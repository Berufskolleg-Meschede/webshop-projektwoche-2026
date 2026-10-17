import type { ProductionStrategy } from '@/types/simulation';

type Props = {
  strategy: ProductionStrategy;
  disabled: boolean;
  onStrategyChange: (strategy: ProductionStrategy) => void;
};

const STRATEGY_CARDS: { value: ProductionStrategy; title: string }[] = [
  { value: 'PULL', title: 'Pull' },
  { value: 'PUSH', title: 'Push' },
];

/** Pull/Push as two compact radio cards. */
function StrategyChoice({ strategy, disabled, onStrategyChange }: Props) {
  return (
    <fieldset className="mb-lg">
      <legend className="mb-sm text-lg font-bold text-ink">Produktionsstrategie</legend>
      <div className="grid gap-sm sm:grid-cols-2">
        {STRATEGY_CARDS.map(({ value, title }) => (
          <label
            className={`flex cursor-pointer flex-col gap-xs rounded-lg border p-md ${
              strategy === value ? 'border-primary bg-chip ring-1 ring-primary' : 'bg-card'
            } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
            key={value}
          >
            <span className="flex items-center gap-sm font-bold text-ink">
              <input
                checked={strategy === value}
                disabled={disabled}
                name="strategy"
                onChange={() => onStrategyChange(value)}
                type="radio"
              />
              {title}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default StrategyChoice;
