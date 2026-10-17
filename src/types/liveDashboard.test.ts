import { makeSession } from '@/test/fixtures';
import type { Batch, SimulationSession, StationId, StationStatus } from '@/types/simulation';

import {
  STRATEGY_LABEL,
  getLiveStations,
  getOrderProgress,
  getWebshopOrderTotal,
} from './liveDashboard';

function batch(overrides: Partial<Batch>): Batch {
  return {
    batch_id: 'b1',
    variant: 'S-RT',
    quantity: 2,
    status: 'PRODUCED',
    is_replenishment: false,
    reject_reason: null,
    created_at: '2026-10-14T08:00:00Z',
    ...overrides,
  };
}

function withStation(
  session: SimulationSession,
  id: StationId,
  status: StationStatus,
  claimedBy: string | null = null
): SimulationSession {
  return {
    ...session,
    stations: session.stations.map((s) =>
      s.station_id === id ? { ...s, status, claimed_by: claimedBy } : s
    ),
  };
}

describe('getOrderProgress', () => {
  it('counts ordered, produced, stored and delivered per variant and in total', () => {
    const session = makeSession({
      state: 'RUNNING',
      daily_orders: { 'S-RT': 4, 'P-SW': 3 },
      batches: [
        batch({ batch_id: 'a', quantity: 3, status: 'STORED' }),
        batch({ batch_id: 'b', quantity: 1, status: 'PRODUCED' }),
        batch({ batch_id: 'c', quantity: 5, status: 'REJECTED' }),
      ],
      retrieved: { 'S-RT': 2 },
    });
    const progress = getOrderProgress(session);
    expect(progress.ordered).toBe(7);
    expect(progress.totals).toEqual([
      { key: 'produced', label: 'Produziert', value: 4 },
      { key: 'stored', label: 'Eingelagert', value: 3 },
      { key: 'delivered', label: 'Ausgelagert', value: 2 },
    ]);
    expect(progress.rows).toEqual([
      { variant: 'S-RT', ordered: 4, produced: 4, stored: 3, out: 2 },
      {
        variant: 'P-SW',
        ordered: 3,
        produced: 0,
        stored: 0,
        out: 0,
      },
    ]);
  });

  it('also lists variants without order that already have activity (Push)', () => {
    const session = makeSession({
      strategy: 'PUSH',
      daily_production_limits: { 'P-RT': 2 },
      batches: [batch({ variant: 'P-RT', quantity: 2 })],
    });
    expect(getOrderProgress(session).rows.map((row) => row.variant)).toEqual(['P-RT']);
  });

  it('is empty without orders', () => {
    const progress = getOrderProgress(makeSession());
    expect(progress.ordered).toBe(0);
    expect(progress.rows).toEqual([]);
  });
});

describe('getLiveStations', () => {
  const orders = { 'S-RT': 4, 'P-SW': 6 };

  it('describes supply stations as active until confirmed, then as done', () => {
    let session = makeSession({ state: 'RUNNING', daily_orders: orders });
    session = withStation(session, 1, 'IDLE', 'Lena');
    const [s1, s2] = getLiveStations(session);
    expect(s1).toMatchObject({
      nr: 1,
      name: 'Zulieferung Deckel',
      badge: 'Aktiv',
      tone: 'active',
      person: 'Lena',
      detail: 'Blau 4 · Grün 6 erwartet',
    });
    expect(s2).toMatchObject({ badge: 'Aktiv', person: 'Nicht besetzt' });

    session = withStation(session, 2, 'COMPLETED', 'Elias');
    const done = getLiveStations(session)[1];
    expect(done).toMatchObject({
      badge: 'Fertig',
      tone: 'done',
      detail: 'Rot 4 · Silber 0 · Schwarz 6 bestätigt',
    });
  });

  it('shows production progress and waits for the supply first', () => {
    let session = makeSession({
      state: 'RUNNING',
      daily_orders: orders,
      batches: [batch({ quantity: 3, status: 'STORED' }), batch({ batch_id: 'b2', quantity: 1 })],
    });
    expect(getLiveStations(session)[2]).toMatchObject({
      badge: 'Gesperrt',
      tone: 'locked',
      detail: 'Wartet auf die Zulieferung',
    });
    session = withStation(session, 3, 'ACTIVE', 'Jonas');
    expect(getLiveStations(session)[2]).toMatchObject({
      badge: 'Aktiv',
      tone: 'active',
      detail: '4 von 10 gesendet · 6 offen',
    });
    session = withStation(session, 3, 'COMPLETED');
    expect(getLiveStations(session)[2]).toMatchObject({ badge: 'Fertig', tone: 'done' });
  });

  it('names the batch Station 4 is inspecting', () => {
    let session = makeSession({
      state: 'RUNNING',
      daily_orders: orders,
      batches: [
        batch({ batch_id: 'a', quantity: 4, status: 'STORED' }),
        batch({ batch_id: 'b', variant: 'S-SI', quantity: 2, status: 'PRODUCED' }),
      ],
    });
    session = withStation(session, 4, 'ACTIVE', 'Mia');
    expect(getLiveStations(session)[3]).toMatchObject({
      badge: 'Prüft Charge 2',
      tone: 'active',
      detail: '2× Silberner Salzstreuer warten auf Bestätigung',
      person: 'Mia',
    });
    session = withStation(session, 4, 'WAITING');
    session = { ...session, batches: [session.batches[0]] };
    expect(getLiveStations(session)[3]).toMatchObject({
      badge: 'Gesperrt',
      tone: 'locked',
      detail: 'Wartet auf die nächste Charge',
    });
  });

  it.each(['PULL', 'PUSH'] as const)(
    'locks Station 5 until the supply is done (%s), then shows deliveries',
    (strategy) => {
      let session = makeSession({ state: 'RUNNING', strategy, daily_orders: orders });
      expect(getLiveStations(session)[4]).toMatchObject({
        badge: 'Gesperrt',
        tone: 'locked',
        detail: 'Wartet auf die Zulieferung',
      });
      session = withStation({ ...session, retrieved: { 'S-RT': 3 } }, 5, 'ACTIVE', 'Noah');
      expect(getLiveStations(session)[4]).toMatchObject({
        badge: 'Aktiv',
        tone: 'active',
        detail: '3 von 10 ausgelagert',
        person: 'Noah',
      });
    }
  );
});

describe('getWebshopOrderTotal', () => {
  it('sums the pieces of all customer orders', () => {
    const order = (items: Record<string, number>) => ({ ...items }) as never;
    const session = makeSession({
      orders: [
        { items: order({ 'S-RT': 3, 'P-SI': 2 }) },
        { items: order({ 'S-RT': 5 }) },
      ] as never,
    });
    expect(getWebshopOrderTotal(session)).toBe(10);
    expect(getWebshopOrderTotal(makeSession())).toBe(0);
  });
});

describe('STRATEGY_LABEL', () => {
  it('maps each strategy to its badge text', () => {
    expect(STRATEGY_LABEL.PUSH).toBe('Push');
    expect(STRATEGY_LABEL.PULL).toBe('Pull');
  });
});
