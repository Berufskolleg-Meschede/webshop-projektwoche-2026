import { act, renderHook } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';

import { ApiRequestError } from '@/api/requestApi';
import { createSaleOrderApi } from '@/test/mockApis';
import { makeCartItem } from '@/test/fixtures';

import { usePlaceOrder } from './usePlaceOrder';

vi.mock('@/api/saleOrders/createSaleOrderApi', async () =>
  (await import('@/test/mockApis')).saleOrderApiModule()
);

function apiError(status: number, body: unknown = null) {
  return new ApiRequestError('failed', status, '/order/sale/create', body);
}

async function placeFailing(error: unknown) {
  createSaleOrderApi.mockRejectedValue(error);
  const { result } = renderHook(() => usePlaceOrder());
  await act(() => result.current.placeOrder([makeCartItem()]));
  return result;
}

describe('usePlaceOrder', () => {
  beforeEach(() => {
    createSaleOrderApi.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('submits the mapped order and stores the order id', async () => {
    createSaleOrderApi.mockResolvedValue({ id: 99 });
    const { result } = renderHook(() => usePlaceOrder());
    let placed = false;
    await act(async () => {
      placed = await result.current.placeOrder([
        makeCartItem({ id: 4 }, 2),
        makeCartItem({ id: 5 }, 1),
      ]);
    });
    expect(placed).toBe(true);
    expect(createSaleOrderApi).toHaveBeenCalledWith({
      customer_id: 1,
      products: [
        { productId: 4, quantity: 2 },
        { productId: 5, quantity: 1 },
      ],
    });
    expect(result.current.status).toBe('success');
    expect(result.current.orderId).toBe(99);
  });

  it('stores a null order id when the response has none', async () => {
    createSaleOrderApi.mockResolvedValue(null);
    const { result } = renderHook(() => usePlaceOrder());
    await act(() => result.current.placeOrder([makeCartItem()]));
    expect(result.current.status).toBe('success');
    expect(result.current.orderId).toBeNull();
  });

  it('refuses an empty cart', async () => {
    const { result } = renderHook(() => usePlaceOrder());
    let placed = true;
    await act(async () => {
      placed = await result.current.placeOrder([]);
    });
    expect(placed).toBe(false);
    expect(createSaleOrderApi).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('blocks a second submit while one is running', async () => {
    let resolveOrder: (value: { id: number }) => void = () => {};
    createSaleOrderApi.mockReturnValue(new Promise((resolve) => (resolveOrder = resolve)));
    const { result } = renderHook(() => usePlaceOrder());
    let first: Promise<boolean> = Promise.resolve(false);
    let second = true;
    await act(async () => {
      first = result.current.placeOrder([makeCartItem()]);
      second = await result.current.placeOrder([makeCartItem()]);
    });
    expect(second).toBe(false);
    expect(result.current.status).toBe('submitting');
    await act(async () => {
      resolveOrder({ id: 1 });
      await first;
    });
    expect(createSaleOrderApi).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('success');
  });

  it.each([
    [401, null, 'Keine Berechtigung für die Shop-API.'],
    [403, null, 'Keine Berechtigung für die Shop-API.'],
    [422, null, 'Ungültige Eingaben. Bitte die Angaben prüfen.'],
    [400, { detail: 'Zu wenig Bestand' }, 'Die Bestellung wurde abgelehnt: Zu wenig Bestand'],
    [404, { detail: 42 }, 'Die Bestellung wurde abgelehnt.'],
    [400, 'text', 'Die Bestellung wurde abgelehnt.'],
    [500, null, 'Serverfehler. Bitte später erneut versuchen.'],
  ])('maps HTTP %i to a user message', async (status, body, message) => {
    const result = await placeFailing(apiError(status, body));
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe(message);
  });

  it('reports unreachable servers on TypeError', async () => {
    const result = await placeFailing(new TypeError('Failed to fetch'));
    expect(result.current.errorMessage).toBe('Server nicht erreichbar. Bitte Verbindung prüfen.');
  });

  it('passes through other error messages and handles unknown throws', async () => {
    let result = await placeFailing(new Error('Eigener Fehler'));
    expect(result.current.errorMessage).toBe('Eigener Fehler');
    result = await placeFailing('weird');
    expect(result.current.errorMessage).toBe('Unbekannter Fehler');
  });

  it('allows a retry after an error and resets state', async () => {
    const result = await placeFailing(apiError(500));
    createSaleOrderApi.mockResolvedValue({ id: 7 });
    await act(() => result.current.placeOrder([makeCartItem()]));
    expect(result.current.status).toBe('success');
    act(() => result.current.reset());
    expect(result.current).toMatchObject({ status: 'idle', errorMessage: '', orderId: null });
  });
});
