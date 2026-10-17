import { afterEach, vi } from 'vitest';

import { API_KEY_STORAGE_KEY } from '@/hooks/useApiKeyInit';

import getApiAuthToken from './getApiAuthToken';

describe('getApiAuthToken', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('prefers the stored API key (trimmed)', () => {
    vi.stubEnv('VITE_API_AUTH_TOKEN', 'env-token');
    localStorage.setItem(API_KEY_STORAGE_KEY, '  stored  ');
    expect(getApiAuthToken()).toBe('stored');
  });

  it('falls back to the env token when nothing is stored', () => {
    vi.stubEnv('VITE_API_AUTH_TOKEN', ' env-token ');
    expect(getApiAuthToken()).toBe('env-token');
  });

  it('ignores a blank stored key', () => {
    vi.stubEnv('VITE_API_AUTH_TOKEN', 'env-token');
    localStorage.setItem(API_KEY_STORAGE_KEY, '   ');
    expect(getApiAuthToken()).toBe('env-token');
  });

  it('returns an empty string when no token is configured', () => {
    vi.stubEnv('VITE_API_AUTH_TOKEN', '');
    expect(getApiAuthToken()).toBe('');
  });
});
