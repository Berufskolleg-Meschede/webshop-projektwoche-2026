import { useState } from 'react';

import {
  getResponseDetail,
  NETWORK_ERROR_MESSAGE,
  SESSION_NOT_FOUND_MESSAGE,
} from '@/api/errorMessages';
import { ApiRequestError } from '@/api/requestApi';
import { claimStationApi, releaseStationApi } from '@/api/simulation/sessionApi';
import type { StationId } from '@/types/simulation';

export const CLAIM_STORAGE_KEY = 'bkm-simulation-claim';

type StoredClaim = { sessionId: string; stationId: StationId; name: string };
type ClaimStatus = 'idle' | 'claiming' | 'claimed' | 'occupied' | 'error';

type RoleClaimState = {
  status: ClaimStatus;
  studentName: string;
  message: string;
  /** Holder of the station when the claim was refused (409), if the backend named them. */
  occupiedBy: string | null;
  claim: (studentName: string) => Promise<boolean>;
  release: () => Promise<boolean>;
  /** Drops the stored claim without a server call (the session is gone). */
  forget: () => void;
};

function readStoredClaim(sessionId: string, stationId: StationId): StoredClaim | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(CLAIM_STORAGE_KEY) ?? 'null') as StoredClaim;
    return stored?.sessionId === sessionId && stored.stationId === stationId ? stored : null;
  } catch {
    return null;
  }
}

function writeStoredClaim(claim: StoredClaim | null) {
  try {
    if (claim) sessionStorage.setItem(CLAIM_STORAGE_KEY, JSON.stringify(claim));
    else sessionStorage.removeItem(CLAIM_STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode): the claim still works, it just is not restored on reload.
  }
}

/**
 * Takes and frees one station for this device. A reload keeps the claim via sessionStorage.
 * `release` is the device's own "Station verlassen"; students cannot free a station held by someone else (#90).
 */
export function useRoleClaim(sessionId: string, stationId: StationId): RoleClaimState {
  const stored = readStoredClaim(sessionId, stationId);
  const [status, setStatus] = useState<ClaimStatus>(stored ? 'claimed' : 'idle');
  const [studentName, setStudentName] = useState(stored?.name ?? '');
  const [message, setMessage] = useState('');
  const [occupiedBy, setOccupiedBy] = useState<string | null>(null);

  async function claim(name: string): Promise<boolean> {
    const trimmedName = name.trim();
    if (!trimmedName) return false;
    setStatus('claiming');
    setMessage('');
    setOccupiedBy(null);
    try {
      await claimStationApi(sessionId, { student_name: trimmedName, station_id: stationId });
      writeStoredClaim({ sessionId, stationId, name: trimmedName });
      setStudentName(trimmedName);
      setStatus('claimed');
      return true;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) {
        const detail = getResponseDetail(error.responseBody);
        setOccupiedBy(detail);
        setMessage(
          detail !== null
            ? `Station ist bereits von ${detail} belegt.`
            : 'Station ist bereits von einem anderen Benutzer belegt.'
        );
        setStatus('occupied');
      } else if (error instanceof ApiRequestError && error.status === 404) {
        setMessage(SESSION_NOT_FOUND_MESSAGE);
        setStatus('error');
      } else {
        setMessage(NETWORK_ERROR_MESSAGE);
        setStatus('error');
      }
      return false;
    }
  }

  async function release(): Promise<boolean> {
    try {
      await releaseStationApi(sessionId, stationId);
    } catch {
      setMessage('Station konnte nicht freigegeben werden.');
      setStatus('error');
      return false;
    }
    writeStoredClaim(null);
    setStudentName('');
    setMessage('');
    setStatus('idle');
    return true;
  }

  function forget() {
    writeStoredClaim(null);
  }

  return { status, studentName, message, occupiedBy, claim, release, forget };
}
