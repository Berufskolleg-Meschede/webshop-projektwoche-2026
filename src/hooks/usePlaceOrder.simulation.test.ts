import { act, renderHook } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';

import { ApiRequestError } from '@/api/requestApi';
import { makeCartItem, makeSession } from '@/test/fixtures';
import { addOrderApi, createSaleOrderApi } from '@/test/mockApis';
import { SIMULATION_CATALOG } from '@/types/simulationCatalog';

import { usePlaceOrder } from './usePlaceOrder';

vi.mock('@/api/saleOrders/createSaleOrderApi', async () =>
  (await import('@/test/mockApis')).saleOrderApiModule()
);

vi.mock('@/api/simulation/sessionApi', async () =>
  (await import('@/test/mockApis')).sessionApiModule()
);

const [redSalt, , , , , blackPepper] = SIMULATION_CATALOG;
const cart = [
  { article: redSalt, quantity: 2 },
  { article: blackPepper, quantity: 3 },
];

function apiError(status: number) {
  return new ApiRequestError('failed', status, '/simulation/session/4827/orders/add', {
    detail: 'x',
  });
}

describe('usePlaceOrder in simulation mode', () => {
  beforeEach(() => {
    createSaleOrderApi.mockReset();
    addOrderApi.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('sends the cart as variants to the simulation and never calls the ERP', async () => {
    addOrderApi.mockResolvedValue(makeSession());
    const { result } = renderHook(() => usePlaceOrder('4827'));
    let placed = false;
    await act(async () => {
      placed = await result.current.placeOrder(cart, '  Mia ');
    });
    expect(placed).toBe(true);
    expect(addOrderApi).toHaveBeenCalledWith('4827', {
      customer_name: 'Mia',
      items: [
        { variant: 'S-RT', quantity: 2 },
        { variant: 'P-SW', quantity: 3 },
      ],
    });
    expect(createSaleOrderApi).not.toHaveBeenCalled();
    expect(result.current.status).toBe('success');
    expect(result.current.orderId).toBeNull();
  });

  it('omits an empty customer name', async () => {
    addOrderApi.mockResolvedValue(makeSession());
    const { result } = renderHook(() => usePlaceOrder('4827'));
    await act(() => result.current.placeOrder(cart, '   '));
    expect(addOrderApi).toHaveBeenCalledWith('4827', {
      items: [
        { variant: 'S-RT', quantity: 2 },
        { variant: 'P-SW', quantity: 3 },
      ],
    });
  });

  it.each([
    [409, 'Die Tagesbestellung ist bereits geschlossen – die Simulation läuft.'],
    [404, 'Sitzung nicht gefunden.'],
    [422, 'Ungültige Eingaben. Bitte die Angaben prüfen.'],
    [500, 'Serverfehler. Bitte später erneut versuchen.'],
  ])('maps HTTP %i to a simulation message', async (status, message) => {
    addOrderApi.mockRejectedValue(apiError(status));
    const { result } = renderHook(() => usePlaceOrder('4827'));
    let placed = true;
    await act(async () => {
      placed = await result.current.placeOrder(cart);
    });
    expect(placed).toBe(false);
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe(message);
  });

  it('rejects articles that are not part of the catalogue without calling any API', async () => {
    const { result } = renderHook(() => usePlaceOrder('4827'));
    await act(() => result.current.placeOrder([makeCartItem({ id: 42 })]));
    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toBe('Ungültiger Artikel im Warenkorb.');
    expect(addOrderApi).not.toHaveBeenCalled();
    expect(createSaleOrderApi).not.toHaveBeenCalled();
  });

  it('keeps the ERP flow and its messages without a simulation session', async () => {
    createSaleOrderApi.mockResolvedValue({ id: 5 });
    const { result } = renderHook(() => usePlaceOrder());
    await act(() => result.current.placeOrder([makeCartItem({ id: 4 }, 1)], 'Mia'));
    expect(createSaleOrderApi).toHaveBeenCalledWith({
      customer_id: 1,
      products: [{ productId: 4, quantity: 1 }],
    });
    expect(addOrderApi).not.toHaveBeenCalled();
    expect(result.current.orderId).toBe(5);

    createSaleOrderApi.mockRejectedValue(apiError(409));
    await act(() => result.current.placeOrder([makeCartItem()]));
    expect(result.current.errorMessage).toBe('Serverfehler. Bitte später erneut versuchen.');
  });
});
