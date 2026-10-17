import { SimulationEngine } from '../../server/engine.ts';

import type { ProductionStrategy, ShakerVariant, SimulationSession } from '@/types/simulation';

/**
 * Drives the real, in-memory `SimulationEngine` so component tests exercise the real rules
 * (ids, state and station checks) instead of a hand-written fake backend.
 * Every action returns the new session snapshot; a rejected booking throws a SimulationError.
 */
export function createEngineHarness(
  config: {
    strategy?: ProductionStrategy;
    daily_orders?: Partial<Record<ShakerVariant, number>>;
    daily_production_limits?: Partial<Record<ShakerVariant, number>>;
  } = {}
) {
  const engine = new SimulationEngine();
  const id = engine.create(config.strategy ?? 'PULL').session_id;
  engine.configure(id, config);
  engine.setState(id, 'RUNNING');

  return {
    id,
    read: () => engine.read(id),
    completeSupply() {
      engine.completeSupply(id, 1);
      return engine.completeSupply(id, 2);
    },
    retrieve: (variant: ShakerVariant, quantity: number): SimulationSession =>
      engine.retrieveItem(id, variant, quantity),
    produceBatch: (variant: ShakerVariant, quantity: number): SimulationSession =>
      engine.produceBatch(id, variant, quantity),
    storeBatch: (batchId: string): SimulationSession => engine.storeBatch(id, batchId),
    reportDeviation: (batchId: string, reason: string, missing: number): SimulationSession =>
      engine.reportDeviation(id, batchId, reason, missing),
  };
}
