import { useEffect, useState } from 'react';

import { getSessionApi } from '@/api/simulation/sessionApi';
import type { StationState } from '@/types/simulation';

export type StationsLoadState = 'loading' | 'ready' | 'error';

/**
 * One-shot load of a session's stations (live occupancy). Load errors only set `loadState`;
 * callers that do not need it may ignore it (the stations stay empty).
 */
export function useSessionStations(sessionId: string): {
  stations: StationState[];
  loadState: StationsLoadState;
} {
  const [stations, setStations] = useState<StationState[]>([]);
  const [loadState, setLoadState] = useState<StationsLoadState>('loading');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const session = await getSessionApi(sessionId, controller.signal);
        if (controller.signal.aborted) return;
        setStations(session?.stations ?? []);
        setLoadState('ready');
      } catch {
        if (!controller.signal.aborted) setLoadState('error');
      }
    }
    void load();
    return () => controller.abort();
  }, [sessionId]);

  return { stations, loadState };
}
