import { getLidSupply } from '@/types/materialSupply';
import type { SimulationSession } from '@/types/simulation';

import MaterialSupplyChecklist from './MaterialSupplyChecklist';

type Props = {
  session: SimulationSession;
  onComplete: () => void;
};

function Station1LidsView({ session, onComplete }: Props) {
  const isCompleted = session.stations.find((s) => s.station_id === 1)?.status === 'COMPLETED';
  return (
    <MaterialSupplyChecklist
      confirmLabel="Zulieferung bestätigen"
      instruction="Lege die Deckel in die Zuführung und hake jede Position ab, sobald sie bestückt und dokumentiert ist."
      isCompleted={isCompleted}
      items={getLidSupply(session)}
      onConfirm={onComplete}
      totalNoun="Deckel"
    />
  );
}

export default Station1LidsView;
