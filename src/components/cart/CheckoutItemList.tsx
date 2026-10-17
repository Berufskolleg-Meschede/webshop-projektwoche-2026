import { X } from 'lucide-react';

import { resolveArticleImage } from '@/components/webshop/placeholderImage';
import type { CartItem } from '@/types/cart';

type Props = {
  items: CartItem[];
  isSimulation: boolean;
  isSubmitting: boolean;
  onRemove: (articleId: number) => void;
  onUpdateQuantity: (articleId: number, quantity: number) => void;
};

function CheckoutItemList({
  items,
  isSimulation,
  isSubmitting,
  onRemove,
  onUpdateQuantity,
}: Props) {
  if (items.length === 0) {
    return <p className="mt-10 text-center text-sm text-ink-muted">Ihr Warenkorb ist leer.</p>;
  }

  return (
    <ul className="flex flex-col gap-md">
      {items.map(({ article, quantity }) => {
        const image = resolveArticleImage(article.imageUrl, article.name, isSimulation);
        return (
          <li
            className="relative flex gap-md rounded-lg border bg-card p-md shadow-sticker-sm"
            key={article.id}
          >
            <img
              alt={image.alt}
              className="h-16 w-16 flex-shrink-0 rounded-md bg-chip object-cover"
              src={image.src}
            />

            <div className="flex flex-1 flex-col justify-between overflow-hidden">
              <div className="pr-xl">
                <p className="truncate text-sm font-semibold text-ink">{article.name}</p>
                {!isSimulation && (
                  <p className="mt-xxs text-sm text-ink-muted">
                    {article.price !== null ? `€${article.price.toFixed(2)}` : 'Preis auf Anfrage'}
                  </p>
                )}
              </div>

              <div className="mt-sm flex items-center gap-sm">
                <button
                  aria-label="Menge verringern"
                  className="flex h-6 w-6 items-center justify-center rounded-full border border bg-chip text-ink-muted transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={isSubmitting}
                  onClick={() => onUpdateQuantity(article.id, quantity - 1)}
                  type="button"
                >
                  <span className="mb-px text-sm leading-none">−</span>
                </button>
                <span className="w-5 text-center text-sm font-semibold text-ink">{quantity}</span>
                <button
                  aria-label="Menge erhöhen"
                  className="flex h-6 w-6 items-center justify-center rounded-full border border bg-chip text-ink-muted transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={isSubmitting || quantity >= article.availableQuantity}
                  onClick={() => onUpdateQuantity(article.id, quantity + 1)}
                  type="button"
                >
                  <span className="mb-px text-sm leading-none">+</span>
                </button>
              </div>
            </div>

            <button
              aria-label={`${article.name} entfernen`}
              className="absolute right-2.5 top-2.5 rounded-full p-xxs text-primary transition-colors hover:bg-chip hover:text-primary disabled:opacity-40"
              disabled={isSubmitting}
              onClick={() => onRemove(article.id)}
              type="button"
            >
              <X size={15} strokeWidth={2.5} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default CheckoutItemList;
