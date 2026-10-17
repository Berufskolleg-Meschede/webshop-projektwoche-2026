// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';

import type { SimulationSession, StationId } from '../src/types/simulation.ts';
import { SimulationEngine, SimulationError } from './engine.ts';

let engine: SimulationEngine;
let id: string;

beforeEach(() => {
  engine = new SimulationEngine();
  id = engine.create().session_id;
});

function station(session: SimulationSession, stationId: StationId) {
  return session.stations.find((entry) => entry.station_id === stationId)!;
}

function expectError(action: () => unknown, status: number, detail?: string | RegExp) {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(SimulationError);
    expect((error as SimulationError).status).toBe(status);
    if (detail) expect((error as SimulationError).message).toMatch(detail);
    return;
  }
  throw new Error('expected an error');
}

/** Pull session with an order and the supply done: Station 5 is open, production still locked. */
function suppliedPull(orders: Record<string, number> = { 'S-RT': 2 }) {
  engine.configure(id, { daily_orders: orders });
  engine.setState(id, 'RUNNING');
  engine.completeSupply(id, 1);
  return engine.completeSupply(id, 2);
}

/** Pull session ready for Station 3: supply done and the whole order retrieved (#198). */
function readyPull(orders: Record<string, number> = { 'S-RT': 2 }) {
  let session = suppliedPull(orders);
  for (const [variant, quantity] of Object.entries(orders)) {
    if (quantity > 0) session = engine.retrieveItem(id, variant, quantity);
  }
  return session;
}

describe('session lifecycle', () => {
  it('creates a CONFIGURING Pull session with a 4-digit code and empty state', () => {
    const session = engine.read(id);
    expect(session.session_id).toMatch(/^\d{4}$/);
    expect(session).toMatchObject({
      state: 'CONFIGURING',
      strategy: 'PULL',
      customer_count: 0,
      batches: [],
      replenishment_queue: [],
    });
    expect(session.stations).toHaveLength(5);
    expect(session.stations.every((s) => s.status === 'IDLE' && s.claimed_by === null)).toBe(true);
    expect(Object.keys(session.daily_orders)).toHaveLength(6);
    expect(Object.values(session.stock).every((q) => q === 0)).toBe(true);
  });

  it('generates unique codes', () => {
    const ids = new Set(Array.from({ length: 50 }, () => engine.create().session_id));
    expect(ids.size).toBe(50);
  });

  it('answers 404 for unknown sessions on every operation', () => {
    expectError(() => engine.read('0000'), 404, 'Session nicht gefunden');
    expectError(() => engine.setState('0000', 'RUNNING'), 404);
    expectError(() => engine.configure('0000', {}), 404);
    expectError(() => engine.claim('0000', 'a', 1), 404);
    expectError(() => engine.release('0000', 1), 404);
    expectError(() => engine.completeSupply('0000', 1), 404);
    expectError(() => engine.reset('0000'), 404);
    expectError(() => engine.customerJoin('0000'), 404);
    expectError(() => engine.produceBatch('0000', 'S-RT', 1), 404);
    expectError(() => engine.storeBatch('0000', 'b1'), 404);
    expectError(() => engine.reportDeviation('0000', 'b1', 'x', 1), 404);
    expectError(() => engine.retrieveItem('0000', 'S-RT', 1), 404);
  });

  it('returns copies, not live state', () => {
    const copy = engine.read(id);
    copy.state = 'FINISHED';
    expect(engine.read(id).state).toBe('CONFIGURING');
  });

  it('counts joined customers', () => {
    engine.customerJoin(id);
    expect(engine.customerJoin(id).customer_count).toBe(2);
  });

  it('resets orders, batches and stations but keeps the station claims so devices and server stay in sync', () => {
    engine.addOrder(id, 'Mia', [{ variant: 'S-RT', quantity: 1 }]);
    readyPull();
    engine.claim(id, 'Mia', 1);
    engine.claim(id, 'Jan', 3);
    engine.customerJoin(id);
    engine.produceBatch(id, 'S-RT', 1);
    const reset = engine.reset(id);
    expect(reset).toMatchObject({
      state: 'CONFIGURING',
      customer_count: 0,
      batches: [],
      orders: [],
    });
    expect(reset.daily_orders['S-RT']).toBe(0);
    expect(reset.stations.every((s) => s.status === 'IDLE')).toBe(true);
    expect(reset.stations.map((s) => s.claimed_by)).toEqual(['Mia', null, 'Jan', null, null]);
    expectError(() => engine.claim(id, 'Eva', 1), 409, 'Mia'); // still taken after the reset
  });
});

describe('claim and release', () => {
  it('claims, lets the same student re-claim, and answers 409 with the holder', () => {
    expect(station(engine.claim(id, 'Mia', 3), 3).claimed_by).toBe('Mia');
    expect(station(engine.claim(id, 'Mia', 3), 3).claimed_by).toBe('Mia');
    expectError(() => engine.claim(id, 'Jan', 3), 409, 'Mia');
  });

  it('validates the station id', () => {
    expectError(() => engine.claim(id, 'Mia', 6), 400);
    expectError(() => engine.release(id, 0), 400);
  });

  it('keeps the work state when a station is released and re-claimed', () => {
    readyPull();
    engine.claim(id, 'Mia', 3);
    engine.produceBatch(id, 'S-RT', 1);
    engine.claim(id, 'Mia', 4);
    expect(station(engine.read(id), 3).status).toBe('ACTIVE');
    expect(station(engine.read(id), 4).status).toBe('ACTIVE');

    const released = engine.release(id, 3);
    expect(station(released, 3)).toMatchObject({
      claimed_by: null,
      status: 'ACTIVE',
      has_error: false,
    });
    expect(station(engine.release(id, 4), 4).status).toBe('ACTIVE');
    const retaken = engine.claim(id, 'Jan', 3);
    expect(station(retaken, 3)).toMatchObject({ claimed_by: 'Jan', status: 'ACTIVE' });
  });
});

describe('configuration', () => {
  it('updates strategy, orders and plan and keeps untouched variants', () => {
    engine.configure(id, { daily_orders: { 'S-RT': 2 } });
    const session = engine.configure(id, {
      strategy: 'PUSH',
      daily_production_limits: { 'P-SW': 5 },
    });
    expect(session.strategy).toBe('PUSH');
    expect(session.daily_orders['S-RT']).toBe(2);
    expect(session.daily_production_limits['P-SW']).toBe(5);
  });

  it('is locked outside CONFIGURING', () => {
    engine.setState(id, 'RUNNING');
    expectError(() => engine.configure(id, { strategy: 'PUSH' }), 409, /CONFIGURING/);
  });

  it('rejects unknown variants and invalid quantities', () => {
    expectError(
      () => engine.configure(id, { daily_orders: { 'X-YY': 1 } as never }),
      422,
      /Variante/
    );
    expectError(() => engine.configure(id, { daily_orders: { 'S-RT': -1 } }), 422);
    expectError(() => engine.configure(id, { daily_orders: { 'S-RT': 1.5 } }), 422);
  });
});

describe('supply stations', () => {
  it('locks Station 2 until Station 1 is completed (in Pull and Push)', () => {
    engine.setState(id, 'RUNNING');
    expect(station(engine.read(id), 1).status).toBe('ACTIVE');
    expect(station(engine.read(id), 2).status).toBe('IDLE');
    expectError(() => engine.completeSupply(id, 2), 409, /Station 2 ist noch nicht freigegeben/);

    engine.completeSupply(id, 1);
    expect(station(engine.read(id), 1).status).toBe('COMPLETED');
    expect(station(engine.read(id), 2).status).toBe('ACTIVE');
    expect(station(engine.read(id), 3).status).toBe('IDLE');
    expect(station(engine.completeSupply(id, 2), 2).status).toBe('COMPLETED');

    const pushId = engine.create('PUSH').session_id;
    engine.setState(pushId, 'RUNNING');
    expectError(
      () => engine.completeSupply(pushId, 2),
      409,
      /Station 2 ist noch nicht freigegeben/
    );
    engine.completeSupply(pushId, 1);
    expect(station(engine.read(pushId), 2).status).toBe('ACTIVE');
    expect(station(engine.completeSupply(pushId, 2), 2).status).toBe('COMPLETED');
  });
});

describe('production (Station 3)', () => {
  it('creates batches from the order in Pull and from the plan in Push', () => {
    const pull = readyPull({ 'S-RT': 3 });
    expect(pull.batches).toEqual([]);
    const afterPull = engine.produceBatch(id, 'S-RT', 2);
    expect(afterPull.batches[0]).toMatchObject({
      batch_id: 'b1',
      variant: 'S-RT',
      quantity: 2,
      status: 'PRODUCED',
      is_replenishment: false,
    });

    const pushId = engine.create('PUSH').session_id;
    engine.configure(pushId, {
      daily_orders: { 'S-RT': 1 },
      daily_production_limits: { 'S-RT': 4 },
    });
    engine.setState(pushId, 'RUNNING');
    engine.completeSupply(pushId, 1);
    engine.completeSupply(pushId, 2);
    engine.produceBatch(pushId, 'S-RT', 4);
    // Plan reached → Station 3 completed, so further production is no longer released.
    expectError(() => engine.produceBatch(pushId, 'S-RT', 1), 409, /Station 3/);
  });

  it('rejects invalid variants and quantities', () => {
    readyPull();
    expectError(() => engine.produceBatch(id, 'X', 1), 422, /Variante/);
    expectError(() => engine.produceBatch(id, 'S-RT', 0), 422);
    expectError(() => engine.produceBatch(id, 'S-RT', 3), 422, /offen: 2/);
    expectError(() => engine.produceBatch(id, 'S-RT', 1.5), 422);
  });
});

describe('storage (Station 4)', () => {
  it('books produced batches into stock', () => {
    readyPull();
    engine.produceBatch(id, 'S-RT', 2);
    const session = engine.storeBatch(id, 'b1');
    expect(session.batches[0].status).toBe('STORED');
    // stock = stored − retrieved: the order was retrieved before it was produced (Pull, #198)
    expect(session.stock['S-RT']).toBe(0);
  });

  it('rejects unknown and already stored batches', () => {
    readyPull();
    engine.produceBatch(id, 'S-RT', 1);
    engine.storeBatch(id, 'b1');
    expectError(() => engine.storeBatch(id, 'zzz'), 404, 'Charge nicht gefunden');
    expectError(() => engine.storeBatch(id, 'b1'), 422, /PRODUCED/);
  });
});

describe('deviation loopback', () => {
  it('rejects the batch, stores the intact part and queues the rest for replenishment', () => {
    readyPull();
    engine.produceBatch(id, 'S-RT', 2);
    const session = engine.reportDeviation(id, 'b1', 'Kratzer', 1);
    expect(session.batches.map((b) => [b.batch_id, b.status, b.quantity])).toEqual([
      ['b1', 'REJECTED', 2],
      ['b2', 'STORED', 1],
    ]);
    expect(session.batches[0].reject_reason).toBe('Kratzer');
    expect(session.replenishment_queue).toEqual([
      { variant: 'S-RT', quantity: 1, reason: 'Kratzer' },
    ]);
    expect(session.stock['S-RT']).toBe(-1); // 1 stored − 2 retrieved (Pull retrieves first)
    expect(station(session, 3).status).toBe('ACTIVE');
    expect(station(session, 5).status).toBe('COMPLETED');
  });

  it('queues everything when the whole batch is defective', () => {
    readyPull();
    engine.produceBatch(id, 'S-RT', 2);
    const session = engine.reportDeviation(id, 'b1', 'alles kaputt', 2);
    expect(session.batches).toHaveLength(1);
    expect(session.stock['S-RT']).toBe(-2);
  });

  it('validates the report', () => {
    readyPull({ 'S-RT': 3 }); // one piece stays open, so the day is still running after the storage
    engine.produceBatch(id, 'S-RT', 2);
    expectError(() => engine.reportDeviation(id, 'zzz', 'x', 1), 404);
    expectError(() => engine.reportDeviation(id, 'b1', 'x', 0), 422);
    expectError(() => engine.reportDeviation(id, 'b1', 'x', 3), 422, /Chargenmenge: 2/);
    engine.storeBatch(id, 'b1');
    expectError(() => engine.reportDeviation(id, 'b1', 'x', 1), 422, /PRODUCED/);
  });

  it('runs the full loop 5 → 3 → 4 → defect → 3 → 4 and finishes the day', () => {
    readyPull();
    engine.produceBatch(id, 'S-RT', 2);
    engine.reportDeviation(id, 'b1', 'Kratzer', 1);
    const replenishment = engine.produceBatch(id, 'S-RT', 1);
    expect(replenishment.batches.at(-1)).toMatchObject({
      is_replenishment: true,
      status: 'PRODUCED',
    });
    expect(replenishment.replenishment_queue).toEqual([]);
    expect(station(replenishment, 3).status).toBe('COMPLETED');
    const stored = engine.storeBatch(id, replenishment.batches.at(-1)!.batch_id);
    expect(station(stored, 5).status).toBe('COMPLETED');
    expect(stored.stock['S-RT']).toBe(0);
    expect(stored.state).toBe('FINISHED');
  });

  it('keeps Station 3 active until the replenishment queue is empty', () => {
    readyPull({ 'S-RT': 3 });
    engine.produceBatch(id, 'S-RT', 3);
    engine.reportDeviation(id, 'b1', 'x', 2);
    let session = engine.produceBatch(id, 'S-RT', 1);
    expect(session.replenishment_queue).toEqual([{ variant: 'S-RT', quantity: 1, reason: 'x' }]);
    expect(station(session, 3).status).toBe('ACTIVE');
    session = engine.produceBatch(id, 'S-RT', 1);
    expect(session.replenishment_queue).toEqual([]);
    expect(station(session, 3).status).toBe('COMPLETED');
  });
});

describe('retrieval (Station 5)', () => {
  it('Pull: opens after the supply, production stays locked until the whole order is retrieved (#198)', () => {
    const supplied = suppliedPull({ 'S-RT': 2, 'P-SW': 1 });
    expect(station(supplied, 5).status).toBe('ACTIVE');
    expect(station(supplied, 3).status).toBe('IDLE');
    expectError(() => engine.produceBatch(id, 'S-RT', 1), 409, /Station 3/);
    engine.retrieveItem(id, 'S-RT', 2);
    const partly = engine.read(id);
    expect(station(partly, 5).status).toBe('ACTIVE');
    expect(station(partly, 3).status).toBe('IDLE');
    const retrieved = engine.retrieveItem(id, 'P-SW', 1);
    expect(station(retrieved, 5).status).toBe('COMPLETED');
    expect(station(retrieved, 3).status).toBe('ACTIVE');
    expect(retrieved.state).toBe('RUNNING');
  });

  it('moves stock to retrieved and validates quantities', () => {
    suppliedPull({ 'S-RT': 2, 'P-SW': 1 });
    const session = engine.retrieveItem(id, 'S-RT', 1);
    expect(session.stock['S-RT']).toBe(-1);
    expect(session.retrieved['S-RT']).toBe(1);
    expectError(() => engine.retrieveItem(id, 'X', 1), 422, /Variante/);
    expectError(() => engine.retrieveItem(id, 'S-RT', 0), 422);
    expectError(() => engine.retrieveItem(id, 'S-RT', -1), 422);
    expectError(() => engine.retrieveItem(id, 'S-RT', 1.5), 422);
    expectError(() => engine.retrieveItem(id, 'S-RT', Number.NaN), 422);
    // two partial retrievals reach the order, independent of the software stock
    const complete = engine.retrieveItem(id, 'S-RT', 1);
    expect(complete.retrieved['S-RT']).toBe(2);
    expect(complete.stock['S-RT']).toBe(-2);
  });

  it('is limited by the remaining customer order', () => {
    suppliedPull({ 'S-RT': 1 });
    expectError(() => engine.retrieveItem(id, 'S-RT', 2), 422, /Rest Auftrag: 1/);
    expectError(() => engine.retrieveItem(id, 'S-RT', 2), 422, /^((?!Lager).)*$/);
  });

  it('Pull: the day ends only when the retrieved quantity is produced again and stored (#198)', () => {
    readyPull({ 'S-RT': 2, 'P-SW': 1 });
    engine.produceBatch(id, 'S-RT', 2);
    engine.produceBatch(id, 'P-SW', 1);
    engine.storeBatch(id, 'b1');
    expect(engine.read(id).state).toBe('RUNNING'); // one batch still waits for storage
    const finished = engine.storeBatch(id, 'b2');
    expect(finished.state).toBe('FINISHED');
    expect(station(finished, 5).status).toBe('COMPLETED');
    expect(finished.stock['S-RT']).toBe(0);
  });

  it('Push: Station 5 unlocks after the supply and confirms without stock', () => {
    const pushId = engine.create('PUSH').session_id;
    engine.configure(pushId, {
      daily_orders: { 'S-RT': 1 },
      daily_production_limits: { 'S-RT': 2 },
    });
    expect(station(engine.read(pushId), 5).status).toBe('IDLE');
    expect(station(engine.setState(pushId, 'RUNNING'), 5).status).toBe('IDLE');
    engine.completeSupply(pushId, 1);
    expect(station(engine.read(pushId), 5).status).toBe('IDLE');
    engine.completeSupply(pushId, 2);
    expect(station(engine.read(pushId), 3).status).toBe('ACTIVE');
    expect(station(engine.read(pushId), 5).status).toBe('ACTIVE');
    // nothing produced or stored yet: still accepted, the software stock goes below zero
    const early = engine.retrieveItem(pushId, 'S-RT', 1);
    expect(early.retrieved['S-RT']).toBe(1);
    expect(early.stock['S-RT']).toBe(-1);
    expect(early.state).toBe('RUNNING'); // plan still open
    engine.produceBatch(pushId, 'S-RT', 2);
    // storing catches the stock up: stock = stored - retrieved
    const stored = engine.storeBatch(pushId, 'b1');
    expect(stored.stock['S-RT']).toBe(1);
    expect(stored.state).toBe('FINISHED');
  });
});

describe('Push day end (review F01)', () => {
  function pushDay(orders: number, plan: number) {
    const pushId = engine.create('PUSH').session_id;
    engine.configure(pushId, {
      daily_orders: { 'S-RT': orders },
      daily_production_limits: { 'S-RT': plan },
    });
    engine.setState(pushId, 'RUNNING');
    engine.completeSupply(pushId, 1);
    engine.completeSupply(pushId, 2);
    return pushId;
  }

  it('does not end the day when the demand is delivered early but the plan is still open', () => {
    const pushId = pushDay(1, 3);
    engine.produceBatch(pushId, 'S-RT', 1);
    engine.storeBatch(pushId, 'b1');
    const early = engine.retrieveItem(pushId, 'S-RT', 1);
    expect(early.state).toBe('RUNNING');
    expect(station(early, 3).status).toBe('ACTIVE');

    // Production continues until the plan is done; the day ends after the last booking.
    engine.produceBatch(pushId, 'S-RT', 2);
    expect(engine.read(pushId).state).toBe('RUNNING'); // batch still waits for inspection
    const finished = engine.storeBatch(pushId, 'b2');
    expect(finished.state).toBe('FINISHED');
    expect(finished.stations.slice(2).every((s) => s.status === 'COMPLETED')).toBe(true);
  });

  it('waits for a pending replenishment before ending the day', () => {
    const pushId = pushDay(1, 2);
    engine.produceBatch(pushId, 'S-RT', 2);
    engine.reportDeviation(pushId, 'b1', 'Kratzer', 1); // 1 stored, 1 comes back
    engine.retrieveItem(pushId, 'S-RT', 1);
    expect(engine.read(pushId).state).toBe('RUNNING');
    engine.produceBatch(pushId, 'S-RT', 1);
    expect(engine.storeBatch(pushId, 'b3').state).toBe('FINISHED');
  });

  it('runs a Push day with a plan only: production goes to stock, Station 5 stays open for nothing', () => {
    const pushId = pushDay(0, 3);
    const produced = engine.produceBatch(pushId, 'S-RT', 3);
    expect(station(produced, 5).status).toBe('ACTIVE');
    const stored = engine.storeBatch(pushId, 'b1');
    expect(stored.stock['S-RT']).toBe(3);
    expect(stored.state).toBe('RUNNING');
    expectError(() => engine.retrieveItem(pushId, 'S-RT', 1), 422, /Rest Auftrag: 0/);
    expect(engine.read(pushId).stock['S-RT']).toBe(3);
    expect(engine.setState(pushId, 'FINISHED').state).toBe('FINISHED');
  });
});

describe('Push day end – more cases (PR review)', () => {
  it('keeps a Push day running while the plan is below the order (shortfall)', () => {
    const pushId = engine.create('PUSH').session_id;
    engine.configure(pushId, {
      daily_orders: { 'S-RT': 2 },
      daily_production_limits: { 'S-RT': 1 },
    });
    engine.setState(pushId, 'RUNNING');
    engine.completeSupply(pushId, 1);
    engine.completeSupply(pushId, 2);
    engine.produceBatch(pushId, 'S-RT', 1);
    engine.storeBatch(pushId, 'b1');
    const after = engine.retrieveItem(pushId, 'S-RT', 1);
    expect(after.state).toBe('RUNNING'); // 1 of 2 delivered, nothing more can be produced
    expect(engine.setState(pushId, 'FINISHED').state).toBe('FINISHED'); // teacher ends it
  });

  it('lets Station 5 end the day without shortfalls once the order is retrieved', () => {
    const pushId = engine.create('PUSH').session_id;
    engine.configure(pushId, {
      daily_orders: { 'S-RT': 1 },
      daily_production_limits: { 'S-RT': 3 },
    });
    engine.setState(pushId, 'RUNNING');
    expectError(() => engine.finishDayFromStation5(pushId), 409, /noch nicht freigegeben/);
    engine.completeSupply(pushId, 1);
    engine.completeSupply(pushId, 2);
    engine.retrieveItem(pushId, 'S-RT', 1);
    const ended = engine.finishDayFromStation5(pushId); // plan still open: allowed, order is complete
    expect(ended.state).toBe('FINISHED');
    expect(ended.shortfall['S-RT']).toBe(0);
    expectError(() => engine.finishDayFromStation5(pushId), 409, /Die Simulation läuft nicht/);
  });

  it('only lets Station 5 end a short day once production and storage are finished', () => {
    const pushId = engine.create('PUSH').session_id;
    engine.configure(pushId, {
      daily_orders: { 'S-RT': 3 },
      daily_production_limits: { 'S-RT': 2 },
    });
    engine.setState(pushId, 'RUNNING');
    engine.completeSupply(pushId, 1);
    engine.completeSupply(pushId, 2);
    engine.retrieveItem(pushId, 'S-RT', 1);
    expectError(() => engine.finishDayFromStation5(pushId), 409, /Produktion und Einlagerung/);
    engine.produceBatch(pushId, 'S-RT', 2);
    expectError(() => engine.finishDayFromStation5(pushId), 409, /Produktion und Einlagerung/);
    engine.storeBatch(pushId, 'b1');
    const ended = engine.finishDayFromStation5(pushId);
    expect(ended.state).toBe('FINISHED');
    expect(ended.shortfall['S-RT']).toBe(2);
    expect(ended.retrieved['S-RT']).toBe(1);
  });

  it('records the shortfall when the teacher ends the day and clears it for the next day', () => {
    const pushId = engine.create('PUSH').session_id;
    engine.configure(pushId, {
      daily_orders: { 'S-RT': 2, 'S-SI': 1 },
      daily_production_limits: { 'S-RT': 1 },
    });
    engine.setState(pushId, 'RUNNING');
    engine.completeSupply(pushId, 1);
    engine.completeSupply(pushId, 2);
    engine.retrieveItem(pushId, 'S-RT', 1);
    const ended = engine.setState(pushId, 'FINISHED');
    expect(ended.shortfall['S-RT']).toBe(1);
    expect(ended.shortfall['S-SI']).toBe(1);
    const next = engine.nextDay(pushId);
    expect(Object.values(next.shortfall).every((quantity) => quantity === 0)).toBe(true);
  });

  it('puts the stations in the same final state for a manual end', () => {
    readyPull({ 'S-RT': 1 });
    engine.produceBatch(id, 'S-RT', 1);
    const ended = engine.setState(id, 'FINISHED');
    expect(ended.state).toBe('FINISHED');
    expect(station(ended, 3).status).toBe('COMPLETED');
    expect(station(ended, 4).status).toBe('COMPLETED'); // was ACTIVE (batch waiting)
    expect(station(ended, 5).status).toBe('COMPLETED'); // the whole order was retrieved
  });
});

describe('controlled state transitions (review T01)', () => {
  it('allows only the defined transitions and treats a repeat as a no-op', () => {
    expect(engine.setState(id, 'CONFIGURING').state).toBe('CONFIGURING');
    expectError(() => engine.setState(id, 'FINISHED'), 409, /nicht erlaubt/);
    engine.setState(id, 'RUNNING');
    expect(engine.setState(id, 'RUNNING').state).toBe('RUNNING');
    expectError(() => engine.setState(id, 'CONFIGURING'), 409, /nicht erlaubt/);
    engine.setState(id, 'FINISHED');
    expectError(() => engine.setState(id, 'RUNNING'), 409);
    expectError(() => engine.setState(id, 'CONFIGURING'), 409);
  });

  it('cannot reconfigure booked work away: back to CONFIGURING only via reset', () => {
    readyPull({ 'S-RT': 2 });
    engine.produceBatch(id, 'S-RT', 2);
    expectError(() => engine.setState(id, 'CONFIGURING'), 409);
    expect(engine.read(id).daily_orders['S-RT']).toBe(2);
    expect(engine.reset(id).state).toBe('CONFIGURING');
  });
});

describe('run identity (review T02)', () => {
  it('never reuses batch or order ids across a reset; stale commands hit 404', () => {
    readyPull({ 'S-RT': 1 });
    const firstRun = engine.read(id).run_id;
    engine.produceBatch(id, 'S-RT', 1);
    engine.reset(id);
    expect(engine.read(id).run_id).toBe(firstRun + 1);

    engine.configure(id, { daily_orders: { 'P-SW': 1 } });
    engine.addOrder(id, 'Mia', [{ variant: 'P-SW', quantity: 1 }]);
    expect(engine.read(id).orders[0].order_id).toBe('o1'); // first order of the session was never placed
    engine.setState(id, 'RUNNING');
    engine.completeSupply(id, 1);
    engine.completeSupply(id, 2);
    engine.retrieveItem(id, 'P-SW', 2); // Pull retrieves the whole order (config 1 + webshop 1) first, then production opens
    const next = engine.produceBatch(id, 'P-SW', 1);
    expect(next.batches[0].batch_id).toBe('b2'); // b1 belonged to the previous run
    expectError(() => engine.storeBatch(id, 'b1'), 404, 'Charge nicht gefunden');
    expect(engine.read(id).batches[0].status).toBe('PRODUCED'); // untouched
  });
});

describe('idempotent supply confirmation (review T03)', () => {
  it('answers a repeated confirmation as a no-op even after the end of the day', () => {
    readyPull({ 'S-RT': 1 });
    const running = engine.read(id);
    expect(engine.completeSupply(id, 1).stations).toEqual(running.stations);
    expectError(() => engine.completeSupply(id, 3), 400);
    engine.setState(id, 'FINISHED');
    expect(engine.completeSupply(id, 2).state).toBe('FINISHED');
    // a first confirmation is still a booking and needs RUNNING
    const fresh = engine.create().session_id;
    expectError(() => engine.completeSupply(fresh, 1), 409, /läuft nicht/);
  });

  it('does not reopen a finished Station 3 when a supply station confirms again', () => {
    readyPull({ 'S-RT': 1 });
    const done = engine.produceBatch(id, 'S-RT', 1);
    expect(station(done, 3).status).toBe('COMPLETED');
    const repeated = engine.completeSupply(id, 1);
    expect(station(repeated, 3).status).toBe('COMPLETED');
    expect(JSON.stringify(repeated)).toBe(JSON.stringify(done));
  });
});

describe('customer orders (ADR-SIM-03)', () => {
  it('adds to daily_orders, logs the order and keeps the teacher overwrite separate', () => {
    engine.addOrder(id, 'Mia', [
      { variant: 'S-RT', quantity: 2 },
      { variant: 'S-RT', quantity: 1 },
      { variant: 'P-SW', quantity: 4 },
    ]);
    const session = engine.addOrder(id, null, [{ variant: 'S-RT', quantity: 1 }]);
    expect(session.daily_orders['S-RT']).toBe(4);
    expect(session.daily_orders['P-SW']).toBe(4);
    expect(session.orders).toHaveLength(2);
    expect(session.orders[0]).toMatchObject({
      order_id: 'o1',
      source: 'customer',
      customer_name: 'Mia',
      items: { 'S-RT': 3, 'P-SW': 4 },
    });
    expect(session.orders[1].customer_name).toBeNull();

    const overwritten = engine.configure(id, { daily_orders: { 'S-RT': 9 } });
    expect(overwritten.daily_orders['S-RT']).toBe(9);
    expect(overwritten.orders).toHaveLength(2);
  });

  it('validates items and the session state', () => {
    expectError(() => engine.addOrder(id, null, []), 422, /keine Positionen/);
    expectError(() => engine.addOrder(id, null, [{ variant: 'X', quantity: 1 }]), 422, /Variante/);
    expectError(
      () => engine.addOrder(id, null, [{ variant: 'S-RT', quantity: 0 }]),
      422,
      /1 und 99/
    );
    expectError(() => engine.addOrder(id, null, [{ variant: 'S-RT', quantity: 100 }]), 422);
    expectError(() => engine.addOrder(id, null, [{ variant: 'S-RT', quantity: 1.5 }]), 422);
    expectError(() => engine.addOrder(id, null, [{ variant: 'S-RT', quantity: '2' }]), 422);
    expect(engine.read(id).orders).toEqual([]);
    engine.setState(id, 'RUNNING');
    expectError(
      () => engine.addOrder(id, null, [{ variant: 'S-RT', quantity: 1 }]),
      409,
      /CONFIGURING/
    );
    expectError(() => engine.addOrder('0000', null, [{ variant: 'S-RT', quantity: 1 }]), 404);
  });
});

describe('Station 4 status', () => {
  it('is ACTIVE while a batch waits, WAITING in between and COMPLETED when everything is stored', () => {
    readyPull({ 'S-RT': 2 });
    expect(station(engine.read(id), 4).status).toBe('IDLE');
    expect(station(engine.produceBatch(id, 'S-RT', 1), 4).status).toBe('ACTIVE');
    expect(station(engine.storeBatch(id, 'b1'), 4).status).toBe('WAITING');
    engine.produceBatch(id, 'S-RT', 1);
    expect(station(engine.storeBatch(id, 'b2'), 4).status).toBe('COMPLETED');
  });

  it('turns ACTIVE again after a deviation reopens work', () => {
    readyPull({ 'S-RT': 2 });
    engine.produceBatch(id, 'S-RT', 2);
    expect(station(engine.reportDeviation(id, 'b1', 'x', 1), 4).status).toBe('WAITING');
    engine.produceBatch(id, 'S-RT', 1);
    expect(station(engine.read(id), 4).status).toBe('ACTIVE');
  });
});

describe('booking guards (review R2)', () => {
  const bookings: [string, () => unknown][] = [
    ['completeSupply', () => engine.completeSupply(id, 1)],
    ['produceBatch', () => engine.produceBatch(id, 'S-RT', 1)],
    ['storeBatch', () => engine.storeBatch(id, 'b1')],
    ['reportDeviation', () => engine.reportDeviation(id, 'b1', 'x', 1)],
    ['retrieveItem', () => engine.retrieveItem(id, 'S-RT', 1)],
  ];

  it.each(['CONFIGURING', 'FINISHED'] as const)(
    'rejects every booking in %s without changing state',
    (state) => {
      engine.configure(id, { daily_orders: { 'S-RT': 2 } });
      if (state === 'FINISHED') {
        engine.setState(id, 'RUNNING');
        engine.setState(id, 'FINISHED');
      }
      const before = JSON.stringify(engine.read(id));
      for (const [, action] of bookings) expectError(action, 409, /läuft nicht/);
      expect(JSON.stringify(engine.read(id))).toBe(before);
    }
  );

  it('keeps production closed until Station 3 is released', () => {
    engine.configure(id, { daily_orders: { 'S-RT': 2 } });
    engine.setState(id, 'RUNNING');
    expectError(
      () => engine.produceBatch(id, 'S-RT', 1),
      409,
      /Station 3 ist noch nicht freigegeben/
    );
    expect(engine.read(id).batches).toEqual([]);
  });

  it('rejects Pull retrieval before Station 5 is released and leaves quantities untouched', () => {
    engine.configure(id, { daily_orders: { 'S-RT': 2, 'P-SW': 1 } });
    engine.setState(id, 'RUNNING');
    engine.completeSupply(id, 1); // Station 2 still open: Station 5 stays locked
    expect(station(engine.read(id), 5).status).toBe('IDLE');
    expectError(
      () => engine.retrieveItem(id, 'S-RT', 1),
      409,
      /Station 5 ist noch nicht freigegeben/
    );
    const session = engine.read(id);
    expect(session.retrieved['S-RT']).toBe(0);
    expect(session.stock['S-RT']).toBe(0);
  });
});

it('clear() drops all sessions', () => {
  engine.clear();
  expectError(() => engine.read(id), 404);
});

describe('session limits (review B01)', () => {
  it('caps the number of live sessions with a controlled 503', () => {
    const small = new SimulationEngine({ maxSessions: 3 });
    small.create();
    small.create();
    small.create();
    expectError(() => small.create(), 503, /Zu viele aktive Sessions/);
  });

  it('purges sessions that were not touched within the TTL when a new one is created', () => {
    let now = 1_000_000;
    const timed = new SimulationEngine({ maxSessions: 2, sessionTtlMs: 1000, now: () => now });
    const old = timed.create().session_id;
    now += 500;
    const fresh = timed.create().session_id;
    now += 700; // old: 1200 ms idle (expired), fresh: 700 ms idle
    timed.read(fresh); // touching keeps a session alive
    now += 400; // old: 1600 ms, fresh: 400 ms
    timed.create();
    expectError(() => timed.read(old), 404);
    expect(timed.read(fresh).session_id).toBe(fresh);
  });

  it('never loops endlessly when the 4-digit code space is exhausted', () => {
    const full = new SimulationEngine({ maxSessions: 10_000 });
    for (let i = 0; i < 9000; i++) full.create(); // every code 1000..9999 is taken
    const started = Date.now();
    expectError(() => full.create(), 503, /Keine freien Session-Codes/);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe('quantity limits (review B04)', () => {
  it('rejects unsafe or oversized quantities in the configuration', () => {
    expectError(() => engine.configure(id, { daily_orders: { 'S-RT': 1e20 } }), 422);
    expectError(() => engine.configure(id, { daily_orders: { 'S-RT': 1000 } }), 422, /0 und 999/);
    expectError(() => engine.configure(id, { daily_production_limits: { 'P-SW': 2 ** 53 } }), 422);
    expect(engine.configure(id, { daily_orders: { 'S-RT': 999 } }).daily_orders['S-RT']).toBe(999);
  });

  it('applies the cap to the summed customer orders, including duplicate positions', () => {
    engine.addOrder(id, 'A', [{ variant: 'S-RT', quantity: 99 }]);
    engine.configure(id, { daily_orders: { 'S-RT': 950 } });
    expectError(
      () =>
        engine.addOrder(id, 'B', [
          { variant: 'S-RT', quantity: 30 },
          { variant: 'S-RT', quantity: 30 },
        ]),
      422,
      /999/
    );
    expect(engine.read(id).daily_orders['S-RT']).toBe(950); // nothing was added
  });
});

describe('ended_by_teacher (#246)', () => {
  function runningPush() {
    const pushId = engine.create('PUSH').session_id;
    engine.configure(pushId, {
      daily_orders: { 'S-RT': 1 },
      daily_production_limits: { 'S-RT': 3 },
    });
    engine.setState(pushId, 'RUNNING');
    return pushId;
  }

  it('is false in a fresh session', () => {
    expect(engine.read(id).ended_by_teacher).toBe(false);
  });

  it('is set when the teacher ends the running day by hand', () => {
    const pushId = runningPush();
    expect(engine.read(pushId).ended_by_teacher).toBe(false);
    expect(engine.setState(pushId, 'FINISHED').ended_by_teacher).toBe(true);
  });

  it('stays false when Station 5 ends the day', () => {
    const pushId = runningPush();
    engine.completeSupply(pushId, 1);
    engine.completeSupply(pushId, 2);
    engine.retrieveItem(pushId, 'S-RT', 1);
    const ended = engine.finishDayFromStation5(pushId);
    expect(ended.state).toBe('FINISHED');
    expect(ended.ended_by_teacher).toBe(false);
  });

  it('stays false when the day ends automatically', () => {
    readyPull({ 'S-RT': 1 });
    engine.produceBatch(id, 'S-RT', 1);
    const finished = engine.storeBatch(id, 'b1');
    expect(finished.state).toBe('FINISHED');
    expect(finished.ended_by_teacher).toBe(false);
  });

  it('is cleared by nextDay', () => {
    const pushId = runningPush();
    engine.setState(pushId, 'FINISHED');
    expect(engine.nextDay(pushId).ended_by_teacher).toBe(false);
  });
});

describe('next day (multi-day simulation, #124)', () => {
  /** A finished Push day: customers joined, two stations claimed, a plan above the order. */
  function finishedPushDay() {
    const pushId = engine.create('PUSH').session_id;
    engine.claim(pushId, 'Mia', 1);
    engine.claim(pushId, 'Jan', 4);
    engine.customerJoin(pushId);
    engine.customerJoin(pushId);
    engine.addOrder(pushId, 'Anna', [{ variant: 'S-RT', quantity: 1 }]);
    engine.configure(pushId, {
      daily_orders: { 'S-RT': 1 },
      daily_production_limits: { 'S-RT': 1, 'P-SW': 0 },
    });
    engine.setState(pushId, 'RUNNING');
    engine.completeSupply(pushId, 1);
    engine.completeSupply(pushId, 2);
    engine.produceBatch(pushId, 'S-RT', 1);
    engine.storeBatch(pushId, 'b1');
    expect(engine.retrieveItem(pushId, 'S-RT', 1).state).toBe('FINISHED');
    return pushId;
  }

  it('is only allowed once the day is FINISHED (409 otherwise)', () => {
    expectError(() => engine.nextDay(id), 409, /CONFIGURING/);
    engine.configure(id, { daily_orders: { 'S-RT': 1 } });
    engine.setState(id, 'RUNNING');
    expectError(() => engine.nextDay(id), 409, /RUNNING/);
    expectError(() => engine.nextDay('0000'), 404);
  });

  it('starts the next day in CONFIGURING with a new run and keeps the session', () => {
    const pushId = finishedPushDay();
    const before = engine.read(pushId);
    const next = engine.nextDay(pushId);
    expect(next.state).toBe('CONFIGURING');
    expect(next.run_id).toBe(before.run_id + 1);
    expect(next.session_id).toBe(pushId);
  });

  it('clears the day: orders, daily sum, batches, stock, progress, replenishment, station states', () => {
    const pushId = finishedPushDay();
    expect(engine.read(pushId).batches.length).toBeGreaterThan(0);
    const next = engine.nextDay(pushId);
    expect(next.orders).toEqual([]);
    expect(next.batches).toEqual([]);
    expect(next.replenishment_queue).toEqual([]);
    expect(Object.values(next.stock).every((quantity) => quantity === 0)).toBe(true);
    expect(Object.values(next.retrieved).every((quantity) => quantity === 0)).toBe(true);
    expect(next.stations.every((entry) => entry.status === 'IDLE' && !entry.has_error)).toBe(true);
  });

  describe('carry-over of the shortfall', () => {
    function endPushDay(orders: Record<string, number>, retrieve: Record<string, number>) {
      const pushId = engine.create('PUSH').session_id;
      engine.configure(pushId, {
        daily_orders: orders,
        daily_production_limits: { 'S-RT': 2, 'S-SI': 1 },
      });
      engine.setState(pushId, 'RUNNING');
      engine.completeSupply(pushId, 1);
      engine.completeSupply(pushId, 2);
      for (const [variant, quantity] of Object.entries(retrieve)) {
        const batch = engine.produceBatch(pushId, variant, quantity).batches.at(-1)!;
        engine.storeBatch(pushId, batch.batch_id);
        engine.retrieveItem(pushId, variant, quantity);
      }
      engine.setState(pushId, 'FINISHED');
      return pushId;
    }

    it('carries the whole order when nothing was retrieved', () => {
      const pushId = endPushDay({ 'S-RT': 2, 'S-SI': 1 }, {});
      const next = engine.nextDay(pushId);
      expect(next.daily_orders['S-RT']).toBe(2);
      expect(next.daily_orders['S-SI']).toBe(1);
      expect(next.orders).toEqual([]);
    });

    it('carries only the part that was not retrieved', () => {
      const pushId = endPushDay({ 'S-RT': 2, 'S-SI': 1 }, { 'S-RT': 1 });
      const next = engine.nextDay(pushId);
      expect(next.daily_orders['S-RT']).toBe(1);
      expect(next.daily_orders['S-SI']).toBe(1);
      const configured = engine.configure(pushId, {
        daily_orders: { 'S-RT': 3 },
        daily_production_limits: { 'S-RT': 3 },
      });
      expect(configured.daily_orders['S-RT']).toBe(3); // the teacher can overwrite the carried order
    });

    it('records the carried quantity and clears it on reset', () => {
      const pushId = endPushDay({ 'S-RT': 2, 'S-SI': 1 }, { 'S-RT': 1 });
      const next = engine.nextDay(pushId);
      expect(next.carried_over['S-RT']).toBe(1);
      expect(next.carried_over['S-SI']).toBe(1);
      const reset = engine.reset(pushId);
      expect(Object.values(reset.carried_over).every((quantity) => quantity === 0)).toBe(true);
    });

    it('starts with an empty order when everything was retrieved', () => {
      const pushId = endPushDay({ 'S-RT': 1 }, { 'S-RT': 1 });
      const next = engine.nextDay(pushId);
      expect(Object.values(next.daily_orders).every((quantity) => quantity === 0)).toBe(true);
    });
  });

  it('keeps claims, participants, strategy and the production plan', () => {
    const pushId = finishedPushDay();
    const next = engine.nextDay(pushId);
    expect(station(next, 1).claimed_by).toBe('Mia');
    expect(station(next, 4).claimed_by).toBe('Jan');
    expect(station(next, 2).claimed_by).toBeNull();
    expect(next.customer_count).toBe(2);
    expect(next.strategy).toBe('PUSH');
    expect(next.daily_production_limits['S-RT']).toBe(1);
  });

  it('can be configured and run again, and ids keep counting across days', () => {
    const pushId = finishedPushDay();
    engine.nextDay(pushId);
    engine.configure(pushId, {
      daily_orders: { 'S-RT': 1 },
      daily_production_limits: { 'S-RT': 1 },
    });
    engine.setState(pushId, 'RUNNING');
    engine.completeSupply(pushId, 1);
    engine.completeSupply(pushId, 2);
    const batch = engine.produceBatch(pushId, 'S-RT', 1).batches[0];
    expect(batch.batch_id).toBe('b2');
    engine.storeBatch(pushId, batch.batch_id);
    expect(engine.retrieveItem(pushId, 'S-RT', 1).state).toBe('FINISHED');
    expect(engine.nextDay(pushId).run_id).toBe(3);
  });
});
