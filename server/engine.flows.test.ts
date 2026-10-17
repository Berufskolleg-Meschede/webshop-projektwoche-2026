// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';

import type { SimulationSession, StationId } from '../src/types/simulation.ts';
import { SimulationEngine, SimulationError } from './engine.ts';

let engine: SimulationEngine;

beforeEach(() => {
  engine = new SimulationEngine();
});

function station(session: SimulationSession, stationId: StationId) {
  return session.stations.find((entry) => entry.station_id === stationId)!;
}

function statusOf(action: () => unknown): number | null {
  try {
    action();
  } catch (error) {
    if (error instanceof SimulationError) return error.status;
    throw error;
  }
  return null;
}

function startDay(id: string) {
  engine.setState(id, 'RUNNING');
  engine.completeSupply(id, 1);
  return engine.completeSupply(id, 2);
}

function pullSession(orders: Record<string, number>) {
  const id = engine.create('PULL').session_id;
  engine.configure(id, { daily_orders: orders });
  return id;
}

function pushSession(orders: Record<string, number>, limits: Record<string, number>): string {
  const id = engine.create('PUSH').session_id;
  engine.configure(id, { daily_orders: orders, daily_production_limits: limits });
  return id;
}

function zero(quantities: Record<string, number>) {
  return Object.values(quantities).every((quantity) => quantity === 0);
}

describe('Pull day end to end', () => {
  it('retrieves the whole order, unlocks Station 3, repeats a rejected replenishment and finishes by itself', () => {
    const id = pullSession({ 'S-RT': 3, 'P-SW': 2 });
    const supplied = startDay(id);
    expect(station(supplied, 5).status).toBe('ACTIVE');
    expect(station(supplied, 3).status).toBe('IDLE');

    // Retrieval is booked per variant; Station 3 opens only with the last piece of the order.
    expect(station(engine.retrieveItem(id, 'S-RT', 3), 3).status).toBe('IDLE');
    const retrieved = engine.retrieveItem(id, 'P-SW', 2);
    expect(station(retrieved, 5).status).toBe('COMPLETED');
    expect(station(retrieved, 3).status).toBe('ACTIVE');
    expect(retrieved.state).toBe('RUNNING');
    expect(retrieved.stock).toMatchObject({ 'S-RT': -3, 'P-SW': -2 });

    // Production is capped at the retrieved order.
    expect(statusOf(() => engine.produceBatch(id, 'S-RT', 4))).toBe(422);
    engine.produceBatch(id, 'S-RT', 3);
    engine.produceBatch(id, 'P-SW', 2);

    // Station 4 rejects the whole S-RT batch; the replenishment batch is rejected once more.
    let session = engine.reportDeviation(id, 'b1', 'Kratzer', 3);
    expect(session.replenishment_queue).toEqual([
      { variant: 'S-RT', quantity: 3, reason: 'Kratzer' },
    ]);
    expect(station(session, 3).status).toBe('ACTIVE');
    session = engine.produceBatch(id, 'S-RT', 3);
    const secondTry = session.batches.at(-1)!;
    expect(secondTry).toMatchObject({ is_replenishment: true, status: 'PRODUCED' });
    expect(session.replenishment_queue).toEqual([]);
    session = engine.reportDeviation(id, secondTry.batch_id, 'Riss', 1);
    expect(session.replenishment_queue).toEqual([{ variant: 'S-RT', quantity: 1, reason: 'Riss' }]);
    expect(session.stock['S-RT']).toBe(-1); // two intact pieces of the second try are stored

    // The day cannot end while the replenishment is open or a batch waits for storage.
    expect(station(session, 3).status).toBe('ACTIVE');
    engine.storeBatch(id, 'b2');
    expect(engine.read(id).state).toBe('RUNNING');
    session = engine.produceBatch(id, 'S-RT', 1);
    expect(session.state).toBe('RUNNING');
    session = engine.storeBatch(id, session.batches.at(-1)!.batch_id);

    expect(session.state).toBe('FINISHED');
    expect(zero(session.stock)).toBe(true);
    expect(zero(session.shortfall)).toBe(true);
    expect(session.retrieved).toMatchObject({ 'S-RT': 3, 'P-SW': 2 });
    for (const stationId of [3, 4, 5] as const) {
      expect(station(session, stationId).status).toBe('COMPLETED');
    }
  });

  it('ends early by the teacher with the unretrieved rest as shortfall and keeps production locked', () => {
    const id = pullSession({ 'S-RT': 3, 'P-SW': 2 });
    startDay(id);
    engine.retrieveItem(id, 'S-RT', 1);

    const ended = engine.setState(id, 'FINISHED');
    expect(ended.state).toBe('FINISHED');
    expect(ended.shortfall).toMatchObject({ 'S-RT': 2, 'P-SW': 2 });
    expect(station(ended, 3).status).toBe('IDLE');
    expect(station(ended, 5).status).toBe('COMPLETED');
    expect(statusOf(() => engine.retrieveItem(id, 'S-RT', 1))).toBe(409);
    expect(statusOf(() => engine.produceBatch(id, 'S-RT', 1))).toBe(409);
  });

  it('carries the shortfall into the next Pull day, which runs to the end and clears the carry-over', () => {
    const id = pullSession({ 'S-RT': 3, 'P-SW': 2 });
    startDay(id);
    engine.retrieveItem(id, 'S-RT', 1);
    engine.setState(id, 'FINISHED');

    const nextDay = engine.nextDay(id);
    expect(nextDay.state).toBe('CONFIGURING');
    expect(nextDay.strategy).toBe('PULL');
    expect(nextDay.daily_orders).toMatchObject({ 'S-RT': 2, 'P-SW': 2 });
    expect(nextDay.carried_over).toMatchObject({ 'S-RT': 2, 'P-SW': 2 });
    expect(nextDay.orders).toEqual([]);

    // A customer adds to the pre-filled order; the carried part stays visible separately.
    const ordered = engine.addOrder(id, 'Anna', [{ variant: 'S-RT', quantity: 1 }]);
    expect(ordered.daily_orders['S-RT']).toBe(3);
    expect(ordered.carried_over['S-RT']).toBe(2);

    startDay(id);
    engine.retrieveItem(id, 'S-RT', 3);
    engine.retrieveItem(id, 'P-SW', 2);
    engine.produceBatch(id, 'S-RT', 3);
    engine.produceBatch(id, 'P-SW', 2);
    engine.storeBatch(id, 'b1');
    const finished = engine.storeBatch(id, 'b2');
    expect(finished.state).toBe('FINISHED');
    expect(zero(finished.shortfall)).toBe(true);

    const third = engine.nextDay(id);
    expect(zero(third.daily_orders)).toBe(true);
    expect(zero(third.carried_over)).toBe(true);
    expect(third.run_id).toBe(3);
  });

  it('does not let Station 5 end a Pull day whose order is not yet retrieved', () => {
    const id = pullSession({ 'S-RT': 2 });
    startDay(id);
    engine.retrieveItem(id, 'S-RT', 1);
    expect(statusOf(() => engine.finishDayFromStation5(id))).toBe(409);
    expect(engine.read(id).state).toBe('RUNNING');
  });
});

describe('Push day end and shortfall', () => {
  it('finishes by itself when the order is delivered and the plan is produced and stored', () => {
    const id = pushSession({ 'S-RT': 2 }, { 'S-RT': 2 });
    startDay(id);
    engine.retrieveItem(id, 'S-RT', 2);
    expect(engine.read(id).state).toBe('RUNNING'); // the plan is still open
    engine.produceBatch(id, 'S-RT', 2);
    expect(engine.read(id).state).toBe('RUNNING'); // the batch waits for Station 4
    const finished = engine.storeBatch(id, 'b1');
    expect(finished.state).toBe('FINISHED');
    expect(zero(finished.shortfall)).toBe(true);
    expect(zero(finished.stock)).toBe(true);
  });

  it('records the shortfall when the plan is smaller than the order and Station 5 ends the day', () => {
    const id = pushSession({ 'S-RT': 4, 'P-SW': 1 }, { 'S-RT': 2 });
    startDay(id);
    engine.produceBatch(id, 'S-RT', 2);
    engine.storeBatch(id, 'b1');
    engine.retrieveItem(id, 'S-RT', 2);
    expect(engine.read(id).state).toBe('RUNNING');

    const finished = engine.finishDayFromStation5(id);
    expect(finished.state).toBe('FINISHED');
    expect(finished.shortfall).toMatchObject({ 'S-RT': 2, 'P-SW': 1 });
    expect(finished.stock['S-RT']).toBe(0);
  });

  it('lets the teacher cancel mid-production: open batch and replenishment stay unbooked', () => {
    const id = pushSession({ 'S-RT': 3 }, { 'S-RT': 3 });
    startDay(id);
    engine.produceBatch(id, 'S-RT', 3);
    engine.reportDeviation(id, 'b1', 'Kratzer', 1);
    engine.retrieveItem(id, 'S-RT', 1);

    const ended = engine.setState(id, 'FINISHED');
    expect(ended.state).toBe('FINISHED');
    expect(ended.shortfall['S-RT']).toBe(2);
    for (const stationId of [3, 4, 5] as const) {
      expect(station(ended, stationId).status).toBe('COMPLETED');
    }

    expect(statusOf(() => engine.produceBatch(id, 'S-RT', 1))).toBe(409);
    expect(statusOf(() => engine.storeBatch(id, 'b2'))).toBe(409);
    expect(statusOf(() => engine.reportDeviation(id, 'b2', 'x', 1))).toBe(409);
    expect(statusOf(() => engine.retrieveItem(id, 'S-RT', 1))).toBe(409);
    expect(engine.setState(id, 'FINISHED').shortfall['S-RT']).toBe(2); // repeating is a no-op
  });

  it('chains the shortfall over two days and keeps the plan', () => {
    const id = pushSession({ 'S-RT': 3 }, { 'S-RT': 3 });
    startDay(id);
    engine.produceBatch(id, 'S-RT', 3);
    engine.storeBatch(id, 'b1');
    engine.retrieveItem(id, 'S-RT', 1);
    engine.setState(id, 'FINISHED');

    const day2 = engine.nextDay(id);
    expect(day2.daily_orders['S-RT']).toBe(2);
    expect(day2.carried_over['S-RT']).toBe(2);
    expect(day2.daily_production_limits['S-RT']).toBe(3);

    startDay(id);
    engine.retrieveItem(id, 'S-RT', 1);
    const ended = engine.setState(id, 'FINISHED');
    expect(ended.shortfall['S-RT']).toBe(1);

    const day3 = engine.nextDay(id);
    expect(day3.daily_orders['S-RT']).toBe(1);
    expect(day3.carried_over['S-RT']).toBe(1);
    expect(day3.run_id).toBe(3);
  });
});

describe('claim and release conflicts', () => {
  it('rejects a second student, frees the station on release and keeps claims across the day change', () => {
    const id = pullSession({ 'S-RT': 1 });
    engine.claim(id, 'Mia', 3);
    let conflict: SimulationError | null = null;
    try {
      engine.claim(id, 'Jan', 3);
    } catch (error) {
      conflict = error as SimulationError;
    }
    expect(conflict?.status).toBe(409);
    expect(conflict?.message).toBe('Mia');
    expect(engine.read(id).stations[2].claimed_by).toBe('Mia');

    engine.release(id, 3);
    expect(engine.claim(id, 'Jan', 3).stations[2].claimed_by).toBe('Jan');

    startDay(id);
    engine.retrieveItem(id, 'S-RT', 1);
    engine.produceBatch(id, 'S-RT', 1);
    expect(engine.storeBatch(id, 'b1').state).toBe('FINISHED');

    // Claims work on a finished day and survive reset and the next day.
    expect(engine.claim(id, 'Eva', 4).stations[3].claimed_by).toBe('Eva');
    expect(statusOf(() => engine.claim(id, 'Mia', 4))).toBe(409);
    const next = engine.nextDay(id);
    expect(next.stations[2].claimed_by).toBe('Jan');
    expect(next.stations[3].claimed_by).toBe('Eva');
    expect(statusOf(() => engine.claim(id, 'Mia', 3))).toBe(409);
    expect(engine.reset(id).stations[2].claimed_by).toBe('Jan');
  });

  it('clears the error flag on release but leaves the work state of the station', () => {
    const id = pullSession({ 'S-RT': 1 });
    startDay(id);
    engine.claim(id, 'Mia', 5);
    const released = engine.release(id, 5);
    expect(station(released, 5).claimed_by).toBeNull();
    expect(station(released, 5).has_error).toBe(false);
    expect(station(released, 5).status).toBe('ACTIVE');
    expect(statusOf(() => engine.release(id, 6))).toBe(400);
  });
});
