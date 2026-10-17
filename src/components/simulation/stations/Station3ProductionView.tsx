import { getProductionProgress, isSupplyDone } from '@/types/production';
import type { VariantProgress } from '@/types/production';
import type { ShakerVariant, SimulationSession } from '@/types/simulation';

import BatchStepperList from './BatchStepperList';
import ReplenishmentAlertBanner from './ReplenishmentAlertBanner';

const STATION3_WAITING_FOR_RETRIEVAL_TEXT =
  'Die Produktion startet, sobald Station 5 die Bestellung ausgelagert hat.';
const STATION3_WAITING_FOR_SUPPLY_TEXT =
  'Die Produktion startet, sobald die Zulieferung (Station 1 & 2) abgeschlossen ist.';

type Props = {
  session: SimulationSession;
  /** Station 3 is ACTIVE once Station 1 & 2 are done (and again while replenishment is pending). */
  isActive: boolean;
  onProduceBatch: (variant: ShakerVariant, quantity: number) => Promise<boolean>;
};

/** One list of all variants with a stepper per row and a single send button. */
function ProductionList({
  progress,
  isActive,
  onProduceBatch,
}: {
  progress: VariantProgress[];
  isActive: boolean;
  onProduceBatch: Props['onProduceBatch'];
}) {
  // The topmost variant that is not counted up completely stays highlighted (fixed list order).
  const firstOpenVariant = progress.find((entry) => entry.open > 0)?.variant ?? null;
  const rows = progress.map((entry) => ({
    variant: entry.variant,
    open: entry.open,
    detail:
      entry.open === 0
        ? `${entry.target} von ${entry.target} gesendet`
        : `offen ${entry.open} · gesendet ${entry.produced}`,
  }));

  return (
    <BatchStepperList
      currentVariant={firstOpenVariant}
      isActive={isActive}
      onSend={onProduceBatch}
      rows={rows}
      sendLabel={(total) => (total === 0 ? 'Menge wählen' : `Charge senden · ${total} Stück`)}
    />
  );
}

/** Station 3: one list of all variants, quantities per row, one "Charge senden" for the whole batch. */
function Station3ProductionView({ session, isActive, onProduceBatch }: Props) {
  const progress = getProductionProgress(session);
  const total = progress.reduce((sum, entry) => sum + entry.target, 0);
  const sent = progress.reduce((sum, entry) => sum + Math.min(entry.produced, entry.target), 0);
  const isAllDone = progress.length > 0 && progress.every((entry) => entry.status === 'DONE');
  // Nothing can be done yet: show only the waiting state, no list.
  const isWaiting = !isActive && !isAllDone;

  return (
    <section>
      <ReplenishmentAlertBanner items={session.replenishment_queue} />
      {isWaiting ? (
        <p className="text-ink-muted">
          {session.strategy === 'PULL' && isSupplyDone(session)
            ? STATION3_WAITING_FOR_RETRIEVAL_TEXT
            : STATION3_WAITING_FOR_SUPPLY_TEXT}
        </p>
      ) : progress.length === 0 ? (
        <p className="text-ink-muted">Kein Produktionsauftrag vorhanden.</p>
      ) : (
        <>
          <div className="mb-xl">
            <p className="font-bold text-ink">
              {sent} von {total} gesendet
            </p>
          </div>
          <ProductionList isActive={isActive} onProduceBatch={onProduceBatch} progress={progress} />
          {isAllDone && (
            <p className="mt-xxl font-bold text-ink">
              Alles gefertigt und an Station 4 gesendet – warte auf die Rückmeldung.
            </p>
          )}
          <p className="mt-xl text-sm text-ink-muted">
            Station 4 erhält genau diese Liste. Meldet sie eine Abweichung, kommt die Charge hier
            zurück.
          </p>
        </>
      )}
    </section>
  );
}

export default Station3ProductionView;
