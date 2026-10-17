import { VARIANTS } from '@/types/production';

import type { InvalidChangeHandler, Quantities } from './quantities';
import VariantRow from './VariantRow';

/** Daily order as an editable list with the total; own card in the right column. */
function OrderList({
  orders,
  disabled,
  orderCount,
  webshopTotal,
  onChange,
  onInvalidChange,
}: {
  orders: Quantities;
  disabled: boolean;
  orderCount: number;
  webshopTotal: number;
  onChange: (orders: Quantities) => void;
  onInvalidChange: InvalidChangeHandler;
}) {
  const total = VARIANTS.reduce((sum, variant) => sum + (orders[variant] ?? 0), 0);
  const sentence =
    orderCount === 0
      ? 'Noch keine WebShop-Bestellungen eingegangen.'
      : `${orderCount} ${orderCount === 1 ? 'WebShop-Bestellung' : 'WebShop-Bestellungen'} eingegangen.`;

  return (
    <section className="rounded-lg border bg-card p-xl shadow-sticker">
      <div className="mb-sm flex items-start justify-between gap-md">
        <div>
          <h2 className="text-lg font-bold text-ink">Tagesbestellung</h2>
          <p className="text-sm text-ink-muted">{sentence} Mengen sind frei änderbar.</p>
        </div>
        <span className="whitespace-nowrap rounded-full border bg-ink px-md py-xs text-sm font-semibold text-card">
          {total} Stück
        </span>
      </div>
      <ul className="divide-y">
        {VARIANTS.map((variant) => (
          <VariantRow
            disabled={disabled}
            key={variant}
            labelPrefix="Tagesauftrag"
            onChange={(next) => onChange({ ...orders, [variant]: next })}
            onInvalidChange={onInvalidChange}
            showSub
            value={orders[variant] ?? 0}
            variant={variant}
          />
        ))}
      </ul>
      {total !== webshopTotal && (
        <p className="mt-sm text-sm font-semibold text-ink" role="note">
          Bestellung weicht von den WebShop-Bestellungen ab.
        </p>
      )}
    </section>
  );
}

export default OrderList;
