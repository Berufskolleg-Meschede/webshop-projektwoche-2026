import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';

import { ApiRequestError } from '@/api/requestApi';
import * as sessionApi from '@/api/simulation/sessionApi';
import { CLAIM_STORAGE_KEY } from '@/hooks/useRoleClaim';
import { makeSession } from '@/test/fixtures';
import type { StationId } from '@/types/simulation';
import { ROLES } from '@/types/simulationRoles';

import SimulationStationPage from './SimulationStationPage';

vi.mock('@/api/simulation/sessionApi');
const api = vi.mocked(sessionApi);

function renderStation(stationId: StationId, onSessionGone = vi.fn()) {
  sessionStorage.setItem(
    CLAIM_STORAGE_KEY,
    JSON.stringify({ sessionId: '4827', stationId, name: 'Max' })
  );
  const role = ROLES.find((info) => info.stationId === stationId) as (typeof ROLES)[number] & {
    stationId: StationId;
  };
  return render(
    <SimulationStationPage
      onChooseOtherRole={vi.fn()}
      onChooseRole={vi.fn()}
      onSessionGone={onSessionGone}
      role={role}
      sessionId="4827"
    />
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
});

describe('SimulationStationPage', () => {
  it('shows the shared station header with the session code', async () => {
    api.getSessionApi.mockResolvedValue(makeSession({ state: 'RUNNING', strategy: 'PUSH' }));
    renderStation(3);
    expect(await screen.findByText('STATION 3 · SITZUNG 4827')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Produktion' })).toBeInTheDocument();
    expect(screen.getByText('Max')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Station verlassen' })).toBeInTheDocument();
  });

  it('shows a connecting hint while the session loads', async () => {
    api.getSessionApi.mockReturnValue(new Promise(() => undefined));
    renderStation(1);
    expect(await screen.findByRole('status')).toHaveTextContent('Verbinde…');
  });

  it('leaves the dead session and clears the claim when the session is not found (404)', async () => {
    api.getSessionApi.mockRejectedValue(
      new ApiRequestError('Not found', 404, '/simulation/sessions/4827', null)
    );
    const onSessionGone = vi.fn();
    renderStation(1, onSessionGone);
    await waitFor(() => expect(onSessionGone).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem(CLAIM_STORAGE_KEY)).toBeNull();
  });

  it('leaves the dead session when claiming it answers 404', async () => {
    api.claimStationApi.mockRejectedValue(
      new ApiRequestError('Not found', 404, '/simulation/sessions/4827/claim', null)
    );
    const onSessionGone = vi.fn();
    const role = ROLES.find((info) => info.stationId === 1) as (typeof ROLES)[number] & {
      stationId: StationId;
    };
    render(
      <SimulationStationPage
        initialName="Max"
        onChooseOtherRole={vi.fn()}
        onChooseRole={vi.fn()}
        onSessionGone={onSessionGone}
        role={role}
        sessionId="4827"
      />
    );
    await waitFor(() => expect(onSessionGone).toHaveBeenCalledTimes(1));
  });

  it('shows an alert when the server is unreachable', async () => {
    api.getSessionApi.mockRejectedValue(new TypeError('Failed to fetch'));
    renderStation(1);
    expect(await screen.findByRole('alert')).toHaveTextContent(/Server nicht erreichbar/);
  });

  it('shows Station 2 as locked while Station 1 is not completed', async () => {
    api.getSessionApi.mockResolvedValue(
      makeSession({
        state: 'RUNNING',
        stations: [
          { station_id: 1, status: 'ACTIVE', claimed_by: null, has_error: false },
          { station_id: 2, status: 'IDLE', claimed_by: 'Max', has_error: false },
        ],
      })
    );
    renderStation(2);
    expect(await screen.findByText('Noch gesperrt')).toBeInTheDocument();
    expect(
      screen.getByText('Die Zulieferung startet, sobald Station 1 die Deckel zugeliefert hat.')
    ).toBeInTheDocument();
  });

  it('shows the session code with "Sitzung" in the claim form', () => {
    const role = ROLES.find((info) => info.stationId === 1) as (typeof ROLES)[number] & {
      stationId: StationId;
    };
    render(
      <SimulationStationPage
        onChooseOtherRole={vi.fn()}
        onChooseRole={vi.fn()}
        onSessionGone={vi.fn()}
        role={role}
        sessionId="4827"
      />
    );
    expect(screen.getByText('Sitzung 4827')).toBeInTheDocument();
  });

  it('shows an inline hint when attempting to claim a station without entering a name', async () => {
    const role = ROLES.find((info) => info.stationId === 1) as (typeof ROLES)[number] & {
      stationId: StationId;
    };
    render(
      <SimulationStationPage
        onChooseOtherRole={vi.fn()}
        onChooseRole={vi.fn()}
        onSessionGone={vi.fn()}
        role={role}
        sessionId="4827"
      />
    );
    const button = screen.getByRole('button', { name: 'Station übernehmen' });
    expect(button).toBeEnabled();

    await userEvent.click(button);
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte einen Namen eingeben.');
    expect(screen.getByLabelText('Dein Name')).toHaveAttribute('aria-invalid', 'true');

    await userEvent.type(screen.getByLabelText('Dein Name'), 'Anna');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Dein Name')).toHaveAttribute('aria-invalid', 'false');
  });

  it('calls finishDayApi when Station 5 ends the day', async () => {
    api.getSessionApi.mockResolvedValue(
      makeSession({
        state: 'RUNNING',
        strategy: 'PUSH',
        daily_orders: { 'S-RT': 1 },
        retrieved: { 'S-RT': 1 },
        stations: [
          { station_id: 1, status: 'COMPLETED', claimed_by: null, has_error: false },
          { station_id: 2, status: 'COMPLETED', claimed_by: null, has_error: false },
          { station_id: 3, status: 'COMPLETED', claimed_by: null, has_error: false },
          { station_id: 4, status: 'COMPLETED', claimed_by: null, has_error: false },
          { station_id: 5, status: 'ACTIVE', claimed_by: 'Max', has_error: false },
        ],
      })
    );
    api.finishDayApi.mockResolvedValue(makeSession({ state: 'FINISHED', strategy: 'PUSH' }));
    renderStation(5);
    const finishButton = await screen.findByRole('button', { name: 'Beenden' });
    await userEvent.click(finishButton);
    expect(api.finishDayApi).toHaveBeenCalledWith('4827');
  });
});

describe('SimulationStationPage station wiring', () => {
  const activate = (session: ReturnType<typeof makeSession>, id: StationId) =>
    session.stations.map((st) =>
      st.station_id === id ? { ...st, status: 'ACTIVE' as const } : st
    );

  it('completes the Station 1 supply for the session', async () => {
    const running = makeSession({ state: 'RUNNING', daily_orders: { 'S-RT': 2 } });
    api.getSessionApi.mockResolvedValue(running);
    api.completeStationApi.mockResolvedValue(running);
    renderStation(1);
    for (const box of await screen.findAllByRole('checkbox')) await userEvent.click(box);
    await userEvent.click(screen.getByRole('button', { name: 'Zulieferung bestätigen' }));
    expect(api.completeStationApi).toHaveBeenCalledWith('4827', 1);
  });

  it('shows an error when completing the Station 2 supply fails offline', async () => {
    const base = makeSession({ state: 'RUNNING', daily_orders: { 'S-RT': 1 } });
    api.getSessionApi.mockResolvedValue({ ...base, stations: activate(base, 2) });
    api.completeStationApi.mockRejectedValue(new TypeError('offline'));
    renderStation(2);
    for (const box of await screen.findAllByRole('checkbox')) await userEvent.click(box);
    await userEvent.click(screen.getByRole('button', { name: 'Zulieferung bestätigen' }));
    expect(await screen.findByText(/nicht erreichbar/)).toBeInTheDocument();
  });

  it('sends a Station 3 batch for the session', async () => {
    const base = makeSession({ state: 'RUNNING', daily_orders: { 'S-RT': 4 } });
    const running = { ...base, stations: activate(base, 3) };
    api.getSessionApi.mockResolvedValue(running);
    api.produceBatchApi.mockResolvedValue(running);
    renderStation(3);
    const more = await screen.findByRole('button', { name: /Salzstreuer · Rot mehr/ });
    for (let i = 0; i < 4; i++) await userEvent.click(more);
    await userEvent.click(screen.getByRole('button', { name: /Charge senden/ }));
    expect(api.produceBatchApi).toHaveBeenCalledWith('4827', { variant: 'S-RT', quantity: 4 });
  });

  it('stores a produced batch at Station 4', async () => {
    const base = makeSession({
      state: 'RUNNING',
      daily_orders: { 'S-RT': 2 },
      batches: [
        {
          batch_id: 'b1',
          variant: 'S-RT',
          quantity: 2,
          status: 'PRODUCED',
          is_replenishment: false,
          reject_reason: null,
          created_at: '',
        },
      ],
    });
    const running = { ...base, stations: activate(base, 4) };
    api.getSessionApi.mockResolvedValue(running);
    api.storeBatchApi.mockResolvedValue(running);
    renderStation(4);
    await userEvent.click(await screen.findByRole('button', { name: 'Stimmt – eingelagert' }));
    expect(api.storeBatchApi).toHaveBeenCalledWith('4827', 'b1');
  });

  it('keeps Station 5 locked until the backend activates it', async () => {
    api.getSessionApi.mockResolvedValue(makeSession({ state: 'RUNNING' }));
    renderStation(5);
    expect(await screen.findByText('Noch gesperrt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menge wählen' })).toBeDisabled();
  });

  it('retrieves an item at Station 5 once it is active', async () => {
    const base = makeSession({
      state: 'RUNNING',
      daily_orders: { 'S-RT': 2 },
      stock: { 'S-RT': 2 },
    });
    const active = { ...base, stations: activate(base, 5) };
    api.getSessionApi.mockResolvedValue(active);
    api.retrieveItemApi.mockResolvedValue(active);
    renderStation(5);
    await userEvent.click(await screen.findByRole('button', { name: 'Salzstreuer · Rot mehr' }));
    expect(screen.getByText('Gib ein, was du jetzt aus dem Lager auslagerst.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '1 Stück auslagern' }));
    expect(api.retrieveItemApi).toHaveBeenCalledWith('4827', { variant: 'S-RT', quantity: 1 });
  });
});

describe('SimulationStationPage finish popup', () => {
  const stationsDone = [1, 2, 3, 4, 5].map((id) => ({
    station_id: id as StationId,
    status: 'COMPLETED' as const,
    claimed_by: null,
    has_error: false,
  }));

  it.each([
    [true, 'Tag abgebrochen', 'Produktionsauftrag erfolgreich abgeschlossen!'],
    [false, 'Produktionsauftrag erfolgreich abgeschlossen!', 'Tag abgebrochen'],
  ])('popup headline for ended_by_teacher=%s', async (endedByTeacher, shown, hidden) => {
    api.getSessionApi.mockResolvedValue(
      makeSession({ state: 'FINISHED', stations: stationsDone, ended_by_teacher: endedByTeacher })
    );
    renderStation(3);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(shown);
    expect(dialog).not.toHaveTextContent(hidden);
  });

  it('popup shows the not-fulfilled headline and flag for a shortfall day', async () => {
    api.getSessionApi.mockResolvedValue(
      makeSession({ state: 'FINISHED', stations: stationsDone, shortfall: { 'S-RT': 2 } })
    );
    renderStation(5);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Tag nicht vollständig erfüllt');
    expect(dialog).not.toHaveTextContent('Produktionsauftrag erfolgreich abgeschlossen!');
    expect(within(dialog).getByTestId('celebration-icon')).toHaveClass('lucide-flag');
  });

  it('popup keeps the success headline and party popper without shortfall', async () => {
    api.getSessionApi.mockResolvedValue(
      makeSession({ state: 'FINISHED', stations: stationsDone, shortfall: { 'S-RT': 0 } })
    );
    renderStation(5);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Produktionsauftrag erfolgreich abgeschlossen!');
    expect(within(dialog).getByTestId('celebration-icon')).toHaveClass('lucide-party-popper');
  });

  it.each(['PUSH', 'PULL'] as const)('shows the day summary in the %s popup', async (strategy) => {
    api.getSessionApi.mockResolvedValue(
      makeSession({
        state: 'FINISHED',
        strategy,
        stations: stationsDone,
        daily_orders: { 'S-RT': 3 },
        retrieved: { 'S-RT': 3 },
      })
    );
    renderStation(3);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Produktionsauftrag erfolgreich abgeschlossen!');
    expect(within(dialog).getByText('Bestellte Einheiten').nextSibling).toHaveTextContent('3');
    expect(within(dialog).getByText('Ausgelagerte Einheiten').nextSibling).toHaveTextContent('3');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('clears the popup on the next day and shows it again for the next finish', async () => {
    const day = (state: 'FINISHED' | 'CONFIGURING', runId: number) =>
      makeSession({ state, run_id: runId, strategy: 'PUSH', stations: stationsDone });
    api.getSessionApi
      .mockResolvedValueOnce(day('FINISHED', 1))
      .mockResolvedValueOnce(day('FINISHED', 1))
      .mockResolvedValueOnce(day('CONFIGURING', 2))
      .mockResolvedValue(day('FINISHED', 2));
    renderStation(3);
    await screen.findByRole('dialog');
    // The popup stays across polls of the same finished run.
    await new Promise((resolve) => setTimeout(resolve, 1700));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Next day: no stale popup.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), {
      timeout: 3500,
    });
    // The new day finishes: popup is back (dismissal of run 1 does not apply).
    expect(await screen.findByRole('dialog', {}, { timeout: 3500 })).toBeInTheDocument();
  }, 15000);

  it('does not show a popup that was dismissed again for the same run', async () => {
    api.getSessionApi.mockResolvedValue(
      makeSession({ state: 'FINISHED', run_id: 1, strategy: 'PUSH', stations: stationsDone })
    );
    renderStation(3);
    await userEvent.click(await screen.findByRole('button', { name: 'Schließen' }));
    await new Promise((resolve) => setTimeout(resolve, 1700));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  }, 10000);
});
