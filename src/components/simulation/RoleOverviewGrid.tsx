import type { SimulationSession, StationId } from '@/types/simulation';
import { ROLES, getRoleTitle } from '@/types/simulationRoles';

import ClearStationButton from './ClearStationButton';

type Props = {
  session: SimulationSession;
  /** Teacher only: shows a small X per station that releases its claim (not for the customer). */
  onClearStation?: (stationId: StationId) => void;
  isBusy?: boolean;
};

/** Occupancy list: per role one title line and a badge (Frei / Besetzt · Name). */
function RoleOverviewGrid({ session, onClearStation, isBusy = false }: Props) {
  return (
    <ul className="grid grid-cols-2 gap-sm">
      {ROLES.map((info) => {
        const { role, stationId } = info;
        const claimedBy =
          stationId === null
            ? null
            : (session.stations.find((entry) => entry.station_id === stationId)?.claimed_by ??
              null);
        const isTaken = stationId === null ? session.customer_count > 0 : claimedBy !== null;
        const badge =
          stationId === null
            ? `${session.customer_count} verbunden`
            : claimedBy !== null
              ? `Besetzt · ${claimedBy}`
              : 'Frei';
        return (
          <li
            className="flex flex-col gap-xs rounded-lg border bg-card p-md"
            data-testid={stationId === null ? 'customer-count' : `tile-${role}`}
            key={role}
          >
            <span className="flex items-start justify-between gap-sm">
              <span className="font-semibold text-ink">{getRoleTitle(info)}</span>
              {stationId !== null && onClearStation && (
                <ClearStationButton
                  disabled={isBusy}
                  onClear={onClearStation}
                  stationId={stationId}
                />
              )}
            </span>
            <span
              title={badge}
              className={`max-w-full self-start truncate rounded-full border px-md py-xs text-xs font-semibold ${
                isTaken ? 'bg-accent-green text-on-green' : 'bg-chip text-ink-muted'
              }`}
            >
              {badge}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default RoleOverviewGrid;
