import { afterEach, beforeEach, vi } from 'vitest';

import { jsonResponse, makeSession } from '@/test/fixtures';

import {
  addOrderApi,
  claimStationApi,
  completeStationApi,
  configureSessionApi,
  createSessionApi,
  getSessionApi,
  joinAsCustomerApi,
  produceBatchApi,
  releaseStationApi,
  retrieveItemApi,
  reportDeviationApi,
  storeBatchApi,
  nextDaySessionApi,
  finishDayApi,
  setSessionStateApi,
} from './sessionApi';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('VITE_SIMULATION_API_BASE_URL', 'http://api.test');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url, init };
}

describe('sessionApi', () => {
  it('gets a session by id without an ERP API key or Authorization header', async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeSession()));
    await getSessionApi('4827');
    expect(lastCall().url).toBe('http://api.test/simulation/session/4827');
    expect(new Headers(lastCall().init.headers).has('Authorization')).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('creates a session and normalizes a numeric id to a string', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...makeSession(), session_id: 427 }));
    const session = await createSessionApi();
    expect(lastCall().url).toBe('http://api.test/simulation/session/create');
    expect(lastCall().init.method).toBe('POST');
    expect(session.session_id).toBe('427');
  });

  it('defaults a missing ended_by_teacher to false and keeps a set one', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...makeSession(), ended_by_teacher: undefined }));
    expect((await getSessionApi('4827')).ended_by_teacher).toBe(false);
    fetchMock.mockResolvedValue(jsonResponse(makeSession({ ended_by_teacher: true })));
    expect((await getSessionApi('4827')).ended_by_teacher).toBe(true);
  });

  it('defaults missing stations to an empty list', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...makeSession(), stations: undefined }));
    expect((await getSessionApi('4827')).stations).toEqual([]);
  });

  it.each([
    ['state', () => setSessionStateApi('4827', 'RUNNING'), { state: 'RUNNING' }],
    [
      'claim',
      () => claimStationApi('4827', { student_name: 'Mia', station_id: 3 }),
      { student_name: 'Mia', station_id: 3 },
    ],
    ['release', () => releaseStationApi('4827', 3), { station_id: 3 }],
  ])('posts to /%s with a JSON body', async (action, call, body) => {
    fetchMock.mockResolvedValue(jsonResponse(makeSession()));
    await call();
    expect(lastCall().url).toBe(`http://api.test/simulation/session/4827/${action}`);
    expect(JSON.parse(lastCall().init.body)).toEqual(body);
  });

  it('counts a customer join and defaults the counter', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...makeSession(), customer_count: undefined }));
    const session = await joinAsCustomerApi('4827');
    expect(lastCall().url).toBe('http://api.test/simulation/session/4827/customer-join');
    expect(session.customer_count).toBe(0);
  });

  it('completes a station via its own endpoint', async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeSession()));
    await completeStationApi('4827', 2);
    expect(lastCall().url).toBe('http://api.test/simulation/session/4827/stations/2/complete');
    expect(lastCall().init.method).toBe('POST');
  });

  it('posts a produced batch to station 3 and defaults batch lists', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ...makeSession(), batches: undefined, replenishment_queue: undefined })
    );
    const session = await produceBatchApi('4827', { variant: 'S-RT', quantity: 2 });
    expect(lastCall().url).toBe('http://api.test/simulation/session/4827/stations/3/produce-batch');
    expect(JSON.parse(lastCall().init.body)).toEqual({ variant: 'S-RT', quantity: 2 });
    expect(session.batches).toEqual([]);
    expect(session.replenishment_queue).toEqual([]);
  });

  it('stores a batch and reports a deviation at station 4', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(makeSession())));
    await storeBatchApi('4827', 'b1');
    expect(lastCall().url).toBe('http://api.test/simulation/session/4827/stations/4/store-batch');
    expect(JSON.parse(lastCall().init.body)).toEqual({ batch_id: 'b1' });

    await reportDeviationApi('4827', { batch_id: 'b1', reason: 'Kratzer', missing_quantity: 1 });
    expect(lastCall().url).toBe(
      'http://api.test/simulation/session/4827/stations/4/report-deviation'
    );
    expect(JSON.parse(lastCall().init.body)).toEqual({
      batch_id: 'b1',
      reason: 'Kratzer',
      missing_quantity: 1,
    });
  });

  it('retrieves an item at station 5 and defaults stock and retrieved', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ...makeSession(), stock: undefined, retrieved: undefined })
    );
    const session = await retrieveItemApi('4827', { variant: 'S-RT', quantity: 2 });
    expect(lastCall().url).toBe('http://api.test/simulation/session/4827/stations/5/retrieve-item');
    expect(JSON.parse(lastCall().init.body)).toEqual({ variant: 'S-RT', quantity: 2 });
    expect(session.stock).toEqual({});
    expect(session.retrieved).toEqual({});
  });

  it('sends the configuration to /config', async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeSession()));
    await configureSessionApi('4827', { strategy: 'PUSH', daily_orders: { 'S-RT': 2 } });
    expect(lastCall().url).toBe('http://api.test/simulation/session/4827/config');
    expect(JSON.parse(lastCall().init.body)).toEqual({
      strategy: 'PUSH',
      daily_orders: { 'S-RT': 2 },
    });
  });

  it('posts customer orders and defaults the order log', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...makeSession(), orders: undefined }));
    const session = await addOrderApi('4827', {
      customer_name: 'Mia',
      items: [{ variant: 'S-RT', quantity: 2 }],
    });
    expect(lastCall().url).toBe('http://api.test/simulation/session/4827/orders/add');
    expect(JSON.parse(lastCall().init.body)).toEqual({
      customer_name: 'Mia',
      items: [{ variant: 'S-RT', quantity: 2 }],
    });
    expect(session.orders).toEqual([]);
  });

  it('starts the next day without a body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeSession()));
    await nextDaySessionApi('4827');
    expect(lastCall().url).toBe('http://api.test/simulation/session/4827/next-day');
    expect(lastCall().init.body).toBeUndefined();
  });
});

describe('finishDayApi', () => {
  it('posts the Station 5 day end with an empty body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeSession({ state: 'FINISHED' })));
    const session = await finishDayApi('4827');
    expect(lastCall().url).toBe('http://api.test/simulation/session/4827/stations/5/finish-day');
    expect(lastCall().init.method).toBe('POST');
    expect(session.state).toBe('FINISHED');
  });
});
