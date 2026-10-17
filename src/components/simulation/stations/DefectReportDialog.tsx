import { useState } from 'react';

import { validateMissingQuantity } from '@/types/production';
import type { Batch } from '@/types/simulation';

/** One-tap reasons for the common defects; the field stays free text (no enum, decision 5). */
const QUICK_REASONS = ['Deckel defekt', 'Kratzer', 'Falsche Farbe'];

/** Keeps what the worker already typed: a chip replaces an empty field or another chip, otherwise it is appended. */
function addQuickReason(current: string, quick: string): string {
  const trimmed = current.trim();
  if (trimmed === '' || QUICK_REASONS.includes(trimmed)) return quick;
  if (trimmed.includes(quick)) return current;
  return `${trimmed}, ${quick}`;
}

type Props = {
  batch: Batch;
  isPending: boolean;
  onSubmit: (reason: string, missingQuantity: number) => void;
  onBack: () => void;
};

/** Reports missing/damaged pieces of a batch; the intact rest is stored, the difference goes back to Station 3. */
function DefectReportDialog({ batch, isPending, onSubmit, onBack }: Props) {
  const [value, setValue] = useState('1');
  const [reason, setReason] = useState('');
  const missing = Number(value);
  const error = validateMissingQuantity(missing, batch.quantity);
  const canSubmit = error === null && reason.trim().length > 0 && !isPending;

  return (
    <div>
      <label className="mb-md block text-sm text-ink-muted" htmlFor="missing-quantity">
        Wie viele Teile fehlen oder sind beschädigt?
        <input
          className="mt-sm block w-full rounded-lg border border-input-border bg-input px-md py-sm text-ink"
          id="missing-quantity"
          inputMode="numeric"
          onChange={(event) => setValue(event.target.value)}
          value={value}
        />
      </label>
      {error && (
        <p className="mb-md text-sm text-danger-ink" role="alert">
          {error}
        </p>
      )}
      <div aria-label="Häufige Gründe" className="mb-md flex flex-wrap gap-sm" role="group">
        {QUICK_REASONS.map((quick) => (
          <button
            aria-pressed={reason === quick}
            className={`rounded-full border px-md py-xs text-xs font-semibold ${
              reason === quick ? 'bg-primary text-on-primary' : 'bg-card text-ink'
            }`}
            key={quick}
            onClick={() => setReason((current) => addQuickReason(current, quick))}
            type="button"
          >
            {quick}
          </button>
        ))}
      </div>
      <label className="mb-xl block text-sm text-ink-muted" htmlFor="defect-reason">
        Grund
        <input
          className="mt-sm block w-full rounded-lg border border-input-border bg-input px-md py-sm text-ink"
          id="defect-reason"
          onChange={(event) => setReason(event.target.value)}
          value={reason}
        />
      </label>
      <div className="flex flex-wrap gap-md">
        <button
          className="rounded-full border bg-primary px-xxl py-md text-sm font-semibold text-on-primary shadow-sticker disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canSubmit}
          onClick={() => onSubmit(reason.trim(), missing)}
          type="button"
        >
          Abweichung melden
        </button>
        <button className="text-sm text-ink-muted underline" onClick={onBack} type="button">
          Zurück
        </button>
      </div>
    </div>
  );
}

export default DefectReportDialog;
