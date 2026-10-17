import { usePendingAction } from '@/hooks/usePendingAction';
import {
  BUTTON_FINISH_DAY,
  BUTTON_FINISH_DAY_SHORTFALLS,
  getRetrievalProgress,
  isProductionAndStorageFinished,
  STATION5_FINISHED_TEXT,
} from '@/types/production';
import type { RetrievalProgress } from '@/types/production';
import { isOrderRetrieved } from '@/types/simulationRules';
import type { ShakerVariant, SimulationSession } from '@/types/simulation';

import BatchStepperList, { StatusChip } from './BatchStepperList';

type Props = {
  session: SimulationSession;
  isActive: boolean;
  onRetrieve: (variant: ShakerVariant, quantity: number) => Promise<boolean>;
  onFinishDay?: () => Promise<unknown> | unknown;
};

/** One list of all ordered variants with a stepper per row and a single confirm button. */
function RetrievalList({
  progress,
  onRetrieve,
}: {
  progress: RetrievalProgress[];
  onRetrieve: Props['onRetrieve'];
}) {
  // Bounded by the total order only; the participant never sees or depends on the stock.
  const rows = progress.map((entry) => ({
    variant: entry.variant,
    open: entry.open,
    detail: `${entry.retrieved} von ${entry.demand} ausgelagert`,
  }));

  return (
    <BatchStepperList
      onSend={onRetrieve}
      rows={rows}
      sendLabel={(total) => (total === 0 ? 'Menge wählen' : `${total} Stück auslagern`)}
    />
  );
}

export const STATION5_LOCKED_TEXT =
  'Die Auslagerung startet, sobald die Zulieferung (Station 1 & 2) abgeschlossen ist.';

/** Locked screen (before the supply is done): chip and why it is locked. */
function LockedStation5() {
  return (
    <section className="flex flex-col gap-xl rounded-lg border bg-card p-xl shadow-sticker-sm">
      <div>
        <StatusChip>Noch gesperrt</StatusChip>
      </div>
      <p className="text-ink-muted">{STATION5_LOCKED_TEXT}</p>
      <button
        className="w-full rounded-full border bg-primary px-xl py-sm text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
        disabled
        type="button"
      >
        Menge wählen
      </button>
    </section>
  );
}

/** Finished screen (Pull, order fully retrieved): same layout as the locked one, own text. */
function FinishedStation5() {
  return (
    <section className="flex flex-col gap-xl rounded-lg border bg-card p-xl shadow-sticker-sm">
      <p className="font-bold text-ink">{STATION5_FINISHED_TEXT}</p>
    </section>
  );
}

/**
 * Station 5: the total order per variant, confirmed manually and never tied to the stock.
 * Push and Pull are active as soon as the supply (Stations 1 & 2) is done.
 */
function Station5RetrievalView({ session, isActive, onRetrieve, onFinishDay }: Props) {
  const { isPending: isFinishing, run: runFinish } = usePendingAction();

  const isCompleted =
    session.stations.find((station) => station.station_id === 5)?.status === 'COMPLETED';
  if (!isActive && isCompleted && session.strategy === 'PULL') return <FinishedStation5 />;
  if (!isActive) return <LockedStation5 />;

  const progress = getRetrievalProgress(session);
  const delivered = progress.reduce((total, entry) => total + entry.retrieved, 0);
  const demand = progress.reduce((total, entry) => total + entry.demand, 0);

  const isOrderComplete = isOrderRetrieved(session);
  const canFinish = isOrderComplete || isProductionAndStorageFinished(session);
  const finishLabel = isOrderComplete ? BUTTON_FINISH_DAY : BUTTON_FINISH_DAY_SHORTFALLS;

  return (
    <section>
      <p className="mb-xl rounded-lg border bg-card p-lg font-semibold text-ink shadow-sticker-sm">
        Ausgelagert {delivered} von {demand}
      </p>
      {progress.length === 0 && <p className="text-ink-muted">Kein Kundenauftrag vorhanden.</p>}
      {progress.length > 0 && <RetrievalList onRetrieve={onRetrieve} progress={progress} />}
      {onFinishDay && (
        <button
          className="mt-xl w-full rounded-full border bg-card px-xl py-md text-base font-semibold text-ink shadow-sticker disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          disabled={!canFinish || isFinishing}
          onClick={() => runFinish(onFinishDay)}
          type="button"
        >
          {finishLabel}
        </button>
      )}
    </section>
  );
}

export default Station5RetrievalView;
