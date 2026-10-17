import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';

import * as sessionApi from '@/api/simulation/sessionApi';
import { makeSession } from '@/test/fixtures';

import { useSessionStations } from './useSessionStations';

vi.mock('@/api/simulation/sessionApi');
const api = vi.mocked(sessionApi);

beforeEach(() => vi.resetAllMocks());

describe('useSessionStations', () => {
  it('loads the stations of the session', async () => {
    const session = makeSession();
    api.getSessionApi.mockResolvedValue(session);
    const { result } = renderHook(() => useSessionStations('4827'));
    expect(result.current).toEqual({ stations: [], loadState: 'loading' });
    await waitFor(() => expect(result.current.loadState).toBe('ready'));
    expect(result.current.stations).toEqual(session.stations);
    expect(api.getSessionApi).toHaveBeenCalledWith('4827', expect.any(AbortSignal));
  });

  it('reports a load error and keeps the stations empty', async () => {
    api.getSessionApi.mockRejectedValue(new TypeError('failed'));
    const { result } = renderHook(() => useSessionStations('4827'));
    await waitFor(() => expect(result.current.loadState).toBe('error'));
    expect(result.current.stations).toEqual([]);
  });

  it('ignores an answer that arrives after unmount', async () => {
    let resolve: (value: ReturnType<typeof makeSession>) => void = () => {};
    api.getSessionApi.mockReturnValue(new Promise((done) => (resolve = done)));
    const { result, unmount } = renderHook(() => useSessionStations('4827'));
    unmount();
    resolve(makeSession());
    await Promise.resolve();
    expect(result.current.loadState).toBe('loading');
  });
});
