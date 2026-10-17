import { useCallback, useEffect, useRef, useState } from 'react';

import {
  claimStationApi,
  configureSessionApi,
  completeStationApi,
  produceBatchApi,
  reportDeviationApi,
  retrieveItemApi,
  finishDayApi,
  storeBatchApi,
  getSessionApi,
  releaseStationApi,
  nextDaySessionApi,
  setSessionStateApi,
} from '@/api/simulation/sessionApi';
import { SESSION_NOT_FOUND_MESSAGE, toApiErrorMessage } from '@/api/errorMessages';
import type {
  SessionConfigRequest,
  ShakerVariant,
  SimulationSession,
  SimulationState,
  StationId,
} from '@/types/simulation';

const SESSION_POLL_INTERVAL_MS = 1500;
/** A poll that gets no answer within this time is aborted so `isPolling` cannot hang forever. */
export const SESSION_POLL_TIMEOUT_MS = 10_000;

type FetchStatus = 'idle' | 'loading' | 'error' | 'success';

function toErrorMessage(error: unknown): string {
  return toApiErrorMessage(error, (apiError, detail) => {
    if (apiError.status === 404) return SESSION_NOT_FOUND_MESSAGE;
    if (apiError.status === 409) {
      // A claim conflict carries the holder's name only; other conflicts carry a full sentence.
      if (apiError.path.endsWith('/claim')) {
        return detail
          ? `Station ist bereits von ${detail} belegt.`
          : 'Diese Station ist bereits besetzt.';
      }
      return detail ?? 'Die Aktion ist im aktuellen Status nicht möglich.';
    }
    if (apiError.status === 422) return detail ?? 'Ungültige Eingabe.';
    return null;
  });
}

type SimulationSessionState = {
  session: SimulationSession | null;
  status: FetchStatus;
  errorMessage: string;
  actionErrorMessage: string;
  /** True while an action request is in flight; overlapping actions are rejected meanwhile. */
  isActionPending: boolean;
  setState: (state: SimulationState) => Promise<boolean>;
  claimStation: (stationId: StationId, studentName: string) => Promise<boolean>;
  releaseStation: (stationId: StationId) => Promise<boolean>;
  completeStation: (stationId: StationId) => Promise<boolean>;
  produceBatch: (variant: ShakerVariant, quantity: number) => Promise<boolean>;
  storeBatch: (batchId: string) => Promise<boolean>;
  reportDeviation: (batchId: string, reason: string, missingQuantity: number) => Promise<boolean>;
  retrieveItem: (variant: ShakerVariant, quantity: number) => Promise<boolean>;
  finishDay: () => Promise<boolean>;
  configure: (config: SessionConfigRequest) => Promise<boolean>;
  nextDay: () => Promise<boolean>;
};

/**
 * Keeps one simulation session in sync across devices by polling the backend.
 * Pass `null` while no session is selected. Actions apply the returned session
 * immediately (no wait for the next poll) and report failures via `actionErrorMessage`.
 */
export function useSimulationSession(
  sessionId: string | null,
  pollIntervalMs = SESSION_POLL_INTERVAL_MS
): SimulationSessionState {
  const [session, setSession] = useState<SimulationSession | null>(null);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [actionErrorMessage, setActionErrorMessage] = useState('');
  const [isActionPending, setIsActionPending] = useState(false);
  const isActionPendingRef = useRef(false);
  const sessionIdRef = useRef(sessionId);
  // Bumped around every action so a poll that started earlier cannot overwrite the action result.
  const actionVersionRef = useRef(0);

  useEffect(() => {
    sessionIdRef.current = sessionId;
    setSession(null);
    setErrorMessage('');
    setActionErrorMessage('');

    if (sessionId === null) {
      setStatus('idle');
      return;
    }
    setStatus('loading');

    let controller = new AbortController();
    // Polls never overlap: a slow answer (weak Wi-Fi, busy NAS) must be allowed to finish, so the
    // next tick or visibility refresh simply skips while one is in flight. Aborting is reserved
    // for a session switch or unmount (cleanup below).
    let isPolling = false;

    async function poll(id: string) {
      if (isPolling) return;
      isPolling = true;
      controller = new AbortController();
      const version = actionVersionRef.current;
      let isTimedOut = false;
      const timeoutId = window.setTimeout(() => {
        isTimedOut = true;
        controller.abort();
      }, SESSION_POLL_TIMEOUT_MS);
      try {
        const latest = await getSessionApi(id, controller.signal);
        if (version !== actionVersionRef.current || sessionIdRef.current !== id) return;
        setSession(latest);
        setStatus('success');
        setErrorMessage('');
      } catch (error) {
        // An answer for a switched session or one overtaken by an action must not leak an error.
        if (version !== actionVersionRef.current || sessionIdRef.current !== id) return;
        if (isTimedOut) {
          setErrorMessage('Server antwortet nicht. Bitte Verbindung prüfen.');
          setStatus('error');
          return;
        }
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setErrorMessage(toErrorMessage(error));
        setStatus('error');
      } finally {
        window.clearTimeout(timeoutId);
        isPolling = false;
      }
    }

    poll(sessionId);
    const intervalId = window.setInterval(() => poll(sessionId), pollIntervalMs);
    // Browsers throttle timers in background tabs (a worker's phone/tab can be hidden for minutes);
    // refresh immediately when the page becomes visible again instead of showing stale state.
    const id = sessionId;
    function handleVisibility() {
      if (document.visibilityState === 'visible') poll(id);
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      // Drop answers of polls that are still in flight (session switch or unmount).
      actionVersionRef.current += 1;
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(intervalId);
      controller.abort();
    };
  }, [sessionId, pollIntervalMs]);

  const runAction = useCallback(
    async (action: (id: string) => Promise<SimulationSession>): Promise<boolean> => {
      const id = sessionIdRef.current;
      if (id === null || isActionPendingRef.current) return false;
      isActionPendingRef.current = true;
      setIsActionPending(true);
      setActionErrorMessage('');
      actionVersionRef.current += 1;
      try {
        const updated = await action(id);
        actionVersionRef.current += 1;
        // Ignore a response that arrives after the user switched sessions.
        if (sessionIdRef.current === id) setSession(updated);
        return true;
      } catch (error) {
        setActionErrorMessage(toErrorMessage(error));
        return false;
      } finally {
        isActionPendingRef.current = false;
        setIsActionPending(false);
      }
    },
    []
  );

  return {
    session,
    status,
    errorMessage,
    actionErrorMessage,
    isActionPending,
    setState: (state) => runAction((id) => setSessionStateApi(id, state)),
    claimStation: (stationId, studentName) =>
      runAction((id) => claimStationApi(id, { student_name: studentName, station_id: stationId })),
    releaseStation: (stationId) => runAction((id) => releaseStationApi(id, stationId)),
    completeStation: (stationId) => runAction((id) => completeStationApi(id, stationId)),
    produceBatch: (variant, quantity) =>
      runAction((id) => produceBatchApi(id, { variant, quantity })),
    storeBatch: (batchId) => runAction((id) => storeBatchApi(id, batchId)),
    reportDeviation: (batchId, reason, missingQuantity) =>
      runAction((id) =>
        reportDeviationApi(id, { batch_id: batchId, reason, missing_quantity: missingQuantity })
      ),
    retrieveItem: (variant, quantity) =>
      runAction((id) => retrieveItemApi(id, { variant, quantity })),
    finishDay: () => runAction((id) => finishDayApi(id)),
    configure: (config) => runAction((id) => configureSessionApi(id, config)),
    nextDay: () => runAction((id) => nextDaySessionApi(id)),
  };
}
