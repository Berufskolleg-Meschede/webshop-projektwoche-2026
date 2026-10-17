import { afterEach, beforeEach, vi } from 'vitest';

import { API_KEY_STORAGE_KEY } from '@/hooks/useApiKeyInit';
import { jsonResponse } from '@/test/fixtures';

import createApiKeyApi from './apikey/createApiKeyApi';
import listArticlesApi from './articles/listArticlesApi';
import callHealthApi from './health/callHealthApi';
import listInventoryApi from './inventory/listInventoryApi';
import createPurchaseOrderApi from './purchaseOrders/createPurchaseOrderApi';
import createSaleOrderApi from './saleOrders/createSaleOrderApi';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test');
  // A stored key keeps authenticated requests from fetching one first (see ensureApiKey).
  localStorage.setItem(API_KEY_STORAGE_KEY, 'test-key');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('listArticlesApi', () => {
  it('requests sellable articles and normalizes the payload', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        articles: [
          { id: 3, name: 'Deckel', type: 'lid', unit_price: '1.5', available_quantity: 4 },
          {
            article_id: 7,
            name: 'Gehäuse',
            price: null,
            image_url: 'x.png',
            available_quantity: -2,
          },
        ],
      })
    );
    const articles = await listArticlesApi();
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/article/list?sellableOnly=true');
    expect(articles).toEqual([
      {
        id: 3,
        name: 'Deckel',
        description: 'lid',
        price: 1.5,
        imageUrl: null,
        availableQuantity: 4,
      },
      {
        id: 7,
        name: 'Gehäuse',
        description: '',
        price: null,
        imageUrl: 'x.png',
        availableQuantity: 0,
      },
    ]);
  });

  it('drops articles without a valid id and tolerates a missing list', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ articles: [{ name: 'no id' }, { id: 0 }, null, 'str', { id: 2.5 }] })
    );
    expect(await listArticlesApi()).toEqual([]);

    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    expect(await listArticlesApi()).toEqual([]);
  });

  it('sorts A–Z (German, case-insensitive) with the id as tiebreaker', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        articles: [
          { id: 5, name: 'Gehäuse Silber' },
          { id: 4, name: 'deckel Grün' },
          { id: 9, name: 'Deckel Blau' },
          { id: 8, name: 'Deckel Blau' },
        ],
      })
    );
    const articles = await listArticlesApi();
    expect(articles.map(({ name, id }) => [name, id])).toEqual([
      ['Deckel Blau', 8],
      ['Deckel Blau', 9],
      ['deckel Grün', 4],
      ['Gehäuse Silber', 5],
    ]);
  });
});

describe('listInventoryApi', () => {
  it('normalizes inventory items', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        inventory_items: [{ id: 1, name: 'A', quantity: '5', base_color: 'red', type: 'housing' }],
      })
    );
    const result = await listInventoryApi();
    expect(result.source).toBe('inventory');
    expect(result.data).toEqual([
      { id: '1', name: 'A', quantity: 5, last_delivery: '', type: 'housing', color: 'red' },
    ]);
  });

  it('falls back to lid_color and the default type', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        inventory_items: [{ id: 'x', name: 'B', quantity: 'abc', lid_color: 'blue' }],
      })
    );
    const { data } = await listInventoryApi();
    expect(data[0]).toMatchObject({ color: 'blue', type: 'article', quantity: 0 });
  });

  it('uses the article list as fallback on server errors', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: 'boom' }, 500))
      .mockResolvedValueOnce(
        jsonResponse({ articles: [{ id: 2, name: 'Fallback', quantity: 1 }] })
      );
    const result = await listInventoryApi();
    expect(result.source).toBe('article-fallback');
    expect(result.warningMessage).toBeTruthy();
    expect(result.data[0].name).toBe('Fallback');
    expect(fetchMock.mock.calls[1][0]).toBe('http://api.test/article/list');
  });

  it('uses the fallback on network failures', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(jsonResponse({ articles: [] }));
    expect((await listInventoryApi()).source).toBe('article-fallback');
  });

  it('does not fall back on client errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 404));
    await expect(listInventoryApi()).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rethrows when the fallback fails as well', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({}, 500));
    await expect(listInventoryApi()).rejects.toMatchObject({ status: 500 });
  });
});

describe('createSaleOrderApi', () => {
  it('posts the order as JSON', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 42 }));
    const body = { customer_id: 1, products: [{ productId: 3, quantity: 2 }] };
    await expect(createSaleOrderApi(body)).resolves.toEqual({ id: 42 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/order/sale/create');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(body);
    expect((init.headers as Headers).get('Content-Type')).toBe('application/json');
  });
});

describe('createPurchaseOrderApi', () => {
  it('posts the purchase order as JSON', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await createPurchaseOrderApi({ supplier_id: 's1', products: [{ productId: 1, quantity: 1 }] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/order/purchase/create');
    expect(init.method).toBe('POST');
  });
});

describe('callHealthApi', () => {
  it('calls /health without an Authorization header', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'ok' }));
    await expect(callHealthApi()).resolves.toEqual({ status: 'ok' });
    expect((fetchMock.mock.calls[0][1].headers as Headers).has('Authorization')).toBe(false);
  });
});

describe('createApiKeyApi', () => {
  it('returns the created key', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ apikey: 'secret' }));
    await expect(createApiKeyApi()).resolves.toBe('secret');
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/apikey/create');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  it('throws with the status on failure', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));
    await expect(createApiKeyApi()).rejects.toThrow('500');
  });
});
