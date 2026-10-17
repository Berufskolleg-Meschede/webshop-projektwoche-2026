import { makeBatch, makeSession } from '@/test/fixtures';
import type { Batch } from '@/types/simulation';

import {
  getProductionProgress,
  getTargets,
  getBatchStorageOutlook,
  getStorageProgress,
  isPushPlanDone,
  getRetrievalProgress,
  getSessionSummary,
  isProductionAndStorageFinished,
  hasOpenShortfall,
  isSupplyDone,
  validateMissingQuantity,
  validateBatchQuantity,
} from './production';

const finished = makeSession({
  state: 'FINISHED',
  daily_orders: { 'S-RT': 3, 'P-SW': 1 },
  retrieved: { 'S-RT': 3, 'P-SW': 1 },
  batches: [
    makeBatch({ quantity: 2, status: 'STORED' }),
    makeBatch({ batch_id: 'r', quantity: 1, status: 'STORED', is_replenishment: true }),
    makeBatch({ batch_id: 'x', quantity: 5, status: 'REJECTED' }),
    makeBatch({ batch_id: 'p', variant: 'P-SW', quantity: 1, status: 'PRODUCED' }),
  ],
});

describe('production helpers', () => {
  it('uses the order in Pull and the plan in Push', () => {
    const base = { daily_orders: { 'S-RT': 3 }, daily_production_limits: { 'S-RT': 9 } };
    expect(getTargets(makeSession({ ...base, strategy: 'PULL' }))).toEqual({ 'S-RT': 3 });
    expect(getTargets(makeSession({ ...base, strategy: 'PUSH' }))).toEqual({ 'S-RT': 9 });
  });

  it('only lists variants with a target and derives open amounts and status', () => {
    const session = makeSession({
      daily_orders: { 'S-RT': 5, 'P-SW': 2, 'S-SI': 1 },
      batches: [
        makeBatch({ variant: 'S-RT', quantity: 2 }),
        makeBatch({ variant: 'P-SW', quantity: 2, status: 'STORED' }),
        makeBatch({ variant: 'S-SI', quantity: 1, status: 'REJECTED' }),
      ],
    });
    expect(getProductionProgress(session)).toEqual([
      { variant: 'S-RT', target: 5, produced: 2, open: 3, status: 'IN_PRODUCTION' },
      { variant: 'S-SI', target: 1, produced: 0, open: 1, status: 'OPEN' },
      { variant: 'P-SW', target: 2, produced: 2, open: 0, status: 'DONE' },
    ]);
  });

  it('never reports a negative open amount', () => {
    const session = makeSession({
      daily_orders: { 'S-RT': 1 },
      batches: [makeBatch({ quantity: 3 })],
    });
    expect(getProductionProgress(session)[0].open).toBe(0);
  });

  it('sums stored pieces against the whole order', () => {
    const session = makeSession({
      daily_orders: { 'S-RT': 3, 'P-SW': 2 },
      batches: [
        makeBatch({ quantity: 2, status: 'STORED' }),
        makeBatch({ batch_id: 'c', quantity: 1, status: 'PRODUCED' }),
        makeBatch({ batch_id: 'd', quantity: 1, status: 'REJECTED' }),
      ],
    });
    expect(getStorageProgress(session)).toEqual({ stored: 2, target: 5 });
  });

  it('shows what a batch would store and what is still missing per variant', () => {
    const session = makeSession({
      daily_orders: { 'S-SI': 2, 'P-RT': 2, 'P-SW': 3 },
      batches: [
        makeBatch({ batch_id: 'a', variant: 'S-SI', quantity: 2, status: 'STORED' }),
        makeBatch({ batch_id: 'b', variant: 'P-RT', quantity: 1, status: 'PRODUCED' }),
        makeBatch({ batch_id: 'c', variant: 'P-SW', quantity: 1, status: 'REJECTED' }),
      ],
    });
    expect(getBatchStorageOutlook(session, session.batches[1])).toEqual({
      stored: 2,
      withBatch: 3,
      target: 7,
      missing: [
        { variant: 'P-RT', quantity: 1 },
        { variant: 'P-SW', quantity: 3 },
      ],
    });
  });

  it('reports nothing missing when the batch completes the order', () => {
    const session = makeSession({
      daily_orders: { 'S-RT': 2 },
      batches: [makeBatch({ quantity: 2 })],
    });
    expect(getBatchStorageOutlook(session, session.batches[0]).missing).toEqual([]);
  });

  it('validates the reported missing quantity', () => {
    expect(validateMissingQuantity(1, 2)).toBeNull();
    expect(validateMissingQuantity(2, 2)).toBeNull();
    expect(validateMissingQuantity(0, 2)).toMatch(/ganze Zahl/);
    expect(validateMissingQuantity(3, 2)).toBe('Die Charge hat nur 2 Stück.');
  });

  it('validates batch quantities', () => {
    expect(validateBatchQuantity(2, 5)).toBeNull();
    expect(validateBatchQuantity(5, 5)).toBeNull();
    expect(validateBatchQuantity(0, 5)).toMatch(/ganze Zahl/);
    expect(validateBatchQuantity(1.5, 5)).toMatch(/ganze Zahl/);
    expect(validateBatchQuantity(NaN, 5)).toMatch(/ganze Zahl/);
    expect(validateBatchQuantity(6, 5)).toBe('Es sind nur noch 5 Stück offen.');
  });
});

describe('isPushPlanDone', () => {
  const plan = { 'S-RT': 2, 'P-SW': 3 };

  it('is true when every planned variant is produced', () => {
    const session = makeSession({
      strategy: 'PUSH',
      daily_production_limits: plan,
      batches: [
        makeBatch({ variant: 'S-RT', quantity: 2 }),
        makeBatch({ variant: 'P-SW', quantity: 4 }),
      ],
    });
    expect(isPushPlanDone(session)).toBe(true);
  });

  it('is false while a variant is still open', () => {
    const session = makeSession({
      strategy: 'PUSH',
      daily_production_limits: plan,
      batches: [makeBatch({ variant: 'S-RT', quantity: 2 })],
    });
    expect(isPushPlanDone(session)).toBe(false);
  });

  it('ignores rejected batches', () => {
    const session = makeSession({
      strategy: 'PUSH',
      daily_production_limits: { 'S-RT': 2 },
      batches: [makeBatch({ variant: 'S-RT', quantity: 2, status: 'REJECTED' })],
    });
    expect(isPushPlanDone(session)).toBe(false);
  });

  it('is false without a plan', () => {
    expect(isPushPlanDone(makeSession({ strategy: 'PUSH' }))).toBe(false);
  });

  it('is false for Pull', () => {
    const session = makeSession({
      strategy: 'PULL',
      daily_orders: { 'S-RT': 2 },
      daily_production_limits: { 'S-RT': 2 },
      batches: [makeBatch({ variant: 'S-RT', quantity: 2 })],
    });
    expect(isPushPlanDone(session)).toBe(false);
  });
});

describe('session summary', () => {
  it('computes the KPIs ignoring rejected batches', () => {
    expect(getSessionSummary(finished)).toEqual({
      produced: 4,
      replenishmentBatches: 1,
      replenishmentUnits: 1,
      retrieved: 4,
      demand: 4,
    });
  });

  it('derives the open amount from order and retrieved, independent of stock', () => {
    const progress = getRetrievalProgress(
      makeSession({
        daily_orders: { 'S-RT': 5 },
        retrieved: { 'S-RT': 4 },
        stock: { 'S-RT': 9 },
      })
    );
    expect(progress).toEqual([{ variant: 'S-RT', demand: 5, retrieved: 4, open: 1 }]);
  });
});

describe('isProductionAndStorageFinished', () => {
  const pushSession = (batches: Batch[], limits = { 'S-RT': 3 }) =>
    makeSession({
      strategy: 'PUSH',
      daily_production_limits: limits,
      daily_orders: { 'S-RT': 3 },
      batches,
    });

  it('follows the batches, not the station statuses (same rule as the server)', () => {
    expect(isProductionAndStorageFinished(pushSession([]))).toBe(false);
    expect(isProductionAndStorageFinished(pushSession([makeBatch({ quantity: 3 })]))).toBe(false);
    expect(
      isProductionAndStorageFinished(pushSession([makeBatch({ quantity: 3, status: 'STORED' })]))
    ).toBe(true);
  });

  it('ignores station statuses entirely', () => {
    const completedStations = makeSession({
      strategy: 'PUSH',
      daily_production_limits: { 'S-RT': 3 },
      stations: makeSession().stations.map((s) =>
        s.station_id === 3 || s.station_id === 4 ? { ...s, status: 'COMPLETED' as const } : s
      ),
    });
    expect(isProductionAndStorageFinished(completedStations)).toBe(false);
  });

  it('is true for an empty Push plan although Station 3 never completes', () => {
    expect(isProductionAndStorageFinished(pushSession([], {} as never))).toBe(true);
  });
});

describe('isSupplyDone', () => {
  const withSupply = (status1: 'ACTIVE' | 'COMPLETED', status2: 'IDLE' | 'COMPLETED') => {
    const base = makeSession();
    return {
      ...base,
      stations: base.stations.map((s) =>
        s.station_id === 1
          ? { ...s, status: status1 }
          : s.station_id === 2
            ? { ...s, status: status2 }
            : s
      ),
    };
  };

  it('needs both supply stations COMPLETED', () => {
    expect(isSupplyDone(makeSession())).toBe(false);
    expect(isSupplyDone(withSupply('COMPLETED', 'IDLE'))).toBe(false);
    expect(isSupplyDone(withSupply('COMPLETED', 'COMPLETED'))).toBe(true);
  });
});

describe('hasOpenShortfall', () => {
  it('is true only when some variant was ordered but not retrieved', () => {
    expect(hasOpenShortfall(makeSession())).toBe(false);
    expect(hasOpenShortfall(makeSession({ shortfall: { 'S-RT': 0, 'P-SW': 0 } }))).toBe(false);
    expect(hasOpenShortfall(makeSession({ shortfall: { 'S-RT': 0, 'P-SW': 2 } }))).toBe(true);
  });
});
