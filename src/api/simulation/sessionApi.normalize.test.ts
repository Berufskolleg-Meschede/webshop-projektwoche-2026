import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { jsonResponse } from '@/test/fixtures';

import { getSessionApi, nextDaySessionApi } from './sessionApi';

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

describe('sessionApi response normalization of a sparse backend payload', () => {
  const sparse = { session_id: 482, state: 'CONFIGURING', strategy: 'PUSH' };

  it('fills every missing collection and counter with a safe empty default', async () => {
    fetchMock.mockResolvedValue(jsonResponse(sparse));

    const session = await getSessionApi('482');

    expect(session).toMatchObject({
      session_id: '482',
      run_id: 1,
      customer_count: 0,
      ended_by_teacher: false,
      stations: [],
      batches: [],
      replenishment_queue: [],
      orders: [],
      stock: {},
      retrieved: {},
      shortfall: {},
      carried_over: {},
      daily_orders: {},
    });
  });

  it('keeps values the backend did send instead of overwriting them', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...sparse,
        run_id: 3,
        customer_count: 2,
        ended_by_teacher: true,
        shortfall: { 'S-RT': 1 },
        carried_over: { 'S-RT': 1 },
        daily_orders: { 'S-RT': 4 },
      })
    );

    const session = await nextDaySessionApi('482');

    expect(session).toMatchObject({
      run_id: 3,
      customer_count: 2,
      ended_by_teacher: true,
      shortfall: { 'S-RT': 1 },
      carried_over: { 'S-RT': 1 },
      daily_orders: { 'S-RT': 4 },
    });
  });
});
