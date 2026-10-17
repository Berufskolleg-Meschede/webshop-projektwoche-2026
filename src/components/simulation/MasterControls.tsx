import { useState } from 'react';

import CTAButton from '@/components/CTAButton';
import type { SimulationState } from '@/types/simulation';

type Props = {
  state: SimulationState;
  canStart: boolean;
  /** An action request is in flight: all buttons lock so clicks cannot overlap. */
  isBusy?: boolean;
  onStateChange: (state: SimulationState) => void;
  onNextDay: () => void;
};

/** Start, a confirmed "Beenden" and "Nächster Tag" after a finished day. */
function MasterControls({ state, canStart, isBusy = false, onStateChange, onNextDay }: Props) {
  const [isConfirmingFinish, setIsConfirmingFinish] = useState(false);
  const canFinish = state === 'RUNNING';

  return (
    <div className="flex flex-wrap items-center gap-md">
      {state === 'CONFIGURING' && (
        <CTAButton
          disabled={!canStart || isBusy}
          label="Tag simulieren"
          onClick={() => onStateChange('RUNNING')}
          variant="solid"
        />
      )}
      {canFinish &&
        (isConfirmingFinish ? (
          <span className="flex items-center gap-md text-sm text-ink" role="alertdialog">
            Tag jetzt beenden? Der restliche Plan wird abgebrochen.
            <button
              className="rounded-full border bg-primary px-lg py-xs text-on-primary disabled:opacity-50"
              disabled={isBusy}
              onClick={() => {
                setIsConfirmingFinish(false);
                onStateChange('FINISHED');
              }}
              type="button"
            >
              Ja, beenden
            </button>
            <button
              className="underline"
              onClick={() => setIsConfirmingFinish(false)}
              type="button"
            >
              Abbrechen
            </button>
          </span>
        ) : (
          <button
            className="rounded-full border bg-card px-xxl py-md text-sm font-semibold text-ink disabled:opacity-50"
            disabled={isBusy}
            onClick={() => setIsConfirmingFinish(true)}
            type="button"
          >
            Beenden
          </button>
        ))}
      {state === 'FINISHED' && (
        <CTAButton disabled={isBusy} label="Nächster Tag" onClick={onNextDay} variant="solid" />
      )}
    </div>
  );
}

export default MasterControls;
