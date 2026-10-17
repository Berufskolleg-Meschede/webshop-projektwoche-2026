/**
 * Simulation state engine (TypeScript port of the former AZuBi-ERP implementation).
 * Pure, in-memory and synchronous: one process owns all sessions, so there are no races.
 * Errors carry the HTTP status the REST layer answers with.
 */
import type {
  Batch,
  Order,
  OrderItem,
  ProductionStrategy,
  SessionConfigRequest,
  ShakerVariant,
  SimulationSession,
  SimulationState,
  StationId,
} from '../src/types/simulation.ts';
import { MAX_DAILY_QUANTITY, MAX_ORDER_LINE_QUANTITY } from '../src/types/production.ts';
import {
  getOpenQuantity,
  VARIANTS,
  getShortfall,
  getStoredQuantity,
  getTotalTarget,
  isOrderRetrieved,
  isProductionDone,
  isSupplyDone,
  sum,
} from '../src/types/simulationRules.ts';

export class SimulationError extends Error {
  readonly status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
  }
}

const notFound = () => new SimulationError(404, 'Session nicht gefunden');
const invalid = (detail: string) => new SimulationError(422, detail);

const STATION_IDS: StationId[] = [1, 2, 3, 4, 5];

function zeroed(): Record<ShakerVariant, number> {
  return Object.fromEntries(VARIANTS.map((variant) => [variant, 0])) as Record<
    ShakerVariant,
    number
  >;
}

function defaultStations(): SimulationSession['stations'] {
  return STATION_IDS.map((station_id) => ({
    station_id,
    status: 'IDLE',
    claimed_by: null,
    has_error: false,
  }));
}

function freshState(): Pick<
  SimulationSession,
  | 'state'
  | 'customer_count'
  | 'daily_production_limits'
  | 'daily_orders'
  | 'stations'
  | 'batches'
  | 'replenishment_queue'
  | 'orders'
  | 'stock'
  | 'retrieved'
  | 'shortfall'
  | 'carried_over'
  | 'ended_by_teacher'
> {
  return {
    state: 'CONFIGURING',
    customer_count: 0,
    daily_production_limits: zeroed(),
    daily_orders: zeroed(),
    stations: defaultStations(),
    batches: [],
    replenishment_queue: [],
    orders: [],
    stock: zeroed(),
    retrieved: zeroed(),
    shortfall: zeroed(),
    carried_over: zeroed(),
    ended_by_teacher: false,
  };
}

/** Bookings only make sense while the day runs; claiming/releasing stays possible in every state. */
function assertRunning(session: SimulationSession) {
  if (session.state !== 'RUNNING') {
    throw new SimulationError(409, 'Die Simulation läuft nicht (Status ' + session.state + ')');
  }
}

/** A station may only book while the workflow has released it (ACTIVE). */
function assertStationActive(session: SimulationSession, stationId: number, name: string) {
  if (station(session, stationId)?.status !== 'ACTIVE') {
    throw new SimulationError(409, name + ' ist noch nicht freigegeben');
  }
}

function assertVariant(variant: unknown): asserts variant is ShakerVariant {
  if (!VARIANTS.includes(variant as ShakerVariant)) {
    throw invalid(`Unbekannte Variante: ${String(variant)}`);
  }
}

function station(session: SimulationSession, stationId: number) {
  return session.stations.find((entry) => entry.station_id === stationId);
}

/**
 * Batch/order ids come from per-session sequences that survive `reset`, so an id is never
 * reused within a session: a stale command from an earlier run hits "not found" (404) instead of
 * silently booking something in the new run.
 */
const sequences = new WeakMap<SimulationSession, { batch: number; order: number }>();

function nextId(session: SimulationSession, kind: 'batch' | 'order'): string {
  const counters = sequences.get(session) ?? { batch: 0, order: 0 };
  sequences.set(session, counters);
  counters[kind] += 1;
  return (kind === 'batch' ? 'b' : 'o') + counters[kind];
}

function newBatch(
  session: SimulationSession,
  variant: ShakerVariant,
  quantity: number,
  status: Batch['status'] = 'PRODUCED',
  isReplenishment = false
): Batch {
  const batch: Batch = {
    batch_id: nextId(session, 'batch'),
    variant,
    quantity,
    status,
    is_replenishment: isReplenishment,
    reject_reason: null,
    created_at: new Date().toISOString(),
  };
  session.batches.push(batch);
  return batch;
}

function findBatch(session: SimulationSession, batchId: string): Batch {
  const batch = session.batches.find((entry) => entry.batch_id === batchId);
  if (!batch) throw new SimulationError(404, 'Charge nicht gefunden');
  return batch;
}

/** Station 3 completes once nothing is open and no replenishment is pending. */
function refreshStation3(session: SimulationSession) {
  const station3 = station(session, 3);
  if (station3?.status !== 'ACTIVE') return;
  const nothingOpen = VARIANTS.every((variant) => getOpenQuantity(session, variant) === 0);
  if (nothingOpen && session.replenishment_queue.length === 0) station3.status = 'COMPLETED';
}

/**
 * Pull: once Station 5 has retrieved the whole customer order it is done and production opens
 * (it then produces the retrieved quantity again; storage follows as usual).
 */
function refreshPullRetrieval(session: SimulationSession) {
  if (session.strategy !== 'PULL') return;
  const station5 = station(session, 5);
  if (station5?.status !== 'ACTIVE') return;
  if (!isOrderRetrieved(session)) return;
  station5.status = 'COMPLETED';
  const station3 = station(session, 3);
  if (station3?.status === 'IDLE') station3.status = 'ACTIVE';
}

/** Station 4 follows its inbox: ACTIVE while a batch waits, COMPLETED once the whole target is stored. */
function refreshStation4(session: SimulationSession) {
  const station4 = station(session, 4);
  if (!station4 || session.batches.length === 0) return;
  const waiting = session.batches.some((batch) => batch.status === 'PRODUCED');
  if (waiting) station4.status = 'ACTIVE';
  else if (getStoredQuantity(session) >= getTotalTarget(session)) station4.status = 'COMPLETED';
  else station4.status = 'WAITING';
}

type EngineOptions = {
  /** Hard cap on live sessions; the 4-digit code space only has 9000 codes. */
  maxSessions?: number;
  /** Sessions untouched for this long are purged when a new one is created. */
  sessionTtlMs?: number;
  now?: () => number;
};

const ALLOWED_TRANSITIONS: Record<SimulationState, SimulationState[]> = {
  CONFIGURING: ['RUNNING'],
  RUNNING: ['FINISHED'],
  FINISHED: [],
};

/**
 * The day is over when the customer order is delivered and the production is done too (see
 * `isProductionDone`) – in Push the plan, in Pull the retrieved quantity produced again. The teacher
 * can still end it manually (RUNNING → FINISHED) to cancel the rest.
 */
function refreshFinished(session: SimulationSession) {
  if (session.state !== 'RUNNING') return;
  const demand = sum(Object.values(session.daily_orders));
  if (demand === 0 || !isOrderRetrieved(session)) return;
  if (!isProductionDone(session)) return;
  finishDay(session);
}

/** Both ways to end the day (automatic and manual) leave the stations in the same state. */
function finishDay(session: SimulationSession) {
  session.state = 'FINISHED';
  // Ordered but not retrieved: the shortfall the next day carries over.
  for (const variant of VARIANTS) {
    session.shortfall[variant] = getShortfall(session, variant);
  }
  for (const entry of session.stations) {
    if (entry.station_id >= 3 && entry.status !== 'IDLE') entry.status = 'COMPLETED';
  }
}

export class SimulationEngine {
  private readonly sessions = new Map<string, SimulationSession>();
  private readonly lastTouched = new Map<string, number>();
  private readonly maxSessions: number;
  private readonly sessionTtlMs: number;
  private readonly now: () => number;

  constructor({
    maxSessions = 500,
    sessionTtlMs = 24 * 60 * 60 * 1000,
    now = Date.now,
  }: EngineOptions = {}) {
    this.maxSessions = maxSessions;
    this.sessionTtlMs = sessionTtlMs;
    this.now = now;
  }

  private get(sessionId: string): SimulationSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw notFound();
    this.lastTouched.set(sessionId, this.now());
    return session;
  }

  /** Callers always get a copy so nobody mutates engine state by accident. */
  private snapshot(session: SimulationSession): SimulationSession {
    return structuredClone(session);
  }

  /** Bounded search: a few random tries, then a scan; never an endless loop. */
  private generateId(): string {
    for (let attempt = 0; attempt < 50; attempt++) {
      const candidate = String(1000 + Math.floor(Math.random() * 9000));
      if (!this.sessions.has(candidate)) return candidate;
    }
    for (let code = 1000; code <= 9999; code++) {
      if (!this.sessions.has(String(code))) return String(code);
    }
    throw new SimulationError(503, 'Keine freien Session-Codes mehr');
  }

  private purgeExpired() {
    const cutoff = this.now() - this.sessionTtlMs;
    for (const [id, touched] of this.lastTouched) {
      if (touched < cutoff) {
        this.sessions.delete(id);
        this.lastTouched.delete(id);
      }
    }
  }

  create(strategy: ProductionStrategy = 'PULL'): SimulationSession {
    this.purgeExpired();
    if (this.sessions.size >= this.maxSessions) {
      throw new SimulationError(
        503,
        'Zu viele aktive Sessions – bitte eine alte Session beenden oder später erneut versuchen'
      );
    }
    const session: SimulationSession = {
      session_id: this.generateId(),
      run_id: 1,
      strategy,
      created_at: new Date().toISOString(),
      ...freshState(),
    };
    this.sessions.set(session.session_id, session);
    this.lastTouched.set(session.session_id, this.now());
    return this.snapshot(session);
  }

  read(sessionId: string): SimulationSession {
    return this.snapshot(this.get(sessionId));
  }

  /**
   * Controlled transitions instead of a free assignment. Going back to CONFIGURING is only
   * possible through `reset` (which also starts a new run), so booked work can never be
   * reconfigured away. Repeating the current state is a harmless no-op.
   */
  setState(sessionId: string, state: SimulationState): SimulationSession {
    const session = this.get(sessionId);
    if (session.state !== state) {
      if (!ALLOWED_TRANSITIONS[session.state].includes(state)) {
        throw new SimulationError(409, `Übergang ${session.state} → ${state} ist nicht erlaubt`);
      }
      if (state === 'FINISHED') {
        finishDay(session);
        session.ended_by_teacher = true;
      } else {
        session.state = state;
        if (state === 'RUNNING') {
          const s1 = station(session, 1);
          if (s1 && s1.status !== 'COMPLETED') s1.status = 'ACTIVE';
          const s2 = station(session, 2);
          if (s2 && s2.status !== 'COMPLETED') {
            s2.status = s1?.status === 'COMPLETED' ? 'ACTIVE' : 'IDLE';
          }
        }
      }
    }
    return this.snapshot(session);
  }

  configure(sessionId: string, config: SessionConfigRequest): SimulationSession {
    const session = this.get(sessionId);
    if (session.state !== 'CONFIGURING') {
      throw new SimulationError(409, 'Session kann nur im Status CONFIGURING konfiguriert werden');
    }
    for (const quantities of [config.daily_orders, config.daily_production_limits]) {
      for (const [variant, quantity] of Object.entries(quantities ?? {})) {
        assertVariant(variant);
        if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > MAX_DAILY_QUANTITY) {
          throw invalid(`Menge für ${variant} muss zwischen 0 und ${MAX_DAILY_QUANTITY} liegen`);
        }
      }
    }
    if (config.strategy !== undefined) session.strategy = config.strategy;
    Object.assign(session.daily_orders, config.daily_orders);
    Object.assign(session.daily_production_limits, config.daily_production_limits);
    return this.snapshot(session);
  }

  claim(sessionId: string, studentName: string, stationId: number): SimulationSession {
    const session = this.get(sessionId);
    const target = this.requireStation(session, stationId);
    if (target.claimed_by !== null && target.claimed_by !== studentName) {
      // The conflict detail is the current holder's name (the UI builds the sentence).
      throw new SimulationError(409, target.claimed_by);
    }
    target.claimed_by = studentName;
    return this.snapshot(session);
  }

  release(sessionId: string, stationId: number): SimulationSession {
    const session = this.get(sessionId);
    const target = this.requireStation(session, stationId);
    // Only the holder leaves: the work state stays, so a re-claim (new phone, closed tab) can continue.
    target.claimed_by = null;
    target.has_error = false;
    return this.snapshot(session);
  }

  private requireStation(session: SimulationSession, stationId: number) {
    const found = station(session, stationId);
    if (!found)
      throw new SimulationError(400, 'Ungültige Station-ID (muss zwischen 1 und 5 liegen)');
    return found;
  }

  /**
   * Supply stations 1 and 2; Station 2 unlocks after Station 1 is done. Then Station 3 (Push) or
   * Station 5 (Pull) opens.
   */
  completeSupply(sessionId: string, stationId: number): SimulationSession {
    const session = this.get(sessionId);
    if (stationId !== 1 && stationId !== 2) {
      throw new SimulationError(400, 'Ungültige Station-ID (muss 1 oder 2 sein)');
    }
    const target = this.requireStation(session, stationId);
    // A repeated confirmation (retry after a lost response) must not turn the workflow back –
    // and must succeed in any state, e.g. when the retry arrives after the end of the day.
    if (target.status === 'COMPLETED') return this.snapshot(session);
    assertRunning(session);
    if (stationId === 2) {
      assertStationActive(session, 2, 'Station 2');
    }
    target.status = 'COMPLETED';
    if (stationId === 1) {
      const station2 = this.requireStation(session, 2);
      if (station2.status !== 'COMPLETED') {
        station2.status = 'ACTIVE';
      }
    }
    const supplyDone = isSupplyDone(session);
    if (supplyDone) {
      if (session.strategy === 'PULL') {
        // Pull: the customer order is retrieved first, production opens afterwards.
        this.requireStation(session, 5).status = 'ACTIVE';
      } else {
        // Push: production and retrieval unlock at the same time.
        this.requireStation(session, 3).status = 'ACTIVE';
        this.requireStation(session, 5).status = 'ACTIVE';
      }
    }
    return this.snapshot(session);
  }

  /** A customer order from the simulation webshop (ADR-SIM-03): adds to `daily_orders` and the order log. */
  addOrder(
    sessionId: string,
    customerName: string | null,
    items: { variant: unknown; quantity: unknown }[]
  ): SimulationSession {
    const session = this.get(sessionId);
    if (session.state !== 'CONFIGURING') {
      throw new SimulationError(
        409,
        'Bestellungen können nur im Status CONFIGURING angenommen werden'
      );
    }
    if (items.length === 0) throw invalid('Die Bestellung enthält keine Positionen');

    const lines: OrderItem[] = items.map(({ variant, quantity }) => {
      assertVariant(variant);
      if (
        !Number.isInteger(quantity) ||
        (quantity as number) < 1 ||
        (quantity as number) > MAX_ORDER_LINE_QUANTITY
      ) {
        throw invalid(`Menge für ${variant} muss zwischen 1 und ${MAX_ORDER_LINE_QUANTITY} liegen`);
      }
      return { variant, quantity: quantity as number };
    });

    // Sum duplicate positions first so the cap applies to the aggregate, not to each line.
    const summed: Order['items'] = {};
    for (const { variant, quantity } of lines) summed[variant] = (summed[variant] ?? 0) + quantity;
    for (const [variant, added] of Object.entries(summed) as [ShakerVariant, number][]) {
      if ((session.daily_orders[variant] ?? 0) + added > MAX_DAILY_QUANTITY) {
        throw invalid(
          `Die Tagesbestellung für ${variant} darf ${MAX_DAILY_QUANTITY} nicht übersteigen`
        );
      }
    }
    for (const [variant, added] of Object.entries(summed) as [ShakerVariant, number][]) {
      session.daily_orders[variant] = (session.daily_orders[variant] ?? 0) + added;
    }
    session.orders.push({
      order_id: nextId(session, 'order'),
      source: 'customer',
      customer_name: customerName,
      items: summed,
      created_at: new Date().toISOString(),
    });
    return this.snapshot(session);
  }

  reset(sessionId: string): SimulationSession {
    const session = this.get(sessionId);
    // Workers keep their station: their devices still show "Angemeldet", so freeing the
    // claims here would let a second person take a station that is still in use.
    const claims = new Map(session.stations.map((entry) => [entry.station_id, entry.claimed_by]));
    Object.assign(session, freshState());
    session.run_id += 1;
    for (const entry of session.stations) entry.claimed_by = claims.get(entry.station_id) ?? null;
    return this.snapshot(session);
  }

  /**
   * Multi-day simulation: after a finished day the next one follows with the same setup.
   * The quantity not retrieved (`shortfall`) becomes the pre-filled daily order of the next day.
   * Only the day itself is cleared (customer orders, batches, stock, progress,
   * replenishment, station run states); the people and the settings stay — station claims,
   * participants (`customer_count`), strategy and the production plan. Like `reset` this starts a
   * new run (`run_id`), and batch/order ids keep counting. Only allowed once the day is FINISHED.
   */
  nextDay(sessionId: string): SimulationSession {
    const session = this.get(sessionId);
    if (session.state !== 'FINISHED') {
      throw new SimulationError(
        409,
        'Der nächste Tag ist erst nach einem abgeschlossenen Tag möglich (Status ' +
          session.state +
          ')'
      );
    }
    const claims = new Map(session.stations.map((entry) => [entry.station_id, entry.claimed_by]));
    const { strategy, daily_production_limits, customer_count, shortfall } = session;
    Object.assign(session, freshState());
    Object.assign(session.daily_orders, shortfall);
    Object.assign(session.carried_over, shortfall);
    session.strategy = strategy;
    session.daily_production_limits = daily_production_limits;
    session.customer_count = customer_count;
    session.run_id += 1;
    for (const entry of session.stations) entry.claimed_by = claims.get(entry.station_id) ?? null;
    return this.snapshot(session);
  }

  customerJoin(sessionId: string): SimulationSession {
    const session = this.get(sessionId);
    session.customer_count += 1;
    return this.snapshot(session);
  }

  produceBatch(sessionId: string, variant: unknown, quantity: number): SimulationSession {
    const session = this.get(sessionId);
    assertRunning(session);
    assertStationActive(session, 3, 'Station 3');
    assertVariant(variant);
    const open = getOpenQuantity(session, variant);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > open) {
      throw invalid(`Ungültige Menge ${quantity} für ${variant} (offen: ${open})`);
    }

    // Pay down matching replenishment entries; the batch counts as replenishment if any was hit.
    let remaining = quantity;
    let isReplenishment = false;
    for (const item of [...session.replenishment_queue]) {
      if (remaining === 0) break;
      if (item.variant !== variant) continue;
      isReplenishment = true;
      const used = Math.min(item.quantity, remaining);
      remaining -= used;
      if (used === item.quantity) {
        session.replenishment_queue.splice(session.replenishment_queue.indexOf(item), 1);
      } else {
        item.quantity -= used;
      }
    }

    newBatch(session, variant, quantity, 'PRODUCED', isReplenishment);
    refreshStation3(session);
    refreshStation4(session);
    refreshFinished(session);
    return this.snapshot(session);
  }

  storeBatch(sessionId: string, batchId: string): SimulationSession {
    const session = this.get(sessionId);
    assertRunning(session);
    const batch = findBatch(session, batchId);
    if (batch.status !== 'PRODUCED')
      throw invalid(`Charge ${batchId} ist nicht im Status PRODUCED`);
    batch.status = 'STORED';
    session.stock[batch.variant] = (session.stock[batch.variant] ?? 0) + batch.quantity;
    refreshStation4(session);
    refreshFinished(session);
    return this.snapshot(session);
  }

  /** Station 4 rejects the batch; intact parts are stored as a new batch, the rest returns to Station 3. */
  reportDeviation(
    sessionId: string,
    batchId: string,
    reason: string,
    missingQuantity: number
  ): SimulationSession {
    const session = this.get(sessionId);
    assertRunning(session);
    const batch = findBatch(session, batchId);
    if (batch.status !== 'PRODUCED')
      throw invalid(`Charge ${batchId} ist nicht im Status PRODUCED`);
    if (
      !Number.isInteger(missingQuantity) ||
      missingQuantity <= 0 ||
      missingQuantity > batch.quantity
    ) {
      throw invalid(`Ungültige Fehlmenge ${missingQuantity} (Chargenmenge: ${batch.quantity})`);
    }

    batch.status = 'REJECTED';
    batch.reject_reason = reason;
    session.replenishment_queue.push({ variant: batch.variant, quantity: missingQuantity, reason });

    const intact = batch.quantity - missingQuantity;
    if (intact > 0) {
      newBatch(session, batch.variant, intact, 'STORED', batch.is_replenishment);
      session.stock[batch.variant] = (session.stock[batch.variant] ?? 0) + intact;
    }
    this.requireStation(session, 3).status = 'ACTIVE';
    refreshStation4(session);
    return this.snapshot(session);
  }

  /** Station 5; the session finishes itself once the whole customer order is retrieved. */
  retrieveItem(sessionId: string, variant: unknown, quantity: number): SimulationSession {
    const session = this.get(sessionId);
    assertRunning(session);
    assertStationActive(session, 5, 'Station 5');
    assertVariant(variant);
    const remaining = (session.daily_orders[variant] ?? 0) - (session.retrieved[variant] ?? 0);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > remaining) {
      throw invalid(
        `Ungültige Menge ${quantity} für ${variant} (Rest Auftrag: ${Math.max(remaining, 0)})`
      );
    }

    // The software stock is not a gate: the real stock is physical and Station 5 does not see it.
    // Booking is limited by the remaining customer order only. Stock stays "stored - retrieved"
    // and may go below zero (e.g. Push: delivered before Station 4 booked the storage), so the
    // teacher can read the difference between stock and delivered and it heals once stored.
    session.stock[variant] = (session.stock[variant] ?? 0) - quantity;
    session.retrieved[variant] = (session.retrieved[variant] ?? 0) + quantity;
    refreshPullRetrieval(session);
    refreshStation4(session);
    refreshFinished(session);
    return this.snapshot(session);
  }

  /**
   * Station 5 ends the day: freely once the whole order is retrieved, with shortfalls only when
   * production and storage are finished. The teacher can always end it via `setState`.
   */
  finishDayFromStation5(sessionId: string): SimulationSession {
    const session = this.get(sessionId);
    assertRunning(session);
    assertStationActive(session, 5, 'Station 5');
    if (!isOrderRetrieved(session) && !isProductionDone(session)) {
      throw new SimulationError(
        409,
        'Der Tag kann erst beendet werden, wenn Produktion und Einlagerung abgeschlossen sind'
      );
    }
    finishDay(session);
    return this.snapshot(session);
  }

  clear() {
    this.sessions.clear();
  }
}
