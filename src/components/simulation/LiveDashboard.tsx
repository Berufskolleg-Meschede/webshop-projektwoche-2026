import { getLiveStations, getOrderProgress } from '@/types/liveDashboard';
import type { StationTone } from '@/types/liveDashboard';
import type { SimulationSession, StationId } from '@/types/simulation';
import { getVariantParts, getVariantTitle } from '@/types/simulationCatalog';

import ClearStationButton from './ClearStationButton';
import VariantSwatches from './VariantSwatches';

type Props = {
  session: SimulationSession;
  /** Teacher only: shows a small X per station that releases its claim. */
  onClearStation?: (stationId: StationId) => void;
  isBusy?: boolean;
};

const CARD_CLASSES: Record<StationTone, string> = {
  done: 'border-solid bg-accent-green/15 shadow-sticker',
  active: 'border-solid bg-card shadow-sticker',
  locked: 'border-dashed bg-chip',
};

const BADGE_CLASSES: Record<StationTone, string> = {
  done: 'bg-accent-green text-on-green',
  active: 'bg-accent-amber text-on-amber',
  locked: 'bg-chip text-ink',
};

/** Live view for the running day: stations, order progress and the variant table. */
function LiveDashboard({ session, onClearStation, isBusy = false }: Props) {
  const stations = getLiveStations(session);
  const progress = getOrderProgress(session);

  return (
    <div className="flex flex-col gap-xxl">
      <section className="flex flex-col gap-md">
        <h2 className="text-xl font-semibold text-ink">Stationen</h2>
        <ul className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {stations.map((station) => (
            <li
              className={`flex min-h-[10rem] flex-col gap-sm rounded-lg border p-lg ${CARD_CLASSES[station.tone]}`}
              data-testid={`live-station-${station.nr}`}
              key={station.nr}
            >
              <div className="flex items-center justify-between gap-sm">
                <span className="flex items-center gap-xs">
                  <span className="whitespace-nowrap text-sm text-ink-muted">
                    STATION {station.nr}
                  </span>
                  {onClearStation && (
                    <ClearStationButton
                      disabled={isBusy}
                      onClear={onClearStation}
                      stationId={station.nr as StationId}
                    />
                  )}
                </span>
                <span
                  className={`rounded-full px-sm py-xxs text-sm font-semibold whitespace-nowrap ${BADGE_CLASSES[station.tone]}`}
                >
                  {station.badge}
                </span>
              </div>
              <p className="text-lg font-semibold leading-tight text-ink">{station.name}</p>
              <p className="text-sm text-ink">{station.detail}</p>
              <p className="mt-auto text-sm text-ink-muted">{station.person}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-lg rounded-lg border bg-card p-xxl shadow-sticker">
        <div className="flex flex-wrap items-baseline justify-between gap-sm">
          <h2 className="text-xl font-semibold text-ink">Auftragsfortschritt</h2>
          <span className="text-sm text-ink-muted">{progress.ordered} Stück bestellt</span>
        </div>

        <ul className="grid grid-cols-1 gap-md sm:grid-cols-3">
          {progress.totals.map((total) => {
            const percent =
              progress.ordered > 0 ? Math.min((total.value / progress.ordered) * 100, 100) : 0;
            return (
              <li className="flex flex-col gap-sm" key={total.key}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-ink">{total.label}</span>
                  <span className="font-medium text-ink">
                    {total.value}/{progress.ordered}
                  </span>
                </div>
                <div
                  aria-label={total.label}
                  aria-valuemax={progress.ordered}
                  aria-valuemin={0}
                  aria-valuenow={total.value}
                  className="h-[10px] overflow-hidden rounded-full bg-chip"
                  role="progressbar"
                >
                  <div className="h-full bg-accent-green" style={{ width: `${percent}%` }} />
                </div>
              </li>
            );
          })}
        </ul>

        <div className="overflow-x-auto">
          <table aria-label="Fortschritt je Variante" className="w-full min-w-[32rem] text-left">
            <thead className="text-sm text-ink-muted">
              <tr>
                <th className="py-sm font-semibold" scope="col">
                  Variante
                </th>
                <th className="p-sm text-right font-semibold" scope="col">
                  Bestellt
                </th>
                <th className="p-sm text-right font-semibold" scope="col">
                  Produziert
                </th>
                <th className="p-sm text-right font-semibold" scope="col">
                  Eingelagert
                </th>
                <th className="py-sm pl-sm text-right font-semibold" scope="col">
                  Ausgelagert
                </th>
              </tr>
            </thead>
            <tbody className="text-ink">
              {progress.rows.map((row) => (
                <tr className="border-t" key={row.variant}>
                  <th className="py-md font-medium" scope="row">
                    <span className="flex items-center gap-sm">
                      <VariantSwatches variant={row.variant} />
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-semibold text-ink">
                          {getVariantTitle(row.variant)}
                        </span>
                        <span className="block text-xs font-normal text-ink-muted">
                          {getVariantParts(row.variant)}
                        </span>
                      </span>
                    </span>
                  </th>
                  <td className="p-md text-right">{row.ordered}</td>
                  <td className="p-md text-right">{row.produced}</td>
                  <td className="p-md text-right">{row.stored}</td>
                  <td className="py-md pl-md text-right">{row.out}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default LiveDashboard;
