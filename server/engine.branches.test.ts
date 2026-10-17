// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';

import { SimulationEngine } from './engine.ts';

let engine: SimulationEngine;
let id: string;

/** Push session with a plan, supply done: Station 3 is open for production. */
function runningPush(limits: Record<string, number>) {
  engine = new SimulationEngine();
  id = engine.create('PUSH').session_id;
  engine.configure(id, { daily_production_limits: limits });
  engine.setState(id, 'RUNNING');
  engine.completeSupply(id, 1);
  engine.completeSupply(id, 2);
}

describe('replenishment queue handling while producing', () => {
  beforeEach(() => runningPush({ 'S-RT': 4, 'P-RT': 4 }));

  it('leaves replenishment entries of other variants untouched', () => {
    engine.produceBatch(id, 'S-RT', 2);
    engine.produceBatch(id, 'P-RT', 2);
    engine.reportDeviation(id, 'b1', 'Kratzer', 2);
    engine.reportDeviation(id, 'b2', 'Riss', 2);

    const session = engine.produceBatch(id, 'P-RT', 2);

    expect(session.replenishment_queue).toEqual([
      { variant: 'S-RT', quantity: 2, reason: 'Kratzer' },
    ]);
    const batch = session.batches.at(-1)!;
    expect(batch).toMatchObject({ variant: 'P-RT', is_replenishment: true });
  });

  it('does not mark a batch as replenishment when only other variants are pending', () => {
    engine.produceBatch(id, 'S-RT', 2);
    engine.reportDeviation(id, 'b1', 'Kratzer', 2);

    const session = engine.produceBatch(id, 'P-RT', 2);

    expect(session.batches.at(-1)).toMatchObject({ variant: 'P-RT', is_replenishment: false });
    expect(session.replenishment_queue).toHaveLength(1);
  });

  it('stops paying down once the produced quantity is used up', () => {
    engine.produceBatch(id, 'S-RT', 2);
    engine.produceBatch(id, 'S-RT', 2);
    engine.reportDeviation(id, 'b1', 'erster', 2);
    engine.reportDeviation(id, 'b2', 'zweiter', 2);

    const session = engine.produceBatch(id, 'S-RT', 2);

    expect(session.replenishment_queue).toEqual([
      { variant: 'S-RT', quantity: 2, reason: 'zweiter' },
    ]);
    expect(session.batches.at(-1)).toMatchObject({ quantity: 2, is_replenishment: true });
  });

  it('reduces a larger pending entry by a smaller batch instead of removing it', () => {
    engine.produceBatch(id, 'S-RT', 4);
    engine.reportDeviation(id, 'b1', 'alles', 4);

    const session = engine.produceBatch(id, 'S-RT', 1);

    expect(session.replenishment_queue).toEqual([
      { variant: 'S-RT', quantity: 3, reason: 'alles' },
    ]);
    expect(session.stations.find((s) => s.station_id === 3)!.status).toBe('ACTIVE');
  });
});
