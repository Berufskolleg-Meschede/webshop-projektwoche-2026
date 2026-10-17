import { useState } from 'react';

import { usePendingAction } from '@/hooks/usePendingAction';
import type { ShakerVariant } from '@/types/simulation';
import { getVariantTitle } from '@/types/simulationCatalog';

export type BatchStepperRow = {
  variant: ShakerVariant;
  /** Quantity that can still be chosen; 0 marks the row as done. */
  open: number;
  detail: string;
};

type Props = {
  rows: BatchStepperRow[];
  isActive?: boolean;
  /** The row that gets the highlighted border (aria-current). */
  currentVariant?: ShakerVariant | null;
  onSend: (variant: ShakerVariant, quantity: number) => Promise<boolean>;
  sendLabel: (total: number) => string;
};

export function StatusChip({ children }: { children: string }) {
  return (
    <span className="inline-block rounded-full border bg-chip px-md py-xs text-sm font-semibold text-ink">
      {children}
    </span>
  );
}

/** One list of variants with a stepper per row and a single send button for the whole batch. */
function BatchStepperList({
  rows,
  isActive = true,
  currentVariant = null,
  onSend,
  sendLabel,
}: Props) {
  const [batch, setBatch] = useState<Partial<Record<ShakerVariant, number>>>({});
  const { isPending, run } = usePendingAction();
  // Never send more than the row allows, even if the open quantity shrinks meanwhile.
  const chosen = (row: BatchStepperRow) => Math.min(batch[row.variant] ?? 0, row.open);
  const total = rows.reduce((sum, row) => sum + chosen(row), 0);

  function step(row: BatchStepperRow, delta: number) {
    setBatch((current) => ({
      ...current,
      [row.variant]: Math.max(0, Math.min(row.open, chosen(row) + delta)),
    }));
  }

  async function handleSend() {
    for (const row of rows) {
      const quantity = chosen(row);
      if (quantity === 0) continue;
      // Stop at the first failure: the remaining rows stay selected for a retry.
      if (!(await onSend(row.variant, quantity))) return;
      setBatch((current) => ({ ...current, [row.variant]: 0 }));
    }
  }

  return (
    <>
      <ul className="mb-xl flex flex-col gap-sm">
        {rows.map((row) => {
          const title = getVariantTitle(row.variant);
          const quantity = chosen(row);
          const isDone = row.open === 0;
          const isCurrent = row.variant === currentVariant;
          return (
            <li
              aria-current={isCurrent ? 'true' : undefined}
              className={`flex min-h-[4.25rem] items-center gap-md rounded-lg border p-md ${
                isDone
                  ? 'bg-chip text-ink-muted'
                  : quantity > 0
                    ? 'border-primary bg-card ring-1 ring-primary'
                    : isCurrent
                      ? 'border-primary bg-card'
                      : 'bg-card'
              }`}
              key={row.variant}
            >
              <span className="flex-1">
                <span className="block font-semibold text-ink">{title}</span>
                <span className="block text-sm text-ink-muted">{row.detail}</span>
              </span>
              {isDone ? (
                <StatusChip>Fertig</StatusChip>
              ) : (
                <span className="flex items-center gap-sm">
                  <button
                    aria-label={`${title} weniger`}
                    className="flex h-11 w-11 items-center justify-center rounded-full border bg-card text-ink disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!isActive || quantity === 0 || isPending}
                    onClick={() => step(row, -1)}
                    type="button"
                  >
                    −
                  </button>
                  <span
                    aria-label={`${title} Menge`}
                    className="w-8 text-center font-semibold text-ink"
                  >
                    {quantity}
                  </span>
                  <button
                    aria-label={`${title} mehr`}
                    className="flex h-11 w-11 items-center justify-center rounded-full border bg-card text-ink disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!isActive || quantity >= row.open || isPending}
                    onClick={() => step(row, 1)}
                    type="button"
                  >
                    +
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <button
        className="w-full rounded-full border bg-primary px-xl py-md text-lg font-semibold text-on-primary shadow-sticker disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        disabled={!isActive || total === 0 || isPending}
        onClick={() => run(handleSend)}
        type="button"
      >
        {sendLabel(total)}
      </button>
    </>
  );
}

export default BatchStepperList;
