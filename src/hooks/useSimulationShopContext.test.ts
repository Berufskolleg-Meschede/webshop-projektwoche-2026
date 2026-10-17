import { act, renderHook } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

import {
  SIMULATION_SESSION_STORAGE_KEY,
  resolveSimulationSessionId,
  useSimulationShopContext,
} from './useSimulationShopContext';

afterEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

describe('resolveSimulationSessionId', () => {
  it('detects the customer QR link and remembers the session', () => {
    expect(resolveSimulationSessionId('?session=4827&role=customer')).toBe('4827');
    expect(sessionStorage.getItem(SIMULATION_SESSION_STORAGE_KEY)).toBe('4827');
  });

  it('detects ?mode=simulation&session=…', () => {
    expect(resolveSimulationSessionId('?mode=simulation&session=0042')).toBe('0042');
  });

  it('falls back to the remembered session after a reload without parameters', () => {
    resolveSimulationSessionId('?session=4827&role=customer');
    expect(resolveSimulationSessionId('')).toBe('4827');
  });

  it('ignores station roles, invalid codes and a missing session', () => {
    expect(resolveSimulationSessionId('?session=4827&role=station3_production')).toBeNull();
    expect(resolveSimulationSessionId('?session=12&role=customer')).toBeNull();
    expect(resolveSimulationSessionId('?session=abcd&mode=simulation')).toBeNull();
    expect(resolveSimulationSessionId('?mode=simulation')).toBeNull();
    expect(sessionStorage.getItem(SIMULATION_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('ignores an invalid remembered value', () => {
    sessionStorage.setItem(SIMULATION_SESSION_STORAGE_KEY, 'nope');
    expect(resolveSimulationSessionId('')).toBeNull();
  });

  it('survives blocked storage', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    expect(resolveSimulationSessionId('?session=4827&role=customer')).toBe('4827');
    expect(resolveSimulationSessionId('')).toBeNull();
  });
});

describe('useSimulationShopContext', () => {
  it('reads the current URL', () => {
    window.history.replaceState(null, '', '/?session=4827&role=customer');
    const { result } = renderHook(() => useSimulationShopContext());
    expect(result.current.simulationSessionId).toBe('4827');
  });

  it('is null outside the simulation', () => {
    const { result } = renderHook(() => useSimulationShopContext());
    expect(result.current.simulationSessionId).toBeNull();
  });

  it('remembers the customer name from the join page and forgets it on leave', () => {
    const { result } = renderHook(() => useSimulationShopContext());
    expect(result.current.simulationCustomerName).toBe('');
    act(() => result.current.enterSimulation('4827', ' Mia K. '));
    expect(result.current.simulationCustomerName).toBe('Mia K.');
    expect(renderHook(() => useSimulationShopContext()).result.current.simulationCustomerName).toBe(
      'Mia K.'
    );
    act(() => result.current.leaveSimulation());
    expect(result.current.simulationCustomerName).toBe('');
    expect(sessionStorage.getItem('simulation_shop_customer_name')).toBeNull();
  });

  it('starts with an empty customer name when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useSimulationShopContext());
    expect(result.current.simulationCustomerName).toBe('');
  });
});
