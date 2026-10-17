import requestApi from '../requestApi';

export type Article = {
  id: number;
  name: string;
  description: string;
  price: number | null;
  imageUrl: string | null;
  availableQuantity: number;
};

function toStr(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function toNullableNum(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

let warnedMissingQuantity = false;

export function resetMissingQuantityWarning(): void {
  warnedMissingQuantity = false;
}

function normalizeArticles(payload: Record<string, unknown>): Article[] {
  const rawItems = Array.isArray(payload.articles) ? payload.articles : [];

  const items = rawItems.filter(
    (item): item is Record<string, unknown> => typeof item === 'object' && item !== null
  );

  if (!warnedMissingQuantity && items.some((item) => !('available_quantity' in item))) {
    warnedMissingQuantity = true;
    console.warn(
      'Article list: "available_quantity" is missing in the ERP response, treating as 0.'
    );
  }

  return (
    items
      .map((item) => ({
        id: toNullableNum(item.id ?? item.article_id) ?? 0,
        name: toStr(item.name),
        description: toStr(item.description ?? item.type),
        price: toNullableNum(item.price ?? item.unit_price),
        imageUrl: toStr(item.image_url ?? item.imageUrl) || null,
        availableQuantity: Math.max(toNullableNum(item.available_quantity) ?? 0, 0),
      }))
      // Articles without a valid id cannot be ordered — drop them to avoid silent cart corruption.
      .filter((article) => Number.isInteger(article.id) && article.id > 0)
      // Deterministic A–Z order (German, case-insensitive) so tiles keep their position on refetch.
      .sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }) || a.id - b.id)
  );
}

export default async function listArticlesApi(signal?: AbortSignal): Promise<Article[]> {
  const response = await requestApi<Record<string, unknown>>('/article/list?sellableOnly=true', {
    signal,
  });
  return normalizeArticles(response);
}
