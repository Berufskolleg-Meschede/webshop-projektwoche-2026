import { useCallback, useState } from 'react';

import { createSessionApi, joinAsCustomerApi } from '@/api/simulation/sessionApi';

export const CREATE_SESSION_ERROR_MESSAGE = 'Sitzung konnte nicht erstellt werden.';

/**
 * Session entry calls of the simulation start page. `createSession` resolves to the new session
 * code, or `null` after setting `createError`. `joinAsCustomer` is best effort: it counts the
 * customer and swallows every error, so it never keeps the customer out of the shop.
 */
export function useCreateSession(): {
  isCreating: boolean;
  createError: string;
  createSession: () => Promise<string | null>;
  joinAsCustomer: (sessionId: string) => Promise<void>;
} {
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const createSession = useCallback(async () => {
    setIsCreating(true);
    setCreateError('');
    try {
      const created = await createSessionApi();
      return created.session_id;
    } catch {
      setCreateError(CREATE_SESSION_ERROR_MESSAGE);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  const joinAsCustomer = useCallback(async (sessionId: string) => {
    try {
      await joinAsCustomerApi(sessionId);
    } catch {
      // Counting is best effort.
    }
  }, []);

  return { isCreating, createError, createSession, joinAsCustomer };
}
