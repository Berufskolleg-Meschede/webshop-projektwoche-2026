import { getVariantLabel } from '@/types/production';
import type { ShakerVariant } from '@/types/simulation';
import { getVariantParts, getVariantTitle } from '@/types/simulationCatalog';

import QuantityInput from './QuantityInput';
import { MAX_QUANTITY } from './quantities';
import type { InvalidChangeHandler } from './quantities';
import VariantSwatches from './VariantSwatches';

const STEP_BUTTON =
  'flex shrink-0 items-center justify-center rounded-full border bg-card text-ink disabled:cursor-not-allowed disabled:opacity-40';

/** One variant: colour dots, title (optional sub line), − / number field / +. */
function VariantRow({
  variant,
  value,
  disabled,
  labelPrefix,
  showSub,
  compact = false,
  onChange,
  onInvalidChange,
}: {
  variant: ShakerVariant;
  value: number;
  disabled: boolean;
  /** Label prefix of the number field (stays stable for assistive tech and tests). */
  labelPrefix: string;
  showSub: boolean;
  /** Narrow variant for two-column lists: smaller dots, buttons and field. */
  compact?: boolean;
  onChange: (value: number) => void;
  onInvalidChange: InvalidChangeHandler;
}) {
  const title = getVariantTitle(variant);
  return (
    <li className={`flex items-center py-xs ${compact ? 'gap-xs' : 'gap-sm'}`}>
      <VariantSwatches compact={compact} variant={variant} />
      <span className="min-w-0 flex-1">
        <span
          className={`block break-words font-semibold text-ink ${compact ? 'text-xs' : 'text-sm'}`}
        >
          {title}
        </span>
        {showSub && (
          <span className="block text-xs text-ink-muted">{getVariantParts(variant)}</span>
        )}
      </span>
      <button
        aria-label={`${title} weniger`}
        className={`${STEP_BUTTON} ${compact ? 'h-7 w-7' : 'h-8 w-8'}`}
        disabled={disabled || value <= 0}
        onClick={() => onChange(value - 1)}
        type="button"
      >
        −
      </button>
      <span className={compact ? 'w-12' : 'w-14'}>
        <QuantityInput
          disabled={disabled}
          label={`${labelPrefix} ${getVariantLabel(variant)}`}
          onChange={onChange}
          onInvalidChange={onInvalidChange}
          value={value}
        />
      </span>
      <button
        aria-label={`${title} mehr`}
        className={`${STEP_BUTTON} ${compact ? 'h-7 w-7' : 'h-8 w-8'}`}
        disabled={disabled || value >= MAX_QUANTITY}
        onClick={() => onChange(value + 1)}
        type="button"
      >
        +
      </button>
    </li>
  );
}

export default VariantRow;
