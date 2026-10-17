import type { CartItem } from '@/types/cart';

type Props = {
  items: CartItem[];
  isSimulation: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
};

function CheckoutFooter({ items, isSimulation, isSubmitting, onSubmit }: Props) {
  const hasUnpricedItems = items.some((cartItem) => cartItem.article.price === null);

  const pricedTotal = items.reduce((runningTotal, cartItem) => {
    if (cartItem.article.price === null) return runningTotal;
    return runningTotal + cartItem.article.price * cartItem.quantity;
  }, 0);

  return (
    <div className="flex flex-wrap items-center justify-between gap-md rounded-b-xl border-t border bg-card px-lg py-lg md:px-xxl">
      <div>
        <span className="text-sm text-ink-muted">
          {isSimulation ? 'Stückzahl' : 'Gesamtbetrag'}
        </span>
        <span className="ml-md text-lg font-bold text-ink">
          {isSimulation
            ? items.reduce((total, cartItem) => total + cartItem.quantity, 0)
            : `€${pricedTotal.toFixed(2)}`}
        </span>
        {hasUnpricedItems && !isSimulation && (
          <p className="mt-xxs text-xs text-ink-muted">* Artikel auf Anfrage nicht enthalten</p>
        )}
      </div>
      <button
        className="rounded-full border bg-primary px-xxxl py-md font-bold text-on-primary shadow-sticker-sm transition-shadow hover:shadow-sticker active:shadow-sticker-press disabled:opacity-40 disabled:shadow-none"
        disabled={items.length === 0 || isSubmitting}
        onClick={onSubmit}
        type="button"
      >
        {isSubmitting ? 'Bestellung wird gesendet…' : 'Bestellung Aufgeben'}
      </button>
    </div>
  );
}

export default CheckoutFooter;
