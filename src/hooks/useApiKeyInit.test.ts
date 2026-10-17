import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';

const createApiKeyApi = vi.fn();
vi.mock('@/api/apikey/createApiKeyApi', () => ({ default: () => createApiKeyApi() }));

// The hook keeps module-level state, so every test needs a fresh module instance.
async function loadHook() {
  vi.resetModules();
  return import('./useApiKeyInit');
}

describe('useApiKeyInit', () => {
  beforeEach(() => {
    createApiKeyApi.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('fetches and stores a key when none exists', async () => {
    createApiKeyApi.mockResolvedValue('new-key');
    const { default: useApiKeyInit, API_KEY_STORAGE_KEY } = await loadHook();
    renderHook(() => useApiKeyInit());
    await waitFor(() => expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBe('new-key'));
  });

  it('does nothing when a key is already stored', async () => {
    const { default: useApiKeyInit, API_KEY_STORAGE_KEY } = await loadHook();
    localStorage.setItem(API_KEY_STORAGE_KEY, 'existing');
    renderHook(() => useApiKeyInit());
    expect(createApiKeyApi).not.toHaveBeenCalled();
  });

  it('requests no key when disabled (simulation mode)', async () => {
    const { default: useApiKeyInit } = await loadHook();
    renderHook(() => useApiKeyInit(false));
    expect(createApiKeyApi).not.toHaveBeenCalled();
  });

  it('does not fire a second request while one is in flight', async () => {
    createApiKeyApi.mockReturnValue(new Promise(() => {}));
    const { default: useApiKeyInit } = await loadHook();
    renderHook(() => useApiKeyInit());
    renderHook(() => useApiKeyInit());
    expect(createApiKeyApi).toHaveBeenCalledTimes(1);
  });

  it('ensureApiKey resolves a stored key without a request', async () => {
    const { ensureApiKey, API_KEY_STORAGE_KEY } = await loadHook();
    localStorage.setItem(API_KEY_STORAGE_KEY, 'existing');
    await expect(ensureApiKey()).resolves.toBe('existing');
    expect(createApiKeyApi).not.toHaveBeenCalled();
  });

  it('ensureApiKey shares one request between concurrent callers', async () => {
    createApiKeyApi.mockResolvedValue('shared-key');
    const { ensureApiKey, API_KEY_STORAGE_KEY } = await loadHook();
    const [first, second] = await Promise.all([ensureApiKey(), ensureApiKey()]);
    expect([first, second]).toEqual(['shared-key', 'shared-key']);
    expect(createApiKeyApi).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBe('shared-key');
  });

  it('logs a failed request in the hook, rejects in ensureApiKey and fetches again on the next call', async () => {
    createApiKeyApi
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue('later');
    const { default: useApiKeyInit, ensureApiKey, API_KEY_STORAGE_KEY } = await loadHook();
    renderHook(() => useApiKeyInit());
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBeNull();
    await expect(ensureApiKey()).rejects.toThrow('down');
    await expect(ensureApiKey()).resolves.toBe('later');
  });
});
