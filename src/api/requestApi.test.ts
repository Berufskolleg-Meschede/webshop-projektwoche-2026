import { afterEach, vi } from 'vitest';

import { API_KEY_STORAGE_KEY } from '@/hooks/useApiKeyInit';

import requestApi, { ApiRequestError } from './requestApi';

function mockFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('requestApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses a JSON response', async () => {
    mockFetch(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await expect(requestApi('/health', { withAuth: false })).resolves.toEqual({ ok: true });
  });

  it('sends the stored API key as bearer token', async () => {
    localStorage.setItem(API_KEY_STORAGE_KEY, 'test-key');
    const fetchMock = mockFetch(new Response('{}', { status: 200 }));
    await requestApi('/article/list');
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer test-key');
  });

  it('waits for the API key on first load before sending the request', async () => {
    const fetchMock = vi.fn<typeof fetch>((input) =>
      Promise.resolve(
        String(input).includes('/apikey/create')
          ? new Response(JSON.stringify({ apikey: 'fresh-key' }), { status: 200 })
          : new Response('{}', { status: 200 })
      )
    );
    vi.stubGlobal('fetch', fetchMock);
    await requestApi('/article/list');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/apikey/create');
    const headers = fetchMock.mock.calls[1][1]?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer fresh-key');
  });

  it('still sends the request with the fallback token when the key cannot be fetched', async () => {
    const fetchMock = vi.fn<typeof fetch>((input) =>
      Promise.resolve(
        String(input).includes('/apikey/create')
          ? new Response('boom', { status: 500 })
          : new Response('{"ok":true}', { status: 200 })
      )
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(requestApi('/article/list')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws ApiRequestError with status and body on HTTP errors', async () => {
    mockFetch(new Response(JSON.stringify({ detail: 'nope' }), { status: 401 }));
    await expect(requestApi('/x', { withAuth: false })).rejects.toMatchObject({
      name: 'ApiRequestError',
      status: 401,
      responseBody: { detail: 'nope' },
    });
    expect(new ApiRequestError('m', 1, '/p', null)).toBeInstanceOf(Error);
  });
});

describe('requestApi body handling', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns null for empty bodies and raw text for non-JSON', async () => {
    mockFetch(new Response('', { status: 200 }));
    await expect(requestApi('/a', { withAuth: false })).resolves.toBeNull();
    mockFetch(new Response('plain', { status: 200 }));
    await expect(requestApi('/a', { withAuth: false })).resolves.toBe('plain');
  });

  it('keeps caller headers and request init', async () => {
    const fetchMock = mockFetch(new Response('{}', { status: 200 }));
    await requestApi('/a', { method: 'POST', headers: { 'X-Test': '1' }, withAuth: false });
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect((init.headers as Headers).get('X-Test')).toBe('1');
  });
});

describe('requestApi stale key recovery', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  function stubErpFetch(rejectStatus: number, rejectBody: string, createStatus = 200) {
    const fetchMock = vi.fn<typeof fetch>((input, init) => {
      if (String(input).includes('/apikey/create')) {
        return Promise.resolve(
          createStatus === 200
            ? new Response(JSON.stringify({ apikey: 'new-key' }), { status: 200 })
            : new Response('boom', { status: createStatus })
        );
      }
      const auth = (init?.headers as Headers).get('Authorization');
      return Promise.resolve(
        auth === 'Bearer new-key'
          ? new Response('{"ok":true}', { status: 200 })
          : new Response(rejectBody, { status: rejectStatus })
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it.each([
    [404, '{"detail":"Key not found"}'],
    [401, '{"detail":"Unauthorized"}'],
  ])('replaces a rejected stored key (%i) and retries once', async (status, body) => {
    localStorage.setItem(API_KEY_STORAGE_KEY, 'stale-key');
    const fetchMock = stubErpFetch(status, body);

    await expect(requestApi('/article/list')).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/apikey/create');
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBe('new-key');
  });

  it('does not loop when the retry is rejected again', async () => {
    localStorage.setItem(API_KEY_STORAGE_KEY, 'stale-key');
    const fetchMock = vi.fn<typeof fetch>((input) =>
      Promise.resolve(
        String(input).includes('/apikey/create')
          ? new Response(JSON.stringify({ apikey: 'new-key' }), { status: 200 })
          : new Response('Key not found', { status: 404 })
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestApi('/article/list')).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('keeps the original error when the new key cannot be fetched', async () => {
    localStorage.setItem(API_KEY_STORAGE_KEY, 'stale-key');
    const fetchMock = stubErpFetch(401, 'nope', 500);

    await expect(requestApi('/article/list')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not recover from a 404 that is not "Key not found"', async () => {
    localStorage.setItem(API_KEY_STORAGE_KEY, 'good-key');
    const fetchMock = stubErpFetch(404, '{"detail":"Article not found"}');

    await expect(requestApi('/article/9')).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBe('good-key');
  });

  it('does not recover other failures or unauthenticated requests', async () => {
    localStorage.setItem(API_KEY_STORAGE_KEY, 'good-key');
    const fetchMock = stubErpFetch(500, 'Key not found');
    await expect(requestApi('/a')).rejects.toMatchObject({ status: 500 });
    await expect(requestApi('/a', { withAuth: false })).rejects.toMatchObject({ status: 500 });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    stubErpFetch(401, 'nope');
    await expect(requestApi('/a', { withAuth: false })).rejects.toMatchObject({ status: 401 });
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBe('good-key');
  });

  it('does not drop a key that was already replaced by a concurrent request', async () => {
    localStorage.setItem(API_KEY_STORAGE_KEY, 'stale-key');
    const fetchMock = stubErpFetch(401, 'nope');

    await Promise.all([requestApi('/a'), requestApi('/b')]);

    const created = fetchMock.mock.calls.filter(([url]) => String(url).includes('/apikey/create'));
    expect(created).toHaveLength(1);
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBe('new-key');
  });
});
