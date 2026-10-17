import { useRef, useState } from 'react';

import { SESSION_NOT_FOUND_MESSAGE, toApiErrorMessage } from '@/api/errorMessages';
import createSaleOrderApi from '@/api/saleOrders/createSaleOrderApi';
import { addOrderApi } from '@/api/simulation/sessionApi';
import type { CartItem } from '@/types/cart';
import type { OrderItem } from '@/types/simulation';
import { variantForArticleId } from '@/types/simulationCatalog';

type PlaceOrderStatus = 'idle' | 'submitting' | 'success' | 'error';

type PlaceOrderState = {
  status: PlaceOrderStatus;
  errorMessage: string;
  orderId: number | null;
  placeOrder: (items: CartItem[], customerName?: string) => Promise<boolean>;
  reset: () => void;
};

/**
 * Arbitrary default customer ID ("the school") used for school project webshop orders.
 */
const DEFAULT_CUSTOMER_ID = 1;

function toSimulationErrorMessage(status: number): string | null {
  if (status === 409) return 'Die Tagesbestellung ist bereits geschlossen – die Simulation läuft.';
  if (status === 404) return SESSION_NOT_FOUND_MESSAGE;
  if (status === 422) return 'Ungültige Eingaben. Bitte die Angaben prüfen.';
  return null;
}

function toErrorMessage(error: unknown, isSimulation: boolean): string {
  return toApiErrorMessage(error, (apiError, detail) => {
    const simulationMessage = isSimulation ? toSimulationErrorMessage(apiError.status) : null;
    if (simulationMessage) return simulationMessage;
    if (apiError.status === 401 || apiError.status === 403) {
      return 'Keine Berechtigung für die Shop-API.';
    }
    if (apiError.status === 422) {
      return 'Ungültige Eingaben. Bitte die Angaben prüfen.';
    }
    if (apiError.status === 400 || apiError.status === 404) {
      return `Die Bestellung wurde abgelehnt${detail ? `: ${detail}` : '.'}`;
    }
    return null;
  });
}

/** Cart lines → simulation order positions; `null` if a line is not part of the static catalogue. */
function toOrderItems(items: CartItem[]): OrderItem[] | null {
  const orderItems: OrderItem[] = [];
  for (const { article, quantity } of items) {
    const variant = variantForArticleId(article.id);
    if (variant === null) return null;
    orderItems.push({ variant, quantity });
  }
  return orderItems;
}

/**
 * With `simulationSessionId` the order goes to the simulation server (`orders/add`) instead of
 * the ERP; the cart and confirmation behave the same.
 */
export function usePlaceOrder(simulationSessionId: string | null = null): PlaceOrderState {
  const [status, setStatus] = useState<PlaceOrderStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [orderId, setOrderId] = useState<number | null>(null);
  const isSubmittingRef = useRef(false);

  async function placeOrder(items: CartItem[], customerName = ''): Promise<boolean> {
    if (isSubmittingRef.current || items.length === 0) return false;
    isSubmittingRef.current = true;
    setStatus('submitting');
    setErrorMessage('');

    try {
      if (simulationSessionId === null) {
        const response = await createSaleOrderApi({
          customer_id: DEFAULT_CUSTOMER_ID,
          products: items.map((cartItem) => ({
            productId: cartItem.article.id,
            quantity: cartItem.quantity,
          })),
        });
        setOrderId(response?.id ?? null);
      } else {
        const orderItems = toOrderItems(items);
        if (orderItems === null) throw new Error('Ungültiger Artikel im Warenkorb.');
        const name = customerName.trim();
        await addOrderApi(simulationSessionId, {
          ...(name ? { customer_name: name } : {}),
          items: orderItems,
        });
      }
      setStatus('success');
      return true;
    } catch (error) {
      console.error('Failed to place order:', error);
      setErrorMessage(toErrorMessage(error, simulationSessionId !== null));
      setStatus('error');
      return false;
    } finally {
      isSubmittingRef.current = false;
    }
  }

  function reset() {
    setStatus('idle');
    setErrorMessage('');
    setOrderId(null);
  }

  return { status, errorMessage, orderId, placeOrder, reset };
}
