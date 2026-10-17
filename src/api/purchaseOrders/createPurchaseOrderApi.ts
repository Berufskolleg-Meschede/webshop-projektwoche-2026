import requestApi from '../requestApi';

export interface CreatePurchaseOrderRequest {
  supplier_id: string;
  products: Array<{
    productId: number;
    quantity: number;
  }>;
}

export default function createPurchaseOrderApi(body: CreatePurchaseOrderRequest) {
  return requestApi<Record<string, unknown> | null>('/order/purchase/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
