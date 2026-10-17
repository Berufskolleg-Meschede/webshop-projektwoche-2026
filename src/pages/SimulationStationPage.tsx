import { useEffect, useRef, useState } from 'react';

import { SESSION_NOT_FOUND_MESSAGE } from '@/api/errorMessages';
import StationOccupiedScreen from '@/components/simulation/StationOccupiedScreen';
import Station1LidsView from '@/components/simulation/stations/Station1LidsView';
import StationHeader from '@/components/simulation/stations/StationHeader';
import SimulationCelebrationModal from '@/components/simulation/SimulationCelebrationModal';
import Station5RetrievalView from '@/components/simulation/stations/Station5RetrievalView';
import Station4StorageView from '@/components/simulation/stations/Station4StorageView';
import Station3ProductionView from '@/components/simulation/stations/Station3ProductionView';
import Station2HousingsView from '@/components/simulation/stations/Station2HousingsView';
import { useSimulationSession } from '@/hooks/useSimulationSession';
import { useRoleClaim } from '@/hooks/useRoleClaim';
import { hasOpenShortfall } from '@/types/production';
import type { RoleInfo } from '@/types/simulationRoles';
import type { StationId } from '@/types/simulation';

type Props = {
  sessionId: string;
  role: RoleInfo & { stationId: StationId };
  onChooseOtherRole: () => void;
  /** Jump to another role from the "station occupied" screen (name is kept). */
  onChooseRole: (role: RoleInfo, name: string) => void;
  /** The server no longer knows the session (404): the claim is cleared, go back to the start. */
  onSessionGone: () => void;
  /** Name entered on the join page: the station is claimed right away with it. */
  initialName?: string;
};

/** Worker view of one station: claim it with a name, then show the role badge (HMI follows in Features 05–08). */
function SimulationStationPage({
  sessionId,
  role,
  onChooseOtherRole,
  onChooseRole,
  onSessionGone,
  initialName = '',
}: Props) {
  const { status, studentName, message, occupiedBy, claim, release, forget } = useRoleClaim(
    sessionId,
    role.stationId
  );
  const [name, setName] = useState(initialName);
  const [nameError, setNameError] = useState<string | null>(null);
  const hasAutoClaimed = useRef(false);
  useEffect(() => {
    // Once per mount; a failed claim (occupied) falls back to the form instead of retrying.
    if (!initialName || status !== 'idle' || hasAutoClaimed.current) return;
    hasAutoClaimed.current = true;
    void claim(initialName);
  }, [initialName, status, claim]);
  // Keyed by run so the next day (new run_id) never shows a stale dismissal.
  const [dismissedRunId, setDismissedRunId] = useState<number | null>(null);
  // Only poll once this device holds the station.
  const {
    session,
    status: sessionStatus,
    errorMessage,
    actionErrorMessage,
    finishDay,
    completeStation,
    produceBatch,
    storeBatch,
    reportDeviation,
    retrieveItem,
  } = useSimulationSession(status === 'claimed' ? sessionId : null);

  // The in-memory session is gone after a server restart: drop the claim and leave it.
  const isSessionGone =
    (sessionStatus === 'error' && errorMessage === SESSION_NOT_FOUND_MESSAGE) ||
    (status === 'error' && message === SESSION_NOT_FOUND_MESSAGE);
  useEffect(() => {
    if (!isSessionGone) return;
    forget();
    onSessionGone();
  }, [isSessionGone, forget, onSessionGone]);

  function isStationActive(stationId: StationId) {
    return (
      session?.stations.find((station) => station.station_id === stationId)?.status === 'ACTIVE'
    );
  }

  const isInteractive = session?.state === 'RUNNING';

  /** Mockup subtitles of the screens whose views do not carry that line themselves (yet). */
  function getSubtitle() {
    if (!session || !isInteractive) return undefined;
    if (role.stationId === 3) return 'Gib ein, was du jetzt in die Produktion schickst.';
    if (role.stationId === 5 && isStationActive(5)) {
      return 'Gib ein, was du jetzt aus dem Lager auslagerst.';
    }
    return undefined;
  }

  async function handleLeave() {
    if (await release()) onChooseOtherRole();
  }

  if (status === 'occupied') {
    return (
      <StationOccupiedScreen
        occupiedBy={occupiedBy}
        onChooseOtherRole={onChooseOtherRole}
        onChooseRole={(chosen) => onChooseRole(chosen, name)}
        role={role}
        sessionId={sessionId}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-xxl py-6 sm:py-8">
      {status === 'claimed' ? (
        <>
          <StationHeader
            onLeave={handleLeave}
            sessionId={sessionId}
            stationId={role.stationId}
            studentName={studentName}
            subtitle={getSubtitle()}
          />
          {sessionStatus === 'loading' && !session && (
            <p className="mb-xl text-ink-muted" role="status">
              Verbinde…
            </p>
          )}
          {sessionStatus === 'error' && (
            <p
              className="mb-xl rounded-lg border bg-card p-md text-sm text-danger-ink"
              role="alert"
            >
              {errorMessage}
            </p>
          )}
          {actionErrorMessage && <p className="mb-md text-danger-ink">{actionErrorMessage}</p>}
          {session?.state === 'FINISHED' && dismissedRunId !== session.run_id && (
            <SimulationCelebrationModal
              endedByTeacher={session.ended_by_teacher}
              onClose={() => setDismissedRunId(session.run_id)}
              notFulfilled={hasOpenShortfall(session)}
              summarySession={session}
            />
          )}
          {session && isInteractive && (
            <>
              {role.stationId === 1 && (
                <Station1LidsView onComplete={() => completeStation(1)} session={session} />
              )}
              {role.stationId === 3 && (
                <Station3ProductionView
                  isActive={isStationActive(3)}
                  onProduceBatch={produceBatch}
                  session={session}
                />
              )}
              {role.stationId === 5 && (
                <Station5RetrievalView
                  isActive={isStationActive(5)}
                  onFinishDay={finishDay}
                  onRetrieve={retrieveItem}
                  session={session}
                />
              )}
              {role.stationId === 4 && (
                <Station4StorageView
                  isActive={isStationActive(4)}
                  onReportDeviation={reportDeviation}
                  onStoreBatch={storeBatch}
                  session={session}
                />
              )}
              {role.stationId === 2 && (
                <Station2HousingsView
                  isActive={isStationActive(2)}
                  onComplete={() => completeStation(2)}
                  session={session}
                />
              )}
            </>
          )}
        </>
      ) : (
        <form
          className="rounded-lg border bg-card p-xxl shadow-sticker"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) {
              setNameError('Bitte einen Namen eingeben.');
              return;
            }
            setNameError(null);
            claim(name.trim());
          }}
        >
          <h1 className="mb-md text-2xl font-bold text-ink">{role.label}</h1>
          <p className="mb-xl text-sm text-ink-muted">Sitzung {sessionId}</p>

          {status === 'error' && (
            <p className="mb-xl text-sm text-danger-ink" role="alert">
              {message}
            </p>
          )}

          <div className="mb-xl">
            <label className="block text-sm text-ink-muted" htmlFor="student-name">
              Dein Name
              <input
                aria-describedby={nameError ? 'student-name-hint' : undefined}
                aria-invalid={nameError !== null}
                className={`mt-sm block w-full rounded-lg border bg-input px-md py-sm text-ink ${
                  nameError ? 'border-danger' : 'border-input-border'
                }`}
                id="student-name"
                onChange={(event) => {
                  setName(event.target.value);
                  if (nameError && event.target.value.trim() !== '') {
                    setNameError(null);
                  }
                }}
                value={name}
              />
            </label>
            {nameError && (
              <p className="mt-xs text-sm text-danger-ink" id="student-name-hint" role="alert">
                {nameError}
              </p>
            )}
          </div>
          <button
            className="rounded-full border bg-primary px-xxl py-md text-sm font-semibold text-on-primary shadow-sticker disabled:cursor-not-allowed disabled:opacity-50"
            disabled={status === 'claiming'}
            type="submit"
          >
            Station übernehmen
          </button>
        </form>
      )}
    </main>
  );
}

export default SimulationStationPage;
