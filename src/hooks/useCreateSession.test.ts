import { act, renderHook } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';

import * as sessionApi from '@/api/simulation/sessionApi';
import { makeSession } from '@/test/fixtures';

import { useCreateSession } from './useCreateSession';

vi.mock('@/api/simulation/sessionApi');
const api = vi.mocked(sessionApi);

beforeEach(() => vi.resetAllMocks());

describe('useCreateSession', () => {
  it('resolves to the new session code', async () => {
    api.createSessionApi.mockResolvedValue(makeSession({ session_id: '4827' }));
    const { result } = renderHook(() => useCreateSession());
    let id: string | null = null;
    await act(async () => {
      id = await result.current.createSession();
    });
    expect(id).toBe('4827');
    expect(result.current.isCreating).toBe(false);
    expect(result.current.createError).toBe('');
  });

  it('reports a failed creation with the fixed message and clears it on retry', async () => {
    api.createSessionApi.mockRejectedValueOnce(new Error('x'));
    const { result } = renderHook(() => useCreateSession());
    let id: string | null = 'unset';
    await act(async () => {
      id = await result.current.createSession();
    });
    expect(id).toBeNull();
    expect(result.current.createError).toBe('Sitzung konnte nicht erstellt werden.');
    expect(result.current.isCreating).toBe(false);

    api.createSessionApi.mockResolvedValueOnce(makeSession({ session_id: '1111' }));
    await act(async () => {
      id = await result.current.createSession();
    });
    expect(id).toBe('1111');
    expect(result.current.createError).toBe('');
  });

  it('counts the customer join and swallows its errors', async () => {
    api.joinAsCustomerApi.mockResolvedValueOnce(makeSession());
    const { result } = renderHook(() => useCreateSession());
    await act(async () => {
      await result.current.joinAsCustomer('4827');
    });
    expect(api.joinAsCustomerApi).toHaveBeenCalledWith('4827');

    api.joinAsCustomerApi.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await expect(result.current.joinAsCustomer('4827')).resolves.toBeUndefined();
    });
  });
});
