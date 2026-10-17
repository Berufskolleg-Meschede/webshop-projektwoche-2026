import { afterEach, beforeEach, vi } from 'vitest';

import { API_KEY_STORAGE_KEY } from '@/hooks/useApiKeyInit';

import listArticlesApi, { resetMissingQuantityWarning } from './listArticlesApi';

function mockArticles(articles: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify({ articles }), { status: 200 })))
  );
}

const erpArticleFull = {
  id: 7,
  name: 'Brotdose',
  lid_color: 'red',
  base_color: 'blue',
  description: 'Lunchbox',
  price: 12.5,
  quantity: 10,
  reserved_quantity: 2,
  incoming_quantity: 0,
  min_capacity: 0,
  max_capacity: 100,
  is_sellable: true,
  is_producable: true,
  is_purchasable: false,
  preferred_supplier_id: null,
  available_quantity: 8,
  reorder_quantity: 5,
};

describe('listArticlesApi', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetMissingQuantityWarning();
    localStorage.setItem(API_KEY_STORAGE_KEY, 'test-key');
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    warn.mockRestore();
  });

  it('keeps id, name, price and availableQuantity for the ERP ArticleFull shape', async () => {
    mockArticles([erpArticleFull]);
    const [article] = await listArticlesApi();
    expect(article).toMatchObject({
      id: 7,
      name: 'Brotdose',
      price: 12.5,
      availableQuantity: 8,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('normalises the old shape (string id and price) and treats the quantity as 0', async () => {
    mockArticles([
      {
        name: 'Alt',
        lid_color: 'red',
        base_color: 'blue',
        description: 'Old',
        price: '9.9',
        id: '3',
      },
    ]);
    const [article] = await listArticlesApi();
    expect(article).toMatchObject({ id: 3, name: 'Alt', price: 9.9, availableQuantity: 0 });
  });

  it('warns once per page load, not per item, when available_quantity is missing', async () => {
    mockArticles([
      { id: 1, name: 'A', price: 1 },
      { id: 2, name: 'B', price: 2 },
    ]);
    await listArticlesApi();
    await listArticlesApi();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('coerces a numeric name to text and drops articles without a valid id', async () => {
    mockArticles([
      { id: 3, name: 42, price: 1, available_quantity: 1 },
      { id: 'x', name: 'Ohne Id', price: 1, available_quantity: 1 },
    ]);
    const articles = await listArticlesApi();
    expect(articles.map((article) => article.name)).toEqual(['42']);
  });
});
