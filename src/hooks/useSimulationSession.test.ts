import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import { ApiRequestError } from '@/api/requestApi';
import * as sessionApi from '@/api/simulation/sessionApi';
import { makeSession } from '@/test/fixtures';
import type { SimulationSession } from '@/types/simulation';

import { SESSION_POLL_TIMEOUT_MS, useSimulationSession } from './useSimulationSession';

vi.mock('@/api/simulation/sessionApi');
const api = vi.mocked(sessionApi);
type HookResult = ReturnType<typeof useSimulationSession>;

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSimulationSession', () => {
  it('stays idle without a session id', () => {
    const { result } = renderHook(() => useSimulationSession(null));
    expect(result.current.status).toBe('idle');
    expect(api.getSessionApi).not.toHaveBeenCalled();
  });

  it('loads the session and keeps polling', async () => {
    vi.useFakeTimers();
    api.getSessionApi.mockResolvedValue(makeSession());
    const { result } = renderHook(() => useSimulationSession('4827', 1000));

    await act(async () => {});
    expect(result.current.status).toBe('success');
    expect(result.current.session?.session_id).toBe('4827');

    api.getSessionApi.mockResolvedValue(makeSession({ state: 'RUNNING' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.session?.state).toBe('RUNNING');
  });

  it('refreshes immediately when a hidden tab becomes visible again', async () => {
    vi.useFakeTimers();
    api.getSessionApi.mockResolvedValue(makeSession());
    renderHook(() => useSimulationSession('4827', 60_000));
    await act(async () => {});
    expect(api.getSessionApi).toHaveBeenCalledTimes(1);

    api.getSessionApi.mockResolvedValue(makeSession({ state: 'RUNNING' }));
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(api.getSessionApi).toHaveBeenCalledTimes(2);

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(api.getSessionApi).toHaveBeenCalledTimes(2); // hidden: no extra request
    vi.restoreAllMocks();
  });

  it('lets slow responses finish instead of aborting them with the next poll', async () => {
    vi.useFakeTimers();
    // Signal-aware mock: answers after 2 s unless aborted (latency > the 1.5 s poll interval).
    api.getSessionApi.mockImplementation(
      (_id, signal) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve(makeSession({ state: 'RUNNING' })), 2000);
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('aborted', 'AbortError'));
          });
        })
    );
    const { result } = renderHook(() => useSimulationSession('4827', 1500));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(result.current.status).toBe('success');
    expect(result.current.session?.state).toBe('RUNNING');
    // Never more than one request in flight: ~one request per 2 s, not one per 1.5 s tick.
    expect(api.getSessionApi.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it('does not start a second poll while one is in flight, e.g. on visibility change', async () => {
    vi.useFakeTimers();
    api.getSessionApi.mockImplementation(() => new Promise(() => {})); // never answers
    renderHook(() => useSimulationSession('4827', 1000));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(api.getSessionApi).toHaveBeenCalledTimes(1);
  });

  it('stops polling on unmount', async () => {
    vi.useFakeTimers();
    api.getSessionApi.mockResolvedValue(makeSession());
    const { unmount } = renderHook(() => useSimulationSession('4827', 1000));
    await act(async () => {});
    unmount();
    await vi.advanceTimersByTimeAsync(5000);
    expect(api.getSessionApi).toHaveBeenCalledTimes(1);
  });

  it('reports a missing session', async () => {
    api.getSessionApi.mockRejectedValue(new ApiRequestError('x', 404, '/p', null));
    const { result } = renderHook(() => useSimulationSession('0000'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toBe('Sitzung nicht gefunden.');
  });

  it('reports an unreachable server', async () => {
    api.getSessionApi.mockRejectedValue(new TypeError('failed'));
    const { result } = renderHook(() => useSimulationSession('4827'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toBe('Server nicht erreichbar. Bitte Verbindung prüfen.');
  });

  it('ignores aborted requests', async () => {
    api.getSessionApi.mockRejectedValue(new DOMException('aborted', 'AbortError'));
    const { result } = renderHook(() => useSimulationSession('4827'));
    await act(async () => {});
    expect(result.current.status).toBe('loading');
  });

  it('applies an action result immediately', async () => {
    api.getSessionApi.mockResolvedValue(makeSession());
    api.setSessionStateApi.mockResolvedValue(makeSession({ state: 'RUNNING' }));
    const { result } = renderHook(() => useSimulationSession('4827'));
    await waitFor(() => expect(result.current.status).toBe('success'));

    let ok = false;
    await act(async () => {
      ok = await result.current.setState('RUNNING');
    });
    expect(ok).toBe(true);
    expect(api.setSessionStateApi).toHaveBeenCalledWith('4827', 'RUNNING');
    expect(result.current.session?.state).toBe('RUNNING');
  });

  it.each([
    {
      name: 'completes a station',
      mock: () => api.completeStationApi.mockResolvedValue(makeSession({ state: 'RUNNING' })),
      run: (hook: HookResult) => hook.completeStation(1),
      api: () => api.completeStationApi,
      args: ['4827', 1],
      applied: (session?: SimulationSession) => expect(session?.state).toBe('RUNNING'),
    },
    {
      name: 'produces a batch',
      mock: () => api.produceBatchApi.mockResolvedValue(makeSession()),
      run: (hook: HookResult) => hook.produceBatch('P-SW', 3),
      api: () => api.produceBatchApi,
      args: ['4827', { variant: 'P-SW', quantity: 3 }],
    },
    {
      name: 'stores a batch',
      mock: () => api.storeBatchApi.mockResolvedValue(makeSession()),
      run: (hook: HookResult) => hook.storeBatch('b1'),
      api: () => api.storeBatchApi,
      args: ['4827', 'b1'],
    },
    {
      name: 'reports a deviation',
      mock: () => api.reportDeviationApi.mockResolvedValue(makeSession()),
      run: (hook: HookResult) => hook.reportDeviation('b2', 'Kratzer', 1),
      api: () => api.reportDeviationApi,
      args: ['4827', { batch_id: 'b2', reason: 'Kratzer', missing_quantity: 1 }],
    },
    {
      name: 'retrieves an item',
      mock: () => api.retrieveItemApi.mockResolvedValue(makeSession()),
      run: (hook: HookResult) => hook.retrieveItem('S-RT', 2),
      api: () => api.retrieveItemApi,
      args: ['4827', { variant: 'S-RT', quantity: 2 }],
    },
    {
      name: 'finishes the day from Station 5',
      mock: () => api.finishDayApi.mockResolvedValue(makeSession({ state: 'FINISHED' })),
      run: (hook: HookResult) => hook.finishDay(),
      api: () => api.finishDayApi,
      args: ['4827'],
      applied: (session?: SimulationSession) => expect(session?.state).toBe('FINISHED'),
    },
    {
      name: 'configures the session',
      mock: () => api.configureSessionApi.mockResolvedValue(makeSession({ strategy: 'PUSH' })),
      run: (hook: HookResult) => hook.configure({ strategy: 'PUSH' }),
      api: () => api.configureSessionApi,
      args: ['4827', { strategy: 'PUSH' }],
      applied: (session?: SimulationSession) => expect(session?.strategy).toBe('PUSH'),
    },
  ])('$name via the API', async ({ mock, run, api: apiFn, args, applied }) => {
    api.getSessionApi.mockResolvedValue(makeSession());
    mock();
    const { result } = renderHook(() => useSimulationSession('4827'));
    await waitFor(() => expect(result.current.status).toBe('success'));
    await act(async () => {
      await run(result.current);
    });
    expect(apiFn()).toHaveBeenCalledWith(...args);
    applied?.(result.current.session ?? undefined);
  });

  it('surfaces the holder name on a claim conflict', async () => {
    api.getSessionApi.mockResolvedValue(makeSession());
    api.claimStationApi.mockRejectedValue(
      new ApiRequestError('x', 409, '/simulation/session/4827/claim', { detail: 'Mia' })
    );
    const { result } = renderHook(() => useSimulationSession('4827'));
    await waitFor(() => expect(result.current.status).toBe('success'));

    let ok = true;
    await act(async () => {
      ok = await result.current.claimStation(3, 'Jan');
    });
    expect(ok).toBe(false);
    expect(api.claimStationApi).toHaveBeenCalledWith('4827', {
      student_name: 'Jan',
      station_id: 3,
    });
    expect(result.current.actionErrorMessage).toBe('Station ist bereits von Mia belegt.');
  });

  it('explains non-claim conflicts and validation errors with the server detail', async () => {
    api.getSessionApi.mockResolvedValue(makeSession());
    api.configureSessionApi.mockRejectedValueOnce(
      new ApiRequestError('x', 409, '/simulation/session/4827/config', {
        detail: 'Session kann nur im Status CONFIGURING konfiguriert werden',
      })
    );
    api.produceBatchApi.mockRejectedValueOnce(
      new ApiRequestError('x', 422, '/p', { detail: 'Ungültige Menge 9 für S-RT (offen: 2)' })
    );
    api.releaseStationApi.mockRejectedValueOnce(new ApiRequestError('x', 409, '/p', null));
    api.claimStationApi.mockRejectedValueOnce(
      new ApiRequestError('x', 409, '/simulation/session/4827/claim', null)
    );
    api.nextDaySessionApi.mockRejectedValueOnce(new ApiRequestError('x', 422, '/p', null));
    api.completeStationApi.mockRejectedValueOnce(new ApiRequestError('x', 500, '/p', null));
    const { result } = renderHook(() => useSimulationSession('4827'));
    await waitFor(() => expect(result.current.status).toBe('success'));

    const message = async (action: () => Promise<boolean>) => {
      await act(async () => {
        await action();
      });
      return result.current.actionErrorMessage;
    };
    expect(await message(() => result.current.configure({ strategy: 'PUSH' }))).toBe(
      'Session kann nur im Status CONFIGURING konfiguriert werden'
    );
    expect(await message(() => result.current.produceBatch('S-RT', 9))).toBe(
      'Ungültige Menge 9 für S-RT (offen: 2)'
    );
    expect(await message(() => result.current.releaseStation(2))).toBe(
      'Die Aktion ist im aktuellen Status nicht möglich.'
    );
    expect(await message(() => result.current.claimStation(2, 'Jan'))).toBe(
      'Diese Station ist bereits besetzt.'
    );
    expect(await message(() => result.current.nextDay())).toBe('Ungültige Eingabe.');
    expect(await message(() => result.current.completeStation(1))).toBe(
      'Serverfehler. Bitte später erneut versuchen.'
    );
  });

  it('ignores a slow poll that answers after the session was switched or unmounted', async () => {
    vi.useFakeTimers();
    const resolvers: Array<(session: ReturnType<typeof makeSession>) => void> = [];
    api.getSessionApi.mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)));
    const { result, rerender, unmount } = renderHook(({ id }) => useSimulationSession(id, 1000), {
      initialProps: { id: '1111' },
    });
    rerender({ id: '2222' });
    await act(async () => {
      resolvers[0](makeSession({ session_id: '1111' })); // answer for the old session
      resolvers[1](makeSession({ session_id: '2222' }));
    });
    expect(result.current.session?.session_id).toBe('2222');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    unmount();
    await act(async () => {
      resolvers[2](makeSession({ session_id: '2222', state: 'FINISHED' }));
    });
    expect(result.current.session?.state).not.toBe('FINISHED');
  });

  it('does not let a poll that started before an action overwrite its result', async () => {
    vi.useFakeTimers();
    let resolveSlowPoll: (session: ReturnType<typeof makeSession>) => void = () => {};
    api.getSessionApi
      .mockResolvedValueOnce(makeSession())
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSlowPoll = resolve)))
      .mockResolvedValue(makeSession({ state: 'RUNNING' }));
    api.setSessionStateApi.mockResolvedValue(makeSession({ state: 'RUNNING' }));
    const { result } = renderHook(() => useSimulationSession('4827', 1000));
    await act(async () => {});

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000); // slow poll starts with the old state
    });
    await act(async () => {
      await result.current.setState('RUNNING');
    });
    await act(async () => {
      resolveSlowPoll(makeSession({ state: 'CONFIGURING' })); // stale answer arrives late
    });
    expect(result.current.session?.state).toBe('RUNNING');
  });

  it('aborts a poll that gets no answer and reports a timeout (U01b)', async () => {
    vi.useFakeTimers();
    api.getSessionApi.mockImplementation(
      (_id, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          );
        })
    );
    const { result } = renderHook(() => useSimulationSession('4827', 1500));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SESSION_POLL_TIMEOUT_MS + 2000);
    });
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toMatch(/antwortet nicht/);
    // The guard is released: the next tick polls again.
    expect(api.getSessionApi.mock.calls.length).toBeGreaterThan(1);
  });

  it('does not show the error of a poll that fails after the session was switched (U02)', async () => {
    let rejectOld: (e: unknown) => void = () => {};
    api.getSessionApi.mockImplementation((id) =>
      id === '1111'
        ? new Promise((_resolve, reject) => {
            rejectOld = reject;
          })
        : Promise.resolve(makeSession({ session_id: '2222' }))
    );
    const { result, rerender } = renderHook(({ id }) => useSimulationSession(id), {
      initialProps: { id: '1111' },
    });
    rerender({ id: '2222' });
    await waitFor(() => expect(result.current.status).toBe('success'));
    await act(async () => {
      rejectOld(new TypeError('network'));
    });
    expect(result.current.status).toBe('success');
    expect(result.current.errorMessage).toBe('');
  });

  it('rejects an overlapping action while one is in flight (U03)', async () => {
    api.getSessionApi.mockResolvedValue(makeSession());
    let finish: (s: ReturnType<typeof makeSession>) => void = () => {};
    api.setSessionStateApi.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const { result } = renderHook(() => useSimulationSession('4827'));
    await waitFor(() => expect(result.current.status).toBe('success'));

    let first: Promise<boolean> = Promise.resolve(false);
    act(() => {
      first = result.current.setState('RUNNING');
    });
    expect(result.current.isActionPending).toBe(true);
    let second = true;
    await act(async () => {
      second = await result.current.setState('FINISHED');
    });
    expect(second).toBe(false);
    expect(api.setSessionStateApi).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish(makeSession({ state: 'RUNNING' }));
      await first;
    });
    expect(result.current.isActionPending).toBe(false);
  });

  it('falls back to the error message for unknown errors', async () => {
    api.getSessionApi.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useSimulationSession('4827'));
    await waitFor(() => expect(result.current.errorMessage).toBe('boom'));
  });

  it('does nothing when no session is selected', async () => {
    const { result } = renderHook(() => useSimulationSession(null));
    let ok = true;
    await act(async () => {
      ok = await result.current.nextDay();
    });
    expect(ok).toBe(false);
    expect(api.nextDaySessionApi).not.toHaveBeenCalled();
  });
});
