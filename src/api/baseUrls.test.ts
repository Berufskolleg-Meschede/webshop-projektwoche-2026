import { afterEach, vi } from 'vitest';

import getApiBaseUrl from './getApiBaseUrl';
import getPublicBaseUrl from './getPublicBaseUrl';
import getSimulationBaseUrl from './getSimulationBaseUrl';

describe.each([
  {
    name: 'getApiBaseUrl',
    getBaseUrl: getApiBaseUrl,
    envKey: 'VITE_API_BASE_URL',
    fallback: () => 'http://localhost:8000',
    configured: ' https://api.example.com/// ',
    expected: 'https://api.example.com',
  },
  {
    name: 'getPublicBaseUrl',
    getBaseUrl: getPublicBaseUrl,
    envKey: 'VITE_PUBLIC_BASE_URL',
    fallback: () => window.location.origin,
    configured: ' http://192.0.2.10:51020// ',
    expected: 'http://192.0.2.10:51020',
  },
  {
    name: 'getSimulationBaseUrl',
    getBaseUrl: getSimulationBaseUrl,
    envKey: 'VITE_SIMULATION_API_BASE_URL',
    fallback: () => window.location.origin,
    configured: ' http://sim.test// ',
    expected: 'http://sim.test',
  },
])('$name', ({ getBaseUrl, envKey, fallback, configured, expected }) => {
  afterEach(() => vi.unstubAllEnvs());

  it('falls back when blank', () => {
    vi.stubEnv(envKey, '   ');
    expect(getBaseUrl()).toBe(fallback());
  });

  it('trims whitespace and trailing slashes from a configured address', () => {
    vi.stubEnv(envKey, configured);
    expect(getBaseUrl()).toBe(expected);
  });
});
