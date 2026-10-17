import { Check, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { Article } from '@/api/articles/listArticlesApi';

import { resolveArticleImage } from './placeholderImage';

const ADDED_FEEDBACK_MS = 1500;

type Props = {
  article: Article;
  onAddToCart: (article: Article) => void;
  quantityInCart: number;
  /** Simulation catalogue: no prices, no ERP stock numbers. */
  isSimulation?: boolean;
};

function ProductCard({ article, onAddToCart, quantityInCart, isSimulation = false }: Props) {
  const displayPrice =
    article.price !== null ? `€${article.price.toFixed(2)}` : 'Preis auf Anfrage';
  const image = resolveArticleImage(article.imageUrl, article.name, isSimulation);
  const stock = article.availableQuantity;
  const isUnavailable = stock === 0;
  const isMaxReached = !isUnavailable && quantityInCart >= stock;

  const [isAdded, setIsAdded] = useState(false);
  const addedTimeoutRef = useRef<number | null>(null);
  // Also confirm the add that exhausts the stock; the disabled state only takes over afterwards.
  const showAdded = isAdded && !isUnavailable;

  useEffect(
    () => () => {
      if (addedTimeoutRef.current !== null) window.clearTimeout(addedTimeoutRef.current);
    },
    []
  );

  function handleAddToCart() {
    onAddToCart(article);
    setIsAdded(true);
    if (addedTimeoutRef.current !== null) window.clearTimeout(addedTimeoutRef.current);
    addedTimeoutRef.current = window.setTimeout(() => setIsAdded(false), ADDED_FEEDBACK_MS);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-card shadow-sticker transition-shadow hover:shadow-sticker-hover">
      <div className="flex h-48 items-center justify-center bg-chip">
        <img
          alt={image.alt}
          className={`h-full w-full ${image.isDefault ? 'object-contain' : 'object-cover'}`}
          src={image.src}
        />
      </div>

      <div className="flex flex-1 flex-col gap-sm p-lg">
        <h3 className="text-base font-semibold text-ink">{article.name}</h3>

        {article.description && <p className="text-sm text-ink-muted">{article.description}</p>}

        {isSimulation ? (
          <div className="mt-auto" />
        ) : (
          <div className="mt-auto flex items-center justify-between pt-sm text-sm text-ink-muted">
            <span className="font-medium">{displayPrice}</span>
            <span className="text-xs text-ink-muted">Lager: {stock}</span>
          </div>
        )}

        <button
          className={`mt-sm w-full rounded-full border py-sm text-sm font-semibold shadow-sticker-sm transition-all hover:shadow-sticker active:shadow-sticker-press disabled:cursor-not-allowed ${
            showAdded
              ? 'bg-accent-green text-on-green'
              : 'bg-primary text-on-primary disabled:opacity-40'
          }`}
          disabled={isUnavailable || isMaxReached}
          onClick={handleAddToCart}
          type="button"
        >
          {showAdded ? (
            <span className="flex items-center justify-center gap-1.5">
              <Check size={16} strokeWidth={2.5} />
              Hinzugefügt!
            </span>
          ) : (
            <>
              {isUnavailable && 'Nicht verfügbar'}
              {isMaxReached && 'Max. Menge erreicht'}
              {!isUnavailable && !isMaxReached && (
                <span className="flex items-center justify-center gap-1.5">
                  <Plus size={15} strokeWidth={2.5} />
                  Warenkorb
                </span>
              )}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default ProductCard;
