import { act, renderHook } from '@testing-library/react';

import { usePendingAction } from './usePendingAction';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('usePendingAction', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => usePendingAction());
    expect(result.current.isPending).toBe(false);
  });

  it('is pending while the action runs and idle again afterwards', async () => {
    const { result } = renderHook(() => usePendingAction());
    const action = deferred();
    const slowAction = vi.fn(() => action.promise);

    let running!: Promise<void>;
    act(() => {
      running = result.current.run(slowAction);
    });
    expect(slowAction).toHaveBeenCalledTimes(1);
    expect(result.current.isPending).toBe(true);

    await act(async () => {
      action.resolve();
      await running;
    });
    expect(result.current.isPending).toBe(false);
  });

  it('accepts a synchronous action', async () => {
    const { result } = renderHook(() => usePendingAction());
    const action = vi.fn();

    await act(() => result.current.run(action));

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.isPending).toBe(false);
  });

  it('propagates a rejection to the caller and resets the pending state', async () => {
    const { result } = renderHook(() => usePendingAction());
    const failure = new Error('failed');
    let caught: unknown;

    await act(async () => {
      try {
        await result.current.run(() => Promise.reject(failure));
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBe(failure);
    expect(result.current.isPending).toBe(false);
  });

  it('ignores a second call while one is pending', async () => {
    const { result } = renderHook(() => usePendingAction());
    const first = deferred();
    const firstAction = vi.fn(() => first.promise);
    const secondAction = vi.fn();

    let running!: Promise<void>;
    act(() => {
      running = result.current.run(firstAction);
    });
    await act(() => result.current.run(secondAction));

    expect(secondAction).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);

    await act(async () => {
      first.resolve();
      await running;
    });
    expect(firstAction).toHaveBeenCalledTimes(1);
  });

  it('runs again once the previous action has finished', async () => {
    const { result } = renderHook(() => usePendingAction());
    const action = vi.fn();

    await act(() => result.current.run(action));
    await act(() => result.current.run(action));

    expect(action).toHaveBeenCalledTimes(2);
  });

  it('runs again after a rejected action', async () => {
    const { result } = renderHook(() => usePendingAction());
    const next = vi.fn();

    await act(async () => {
      await result.current.run(() => Promise.reject(new Error('x'))).catch(() => undefined);
    });
    await act(() => result.current.run(next));

    expect(next).toHaveBeenCalledTimes(1);
  });
});
