import { useSessionStations } from '@/hooks/useSessionStations';
import { ROLES, getRoleShortName, getRoleTitle, parseRole } from '@/types/simulationRoles';
import type { RoleInfo } from '@/types/simulationRoles';

type Props = {
  sessionId: string;
  /** The station the participant tried to take. */
  role: RoleInfo;
  /** Name of the person holding it (from the 409 answer), if the backend told us. */
  occupiedBy: string | null;
  onChooseRole: (role: RoleInfo) => void;
  onChooseOtherRole: () => void;
};

/**
 * Full-page state when the chosen station is already taken: who holds it, which stations are
 * still free (jump straight to one), and the way back to the role list or the customer shop.
 * Students cannot free a foreign station (#90).
 */
function StationOccupiedScreen({
  sessionId,
  role,
  occupiedBy,
  onChooseRole,
  onChooseOtherRole,
}: Props) {
  // Without the live list (load error) the screen still offers "Andere Rolle wählen".
  const { stations } = useSessionStations(sessionId);

  const freeRoles = ROLES.filter(
    (info) =>
      info.stationId !== null &&
      info.role !== role.role &&
      stations.some((station) => station.station_id === info.stationId && !station.claimed_by)
  );
  const customer = parseRole('customer');

  return (
    <main className="mx-auto w-full max-w-[36rem] px-lg py-6 sm:py-8">
      <header className="mb-xxl">
        <span className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Sitzung {sessionId}
        </span>
        <h1 className="text-2xl font-bold text-ink">Produktions-Simulation</h1>
      </header>

      <section className="rounded-lg border bg-card p-xxl shadow-sticker">
        <h2 className="mb-sm text-xl font-bold text-ink">{getRoleShortName(role)} ist besetzt</h2>
        <p className="mb-xl text-ink-muted" role="alert">
          {occupiedBy && role.sub
            ? `${occupiedBy} bedient die ${role.sub}.`
            : 'Diese Station wird bereits bedient.'}{' '}
          Pro Station ist nur eine Person erlaubt.
        </p>

        {freeRoles.length > 0 && (
          <>
            <h3 className="mb-sm text-sm font-semibold text-ink-muted">Noch frei</h3>
            <ul className="mb-xl flex flex-col gap-sm">
              {freeRoles.map((info) => (
                <li key={info.role}>
                  <button
                    className="w-full rounded-lg border bg-card px-md py-sm text-left hover:shadow-sticker-sm"
                    onClick={() => onChooseRole(info)}
                    type="button"
                  >
                    <span className="block font-semibold text-ink">{getRoleTitle(info)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="flex flex-col gap-sm">
          <button
            className="w-full rounded-full border bg-primary px-xxl py-md font-semibold text-on-primary shadow-sticker"
            onClick={onChooseOtherRole}
            type="button"
          >
            Andere Rolle wählen
          </button>
          {customer && (
            <button
              className="w-full rounded-full border bg-card px-xxl py-md font-semibold text-ink"
              onClick={() => onChooseRole(customer)}
              type="button"
            >
              Als Kunde zum WebShop
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

export default StationOccupiedScreen;
