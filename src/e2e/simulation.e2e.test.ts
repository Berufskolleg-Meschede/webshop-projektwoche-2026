/**
 * Live end-to-end scenarios (Feature 09): the real frontend API client against a running simulation server (`npm run server`).
 * Skipped unless VITE_E2E_API_BASE_URL is set (test only, never embedded in the app), e.g.
 *   VITE_E2E_API_BASE_URL=http://127.0.0.1:8765 npm run test:e2e
 * The session store is in memory, so one server process owns all sessions.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '@/api/requestApi';
import {
  addOrderApi,
  claimStationApi,
  completeStationApi,
  configureSessionApi,
  createSessionApi,
  getSessionApi,
  produceBatchApi,
  releaseStationApi,
  reportDeviationApi,
  nextDaySessionApi,
  retrieveItemApi,
  setSessionStateApi,
  storeBatchApi,
} from '@/api/simulation/sessionApi';
import { getProductionProgress, getRetrievalProgress } from '@/types/production';
import type { SimulationSession, StationId } from '@/types/simulation';

const baseUrl = import.meta.env.VITE_E2E_API_BASE_URL;
const STATIONS: StationId[] = [1, 2, 3, 4, 5];

function status(session: SimulationSession, stationId: StationId) {
  return session.stations.find((station) => station.station_id === stationId)?.status;
}

async function expectApiError(promise: Promise<unknown>, httpStatus: number) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught
  );
  expect(error).toBeInstanceOf(ApiRequestError);
  expect((error as ApiRequestError).status).toBe(httpStatus);
}

async function startedSession(config: Parameters<typeof configureSessionApi>[1]) {
  const { session_id: id } = await createSessionApi();
  await configureSessionApi(id, config);
  for (const stationId of STATIONS)
    await claimStationApi(id, { student_name: `W${stationId}`, station_id: stationId });
  await setSessionStateApi(id, 'RUNNING');
  return id;
}

describe.skipIf(!baseUrl)('live simulation scenarios', () => {
  beforeAll(() => {
    vi.stubEnv('VITE_SIMULATION_API_BASE_URL', baseUrl as string);
  });

  it('covers the session lifecycle: claim conflict, release, config lock, next day', async () => {
    const { session_id: id } = await createSessionApi();
    expect((await getSessionApi(id)).state).toBe('CONFIGURING');

    await claimStationApi(id, { student_name: 'Mia', station_id: 3 });
    await expectApiError(claimStationApi(id, { student_name: 'Jan', station_id: 3 }), 409);
    await releaseStationApi(id, 3);
    const retaken = await claimStationApi(id, { student_name: 'Jan', station_id: 3 });
    expect(retaken.stations[2].claimed_by).toBe('Jan');

    await setSessionStateApi(id, 'RUNNING');
    await expectApiError(configureSessionApi(id, { strategy: 'PUSH' }), 409);
    await setSessionStateApi(id, 'FINISHED');
    const reset = await nextDaySessionApi(id);
    expect(reset.state).toBe('CONFIGURING');
    // The next day clears progress but workers keep their station (devices still show "Angemeldet").
    expect(reset.stations.map((station) => station.claimed_by)).toEqual([
      null,
      null,
      'Jan',
      null,
      null,
    ]);
    await expectApiError(claimStationApi(id, { student_name: 'Eva', station_id: 3 }), 409);
    await expectApiError(getSessionApi('0000-nope'), 404);
  });

  it('Scenario 1 – Pull happy path ends FINISHED', async () => {
    const id = await startedSession({
      strategy: 'PULL',
      daily_orders: { 'S-RT': 2, 'P-SW': 1 },
    });

    await completeStationApi(id, 1);
    let session = await completeStationApi(id, 2);
    expect(status(session, 5)).toBe('ACTIVE'); // Pull: the order is retrieved first (#198)
    expect(status(session, 3)).toBe('IDLE');
    await expectApiError(produceBatchApi(id, { variant: 'S-RT', quantity: 1 }), 409);

    await retrieveItemApi(id, { variant: 'S-RT', quantity: 2 });
    session = await retrieveItemApi(id, { variant: 'P-SW', quantity: 1 });
    expect(status(session, 3)).toBe('ACTIVE');
    expect(session.state).toBe('RUNNING');

    await expectApiError(produceBatchApi(id, { variant: 'S-RT', quantity: 3 }), 422);
    await produceBatchApi(id, { variant: 'S-RT', quantity: 1 });
    await produceBatchApi(id, { variant: 'S-RT', quantity: 1 });
    session = await produceBatchApi(id, { variant: 'P-SW', quantity: 1 });
    expect(getProductionProgress(session).every((entry) => entry.status === 'DONE')).toBe(true);

    for (const batch of session.batches) session = await storeBatchApi(id, batch.batch_id);
    expect(session.state).toBe('FINISHED'); // produced again and stored
    expect(getRetrievalProgress(session).every((entry) => entry.open === 0)).toBe(true);
  });

  it('Scenario 2 – Push has Station 5 active from the start; early delivery does not end the day', async () => {
    let id = await startedSession({
      strategy: 'PUSH',
      daily_orders: { 'S-RT': 1 },
      daily_production_limits: { 'S-RT': 2 },
    });

    expect(status(await getSessionApi(id), 5)).toBe('ACTIVE');
    await expectApiError(retrieveItemApi(id, { variant: 'S-RT', quantity: 2 }), 422); // above the order

    // nothing produced or stored yet: the confirmation is not stock dependent
    let session = await retrieveItemApi(id, { variant: 'S-RT', quantity: 1 });
    expect(session.retrieved['S-RT']).toBe(1);
    expect(session.state).toBe('RUNNING'); // the plan is still open

    await completeStationApi(id, 1);
    await completeStationApi(id, 2);
    session = await produceBatchApi(id, { variant: 'S-RT', quantity: 2 });
    session = await storeBatchApi(id, session.batches[0].batch_id);
    expect(session.state).toBe('FINISHED');

    // early delivery does not end the day while the plan is open
    id = await startedSession({
      strategy: 'PUSH',
      daily_orders: { 'S-RT': 1 },
      daily_production_limits: { 'S-RT': 3 },
    });
    await completeStationApi(id, 1);
    await completeStationApi(id, 2);

    session = await produceBatchApi(id, { variant: 'S-RT', quantity: 1 });
    await storeBatchApi(id, session.batches[0].batch_id);
    session = await retrieveItemApi(id, { variant: 'S-RT', quantity: 1 });
    expect(session.state).toBe('RUNNING'); // demand delivered, plan (3) still open
    expect(status(session, 3)).toBe('ACTIVE');

    session = await produceBatchApi(id, { variant: 'S-RT', quantity: 2 });
    session = await storeBatchApi(id, session.batches.at(-1)!.batch_id);
    expect(session.state).toBe('FINISHED'); // plan done → the day ends
  });

  it('Scenario 3 – defect at Station 4 loops back to Station 3 and finishes', async () => {
    const id = await startedSession({ strategy: 'PULL', daily_orders: { 'S-RT': 2 } });
    await completeStationApi(id, 1);
    await completeStationApi(id, 2);
    await retrieveItemApi(id, { variant: 'S-RT', quantity: 2 });

    let session = await produceBatchApi(id, { variant: 'S-RT', quantity: 2 });
    session = await reportDeviationApi(id, {
      batch_id: session.batches[0].batch_id,
      reason: 'Kratzer',
      missing_quantity: 1,
    });
    expect(session.replenishment_queue).toEqual([
      { variant: 'S-RT', quantity: 1, reason: 'Kratzer' },
    ]);
    expect(status(session, 3)).toBe('ACTIVE');
    expect(getProductionProgress(session)[0].open).toBe(1);

    session = await produceBatchApi(id, { variant: 'S-RT', quantity: 1 });
    const replenishment = session.batches.find((batch) => batch.is_replenishment);
    expect(replenishment).toBeDefined();
    session = await storeBatchApi(id, replenishment!.batch_id);
    expect(session.replenishment_queue).toEqual([]);
    expect(session.state).toBe('FINISHED');
  });

  it('Scenario 4 – customers order, the sums match and the Pull run finishes', async () => {
    const { session_id: id } = await createSessionApi();
    await addOrderApi(id, {
      customer_name: 'Mia',
      items: [
        { variant: 'S-RT', quantity: 2 },
        { variant: 'P-SW', quantity: 1 },
      ],
    });
    let session = await addOrderApi(id, { items: [{ variant: 'S-RT', quantity: 1 }] });
    expect(session.daily_orders['S-RT']).toBe(3);
    expect(session.daily_orders['P-SW']).toBe(1);
    expect(session.orders.map((order) => order.order_id)).toEqual(['o1', 'o2']);
    expect(session.orders[0]).toMatchObject({
      customer_name: 'Mia',
      items: { 'S-RT': 2, 'P-SW': 1 },
    });
    expect(session.orders[1].customer_name).toBeNull();

    await expectApiError(addOrderApi(id, { items: [] }), 422);
    await expectApiError(addOrderApi(id, { items: [{ variant: 'S-RT', quantity: 100 }] }), 422);
    await expectApiError(
      addOrderApi('0000-nope', { items: [{ variant: 'S-RT', quantity: 1 }] }),
      404
    );

    for (const stationId of STATIONS)
      await claimStationApi(id, { student_name: `W${stationId}`, station_id: stationId });
    await setSessionStateApi(id, 'RUNNING');
    await expectApiError(addOrderApi(id, { items: [{ variant: 'S-RT', quantity: 1 }] }), 409);

    await completeStationApi(id, 1);
    await completeStationApi(id, 2);
    await retrieveItemApi(id, { variant: 'S-RT', quantity: 3 });
    await retrieveItemApi(id, { variant: 'P-SW', quantity: 1 });
    await produceBatchApi(id, { variant: 'S-RT', quantity: 3 });
    session = await produceBatchApi(id, { variant: 'P-SW', quantity: 1 });
    for (const batch of session.batches) session = await storeBatchApi(id, batch.batch_id);
    expect(session.state).toBe('FINISHED');
    expect(session.orders).toHaveLength(2);

    expect((await nextDaySessionApi(id)).orders).toEqual([]);
  });
});
