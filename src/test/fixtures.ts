import type { Article } from '@/api/articles/listArticlesApi';
import type { CartItem } from '@/types/cart';
import type { Batch, SimulationSession, StationState } from '@/types/simulation';

export function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 1,
    name: 'Gehäuse rot',
    description: 'Rotes Gehäuse',
    price: 2.5,
    imageUrl: null,
    availableQuantity: 5,
    ...overrides,
  };
}

export function makeCartItem(overrides: Partial<Article> = {}, quantity = 1): CartItem {
  return { article: makeArticle(overrides), quantity };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

export function makeSession(overrides: Partial<SimulationSession> = {}): SimulationSession {
  return {
    session_id: '4827',
    run_id: 1,
    state: 'CONFIGURING',
    strategy: 'PULL',
    daily_production_limits: {},
    daily_orders: {},
    customer_count: 0,
    batches: [],
    replenishment_queue: [],
    orders: [],
    stock: {},
    retrieved: {},
    shortfall: {},
    carried_over: {},
    ended_by_teacher: false,
    created_at: '2026-10-13T08:00:00Z',
    stations: ([1, 2, 3, 4, 5] as const).map((station_id) => ({
      station_id,
      status: 'IDLE' as const,
      claimed_by: null,
      has_error: false,
    })),
    ...overrides,
  };
}

export function makeBatch(overrides: Partial<Batch> = {}): Batch {
  return {
    batch_id: 'b1',
    variant: 'S-RT',
    quantity: 2,
    status: 'PRODUCED',
    is_replenishment: false,
    reject_reason: null,
    created_at: '',
    ...overrides,
  };
}

export function makeStation(
  station_id: StationState['station_id'],
  overrides: Partial<StationState> = {}
): StationState {
  return { station_id, status: 'IDLE', claimed_by: null, has_error: false, ...overrides };
}
