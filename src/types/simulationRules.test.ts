import { makeSession } from '@/test/fixtures';
import type { Batch, StationStatus } from './simulation';
import {
  VARIANTS,
  getOpenQuantity,
  getProducedQuantity,
  getShortfall,
  getStoredQuantity,
  getTarget,
  getTargets,
  getTotalTarget,
  isOrderRetrieved,
  isProductionDone,
  isSupplyDone,
  sum,
} from './simulationRules';

function batch(overrides: Partial<Batch>): Batch {
  return {
    batch_id: 'b',
    variant: 'S-RT',
    quantity: 1,
    status: 'PRODUCED',
    is_replenishment: false,
    reject_reason: null,
    created_at: '',
    ...overrides,
  };
}

describe('simulationRules', () => {
  const plan = { 'S-RT': 5 };
  const orders = { 'S-RT': 3, 'P-SW': 2 };

  it('uses the production plan for Push and the orders for Pull', () => {
    const push = makeSession({
      strategy: 'PUSH',
      daily_production_limits: plan,
      daily_orders: orders,
    });
    const pull = { ...push, strategy: 'PULL' as const };
    expect(getTargets(push)).toBe(plan);
    expect(getTargets(pull)).toBe(orders);
    expect(getTarget(push, 'P-SW')).toBe(0);
    expect(getTarget(pull, 'P-SW')).toBe(2);
  });

  it('counts every batch except rejected ones as produced', () => {
    const session = makeSession({
      strategy: 'PUSH',
      daily_production_limits: plan,
      batches: [
        batch({ quantity: 2 }),
        batch({ batch_id: 's', quantity: 1, status: 'STORED' }),
        batch({ batch_id: 'x', quantity: 4, status: 'REJECTED' }),
        batch({ batch_id: 'o', variant: 'P-SW', quantity: 9 }),
      ],
    });
    expect(getProducedQuantity(session, 'S-RT')).toBe(3);
    expect(getOpenQuantity(session, 'S-RT')).toBe(2);
    expect(getOpenQuantity(session, 'P-SW')).toBe(0);
  });

  it('never reports a negative open quantity', () => {
    const session = makeSession({
      strategy: 'PUSH',
      daily_production_limits: { 'S-RT': 1 },
      batches: [batch({ quantity: 4 })],
    });
    expect(getOpenQuantity(session, 'S-RT')).toBe(0);
  });

  it('needs stations 1 and 2 completed for the supply', () => {
    const withStatus = (s1: StationStatus, s2: StationStatus) => {
      const session = makeSession();
      return {
        ...session,
        stations: session.stations.map((entry) =>
          entry.station_id === 1
            ? { ...entry, status: s1 }
            : entry.station_id === 2
              ? { ...entry, status: s2 }
              : entry
        ),
      };
    };
    expect(isSupplyDone(withStatus('COMPLETED', 'COMPLETED'))).toBe(true);
    expect(isSupplyDone(withStatus('COMPLETED', 'ACTIVE'))).toBe(false);
  });

  it('sums the whole target and the stored pieces', () => {
    const session = makeSession({
      strategy: 'PULL',
      daily_orders: orders,
      batches: [
        batch({ status: 'STORED', quantity: 2 }),
        batch({ status: 'PRODUCED', quantity: 4 }),
        batch({ status: 'REJECTED', quantity: 8 }),
        batch({ status: 'STORED', variant: 'P-SW', quantity: 1 }),
      ],
    });
    expect(getTotalTarget(session)).toBe(5);
    expect(getStoredQuantity(session)).toBe(3);
  });

  it('knows when every variant of the order is retrieved', () => {
    const base = makeSession({ daily_orders: orders });
    expect(isOrderRetrieved({ ...base, retrieved: { 'S-RT': 3 } })).toBe(false);
    expect(isOrderRetrieved({ ...base, retrieved: { 'S-RT': 3, 'P-SW': 2 } })).toBe(true);
    expect(isOrderRetrieved({ ...base, daily_orders: {}, retrieved: {} })).toBe(true);
  });
});

describe('isProductionDone', () => {
  const pushPlan = { 'S-RT': 3 };
  const push = (batches: Batch[], extra = {}) =>
    makeSession({
      strategy: 'PUSH',
      daily_production_limits: pushPlan,
      daily_orders: { 'S-RT': 3 },
      batches,
      ...extra,
    });

  it('is true for an empty Push plan with orders and no batches (client and server agree now)', () => {
    const session = makeSession({
      strategy: 'PUSH',
      daily_production_limits: { 'S-RT': 0, 'P-SW': 0 },
      daily_orders: { 'S-RT': 3 },
    });
    expect(isProductionDone(session)).toBe(true);
  });

  it('is true when the Push plan is fully produced and stored', () => {
    expect(isProductionDone(push([batch({ quantity: 3, status: 'STORED' })]))).toBe(true);
  });

  it('is false when the plan is produced but a batch still waits for storage', () => {
    expect(isProductionDone(push([batch({ quantity: 3, status: 'PRODUCED' })]))).toBe(false);
  });

  it('is false when a rejected batch reopens its quantity, even with a partial replenishment', () => {
    const session = push(
      [
        batch({ batch_id: 'x', quantity: 3, status: 'REJECTED' }),
        batch({ batch_id: 'r', quantity: 1, status: 'STORED', is_replenishment: true }),
      ],
      { replenishment_queue: [{ variant: 'S-RT', quantity: 2, reason: 'reject' }] }
    );
    expect(isProductionDone(session)).toBe(false);
  });

  it('is false while a replenishment is queued even if nothing else is open', () => {
    const session = push([batch({ quantity: 3, status: 'STORED' })], {
      replenishment_queue: [{ variant: 'S-RT', quantity: 1, reason: 'reject' }],
    });
    expect(isProductionDone(session)).toBe(false);
  });

  it('is false when the plan is only partly produced', () => {
    expect(isProductionDone(push([batch({ quantity: 1, status: 'STORED' })]))).toBe(false);
  });

  it('uses the orders as target in Pull', () => {
    const pull = makeSession({ strategy: 'PULL', daily_orders: { 'S-RT': 2 } });
    expect(isProductionDone(pull)).toBe(false);
    expect(isProductionDone({ ...pull, batches: [batch({ quantity: 2, status: 'STORED' })] })).toBe(
      true
    );
  });

  it('sums quantities and treats missing entries as 0', () => {
    expect(sum([])).toBe(0);
    expect(sum([1, undefined, 4])).toBe(5);
    expect(VARIANTS).toHaveLength(6);
  });

  it('computes the shortfall as ordered minus retrieved, never negative', () => {
    const session = makeSession({
      daily_orders: { 'S-RT': 5, 'P-RT': 2 },
      retrieved: { 'S-RT': 3, 'P-RT': 4, 'S-SI': 1 },
    });
    expect(getShortfall(session, 'S-RT')).toBe(2);
    expect(getShortfall(session, 'P-RT')).toBe(0);
    expect(getShortfall(session, 'S-SI')).toBe(0);
    expect(getShortfall(session, 'P-SW')).toBe(0);
  });
});
