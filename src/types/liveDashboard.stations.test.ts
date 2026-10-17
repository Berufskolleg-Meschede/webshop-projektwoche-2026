import { describe, expect, it } from 'vitest';

import { makeBatch, makeSession, makeStation } from '@/test/fixtures';
import type { StationState } from '@/types/simulation';

import { getLiveStations, getWebshopOrderTotal } from './liveDashboard';
import { hasOpenShortfall } from './production';

function stationsWith(overrides: Record<number, StationState['status']>) {
  return ([1, 2, 3, 4, 5] as const).map((id) =>
    makeStation(id, { status: overrides[id] ?? 'IDLE' })
  );
}

describe('getLiveStations for a finished storage and retrieval', () => {
  it('shows Station 4 as done with the stored share of the target', () => {
    const session = makeSession({
      state: 'RUNNING',
      daily_orders: { 'S-RT': 2 },
      batches: [makeBatch({ status: 'STORED', quantity: 2 })],
      stations: stationsWith({ 4: 'COMPLETED' }),
    });

    const card = getLiveStations(session).find((entry) => entry.nr === 4)!;

    expect(card.tone).toBe('done');
    expect(card.detail).toContain('2 von');
  });

  it('keeps Station 4 locked while it is active but no batch waits', () => {
    const session = makeSession({
      state: 'RUNNING',
      batches: [makeBatch({ status: 'STORED' })],
      stations: stationsWith({ 4: 'ACTIVE' }),
    });

    const card = getLiveStations(session).find((entry) => entry.nr === 4)!;

    expect(card.tone).toBe('locked');
  });

  it('reports Station 5 delivery progress as active while retrieving and done afterwards', () => {
    const active = makeSession({
      daily_orders: { 'S-RT': 4 },
      retrieved: { 'S-RT': 1 },
      stations: stationsWith({ 5: 'ACTIVE' }),
    });
    const done = makeSession({
      daily_orders: { 'S-RT': 4 },
      retrieved: { 'S-RT': 4 },
      stations: stationsWith({ 5: 'COMPLETED' }),
    });

    const activeCard = getLiveStations(active).find((entry) => entry.nr === 5)!;
    const doneCard = getLiveStations(done).find((entry) => entry.nr === 5)!;

    expect(activeCard).toMatchObject({ tone: 'active', detail: '1 von 4 ausgelagert' });
    expect(doneCard).toMatchObject({ tone: 'done', detail: '4 von 4 ausgelagert' });
  });

  it('shows the claiming student as the person of a station', () => {
    const session = makeSession({
      stations: [
        makeStation(1, { claimed_by: 'Mia' }),
        makeStation(2),
        makeStation(3),
        makeStation(4),
        makeStation(5),
      ],
    });

    const cards = getLiveStations(session);

    expect(cards[0].person).toBe('Mia');
    expect(cards[1].person).not.toBe('Mia');
  });
});

describe('getWebshopOrderTotal', () => {
  it('sums all order lines and ignores lines without a quantity', () => {
    const session = makeSession({
      orders: [
        {
          order_id: 'o1',
          source: 'customer',
          customer_name: null,
          items: { 'S-RT': 2, 'P-RT': undefined },
          created_at: '',
        },
        {
          order_id: 'o2',
          source: 'customer',
          customer_name: 'A',
          items: { 'S-RT': 3 },
          created_at: '',
        },
      ],
    });

    expect(getWebshopOrderTotal(session)).toBe(5);
  });

  it('is zero without orders', () => {
    expect(getWebshopOrderTotal(makeSession())).toBe(0);
  });
});

describe('hasOpenShortfall', () => {
  it('is false when the backend sent no shortfall at all', () => {
    const session = makeSession();
    (session as { shortfall?: unknown }).shortfall = undefined;
    expect(hasOpenShortfall(session)).toBe(false);
  });

  it('is false for zero or missing quantities and true for any open piece', () => {
    expect(hasOpenShortfall(makeSession({ shortfall: { 'S-RT': 0, 'P-RT': undefined } }))).toBe(
      false
    );
    expect(hasOpenShortfall(makeSession({ shortfall: { 'S-RT': 0, 'P-RT': 1 } }))).toBe(true);
  });
});
