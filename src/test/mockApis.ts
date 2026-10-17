import { vi } from 'vitest';

export const createSaleOrderApi = vi.fn();
export const addOrderApi = vi.fn();

// Module factories for `vi.mock`; the dynamic import keeps them valid after vi.mock hoisting.
export const saleOrderApiModule = () => ({
  default: (body: unknown) => createSaleOrderApi(body),
});

export const sessionApiModule = () => ({
  addOrderApi: (sessionId: string, body: unknown) => addOrderApi(sessionId, body),
});
