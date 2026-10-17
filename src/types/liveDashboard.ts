import type {
  ProductionStrategy,
  ShakerVariant,
  SimulationSession,
  StationState,
} from './simulation';
import { getVariantName } from './simulationCatalog';
import { getHousingSupply, getLidSupply } from './materialSupply';
import { STATION_NAMES, VARIANTS, getStorageProgress, sum } from './production';

type OrderProgressRow = {
  variant: ShakerVariant;
  ordered: number;
  produced: number;
  stored: number;
  out: number;
};

export type OrderProgress = {
  ordered: number;
  totals: { key: 'produced' | 'stored' | 'delivered'; label: string; value: number }[];
  rows: OrderProgressRow[];
};

/** Live numbers of the day, all derived from the polled session (rejected batches never count). */
export function getOrderProgress(session: SimulationSession): OrderProgress {
  const rows = VARIANTS.map((variant) => {
    const kept = session.batches.filter(
      (batch) => batch.variant === variant && batch.status !== 'REJECTED'
    );
    return {
      variant,
      ordered: session.daily_orders[variant] ?? 0,
      produced: sum(kept.map((batch) => batch.quantity)),
      stored: sum(kept.filter((batch) => batch.status === 'STORED').map((batch) => batch.quantity)),
      out: session.retrieved[variant] ?? 0,
    };
  }).filter((row) => row.ordered + row.produced + row.stored + row.out > 0);
  const total = (pick: (row: OrderProgressRow) => number) => sum(rows.map(pick));
  return {
    ordered: total((row) => row.ordered),
    totals: [
      { key: 'produced', label: 'Produziert', value: total((row) => row.produced) },
      { key: 'stored', label: 'Eingelagert', value: total((row) => row.stored) },
      { key: 'delivered', label: 'Ausgelagert', value: total((row) => row.out) },
    ],
    rows,
  };
}

/** Badge text of the chosen production strategy. */
export const STRATEGY_LABEL: Record<ProductionStrategy, string> = { PUSH: 'Push', PULL: 'Pull' };

/** Total pieces over all customer orders of the day (webshop orders). */
export function getWebshopOrderTotal(session: SimulationSession): number {
  return sum(
    session.orders.flatMap((order) => Object.values(order.items).map((quantity) => quantity ?? 0))
  );
}

export type StationTone = 'done' | 'active' | 'locked';

export type LiveStation = {
  nr: number;
  name: string;
  badge: string;
  tone: StationTone;
  detail: string;
  person: string;
};

function describeSupply(session: SimulationSession, nr: 1 | 2, done: boolean): string {
  const items = nr === 1 ? getLidSupply(session) : getHousingSupply(session);
  const parts = items.map((item) => `${item.colour} ${item.quantity}`);
  return `${parts.join(' · ')} ${done ? 'bestätigt' : 'erwartet'}`;
}

function describeStation(
  session: SimulationSession,
  station: StationState
): Pick<LiveStation, 'badge' | 'tone' | 'detail'> {
  const { status } = station;
  const done = status === 'COMPLETED';
  const nr = station.station_id;

  if (nr === 1 || nr === 2) {
    return {
      // Mockup shows only Fertig/Aktiv/Prüft Charge/Gesperrt: unconfirmed supply can act, so Aktiv.
      badge: done ? 'Fertig' : 'Aktiv',
      tone: done ? 'done' : 'active',
      detail: describeSupply(session, nr, done),
    };
  }

  const { stored, target } = getStorageProgress(session);

  if (nr === 3) {
    const sent = sum(
      session.batches.filter((batch) => batch.status !== 'REJECTED').map((batch) => batch.quantity)
    );
    if (done) return { badge: 'Fertig', tone: 'done', detail: `${sent} von ${target} gesendet` };
    if (status === 'ACTIVE') {
      return {
        badge: 'Aktiv',
        tone: 'active',
        detail: `${sent} von ${target} gesendet · ${Math.max(target - sent, 0)} offen`,
      };
    }
    // Cannot act before the supply is confirmed: Gesperrt.
    return { badge: 'Gesperrt', tone: 'locked', detail: 'Wartet auf die Zulieferung' };
  }

  if (nr === 4) {
    if (done)
      return { badge: 'Fertig', tone: 'done', detail: `${stored} von ${target} eingelagert` };
    const waitingIndex = session.batches.findIndex((batch) => batch.status === 'PRODUCED');
    if (status === 'ACTIVE' && waitingIndex >= 0) {
      const waiting = session.batches[waitingIndex];
      return {
        badge: `Prüft Charge ${waitingIndex + 1}`,
        tone: 'active',
        detail: `${waiting.quantity}× ${getVariantName(waiting.variant)} warten auf Bestätigung`,
      };
    }
    // No batch to inspect, cannot act yet: Gesperrt.
    return { badge: 'Gesperrt', tone: 'locked', detail: 'Wartet auf die nächste Charge' };
  }

  const demand = sum(VARIANTS.map((variant) => session.daily_orders[variant] ?? 0));
  const delivered = sum(VARIANTS.map((variant) => session.retrieved[variant] ?? 0));
  if (status === 'IDLE') {
    return {
      badge: 'Gesperrt',
      tone: 'locked',
      detail: 'Wartet auf die Zulieferung',
    };
  }
  return {
    badge: done ? 'Fertig' : 'Aktiv',
    tone: done ? 'done' : 'active',
    detail: `${delivered} von ${demand} ausgelagert`,
  };
}

/** One card per station for the teacher's live overview (mockup "Stationen"). */
export function getLiveStations(session: SimulationSession): LiveStation[] {
  return session.stations.map((station) => ({
    nr: station.station_id,
    name: STATION_NAMES[station.station_id],
    person: station.claimed_by ?? 'Nicht besetzt',
    ...describeStation(session, station),
  }));
}
