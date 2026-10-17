import type { ShakerVariant, SimulationSession } from './simulation';

export const VARIANTS: ShakerVariant[] = ['S-RT', 'S-SI', 'S-SW', 'P-RT', 'P-SI', 'P-SW'];

/**
 * Engine rules shared by the client and `server/engine.ts`. Pure functions over the session,
 * no UI text. Rule families are moved here one PR at a time (see #214).
 */

/** Sum of quantities; missing entries count as 0. */
export function sum(values: Iterable<number | undefined>): number {
  let total = 0;
  for (const value of values) total += value ?? 0;
  return total;
}

/** Push produces to the teacher's plan, Pull to the aggregated customer order. */
export function getTargets(session: SimulationSession): Partial<Record<ShakerVariant, number>> {
  return session.strategy === 'PUSH' ? session.daily_production_limits : session.daily_orders;
}

/** Target quantity of one variant (0 when the variant is not planned or ordered). */
export function getTarget(session: SimulationSession, variant: ShakerVariant): number {
  return getTargets(session)[variant] ?? 0;
}

/** Produced quantity of one variant: all batches except rejected ones. */
export function getProducedQuantity(session: SimulationSession, variant: ShakerVariant): number {
  return session.batches
    .filter((batch) => batch.variant === variant && batch.status !== 'REJECTED')
    .reduce((total, batch) => total + batch.quantity, 0);
}

/**
 * Open = target - all non-rejected batches. A rejected batch therefore reopens its quantity
 * automatically; `replenishment_queue` only explains why and is not added again.
 */
export function getOpenQuantity(session: SimulationSession, variant: ShakerVariant): number {
  return Math.max(getTarget(session, variant) - getProducedQuantity(session, variant), 0);
}

/** Ordered but not retrieved of one variant; what `finishDay` stores as `shortfall`. */
export function getShortfall(session: SimulationSession, variant: ShakerVariant): number {
  return Math.max((session.daily_orders[variant] ?? 0) - (session.retrieved[variant] ?? 0), 0);
}

/** Stations 1 and 2 have both confirmed their supply. */
export function isSupplyDone(session: SimulationSession): boolean {
  return [1, 2].every(
    (id) => session.stations.find((entry) => entry.station_id === id)?.status === 'COMPLETED'
  );
}

/** Whole target over all variants (Push: the plan, Pull: the customer order). */
export function getTotalTarget(session: SimulationSession): number {
  return sum(VARIANTS.map((variant) => getTarget(session, variant)));
}

/** Pieces Station 4 has stored so far (all variants, only STORED batches). */
export function getStoredQuantity(session: SimulationSession): number {
  return session.batches
    .filter((batch) => batch.status === 'STORED')
    .reduce((total, batch) => total + batch.quantity, 0);
}

/** Every variant is retrieved up to its ordered quantity (trivially true without an order). */
export function isOrderRetrieved(session: SimulationSession): boolean {
  return VARIANTS.every(
    (variant) => (session.retrieved[variant] ?? 0) >= (session.daily_orders[variant] ?? 0)
  );
}

/**
 * Production is done when nothing is open, nothing waits for inspection and no replenishment is
 * pending. Stateless: derived from batches only, independent of station statuses (an empty Push
 * plan is done from the start).
 */
export function isProductionDone(session: SimulationSession): boolean {
  return (
    VARIANTS.every((variant) => getOpenQuantity(session, variant) === 0) &&
    session.replenishment_queue.length === 0 &&
    session.batches.every((batch) => batch.status !== 'PRODUCED')
  );
}
