import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import type { ProductionStrategy } from '@/types/simulation';

import OrderList from './OrderList';
import PushPlan from './PushPlan';
import { MAX_QUANTITY, QUANTITY_HINT_ID } from './quantities';
import type { Quantities } from './quantities';
import StrategyChoice from './StrategyChoice';

export type { Quantities };

type Props = {
  strategy: ProductionStrategy;
  orders: Quantities;
  limits: Quantities;
  /** Customer orders received from the simulation shop and their summed pieces. */
  webshopOrderCount?: number;
  webshopTotal?: number;
  disabled: boolean;
  /** Rendered at the bottom of the strategy card (save button, locked hint). */
  footer?: ReactNode;
  onStrategyChange: (strategy: ProductionStrategy) => void;
  onOrdersChange: (orders: Quantities) => void;
  onLimitsChange: (limits: Quantities) => void;
  /** Reports whether every number field currently holds a valid value (saving is pointless otherwise). */
  onValidityChange?: (isValid: boolean) => void;
};

/** Pull/Push as two compact cards, the Push plan in two columns, then the footer (save). */
function StrategySelector({
  strategy,
  orders,
  limits,
  webshopOrderCount = 0,
  webshopTotal = 0,
  disabled,
  footer,
  onStrategyChange,
  onOrdersChange,
  onLimitsChange,
  onValidityChange,
}: Props) {
  const [invalidFields, setInvalidFields] = useState<ReadonlySet<string>>(new Set());
  const handleInvalidChange = useCallback((label: string, isInvalid: boolean) => {
    setInvalidFields((current) => {
      if (current.has(label) === isInvalid) return current;
      const next = new Set(current);
      if (isInvalid) next.add(label);
      else next.delete(label);
      return next;
    });
  }, []);
  const isValid = invalidFields.size === 0;
  useEffect(() => onValidityChange?.(isValid), [isValid, onValidityChange]);

  return (
    <div className="flex flex-col gap-xl">
      {!isValid && (
        <p className="text-sm text-danger-ink" id={QUANTITY_HINT_ID} role="alert">
          Ungültige Menge: nur ganze Zahlen von 0 bis {MAX_QUANTITY}. Speichern ist gesperrt, bis
          alle Felder gültig sind.
        </p>
      )}
      <OrderList
        disabled={disabled}
        onChange={onOrdersChange}
        onInvalidChange={handleInvalidChange}
        orderCount={webshopOrderCount}
        orders={orders}
        webshopTotal={webshopTotal}
      />
      <section className="rounded-lg border bg-card p-xl shadow-sticker">
        <StrategyChoice
          disabled={disabled}
          onStrategyChange={onStrategyChange}
          strategy={strategy}
        />
        {strategy === 'PUSH' && (
          <PushPlan
            disabled={disabled}
            limits={limits}
            onChange={onLimitsChange}
            onInvalidChange={handleInvalidChange}
          />
        )}
        {footer}
      </section>
    </div>
  );
}

export default StrategySelector;
