import { useState } from 'react';

import { isSessionCode } from '@/types/simulationRoles';

export const SIMULATION_SESSION_STORAGE_KEY = 'simulation_shop_session';
const SIMULATION_CUSTOMER_NAME_STORAGE_KEY = 'simulation_shop_customer_name';

function readStored(): string | null {
  try {
    const stored = sessionStorage.getItem(SIMULATION_SESSION_STORAGE_KEY);
    return stored && isSessionCode(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Simulation shop mode comes from `?session=XXXX&role=customer` (customer QR code) or
 * `?mode=simulation&session=XXXX`. The code is remembered in `sessionStorage` so a reload or
 * navigating within the app keeps the mode. Only 4-digit codes count.
 */
export function resolveSimulationSessionId(search: string): string | null {
  const params = new URLSearchParams(search);
  const sessionId = params.get('session');
  const isSimulationLink = params.get('role') === 'customer' || params.get('mode') === 'simulation';

  if (isSimulationLink && sessionId && isSessionCode(sessionId)) {
    try {
      sessionStorage.setItem(SIMULATION_SESSION_STORAGE_KEY, sessionId);
    } catch {
      // Storage may be blocked; the mode then only lasts until the page is reloaded without params.
    }
    return sessionId;
  }
  return readStored();
}

function readStoredName(): string {
  try {
    return sessionStorage.getItem(SIMULATION_CUSTOMER_NAME_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Forgets the remembered code and removes the simulation params from the address bar. */
function clearSimulationContext() {
  try {
    sessionStorage.removeItem(SIMULATION_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SIMULATION_CUSTOMER_NAME_STORAGE_KEY);
  } catch {
    // Storage may be blocked; nothing to forget then.
  }
  const url = new URL(window.location.href);
  ['session', 'role', 'mode'].forEach((key) => url.searchParams.delete(key));
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}

/** Session code of the running simulation when the shop is opened in simulation mode, else `null`. */
export function useSimulationShopContext(): {
  simulationSessionId: string | null;
  /** Name entered on the join page; prefills the checkout. Empty when none was given. */
  simulationCustomerName: string;
  leaveSimulation: () => void;
  /** A customer joined in-app (join page): switch the shop to simulation mode and remember it. */
  enterSimulation: (sessionId: string, customerName?: string) => void;
} {
  const [simulationSessionId, setSimulationSessionId] = useState(() =>
    resolveSimulationSessionId(window.location.search)
  );
  const [simulationCustomerName, setSimulationCustomerName] = useState(readStoredName);
  function enterSimulation(sessionId: string, customerName = '') {
    const name = customerName.trim();
    try {
      sessionStorage.setItem(SIMULATION_SESSION_STORAGE_KEY, sessionId);
      if (name) sessionStorage.setItem(SIMULATION_CUSTOMER_NAME_STORAGE_KEY, name);
    } catch {
      // Storage may be blocked; the mode then only lasts until the page is reloaded.
    }
    setSimulationSessionId(sessionId);
    if (name) setSimulationCustomerName(name);
  }
  function leaveSimulation() {
    clearSimulationContext();
    setSimulationSessionId(null);
    setSimulationCustomerName('');
  }
  return { simulationSessionId, simulationCustomerName, enterSimulation, leaveSimulation };
}
