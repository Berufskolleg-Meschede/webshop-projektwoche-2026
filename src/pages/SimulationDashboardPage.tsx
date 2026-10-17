import { useEffect, useState } from 'react';

import { SESSION_NOT_FOUND_MESSAGE } from '@/api/errorMessages';
import DailyOrderTable from '@/components/simulation/DailyOrderTable';
import JoinCard from '@/components/simulation/JoinCard';
import LiveDashboard from '@/components/simulation/LiveDashboard';
import MasterControls from '@/components/simulation/MasterControls';
import RoleOverviewGrid from '@/components/simulation/RoleOverviewGrid';
import SimulationCelebrationModal from '@/components/simulation/SimulationCelebrationModal';
import SimulationSummaryReport from '@/components/simulation/SimulationSummaryReport';
import StrategySelector from '@/components/simulation/StrategySelector';
import type { Quantities } from '@/components/simulation/StrategySelector';
import { useSimulationSession } from '@/hooks/useSimulationSession';
import { STRATEGY_LABEL, getWebshopOrderTotal } from '@/types/liveDashboard';
import { getPreflight } from '@/types/preflight';
import { hasOpenShortfall, isPushPlanDone } from '@/types/production';
import type { ProductionStrategy, SimulationSession, SimulationState } from '@/types/simulation';

const STATE_LABELS: Record<SimulationState, string> = {
  CONFIGURING: 'Wartet auf Start',
  RUNNING: 'Läuft',
  FINISHED: 'Beendet',
};

type Props = {
  sessionId: string;
  onLeave: () => void;
};

type Draft = {
  strategy?: ProductionStrategy;
  orders?: Quantities;
  limits?: Quantities;
};

/** The editable setup. The draft lives in the page and goes to the server once, on "Tag simulieren". */
function ConfigPanel({
  session,
  draft,
  onDraftChange,
  onValidityChange,
}: {
  session: SimulationSession;
  draft: Draft;
  onDraftChange: (draft: Draft) => void;
  onValidityChange: (isValid: boolean) => void;
}) {
  return (
    <StrategySelector
      disabled={session.state !== 'CONFIGURING'}
      footer={
        session.state !== 'CONFIGURING' ? (
          <p className="text-sm text-ink-muted">
            Die Konfiguration ist nur vor dem Start änderbar.
          </p>
        ) : undefined
      }
      limits={draft.limits ?? session.daily_production_limits}
      onLimitsChange={(limits) => onDraftChange({ ...draft, limits })}
      onOrdersChange={(orders) => onDraftChange({ ...draft, orders })}
      onStrategyChange={(strategy) => onDraftChange({ ...draft, strategy })}
      onValidityChange={onValidityChange}
      orders={draft.orders ?? session.daily_orders}
      strategy={draft.strategy ?? session.strategy}
      webshopOrderCount={session.orders.length}
      webshopTotal={getWebshopOrderTotal(session)}
    />
  );
}

/** Teacher view: configure, check readiness, start, next day and watch the roles live. */
function SimulationDashboardPage({ sessionId, onLeave }: Props) {
  const [draft, setDraft] = useState<Draft>({});
  const [isInputValid, setIsInputValid] = useState(true);
  const [dismissedRunId, setDismissedRunId] = useState<number | null>(null);
  const {
    session,
    status,
    errorMessage,
    actionErrorMessage,
    isActionPending,
    setState,
    configure,
    nextDay,
    releaseStation,
  } = useSimulationSession(sessionId);

  // The in-memory session is gone after a server restart: leave it like "Sitzung verlassen".
  const isSessionGone = status === 'error' && errorMessage === SESSION_NOT_FOUND_MESSAGE;
  useEffect(() => {
    if (isSessionGone) onLeave();
  }, [isSessionGone, onLeave]);

  // A new day (or a reset) starts from the server values again.
  const runId = session?.run_id;
  useEffect(() => {
    setDraft({});
  }, [runId]);

  /** "Tag simulieren": the whole draft goes to the server once, then the day starts (one click). */
  async function handleStateChange(state: SimulationState) {
    if (state === 'RUNNING' && Object.keys(draft).length > 0) {
      const saved = await configure({
        strategy: draft.strategy,
        daily_orders: draft.orders,
        daily_production_limits: draft.limits,
      });
      if (!saved) return;
      setDraft({});
    }
    await setState(state);
  }

  // The pre-flight looks at what the teacher sees (draft included), not only at saved values.
  const preflight = session
    ? getPreflight({
        ...session,
        strategy: draft.strategy ?? session.strategy,
        daily_orders: draft.orders ?? session.daily_orders,
        daily_production_limits: draft.limits ?? session.daily_production_limits,
      })
    : null;
  const isLive = session?.state === 'RUNNING';

  return (
    <main className="mx-auto w-full max-w-[90rem] px-xxl py-6 sm:py-8">
      {session && isLive ? (
        <>
          <div className="mb-xl flex flex-wrap items-center justify-between gap-lg">
            <div className="flex flex-col gap-xs">
              <p className="text-sm tracking-wider text-ink-muted">
                SIMULATION · SITZUNG {sessionId}
              </p>
              <div className="flex flex-wrap items-center gap-md">
                <h1 className="text-3xl font-bold text-ink">Simulation läuft</h1>
                <span className="rounded-full bg-ink px-md py-xs font-semibold text-card">
                  {STRATEGY_LABEL[session.strategy]}
                </span>
              </div>
            </div>
            <MasterControls
              canStart={false}
              isBusy={isActionPending}
              onNextDay={() => {
                nextDay();
              }}
              onStateChange={(state) => {
                setState(state);
              }}
              state={session.state}
            />
          </div>
          <div className="mb-xl flex flex-wrap items-center justify-between gap-md">
            <p className="text-ink">
              <span className="rounded-full border bg-card px-md py-xs text-sm">
                {STATE_LABELS[session.state]}
              </span>
              {isPushPlanDone(session) && (
                <span className="ml-md text-sm text-ink-muted" role="status">
                  Tagesplan abgearbeitet. Du kannst den Tag jetzt beenden.
                </span>
              )}
            </p>
            <button className="text-sm text-ink-muted underline" onClick={onLeave} type="button">
              Sitzung verlassen
            </button>
          </div>
        </>
      ) : (
        <header className="mb-xl flex flex-wrap items-start justify-between gap-md">
          <div>
            <span className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Simulation · Sitzung {sessionId}
            </span>
            <h1 className="text-2xl font-bold text-ink">Dashboard Tagesproduktion</h1>
            <button className="text-sm text-ink-muted underline" onClick={onLeave} type="button">
              Sitzung verlassen
            </button>
          </div>
          {session && preflight && (
            <div className="flex flex-wrap items-center gap-md">
              <span className="flex items-center gap-sm rounded-full border bg-card px-lg py-sm text-sm font-semibold text-ink">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-accent-amber" />
                {STATE_LABELS[session.state]} ·{' '}
                {session.stations.filter((station) => station.claimed_by).length} von 5 Stationen
                besetzt
              </span>
              <MasterControls
                canStart={preflight.canStart && isInputValid}
                isBusy={isActionPending}
                onNextDay={() => {
                  nextDay();
                }}
                onStateChange={(state) => {
                  void handleStateChange(state);
                }}
                state={session.state}
              />
            </div>
          )}
        </header>
      )}

      {status === 'loading' && <p className="text-ink-muted">Sitzung wird geladen…</p>}
      {status === 'error' && <p className="text-danger-ink">Fehler: {errorMessage}</p>}
      {actionErrorMessage && <p className="mb-md text-danger-ink">{actionErrorMessage}</p>}

      {session && preflight && (
        <div className="flex flex-col gap-xxl">
          {isLive && (
            <LiveDashboard
              isBusy={isActionPending}
              onClearStation={(stationId) => {
                void releaseStation(stationId);
              }}
              session={session}
            />
          )}

          {!isLive && (
            <div className="grid items-start gap-xl lg:grid-cols-2">
              <div className="flex flex-col gap-xl">
                <JoinCard sessionId={session.session_id}>
                  <h3 className="mb-sm mt-xl font-bold text-ink">Besetzung</h3>
                  <RoleOverviewGrid
                    isBusy={isActionPending}
                    onClearStation={(stationId) => {
                      void releaseStation(stationId);
                    }}
                    session={session}
                  />
                </JoinCard>
                <DailyOrderTable session={session} />
              </div>
              <ConfigPanel
                draft={draft}
                onDraftChange={setDraft}
                onValidityChange={setIsInputValid}
                session={session}
              />
            </div>
          )}

          {session.state === 'FINISHED' && <SimulationSummaryReport session={session} />}
          {session.state === 'FINISHED' && dismissedRunId !== session.run_id && (
            <SimulationCelebrationModal
              endedByTeacher={session.ended_by_teacher}
              notFulfilled={hasOpenShortfall(session)}
              onClose={() => setDismissedRunId(session.run_id)}
            />
          )}
        </div>
      )}
    </main>
  );
}

export default SimulationDashboardPage;
