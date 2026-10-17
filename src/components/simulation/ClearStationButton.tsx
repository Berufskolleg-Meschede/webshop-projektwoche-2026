import { useState } from 'react';

import { X } from 'lucide-react';

import Overlay from '@/components/common/Overlay';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import type { StationId } from '@/types/simulation';

const CLEAR_STATION_QUESTION = 'Diese Station wirklich leeren?';
const CLEAR_STATION_CONFIRM = 'Ja, leeren';
const CLEAR_STATION_CANCEL = 'Abbrechen';

type Props = {
  stationId: StationId;
  disabled?: boolean;
  onClear: (stationId: StationId) => void;
};

/** Small X on a station tile; asks once before the teacher releases the station's claim. */
function ClearStationButton({ stationId, disabled = false, onClear }: Props) {
  const [isConfirming, setIsConfirming] = useState(false);
  useEscapeKey(isConfirming, () => setIsConfirming(false));

  return (
    <>
      <button
        aria-label={`Station ${stationId} leeren`}
        className="rounded-full p-xxs text-danger hover:bg-chip disabled:opacity-40"
        disabled={disabled}
        onClick={() => setIsConfirming(true)}
        type="button"
      >
        <X aria-hidden="true" size={16} />
      </button>
      {isConfirming && (
        <Overlay onClose={() => setIsConfirming(false)} padded zIndex="z-30">
          <div
            aria-labelledby={`clear-station-${stationId}-title`}
            aria-modal="true"
            className="w-full max-w-[28rem] rounded-lg border bg-card p-xxl text-center shadow-sticker"
            role="dialog"
          >
            <h2
              className="mb-lg text-lg font-bold text-ink"
              id={`clear-station-${stationId}-title`}
            >
              {CLEAR_STATION_QUESTION}
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-md">
              <button
                autoFocus
                className="rounded-full border bg-card px-xxl py-md text-sm font-semibold text-ink"
                onClick={() => setIsConfirming(false)}
                type="button"
              >
                {CLEAR_STATION_CANCEL}
              </button>
              <button
                className="rounded-full border bg-primary px-xxl py-md text-sm font-semibold text-on-primary shadow-sticker disabled:opacity-50"
                disabled={disabled}
                onClick={() => {
                  setIsConfirming(false);
                  onClear(stationId);
                }}
                type="button"
              >
                {CLEAR_STATION_CONFIRM}
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </>
  );
}

export default ClearStationButton;
