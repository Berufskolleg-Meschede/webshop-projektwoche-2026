import { useState } from 'react';

import { useSessionStations } from '@/hooks/useSessionStations';
import { ROLES, getRoleTitle } from '@/types/simulationRoles';
import type { RoleInfo, SimulationRole } from '@/types/simulationRoles';

type Props = {
  sessionId: string;
  /** Prefilled when the participant comes back from a station ("Andere Rolle wählen"). */
  initialName?: string;
  onJoin: (role: RoleInfo, name: string) => void;
};

/**
 * The one entry page for everybody (`/join/<code>`): user name, role list with live occupancy and
 * a submit button. Occupied stations cannot be picked; "Kunde" can be joined any number of times.
 */
function JoinPage({ sessionId, initialName = '', onJoin }: Props) {
  const { stations, loadState } = useSessionStations(sessionId);
  const [name, setName] = useState(initialName);
  const [picked, setPicked] = useState<SimulationRole | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  function getClaimedBy(stationId: number | null): string | null {
    if (stationId === null) return null;
    return stations.find((station) => station.station_id === stationId)?.claimed_by ?? null;
  }

  const pickedInfo = ROLES.find((info) => info.role === picked) ?? null;
  const isCustomer = pickedInfo?.stationId === null;
  const buttonLabel = isCustomer ? 'Zum WebShop' : 'Station beitreten';

  function handleSubmit(event: React.SyntheticEvent) {
    event.preventDefault();
    if (!pickedInfo) return;
    if (!isCustomer && name.trim() === '') {
      setNameError('Bitte einen Namen eingeben.');
      return;
    }
    setNameError(null);
    onJoin(pickedInfo, name.trim());
  }

  return (
    <main className="mx-auto w-full max-w-[36rem] px-lg py-6 sm:py-8">
      <header className="mb-xxl">
        <span className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Sitzung {sessionId}
        </span>
        <h1 className="text-2xl font-bold text-ink">Produktions-Simulation</h1>
      </header>

      <form
        className="rounded-lg border bg-card p-xxl shadow-sticker"
        noValidate
        onSubmit={handleSubmit}
      >
        <div className="mb-xl">
          <label className="block text-sm font-semibold text-ink-muted" htmlFor="join-name">
            Benutzername
            <input
              aria-describedby={nameError ? 'join-name-hint' : undefined}
              aria-invalid={nameError !== null}
              autoComplete="nickname"
              className={`mt-sm block w-full rounded-lg border bg-input px-md py-sm font-normal text-ink ${
                nameError ? 'border-danger' : 'border-input-border'
              }`}
              id="join-name"
              maxLength={40}
              onChange={(event) => {
                setName(event.target.value);
                if (nameError && event.target.value.trim() !== '') {
                  setNameError(null);
                }
              }}
              placeholder="z. B. Mia K."
              value={name}
            />
          </label>
          {nameError && (
            <p
              className="mt-xs text-sm font-normal text-danger-ink"
              id="join-name-hint"
              role="alert"
            >
              {nameError}
            </p>
          )}
        </div>

        <h2 className="mb-md text-lg font-bold text-ink" id="join-roles-title">
          Rolle wählen
        </h2>
        {loadState === 'loading' && (
          <p className="mb-md text-sm text-ink-muted" role="status">
            Belegung wird geladen…
          </p>
        )}
        {loadState === 'error' && (
          <p className="mb-md text-sm text-danger-ink" role="alert">
            Belegung konnte nicht geladen werden. Die Auswahl ist trotzdem möglich.
          </p>
        )}
        <ul
          aria-labelledby="join-roles-title"
          className="mb-xl flex flex-col gap-sm"
          role="radiogroup"
        >
          {ROLES.map((info) => {
            const { role, stationId } = info;
            const claimedBy = getClaimedBy(stationId);
            const isTaken = claimedBy !== null;
            const isPicked = picked === role;
            let badge: string | null = null;
            if (stationId === null) badge = 'Mehrfach';
            else if (loadState === 'ready') badge = isTaken ? `Besetzt · ${claimedBy}` : 'Frei';
            return (
              <li key={role}>
                <label
                  className={`flex min-h-14 items-center gap-md rounded-lg border px-md py-sm ${
                    isTaken
                      ? 'cursor-not-allowed border-dashed bg-chip text-ink-muted'
                      : `cursor-pointer bg-card text-ink ${isPicked ? 'border-primary ring-1 ring-primary' : ''}`
                  }`}
                >
                  <input
                    checked={isPicked}
                    disabled={isTaken}
                    name="join-role"
                    onChange={() => {
                      setPicked(role);
                      if (stationId === null && nameError) {
                        setNameError(null);
                      }
                    }}
                    type="radio"
                    value={role}
                  />
                  <span className="flex-1 font-semibold">{getRoleTitle(info)}</span>
                  {badge && (
                    <span className="whitespace-nowrap rounded-full border bg-chip px-md py-xs text-xs font-semibold">
                      {badge}
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>

        <button
          className="w-full rounded-full border bg-primary px-xxl py-md font-semibold text-on-primary shadow-sticker disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pickedInfo === null}
          type="submit"
        >
          {buttonLabel}
        </button>
      </form>
    </main>
  );
}

export default JoinPage;
