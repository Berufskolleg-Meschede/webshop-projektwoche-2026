import { VARIANTS, getVariantLabel } from './production';
import type { ShakerVariant, SimulationSession } from './simulation';

export type Preflight = {
  allStationsClaimed: boolean;
  hasOrder: boolean;
  hasProductionPlan: boolean;
  /** Push only: every variant's plan covers its order (otherwise the day cannot be fulfilled). */
  isPlanSufficient: boolean;
  canStart: boolean;
  warnings: string[];
};

function total(quantities: Partial<Record<ShakerVariant, number>>): number {
  return VARIANTS.reduce((sum, variant) => sum + (quantities[variant] ?? 0), 0);
}

/**
 * Start checks for the teacher. Only a missing order blocks the start (Push: a missing order AND a missing plan). Unclaimed stations and a
 * plan below the order (per variant, Push) or a missing Push plan are shown as warnings but do not
 * block (developer decision 2026-10-14: no demo switch, the simulation is the demo).
 */
export function getPreflight(session: SimulationSession): Preflight {
  const allStationsClaimed =
    session.stations.length === 5 && session.stations.every((station) => station.claimed_by);
  const hasOrder = total(session.daily_orders) > 0;
  const plannedUnits = total(session.daily_production_limits);
  const hasProductionPlan = session.strategy === 'PULL' || plannedUnits > 0;
  // Push produces to the plan, so a plan alone is enough; Pull has nothing to produce without an order.
  const canStart = hasOrder || (session.strategy === 'PUSH' && plannedUnits > 0);

  const shortfalls =
    session.strategy === 'PUSH'
      ? VARIANTS.filter(
          (variant) =>
            (session.daily_production_limits[variant] ?? 0) < (session.daily_orders[variant] ?? 0)
        )
      : [];
  const isPlanSufficient = shortfalls.length === 0;

  const warnings: string[] = [];
  if (!allStationsClaimed) warnings.push('Nicht alle Stationen 1–5 sind besetzt.');
  if (!canStart) warnings.push('Es liegt noch kein Auftrag vor.');
  if (!hasProductionPlan) warnings.push('Im Push-Modus fehlen die Tages-Produktionsmengen.');
  else {
    for (const variant of shortfalls) {
      warnings.push(
        `Plan für ${getVariantLabel(variant)} (${session.daily_production_limits[variant] ?? 0}) liegt unter dem Auftrag (${session.daily_orders[variant]}).`
      );
    }
  }

  return {
    allStationsClaimed,
    hasOrder,
    hasProductionPlan,
    isPlanSufficient,
    canStart,
    warnings,
  };
}
