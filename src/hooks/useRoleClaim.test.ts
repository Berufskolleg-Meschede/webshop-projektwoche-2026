import { act, renderHook } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';

import { NETWORK_ERROR_MESSAGE } from '@/api/errorMessages';
import { ApiRequestError } from '@/api/requestApi';
import * as sessionApi from '@/api/simulation/sessionApi';
import { makeSession } from '@/test/fixtures';

import { CLAIM_STORAGE_KEY, useRoleClaim } from './useRoleClaim';

vi.mock('@/api/simulation/sessionApi');
const api = vi.mocked(sessionApi);

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
});

describe('useRoleClaim', () => {
  it('claims a station and remembers it for reloads', async () => {
    api.claimStationApi.mockResolvedValue(makeSession());
    const { result } = renderHook(() => useRoleClaim('4827', 3));
    expect(result.current.status).toBe('idle');

    let ok = false;
    await act(async () => {
      ok = await result.current.claim('  Mia ');
    });
    expect(ok).toBe(true);
    expect(api.claimStationApi).toHaveBeenCalledWith('4827', {
      student_name: 'Mia',
      station_id: 3,
    });
    expect(result.current.status).toBe('claimed');
    expect(result.current.studentName).toBe('Mia');

    const reloaded = renderHook(() => useRoleClaim('4827', 3));
    expect(reloaded.result.current.status).toBe('claimed');
    expect(reloaded.result.current.studentName).toBe('Mia');
  });

  it('does not restore a claim of another session or station', () => {
    sessionStorage.setItem(
      CLAIM_STORAGE_KEY,
      JSON.stringify({ sessionId: '1111', stationId: 3, name: 'Mia' })
    );
    expect(renderHook(() => useRoleClaim('4827', 3)).result.current.status).toBe('idle');
    expect(renderHook(() => useRoleClaim('1111', 4)).result.current.status).toBe('idle');
  });

  it('ignores corrupt stored data', () => {
    sessionStorage.setItem(CLAIM_STORAGE_KEY, '{nope');
    expect(renderHook(() => useRoleClaim('4827', 3)).result.current.status).toBe('idle');
  });

  it('rejects an empty name', async () => {
    const { result } = renderHook(() => useRoleClaim('4827', 3));
    let ok = true;
    await act(async () => {
      ok = await result.current.claim('   ');
    });
    expect(ok).toBe(false);
    expect(api.claimStationApi).not.toHaveBeenCalled();
  });

  it('reports an occupied station with the holder from the backend', async () => {
    api.claimStationApi.mockRejectedValue(new ApiRequestError('x', 409, '/p', { detail: 'Mia' }));
    const { result } = renderHook(() => useRoleClaim('4827', 3));
    await act(async () => {
      await result.current.claim('Jan');
    });
    expect(result.current.status).toBe('occupied');
    expect(result.current.message).toBe('Station ist bereits von Mia belegt.');
    expect(result.current.occupiedBy).toBe('Mia');
  });

  it('falls back to a generic occupied message', async () => {
    api.claimStationApi.mockRejectedValue(new ApiRequestError('x', 409, '/p', null));
    const { result } = renderHook(() => useRoleClaim('4827', 3));
    await act(async () => {
      await result.current.claim('Jan');
    });
    expect(result.current.message).toBe('Station ist bereits von einem anderen Benutzer belegt.');
    expect(result.current.occupiedBy).toBeNull();
  });

  it('reports a missing session and an unreachable server', async () => {
    api.claimStationApi.mockRejectedValueOnce(new ApiRequestError('x', 404, '/p', null));
    api.claimStationApi.mockRejectedValueOnce(new TypeError('offline'));
    const { result } = renderHook(() => useRoleClaim('4827', 3));
    await act(async () => {
      await result.current.claim('Jan');
    });
    expect(result.current.message).toBe('Sitzung nicht gefunden.');
    await act(async () => {
      await result.current.claim('Jan');
    });
    expect(result.current.message).toBe(NETWORK_ERROR_MESSAGE);
    expect(result.current.status).toBe('error');
  });

  it('releases the station and forgets the stored claim', async () => {
    api.claimStationApi.mockResolvedValue(makeSession());
    api.releaseStationApi.mockResolvedValue(makeSession());
    const { result } = renderHook(() => useRoleClaim('4827', 3));
    await act(async () => {
      await result.current.claim('Mia');
    });
    let ok = false;
    await act(async () => {
      ok = await result.current.release();
    });
    expect(ok).toBe(true);
    expect(api.releaseStationApi).toHaveBeenCalledWith('4827', 3);
    expect(result.current.status).toBe('idle');
    expect(sessionStorage.getItem(CLAIM_STORAGE_KEY)).toBeNull();
  });

  it('reports a failed release', async () => {
    api.releaseStationApi.mockRejectedValue(new Error('x'));
    const { result } = renderHook(() => useRoleClaim('4827', 3));
    let ok = true;
    await act(async () => {
      ok = await result.current.release();
    });
    expect(ok).toBe(false);
    expect(result.current.message).toBe('Station konnte nicht freigegeben werden.');
  });

  it('still works when sessionStorage is unavailable', async () => {
    api.claimStationApi.mockResolvedValue(makeSession());
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { result } = renderHook(() => useRoleClaim('4827', 3));
    await act(async () => {
      await result.current.claim('Mia');
    });
    expect(result.current.status).toBe('claimed');
    vi.restoreAllMocks();
  });
});
