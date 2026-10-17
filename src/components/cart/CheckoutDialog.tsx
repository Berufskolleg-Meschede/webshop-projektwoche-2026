import { useEffect, useState } from 'react';

import { X } from 'lucide-react';

import Overlay from '@/components/common/Overlay';
import { usePlaceOrder } from '@/hooks/usePlaceOrder';
import type { CartItem } from '@/types/cart';
import type { PaymentMethod } from '@/types/checkout';
import CheckoutFooter from './CheckoutFooter';
import CheckoutItemList from './CheckoutItemList';
import OrderConfirmation from './OrderConfirmation';
import PaymentMethodPicker from './PaymentMethodPicker';
import SimulationOrderForm from './SimulationOrderForm';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onRemove: (articleId: number) => void;
  onUpdateQuantity: (articleId: number, quantity: number) => void;
  onOrderPlaced: () => void;
  /** Session code in simulation mode: no payment step, the order goes to the simulation. */
  simulationSessionId?: string | null;
  /** Name from the join page; prefills the (editable) name field in simulation mode. */
  initialCustomerName?: string;
};

function CheckoutDialog({
  isOpen,
  onClose,
  items,
  onRemove,
  onUpdateQuantity,
  onOrderPlaced,
  simulationSessionId = null,
  initialCustomerName = '',
}: Props) {
  const isSimulation = simulationSessionId !== null;
  const [customerName, setCustomerName] = useState(initialCustomerName);
  // The dialog stays mounted, so the name from the join page arrives after the first render.
  useEffect(() => setCustomerName(initialCustomerName), [initialCustomerName]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const { status, errorMessage, orderId, placeOrder, reset } = usePlaceOrder(simulationSessionId);

  const isSubmitting = status === 'submitting';
  const paymentError =
    !isSimulation && hasAttemptedSubmit && selectedPaymentMethod === null
      ? 'Bitte eine Bezahlmethode auswählen.'
      : null;

  function handleClose() {
    if (isSubmitting) return;
    if (status === 'error') reset();
    if (status === 'success') {
      reset();
      setHasAttemptedSubmit(false);
      setSelectedPaymentMethod(null);
      setCustomerName(initialCustomerName);
    }
    onClose();
  }

  async function handleSubmit() {
    setHasAttemptedSubmit(true);
    if (!isSimulation && selectedPaymentMethod === null) return;

    const isPlaced = await placeOrder(items, customerName);
    if (isPlaced) onOrderPlaced();
  }

  if (!isOpen) return null;

  return (
    <Overlay zIndex="z-40">
      <div className="z-50 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border bg-bg shadow-sticker-lg">
        <div className="flex items-center border-b border px-xxl py-lg">
          <h2 className="flex-1 text-center text-2xl font-bold text-ink">Kasse</h2>
          <button
            aria-label="Dialog schließen"
            className="rounded-full p-xs text-ink-muted transition-colors hover:bg-chip hover:text-ink disabled:opacity-40"
            disabled={isSubmitting}
            onClick={handleClose}
            type="button"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {status === 'success' ? (
          <OrderConfirmation onClose={handleClose} orderId={orderId} />
        ) : (
          <>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
              <div className="w-full border-b border px-lg py-lg md:w-2/5 md:overflow-y-auto md:border-b-0 md:border-r">
                <CheckoutItemList
                  isSimulation={isSimulation}
                  isSubmitting={isSubmitting}
                  items={items}
                  onRemove={onRemove}
                  onUpdateQuantity={onUpdateQuantity}
                />
              </div>

              <div className="px-lg py-xxl md:flex-1 md:overflow-y-auto md:px-xxxl">
                {isSimulation ? (
                  <SimulationOrderForm
                    customerName={customerName}
                    disabled={isSubmitting}
                    onCustomerNameChange={setCustomerName}
                  />
                ) : (
                  <PaymentMethodPicker
                    disabled={isSubmitting}
                    onSelect={setSelectedPaymentMethod}
                    selected={selectedPaymentMethod}
                  />
                )}
                {paymentError && <p className="mt-sm text-xs text-danger-ink">{paymentError}</p>}

                {status === 'error' && (
                  <p
                    className="mt-xl rounded-lg border bg-card px-lg py-md text-sm text-danger-ink"
                    role="alert"
                  >
                    {errorMessage}
                  </p>
                )}
              </div>
            </div>

            <CheckoutFooter
              isSimulation={isSimulation}
              isSubmitting={isSubmitting}
              items={items}
              onSubmit={handleSubmit}
            />
          </>
        )}
      </div>
    </Overlay>
  );
}

export default CheckoutDialog;
