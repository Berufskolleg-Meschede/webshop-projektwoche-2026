import { CheckCircle2 } from 'lucide-react';

type Props = {
  orderId: number | null;
  onClose: () => void;
};

function OrderConfirmation({ orderId, onClose }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-lg px-xxxl py-16 text-center">
      <CheckCircle2 className="text-accent-green" size={56} strokeWidth={1.75} />
      <h3 className="text-2xl font-bold text-ink">Vielen Dank für Ihre Bestellung!</h3>
      <p className="text-sm text-ink-muted">
        {orderId !== null ? (
          <>
            Ihre Bestellnummer lautet <span className="font-semibold text-ink">#{orderId}</span>.
          </>
        ) : (
          'Ihre Bestellung wurde erfolgreich übermittelt.'
        )}
      </p>
      <button
        className="mt-lg rounded-full border bg-primary px-xxxl py-md font-bold text-on-primary shadow-sticker-sm transition-shadow hover:shadow-sticker active:shadow-sticker-press"
        onClick={onClose}
        type="button"
      >
        Weiter einkaufen
      </button>
    </div>
  );
}

export default OrderConfirmation;
