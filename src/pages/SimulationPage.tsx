import { useEffect, useState } from 'react';

import CTAButton from '@/components/CTAButton';
import JoinPage from '@/components/simulation/JoinPage';
import { useCreateSession } from '@/hooks/useCreateSession';
import SimulationStationPage from '@/pages/SimulationStationPage';
import SimulationDashboardPage from '@/pages/SimulationDashboardPage';
import type { Page } from '@/components/Navbar';
import { isSessionCode } from '@/types/simulationRoles';
import type { RoleInfo } from '@/types/simulationRoles';

type Props = {
  onNavigate: (page: Page) => void;
  /** Set when the page was opened from a role QR code (`?session=…&role=…`). */
  joinTarget?: { sessionId: string; role: RoleInfo | null } | null;
  /** A customer joined in-app: the shop must switch to simulation mode for this session. */
  onEnterSimulationShop?: (sessionId: string, customerName?: string) => void;
};

function SimulationPage({ onNavigate, joinTarget = null, onEnterSimulationShop }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(joinTarget?.sessionId ?? null);
  const [isJoining, setIsJoining] = useState(joinTarget !== null);
  const [joinRole, setJoinRole] = useState<RoleInfo | null>(joinTarget?.role ?? null);
  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const { isCreating, createError, createSession, joinAsCustomer } = useCreateSession();

  const codeValid = isSessionCode(joinCode);

  const isCustomerJoin = isJoining && joinRole?.stationId === null;
  useEffect(() => {
    if (!isCustomerJoin || sessionId === null) return;
    // Counting is best effort: a failed request must not keep the customer out of the shop.
    void joinAsCustomer(sessionId).finally(() => {
      onEnterSimulationShop?.(sessionId, joinName);
      onNavigate('webshop');
    });
  }, [isCustomerJoin, sessionId, joinName, joinAsCustomer, onNavigate, onEnterSimulationShop]);

  async function handleCreate() {
    const created = await createSession();
    if (created !== null) setSessionId(created);
  }

  function handleJoin(event: React.SyntheticEvent, asStudent: boolean) {
    event.preventDefault();
    if (!isSessionCode(joinCode)) return;
    setSessionId(joinCode);
    setIsJoining(asStudent);
  }

  function handleJoinRole(role: RoleInfo, name: string) {
    setJoinName(name);
    setJoinRole(role);
    // A reload resumes this role: station claims are restored from sessionStorage, customers
    // reopen the simulation shop. Without it /join/<code> would show the form again.
    if (sessionId !== null) {
      const params = new URLSearchParams({ session: sessionId, role: role.role });
      window.history.replaceState(null, '', `/?${params.toString()}`);
    }
  }

  function handleLeave() {
    setIsJoining(false);
    setJoinRole(null);
    setSessionId(null);
    setJoinCode('');
  }

  if (isJoining && sessionId !== null) {
    if (joinRole?.stationId) {
      return (
        <SimulationStationPage
          initialName={joinName}
          key={joinRole.role}
          onChooseOtherRole={() => setJoinRole(null)}
          onChooseRole={handleJoinRole}
          onSessionGone={handleLeave}
          role={{ ...joinRole, stationId: joinRole.stationId }}
          sessionId={sessionId}
        />
      );
    }
    if (isCustomerJoin) {
      // The join is counted and the shop opens right after; no role selection in between (#88).
      return (
        <main className="mx-auto w-full max-w-3xl px-xxl py-6 sm:py-8">
          <p className="text-ink-muted">Weiter zum Webshop…</p>
        </main>
      );
    }
    return <JoinPage initialName={joinName} onJoin={handleJoinRole} sessionId={sessionId} />;
  }

  if (sessionId !== null)
    return <SimulationDashboardPage onLeave={handleLeave} sessionId={sessionId} />;

  return (
    <main className="mx-auto w-full max-w-[90rem] px-xxl py-6 sm:py-8">
      <h1 className="mb-xxxl text-2xl font-bold text-ink">Simulation</h1>

      <div className="grid gap-xxl md:grid-cols-3">
        <section className="rounded-lg border bg-card p-xxl shadow-sticker">
          <h2 className="mb-md text-lg font-bold text-ink">Neue Sitzung</h2>
          <p className="mb-xl text-sm text-ink-muted">
            Erstellt eine Sitzung mit einem 4-stelligen Code für alle Geräte.
          </p>
          <CTAButton disabled={isCreating} label="Sitzung erstellen" onClick={handleCreate} />
          {createError && <p className="mt-md text-sm text-danger-ink">{createError}</p>}
        </section>

        <form
          className="rounded-lg border bg-card p-xxl shadow-sticker"
          onSubmit={(event) => handleJoin(event, false)}
        >
          <h2 className="mb-md text-lg font-bold text-ink">Als Lehrkraft öffnen</h2>
          <p className="mb-xl text-sm text-ink-muted">
            Öffnet das Dashboard einer bestehenden Sitzung (Start, Nächster Tag).
          </p>
          <label className="mb-xl block text-sm text-ink-muted" htmlFor="teacher-session-code">
            Sitzungs-Code (Lehrkraft)
            <input
              className="mt-sm block w-full rounded-lg border border-input-border bg-input px-md py-sm text-ink"
              id="teacher-session-code"
              inputMode="numeric"
              maxLength={4}
              onChange={(event) => setJoinCode(event.target.value)}
              value={joinCode}
            />
          </label>
          <button
            className="rounded-full border bg-primary px-xxl py-md text-sm font-semibold text-on-primary shadow-sticker disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!codeValid}
            type="submit"
          >
            Als Lehrkraft öffnen
          </button>
        </form>

        <form
          className="rounded-lg border bg-card p-xxl shadow-sticker"
          onSubmit={(event) => handleJoin(event, true)}
        >
          <h2 className="mb-md text-lg font-bold text-ink">Als Schüler beitreten</h2>
          <p className="mb-xl text-sm text-ink-muted">
            Mit dem Code deiner Lehrkraft eine Rolle bzw. Station auswählen.
          </p>
          <label className="mb-xl block text-sm text-ink-muted" htmlFor="student-session-code">
            Sitzungs-Code (Schüler)
            <input
              className="mt-sm block w-full rounded-lg border border-input-border bg-input px-md py-sm text-ink"
              id="student-session-code"
              inputMode="numeric"
              maxLength={4}
              onChange={(event) => setJoinCode(event.target.value)}
              value={joinCode}
            />
          </label>
          <button
            className="rounded-full border bg-primary px-xxl py-md text-sm font-semibold text-on-primary shadow-sticker disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!codeValid}
            type="submit"
          >
            Als Schüler beitreten
          </button>
        </form>
      </div>
    </main>
  );
}

export default SimulationPage;
