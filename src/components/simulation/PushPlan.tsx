import { VARIANTS } from '@/types/production';

import type { InvalidChangeHandler, Quantities } from './quantities';
import VariantRow from './VariantRow';

type Props = {
  limits: Quantities;
  disabled: boolean;
  onChange: (limits: Quantities) => void;
  onInvalidChange: InvalidChangeHandler;
};

/** Push daily production plan: the variants in two columns with the planned total. */
function PushPlan({ limits, disabled, onChange, onInvalidChange }: Props) {
  const planned = VARIANTS.reduce((total, variant) => total + (limits[variant] ?? 0), 0);

  return (
    <fieldset className="mb-lg border-t pt-md">
      <legend className="sr-only">Tagesproduktion (Push)</legend>
      <div className="mb-sm flex items-baseline justify-between gap-md">
        <h3 className="font-bold text-ink">Tagesproduktion (Push)</h3>
        <span className="text-sm text-ink-muted">{planned} Stück geplant</span>
      </div>
      <ul className="grid gap-x-md sm:grid-cols-2">
        {VARIANTS.map((variant) => (
          <VariantRow
            compact
            disabled={disabled}
            key={variant}
            labelPrefix="Tages-Produktionsmenge"
            onChange={(next) => onChange({ ...limits, [variant]: next })}
            onInvalidChange={onInvalidChange}
            showSub={false}
            value={limits[variant] ?? 0}
            variant={variant}
          />
        ))}
      </ul>
    </fieldset>
  );
}

export default PushPlan;
