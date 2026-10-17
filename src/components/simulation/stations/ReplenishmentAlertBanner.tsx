import { AlertTriangle } from 'lucide-react';

import { getVariantLabel } from '@/types/production';
import type { ReplenishmentItem } from '@/types/simulation';

type Props = { items: ReplenishmentItem[] };

/** Priority notice: Station 4 sent items back for re-production. */
function ReplenishmentAlertBanner({ items }: Props) {
  if (items.length === 0) return null;
  return (
    <div
      className="mb-xxl rounded-lg border bg-primary p-lg text-on-primary shadow-sticker"
      role="alert"
    >
      <p className="mb-sm flex items-center gap-sm font-bold">
        <AlertTriangle size={20} /> Nachproduktion erforderlich
      </p>
      <ul className="text-sm">
        {items.map((item, index) => (
          <li key={`${item.variant}-${index}`}>
            {item.quantity}× {getVariantLabel(item.variant)} – {item.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ReplenishmentAlertBanner;
