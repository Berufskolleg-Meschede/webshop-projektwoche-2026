import { ShoppingCart, X } from 'lucide-react';

import { resolveArticleImage } from '@/components/webshop/placeholderImage';
import type { CartItem } from '@/types/cart';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  cartCount: number;
  onRemove: (articleId: number) => void;
  onUpdateQuantity: (articleId: number, quantity: number) => void;
  onClearCart: () => void;
  onOpenCheckout: () => void;
  /** Simulation shop: there are no prices, so the footer shows the piece count instead. */
  isSimulation?: boolean;
};

function CartDrawer({
  isOpen,
  onClose,
  items,
  cartCount,
  onRemove,
  onUpdateQuantity,
  onClearCart,
  onOpenCheckout,
  isSimulation = false,
}: Props) {
  const hasUnpricedItems = items.some((cartItem) => cartItem.article.price === null);

  const pricedTotal = items.reduce((runningTotal, cartItem) => {
    if (cartItem.article.price === null) return runningTotal;
    return runningTotal + cartItem.article.price * cartItem.quantity;
  }, 0);

  return (
    <>
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-scrim transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      <aside
        aria-label="Warenkorb"
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-[22rem] flex-col border-l bg-bg shadow-sticker-lg transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-lg border-b bg-card px-xl py-xl">
          <button
            aria-label="Warenkorb schließen"
            className="rounded-full p-xs text-ink-muted transition-colors hover:bg-chip hover:text-ink"
            onClick={onClose}
            type="button"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
          <h2 className="text-2xl font-bold text-ink">Warenkorb</h2>
          {cartCount > 0 && (
            <span className="ml-auto rounded-full border bg-primary px-sm py-xxs text-xs font-semibold text-on-primary shadow-sticker-sm">
              {cartCount}
            </span>
          )}
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto px-lg py-lg">
          {items.length === 0 ? (
            <div className="mt-10 flex flex-col items-center gap-lg text-center">
              <ShoppingCart className="text-ink-muted" size={48} strokeWidth={1.5} />
              <p className="text-sm text-ink-muted">Ihr Warenkorb ist noch leer.</p>
              <button
                className="rounded-full border bg-primary px-xl py-sm text-sm font-semibold text-on-primary shadow-sticker-sm transition-shadow hover:shadow-sticker active:shadow-sticker-press"
                onClick={onClose}
                type="button"
              >
                Jetzt Produkte ansehen
              </button>
            </div>
          ) : (
            <ul className="flex flex-col gap-md">
              {items.map(({ article, quantity }) => (
                <li
                  className="relative flex gap-md rounded-lg border bg-card p-md shadow-sticker-sm"
                  key={article.id}
                >
                  <img
                    alt={resolveArticleImage(article.imageUrl, article.name, isSimulation).alt}
                    className="h-16 w-16 flex-shrink-0 rounded-md object-cover"
                    src={resolveArticleImage(article.imageUrl, article.name, isSimulation).src}
                  />

                  <div className="flex flex-1 flex-col justify-between overflow-hidden">
                    <div className="pr-xl">
                      <p className="truncate text-sm font-semibold text-ink">{article.name}</p>
                      {!isSimulation && (
                        <p className="mt-xxs text-sm text-ink-muted">
                          {article.price !== null
                            ? `€${article.price.toFixed(2)}`
                            : 'Preis auf Anfrage'}
                        </p>
                      )}
                    </div>

                    <div className="mt-sm flex items-center gap-sm">
                      <button
                        aria-label="Menge verringern"
                        className="flex h-6 w-6 items-center justify-center rounded-full border bg-chip text-ink transition-all hover:bg-card hover:shadow-sticker-sm active:shadow-sticker-press"
                        onClick={() => onUpdateQuantity(article.id, quantity - 1)}
                        type="button"
                      >
                        <span className="mb-px text-sm leading-none">−</span>
                      </button>
                      <span className="w-5 text-center text-sm font-semibold text-ink">
                        {quantity}
                      </span>
                      <button
                        aria-label="Menge erhöhen"
                        className="flex h-6 w-6 items-center justify-center rounded-full border bg-chip text-ink transition-all hover:bg-card hover:shadow-sticker-sm active:shadow-sticker-press disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                        disabled={quantity >= article.availableQuantity}
                        onClick={() => onUpdateQuantity(article.id, quantity + 1)}
                        type="button"
                      >
                        <span className="mb-px text-sm leading-none">+</span>
                      </button>
                    </div>
                  </div>

                  <button
                    aria-label={`${article.name} entfernen`}
                    className="absolute right-2.5 top-2.5 rounded-full p-xxs text-primary transition-colors hover:bg-chip hover:text-primary"
                    onClick={() => onRemove(article.id)}
                    type="button"
                  >
                    <X size={15} strokeWidth={2.5} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border bg-card px-xl pb-xxl pt-lg">
          {items.length > 0 && (
            <div className="mb-md flex justify-end">
              <button
                className="text-xs text-ink-muted underline-offset-2 transition-colors hover:text-primary hover:underline"
                onClick={onClearCart}
                type="button"
              >
                Warenkorb leeren
              </button>
            </div>
          )}
          <div className="mb-xs flex items-center justify-between">
            <span className="text-base font-semibold text-ink">
              {isSimulation ? 'Stückzahl' : 'Preis'}
            </span>
            <span className="text-lg font-bold text-ink">
              {isSimulation ? cartCount : `€${pricedTotal.toFixed(2)}`}
            </span>
          </div>
          {hasUnpricedItems && !isSimulation && (
            <p className="mb-md text-right text-xs text-ink-muted">
              * Artikel auf Anfrage nicht enthalten
            </p>
          )}
          <button
            className="mt-md w-full rounded-full border bg-primary py-md text-sm font-bold tracking-wide text-on-primary shadow-sticker-sm transition-shadow hover:shadow-sticker active:shadow-sticker-press disabled:opacity-40 disabled:shadow-none"
            disabled={items.length === 0}
            onClick={() => {
              onClose();
              onOpenCheckout();
            }}
            type="button"
          >
            Zur Kasse
          </button>
        </div>
      </aside>
    </>
  );
}

export default CartDrawer;
