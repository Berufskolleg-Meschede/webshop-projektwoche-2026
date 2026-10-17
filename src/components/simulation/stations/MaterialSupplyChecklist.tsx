import { useState } from 'react';

import { usePendingAction } from '@/hooks/usePendingAction';
import type { SupplyItem } from '@/types/materialSupply';

type Props = {
  items: SupplyItem[];
  instruction: string;
  /** Noun for the total line, e.g. "Deckel" → "10 Deckel gesamt". */
  totalNoun: string;
  confirmLabel: string;
  isCompleted: boolean;
  onConfirm: () => Promise<unknown> | unknown;
};

/** Checklist with colour swatches; confirming is only possible once every item is ticked. */
function MaterialSupplyChecklist({
  items,
  instruction,
  totalNoun,
  confirmLabel,
  isCompleted,
  onConfirm,
}: Props) {
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const { isPending, run } = usePendingAction();
  // Positions that are not needed for this order are not something to tick (BUG-08).
  const needed = items.filter((item) => item.quantity > 0);
  const notNeeded = items.filter((item) => item.quantity === 0);
  const allChecked = needed.every((item) => checkedKeys.includes(item.key));
  const doneCount = isCompleted
    ? needed.length
    : needed.filter((item) => checkedKeys.includes(item.key)).length;
  const total = needed.reduce((sum, item) => sum + item.quantity, 0);

  function toggle(key: string) {
    setCheckedKeys((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));
  }

  return (
    <section className="rounded-lg border bg-card p-xxl shadow-sticker">
      <p className="mb-xl text-sm text-ink-muted">{instruction}</p>
      <ul className="mb-xxl flex flex-col gap-md">
        {needed.map((item) => (
          <li key={item.key}>
            <label className="flex items-center gap-md text-ink">
              <input
                checked={isCompleted || checkedKeys.includes(item.key)}
                disabled={isCompleted}
                onChange={() => toggle(item.key)}
                type="checkbox"
              />
              <span aria-hidden className={`h-5 w-5 rounded-full border ${item.swatchClass}`} />
              <span className="flex-1">
                <span className="block font-semibold">{item.name}</span>
                <span className="block text-sm text-ink-muted">{item.sub}</span>
              </span>
              <span className="font-semibold">{item.quantity}×</span>
            </label>
          </li>
        ))}
      </ul>
      {needed.length > 0 && (
        <p className="mb-xxl flex flex-wrap justify-between gap-x-md text-sm text-ink-muted">
          <span className="whitespace-nowrap">
            {doneCount} von {needed.length} Positionen bestückt
          </span>
          <span className="whitespace-nowrap">
            {total} {totalNoun} gesamt
          </span>
        </p>
      )}
      {needed.length === 0 && (
        <p className="mb-xxl text-sm font-semibold text-ink">
          Für diesen Auftrag wird hier nichts bereitgestellt.
        </p>
      )}
      {notNeeded.length > 0 && (
        <p className="mb-xxl text-xs text-ink-muted">
          Nicht benötigt: {notNeeded.map((item) => item.name).join(', ')}
        </p>
      )}
      {isCompleted ? (
        <p className="font-bold text-ink">Erledigt – warte auf die anderen Stationen.</p>
      ) : (
        <button
          className="rounded-full border bg-primary px-xxl py-md text-sm font-semibold text-on-primary shadow-sticker disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!allChecked || isPending}
          onClick={() => run(onConfirm)}
          type="button"
        >
          {confirmLabel}
        </button>
      )}
    </section>
  );
}

export default MaterialSupplyChecklist;
