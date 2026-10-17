import { getSessionSummary } from '@/types/production';
import type { SimulationSession } from '@/types/simulation';

type Props = { session: SimulationSession };

/** KPI summary of a finished day for the teacher dashboard. */
function SimulationSummaryReport({ session }: Props) {
  const summary = getSessionSummary(session);
  const rows: [string, number][] = [
    ['Bestellte Einheiten', summary.demand],
    ['Ausgelagerte Einheiten', summary.retrieved],
    ['Gefertigte Einheiten', summary.produced],
    ['Nachproduktions-Chargen', summary.replenishmentBatches],
    ['Nachproduzierte Einheiten', summary.replenishmentUnits],
  ];
  return (
    <section className="rounded-lg border bg-card p-xxl shadow-sticker">
      <h2 className="mb-lg text-lg font-bold text-ink">Zusammenfassung</h2>
      <dl className="grid grid-cols-2 gap-md sm:grid-cols-5">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-ink-muted">{label}</dt>
            <dd className="text-2xl font-bold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default SimulationSummaryReport;
