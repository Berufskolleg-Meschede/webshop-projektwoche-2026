import { getHousingSupply } from '@/types/materialSupply';
import type { SimulationSession } from '@/types/simulation';

import MaterialSupplyChecklist from './MaterialSupplyChecklist';

export const STATION_2_LOCKED_HINT =
  'Die Zulieferung startet, sobald Station 1 die Deckel zugeliefert hat.';

function LockedStation2() {
  return (
    <section className="flex flex-col gap-xl rounded-lg border bg-card p-xl shadow-sticker-sm">
      <div>
        <span className="inline-block rounded-full border bg-chip px-md py-xs text-sm font-semibold text-ink">
          Noch gesperrt
        </span>
      </div>
      <p className="text-ink-muted">{STATION_2_LOCKED_HINT}</p>
    </section>
  );
}

type Props = {
  session: SimulationSession;
  isActive: boolean;
  onComplete: () => void;
};

function Station2HousingsView({ session, isActive, onComplete }: Props) {
  const isCompleted = session.stations.find((s) => s.station_id === 2)?.status === 'COMPLETED';

  if (!isActive && !isCompleted) {
    return <LockedStation2 />;
  }

  return (
    <MaterialSupplyChecklist
      confirmLabel="Zulieferung bestätigen"
      instruction="Lege die Gehäuse in die Zuführung und hake jede Position ab, sobald sie bestückt und dokumentiert ist."
      isCompleted={isCompleted}
      items={getHousingSupply(session)}
      onConfirm={onComplete}
      totalNoun="Gehäuse"
    />
  );
}

export default Station2HousingsView;
