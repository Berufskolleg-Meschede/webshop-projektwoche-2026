import { VARIANTS } from '@/types/production';
import type { Order, ShakerVariant, SimulationSession } from '@/types/simulation';
import { getVariantName } from '@/types/simulationCatalog';

type Props = {
  session: SimulationSession;
};

function sumQuantities(quantities: Partial<Record<ShakerVariant, number>>): number {
  return VARIANTS.reduce((total, variant) => total + (quantities[variant] ?? 0), 0);
}

function describeItems(items: Order['items']): string {
  return VARIANTS.filter((variant) => (items[variant] ?? 0) > 0)
    .map((variant) => `${items[variant]}× ${getVariantName(variant)}`)
    .join(', ');
}

/**
 * Teacher view of incoming customer orders from the simulation webshop (live via session polling).
 * The editable daily order total lives in the configuration panel (`Tagesbestellung`).
 */
function DailyOrderTable({ session }: Props) {
  const total = sumQuantities(session.daily_orders);
  const loggedTotal = session.orders.reduce((sum, order) => sum + sumQuantities(order.items), 0);
  const carriedTotal = sumQuantities(session.carried_over);
  const isOverwritten = total !== loggedTotal + carriedTotal;

  return (
    <section className="rounded-lg border bg-card p-xl shadow-sticker">
      <h2 className="mb-lg text-lg font-bold text-ink">Eingegangene Bestellungen</h2>

      {session.orders.length === 0 ? (
        <p className="text-sm text-ink-muted">Noch keine Kundenbestellungen eingegangen.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-ink">
            <thead>
              <tr className="border-b text-ink-muted">
                <th className="py-sm pr-md font-semibold">Nr.</th>
                <th className="py-sm pr-md font-semibold">Kunde</th>
                <th className="py-sm pr-md font-semibold">Positionen</th>
                <th className="py-sm text-right font-semibold">Stück</th>
              </tr>
            </thead>
            <tbody>
              {session.orders.map((order) => (
                <tr className="border-b" key={order.order_id}>
                  <td className="py-sm pr-md">{order.order_id}</td>
                  <td className="py-sm pr-md">{order.customer_name ?? '–'}</td>
                  <td className="py-sm pr-md">{describeItems(order.items)}</td>
                  <td className="py-sm text-right font-semibold">{sumQuantities(order.items)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isOverwritten && (
        <p
          className="mt-xl rounded-lg border border-primary bg-chip px-lg py-md text-sm font-semibold text-ink"
          role="note"
        >
          Die Tagessumme ({total} Stück) weicht von den Kundenbestellungen ({loggedTotal} Stück) ab:
          Sie wurde in der Konfiguration angepasst.
        </p>
      )}
    </section>
  );
}

export default DailyOrderTable;
