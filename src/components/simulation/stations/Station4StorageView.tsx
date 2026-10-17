import { useState } from 'react';

import { usePendingAction } from '@/hooks/usePendingAction';
import { getBatchStorageOutlook, getStorageProgress } from '@/types/production';
import { describeMissingParts, getVariantParts, getVariantTitle } from '@/types/simulationCatalog';
import type { Batch, SimulationSession } from '@/types/simulation';

import DefectReportDialog from './DefectReportDialog';

type Props = {
  session: SimulationSession;
  /** Station 4 is ACTIVE while a batch from Station 3 waits for inspection. */
  isActive: boolean;
  onStoreBatch: (batchId: string) => Promise<boolean>;
  onReportDeviation: (batchId: string, reason: string, missingQuantity: number) => Promise<boolean>;
};

type BatchCardProps = {
  batch: Batch;
  session: SimulationSession;
  isActive: boolean;
  onStoreBatch: Props['onStoreBatch'];
  onReportDeviation: Props['onReportDeviation'];
};

/** One incoming batch: item rows and both decisions directly on the card, no intermediate step. */
function BatchCard({ batch, session, isActive, onStoreBatch, onReportDeviation }: BatchCardProps) {
  const [isReporting, setIsReporting] = useState(false);
  const { isPending, run } = usePendingAction();
  const outlook = getBatchStorageOutlook(session, batch);
  const missing = describeMissingParts(outlook.missing);

  return (
    <li className="rounded-lg border bg-card p-xl shadow-sticker-sm">
      <h3 className="font-bold text-ink">Neue Charge von Station 3</h3>
      <p className="mb-md text-sm text-ink-muted">
        Prüfe, ob diese Teile am Band liegen. Lagere sie ein und bestätige.
      </p>
      <ul className="mb-md">
        <li className="flex items-baseline justify-between gap-md">
          <div>
            <p className="font-semibold text-ink">{getVariantTitle(batch.variant)}</p>
            <p className="text-sm text-ink-muted">{getVariantParts(batch.variant)}</p>
          </div>
          <p className="font-semibold text-ink">{batch.quantity}×</p>
        </li>
      </ul>
      {batch.is_replenishment && <p className="text-sm text-primary">Nachproduktion</p>}
      <p className="mt-md text-sm text-ink">
        Mit dieser Charge: {outlook.withBatch} von {outlook.target}.
        {missing && ` ${missing} fehlen noch.`}
      </p>
      {isReporting ? (
        <div className="mt-md">
          <DefectReportDialog
            batch={batch}
            isPending={isPending}
            onBack={() => setIsReporting(false)}
            onSubmit={(reason, missingQuantity) =>
              run(async () => {
                if (await onReportDeviation(batch.batch_id, reason, missingQuantity)) {
                  setIsReporting(false);
                }
              })
            }
          />
        </div>
      ) : (
        <>
          <p className="mb-md mt-md text-sm text-ink-muted">
            Falsche oder fehlende Teile? Melde die Abweichung. Station 3 produziert sie dann erneut.
          </p>
          <div className="flex flex-wrap gap-md">
            <button
              className="rounded-full border bg-primary px-xxl py-md text-sm font-semibold text-on-primary shadow-sticker disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!isActive || isPending}
              onClick={() => run(() => onStoreBatch(batch.batch_id))}
              type="button"
            >
              Stimmt – eingelagert
            </button>
            <button
              className="rounded-full border bg-card px-xxl py-md text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!isActive || isPending}
              onClick={() => setIsReporting(true)}
              type="button"
            >
              Abweichung melden
            </button>
          </div>
        </>
      )}
    </li>
  );
}

/** Station 4: incoming batches from Station 3, inspection and storage, plus order progress. */
function Station4StorageView({ session, isActive, onStoreBatch, onReportDeviation }: Props) {
  const incoming = session.batches.filter((batch) => batch.status === 'PRODUCED');
  const { stored, target } = getStorageProgress(session);
  const isOrderComplete = target > 0 && stored >= target;

  return (
    <section>
      <div className="mb-xl rounded-lg border bg-card p-xl shadow-sticker-sm">
        <p className="font-bold text-ink">
          Bereits eingelagert {stored} von {target}
        </p>
      </div>
      {isOrderComplete && <p className="mb-xl text-ink">Der gesamte Auftrag ist eingelagert.</p>}
      <ul className="grid gap-xl sm:grid-cols-2">
        {incoming.map((batch) => (
          <BatchCard
            batch={batch}
            isActive={isActive}
            key={batch.batch_id}
            onReportDeviation={onReportDeviation}
            onStoreBatch={onStoreBatch}
            session={session}
          />
        ))}
      </ul>
    </section>
  );
}

export default Station4StorageView;
