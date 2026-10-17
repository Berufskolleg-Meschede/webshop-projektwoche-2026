import requestApi from '../requestApi';

export interface CreateSaleOrderRequest {
  customer_id: number;
  products: Array<{
    productId: number;
    quantity: number;
  }>;
}

export interface CreateSaleOrderResponse {
  id: number;
  customerId?: number;
  status?: string;
}

/**
 * Creates a customer order and reserves the ordered stock.
 * `status` is omitted on purpose so the backend default (`open`) applies.
 * The backend responds with the created sale order including its generated id.
 */
export default function createSaleOrderApi(body: CreateSaleOrderRequest) {
  return requestApi<CreateSaleOrderResponse>('/order/sale/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
