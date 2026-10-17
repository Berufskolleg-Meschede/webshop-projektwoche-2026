import { Flag, PartyPopper } from 'lucide-react';

import Overlay from '@/components/common/Overlay';
import { HEADLINE_DAY_ABORTED, LINE_DAY_NOT_FULFILLED } from '@/types/production';
import type { SimulationSession } from '@/types/simulation';

import SimulationSummaryReport from './SimulationSummaryReport';

type Props = {
  onClose: () => void;
  notFulfilled?: boolean;
  /** The teacher ended the running day by hand: headline "Tag abgebrochen". */
  endedByTeacher?: boolean;
  /** When set, the day summary is shown inside the popup (station pages). */
  summarySession?: SimulationSession;
};

/** Shown on every connected device once the session is FINISHED. */
function SimulationCelebrationModal({
  onClose,
  notFulfilled = false,
  endedByTeacher = false,
  summarySession,
}: Props) {
  let headline = 'Produktionsauftrag erfolgreich abgeschlossen!';
  if (endedByTeacher) headline = HEADLINE_DAY_ABORTED;
  else if (notFulfilled) headline = LINE_DAY_NOT_FULFILLED;

  return (
    <Overlay padded zIndex="z-30">
      <div
        aria-labelledby="celebration-title"
        aria-modal="true"
        className={`w-full ${summarySession ? 'max-w-[40rem]' : 'max-w-[28rem]'} rounded-lg border bg-card p-xxl text-center shadow-sticker`}
        role="dialog"
      >
        {notFulfilled || endedByTeacher ? (
          <Flag
            aria-hidden="true"
            className="mx-auto mb-md text-ink-muted"
            data-testid="celebration-icon"
            size={40}
          />
        ) : (
          <PartyPopper
            aria-hidden="true"
            className="mx-auto mb-md text-primary"
            data-testid="celebration-icon"
            size={40}
          />
        )}
        <h2 className="mb-md text-xl font-bold text-ink" id="celebration-title">
          {headline}
        </h2>
        {summarySession && (
          <div className="mb-md text-left">
            <SimulationSummaryReport session={summarySession} />
          </div>
        )}
        <button
          className="rounded-full border bg-primary px-xxl py-md text-sm font-semibold text-on-primary shadow-sticker"
          onClick={onClose}
          type="button"
        >
          Schließen
        </button>
      </div>
    </Overlay>
  );
}

export default SimulationCelebrationModal;
