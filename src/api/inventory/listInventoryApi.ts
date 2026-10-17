import requestApi from '../requestApi';
import { ApiRequestError } from '../requestApi';

type InventoryDataSource = 'inventory' | 'article-fallback';

type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  last_delivery: string;
  type: string;
  color: string;
};

export type InventoryListResult = {
  data: InventoryItem[];
  source: InventoryDataSource;
  warningMessage?: string;
};

function toStringValue(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value);
}

function toNumberValue(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeItems(payload: Record<string, unknown>): InventoryItem[] {
  const rawItems = Array.isArray(payload.inventory_items)
    ? payload.inventory_items
    : Array.isArray(payload.articles)
      ? payload.articles
      : [];

  return rawItems
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: toStringValue(item.id),
      name: toStringValue(item.name),
      quantity: toNumberValue(item.quantity, 0),
      last_delivery: toStringValue(item.last_delivery),
      type: toStringValue(item.type, 'article'),
      color: toStringValue(
        item.color,
        toStringValue(item.base_color, toStringValue(item.lid_color))
      ),
    }));
}

function shouldUseArticleFallback(error: unknown): boolean {
  if (error instanceof ApiRequestError) {
    return error.status >= 500;
  }
  // TypeError is thrown by fetch for transport-level failures (e.g. network offline).
  return error instanceof TypeError;
}

export default async function listInventoryApi(signal?: AbortSignal): Promise<InventoryListResult> {
  try {
    const response = await requestApi<Record<string, unknown>>('/inventory/list', { signal });
    return { data: normalizeItems(response), source: 'inventory' };
  } catch (error) {
    if (!shouldUseArticleFallback(error)) {
      console.error('Failed to fetch inventory:', error);
      throw error;
    }

    try {
      const fallback = await requestApi<Record<string, unknown>>('/article/list', { signal });
      return {
        data: normalizeItems(fallback),
        source: 'article-fallback',
        warningMessage:
          'Inventory endpoint is unavailable. Showing article list as temporary fallback.',
      };
    } catch (fallbackError) {
      console.error('Failed to fetch inventory and article fallback:', {
        inventoryError: error,
        articleFallbackError: fallbackError,
      });
      throw fallbackError;
    }
  }
}
