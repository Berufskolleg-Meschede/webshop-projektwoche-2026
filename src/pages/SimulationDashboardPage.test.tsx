import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';

import { ApiRequestError } from '@/api/requestApi';
import * as sessionApi from '@/api/simulation/sessionApi';
import { makeSession } from '@/test/fixtures';
import type { SimulationSession } from '@/types/simulation';

import SimulationDashboardPage from './SimulationDashboardPage';

vi.mock('@/api/simulation/sessionApi');
const api = vi.mocked(sessionApi);

function claimedStations(session: SimulationSession) {
  return session.stations.map((s) => ({ ...s, claimed_by: `W${s.station_id}` }));
}

async function renderDashboard(session = makeSession()) {
  api.getSessionApi.mockResolvedValue(session);
  const onLeave = vi.fn();
  render(<SimulationDashboardPage onLeave={onLeave} sessionId="4827" />);
  await screen.findByRole('heading', {
    name: /Dashboard Tagesproduktion|Simulation läuft/,
  });
  return onLeave;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('SimulationDashboardPage', () => {
  it('shows loading and load errors', async () => {
    api.getSessionApi.mockRejectedValue(new TypeError('x'));
    render(<SimulationDashboardPage onLeave={vi.fn()} sessionId="4827" />);
    expect(screen.getByText('Sitzung wird geladen…')).toBeInTheDocument();
    expect(await screen.findByText(/Fehler: Server nicht erreichbar/)).toBeInTheDocument();
  });

  it('shows the session code once while running', async () => {
    await renderDashboard(makeSession({ state: 'RUNNING' }));
    expect(screen.getByText('SIMULATION · SITZUNG 4827')).toBeInTheDocument();
    expect(screen.getAllByText(/Sitzung 4827/i)).toHaveLength(1);
    expect(screen.getByText('Läuft')).toBeInTheDocument();
  });

  it('leaves to the start page when the session is not found (404)', async () => {
    api.getSessionApi.mockRejectedValue(new ApiRequestError('x', 404, '/p', null));
    const onLeave = vi.fn();
    render(<SimulationDashboardPage onLeave={onLeave} sessionId="4827" />);
    await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1));
  });

  it('blocks the start without an order and shows no warning list (#147)', async () => {
    await renderDashboard();
    expect(screen.getByRole('button', { name: /Tag simulieren/ })).toBeDisabled();
    expect(screen.queryByText('Nicht alle Stationen 1–5 sind besetzt.')).not.toBeInTheDocument();
    expect(screen.queryByText('Es liegt noch kein Auftrag vor.')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('starts when everything is ready', async () => {
    const ready = makeSession({ daily_orders: { 'S-RT': 2 } });
    ready.stations = claimedStations(ready);
    api.setSessionStateApi.mockResolvedValue({ ...ready, state: 'RUNNING' });
    await renderDashboard(ready);

    await userEvent.click(screen.getByRole('button', { name: /Tag simulieren/ }));
    expect(api.setSessionStateApi).toHaveBeenCalledWith('4827', 'RUNNING');
    expect(await screen.findByRole('button', { name: 'Beenden' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Konfiguration' })).not.toBeInTheDocument();
  });

  it('enables the start with unclaimed stations once an order exists (decision B)', async () => {
    await renderDashboard(makeSession({ daily_orders: { 'P-SW': 1 } }));
    expect(screen.queryByLabelText(/Demo-Modus/)).not.toBeInTheDocument();
    // the header status line already says how many stations are occupied
    expect(screen.getByText(/0 von 5 Stationen besetzt/)).toBeInTheDocument();
    expect(screen.queryByText('Nicht alle Stationen 1–5 sind besetzt.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tag simulieren/ })).toBeEnabled();
  });

  it('starts the next day from a finished day and shows the preparation screen', async () => {
    api.nextDaySessionApi.mockResolvedValue(makeSession({ run_id: 2 }));
    await renderDashboard(makeSession({ state: 'FINISHED', run_id: 1 }));
    await userEvent.click(screen.getByRole('button', { name: 'Nächster Tag' }));
    expect(api.nextDaySessionApi).toHaveBeenCalledWith('4827');
    expect(await screen.findByRole('button', { name: /Tag simulieren/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nächster Tag' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Konfiguration speichern/ })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tagesbestellung' })).toBeInTheDocument();
    expect(screen.getByText('Produktionsstrategie')).toBeInTheDocument();
    expect(screen.getByText('Teilnehmende beitreten lassen')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Besetzung' })).toBeInTheDocument();
  });

  it('shows the finish popup once the day is finished and closes it with "Schließen"', async () => {
    await renderDashboard(makeSession({ state: 'FINISHED', run_id: 1 }));
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Produktionsauftrag erfolgreich abgeschlossen!'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nächster Tag' })).toBeInTheDocument();
  });

  it('shows "Tag abgebrochen" instead of the success headline when the teacher ended the day', async () => {
    await renderDashboard(makeSession({ state: 'FINISHED', run_id: 1, ended_by_teacher: true }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Tag abgebrochen');
    expect(dialog).not.toHaveTextContent('Produktionsauftrag erfolgreich abgeschlossen!');
  });

  it('keeps the success headline when the teacher did not end the day', async () => {
    await renderDashboard(makeSession({ state: 'FINISHED', run_id: 1, ended_by_teacher: false }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Produktionsauftrag erfolgreich abgeschlossen!');
    expect(dialog).not.toHaveTextContent('Tag abgebrochen');
  });

  it('shows "Tag nicht vollständig erfüllt" as the only headline for a shortfall day', async () => {
    await renderDashboard(makeSession({ state: 'FINISHED', run_id: 1, shortfall: { 'S-RT': 2 } }));
    const dialog = screen.getByRole('dialog');
    expect(screen.getByRole('heading', { name: 'Tag nicht vollständig erfüllt' })).toBeVisible();
    expect(dialog).not.toHaveTextContent('Produktionsauftrag erfolgreich abgeschlossen!');
    expect(within(dialog).getAllByText('Tag nicht vollständig erfüllt')).toHaveLength(1);
    expect(screen.getByTestId('celebration-icon')).toHaveClass('lucide-flag');
  });

  it('keeps "Tag abgebrochen" for a teacher-ended day with shortfall', async () => {
    await renderDashboard(
      makeSession({
        state: 'FINISHED',
        run_id: 1,
        ended_by_teacher: true,
        shortfall: { 'S-RT': 2 },
      })
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Tag abgebrochen');
    expect(dialog).not.toHaveTextContent('Tag nicht vollständig erfüllt');
  });

  it('keeps the success headline and party popper without shortfall', async () => {
    await renderDashboard(makeSession({ state: 'FINISHED', run_id: 1, shortfall: { 'S-RT': 0 } }));
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Produktionsauftrag erfolgreich abgeschlossen!'
    );
    expect(screen.getByTestId('celebration-icon')).toHaveClass('lucide-party-popper');
  });

  it.each(['CONFIGURING', 'RUNNING'] as const)(
    'shows neither the finish popup nor "Nächster Tag" while %s',
    async (state) => {
      await renderDashboard(makeSession({ state }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Nächster Tag' })).not.toBeInTheDocument();
    }
  );

  it('ends the day only after confirmation (Beenden)', async () => {
    api.setSessionStateApi.mockResolvedValue(makeSession({ state: 'FINISHED' }));
    await renderDashboard(makeSession({ state: 'RUNNING' }));

    await userEvent.click(screen.getByRole('button', { name: 'Beenden' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(api.setSessionStateApi).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Beenden' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ja, beenden' }));
    expect(api.setSessionStateApi).toHaveBeenCalledWith('4827', 'FINISHED');
  });

  it('locks the master buttons while an action is in flight (U03)', async () => {
    let finish: (s: SimulationSession) => void = () => {};
    api.setSessionStateApi.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await renderDashboard(makeSession({ state: 'RUNNING' }));
    await userEvent.click(screen.getByRole('button', { name: 'Beenden' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ja, beenden' }));
    expect(screen.getByRole('button', { name: 'Beenden' })).toBeDisabled();
    finish(makeSession({ state: 'FINISHED' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nächster Tag' })).toBeEnabled());
  });

  it('sends the whole draft once when the day starts and has no save button (#144)', async () => {
    const saved = makeSession({
      strategy: 'PUSH',
      daily_orders: { 'S-RT': 3 },
      daily_production_limits: { 'S-RT': 5 },
    });
    api.configureSessionApi.mockResolvedValue(saved);
    api.setSessionStateApi.mockResolvedValue({ ...saved, state: 'RUNNING' });
    await renderDashboard();

    expect(
      screen.queryByRole('button', { name: /Konfiguration speichern/ })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Tages-Produktionsmenge/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tag simulieren/ })).toBeDisabled(); // no order yet

    await userEvent.click(screen.getByLabelText(/Push/));
    const order = screen.getByLabelText('Tagesauftrag Salz (Deckel blau) · Gehäuse rot');
    await userEvent.clear(order);
    await userEvent.type(order, '3');
    const plan = screen.getByLabelText('Tages-Produktionsmenge Salz (Deckel blau) · Gehäuse rot');
    await userEvent.clear(plan);
    await userEvent.type(plan, '5');
    // nothing was sent while editing
    expect(api.configureSessionApi).not.toHaveBeenCalled();

    // the draft counts for the pre-flight: the start is possible without saving first
    const start = screen.getByRole('button', { name: /Tag simulieren/ });
    expect(start).toBeEnabled();
    await userEvent.click(start);
    await waitFor(() => expect(api.setSessionStateApi).toHaveBeenCalledWith('4827', 'RUNNING'));
    expect(api.configureSessionApi).toHaveBeenCalledTimes(1);
    expect(api.configureSessionApi).toHaveBeenCalledWith('4827', {
      strategy: 'PUSH',
      daily_orders: expect.objectContaining({ 'S-RT': 3 }),
      daily_production_limits: expect.objectContaining({ 'S-RT': 5 }),
    });
    // configuration first, then the start
    expect(api.configureSessionApi.mock.invocationCallOrder[0]).toBeLessThan(
      api.setSessionStateApi.mock.invocationCallOrder[0]
    );
  });

  it('starts a Push day with a plan but no order and sends that config (#166)', async () => {
    api.setSessionStateApi.mockResolvedValue(makeSession({ state: 'RUNNING' }));
    api.configureSessionApi.mockResolvedValue(makeSession({ strategy: 'PUSH' }));
    await renderDashboard();
    await userEvent.click(screen.getByLabelText(/Push/));
    expect(screen.getByRole('button', { name: /Tag simulieren/ })).toBeDisabled();
    const plan = screen.getByLabelText('Tages-Produktionsmenge Salz (Deckel blau) · Gehäuse rot');
    await userEvent.clear(plan);
    await userEvent.type(plan, '3');
    const start = screen.getByRole('button', { name: /Tag simulieren/ });
    expect(start).toBeEnabled();
    await userEvent.click(start);
    await waitFor(() => expect(api.setSessionStateApi).toHaveBeenCalledWith('4827', 'RUNNING'));
    expect(api.configureSessionApi).toHaveBeenCalledWith('4827', {
      strategy: 'PUSH',
      daily_orders: undefined,
      daily_production_limits: expect.objectContaining({ 'S-RT': 3 }),
    });
  });

  it('starts without a configuration request when nothing was edited (#144)', async () => {
    api.setSessionStateApi.mockResolvedValue(makeSession({ state: 'RUNNING' }));
    await renderDashboard(makeSession({ daily_orders: { 'S-RT': 2 } }));
    await userEvent.click(screen.getByRole('button', { name: /Tag simulieren/ }));
    await waitFor(() => expect(api.setSessionStateApi).toHaveBeenCalledWith('4827', 'RUNNING'));
    expect(api.configureSessionApi).not.toHaveBeenCalled();
  });

  it('does not start the day when sending the configuration fails (#144)', async () => {
    api.configureSessionApi.mockRejectedValue(new TypeError('x'));
    await renderDashboard();
    const order = screen.getByLabelText('Tagesauftrag Salz (Deckel blau) · Gehäuse rot');
    await userEvent.clear(order);
    await userEvent.type(order, '2');
    await userEvent.click(screen.getByRole('button', { name: /Tag simulieren/ }));
    expect(await screen.findByText(/nicht erreichbar/)).toBeInTheDocument();
    expect(api.setSessionStateApi).not.toHaveBeenCalled();
    // the draft is still there for another try
    expect(order).toHaveValue('2');
  });

  it('lets a number field be cleared and typed freely; empty counts as 0 (BUG-04)', async () => {
    api.configureSessionApi.mockResolvedValue(makeSession({ daily_orders: { 'S-RT': 5 } }));
    api.setSessionStateApi.mockResolvedValue(makeSession({ state: 'RUNNING' }));
    await renderDashboard();
    const order = screen.getByLabelText('Tagesauftrag Salz (Deckel blau) · Gehäuse rot');
    expect(order).toHaveValue('0');
    await userEvent.type(order, '{Backspace}'); // clears the "0" instead of snapping back
    expect(order).toHaveValue('');
    await userEvent.type(order, '7');
    expect(order).toHaveValue('7'); // not "07"
    await userEvent.clear(order);
    await userEvent.type(order, '12{Backspace}{Backspace}');
    expect(order).toHaveValue('');
    await userEvent.type(order, '5');
    expect(order).toHaveValue('5');
    await userEvent.click(screen.getByRole('button', { name: /Tag simulieren/ }));
    expect(api.configureSessionApi).toHaveBeenCalledWith(
      '4827',
      expect.objectContaining({ daily_orders: expect.objectContaining({ 'S-RT': 5 }) })
    );
  });

  it('shows the carried quantity as the pre-filled order of the next day and lets it be extended (#197)', async () => {
    api.nextDaySessionApi.mockResolvedValue(
      makeSession({ state: 'CONFIGURING', run_id: 2, daily_orders: { 'S-RT': 2 } })
    );
    await renderDashboard(makeSession({ state: 'FINISHED', run_id: 1, shortfall: { 'S-RT': 2 } }));
    await userEvent.click(screen.getByRole('button', { name: 'Nächster Tag' }));
    const order = await screen.findByLabelText('Tagesauftrag Salz (Deckel blau) · Gehäuse rot');
    expect(order).toHaveValue('2');
    await userEvent.clear(order);
    await userEvent.type(order, '5');
    expect(order).toHaveValue('5');
  });

  it('marks invalid input instead of silently rewriting it and keeps the last valid value (U09)', async () => {
    api.configureSessionApi.mockRejectedValue(new TypeError('x'));
    await renderDashboard();
    const order = screen.getByLabelText('Tagesauftrag Salz (Deckel blau) · Gehäuse rot');
    await userEvent.type(order, '{Backspace}2');
    expect(order).toHaveValue('2');
    await userEvent.type(order, 'x');
    expect(order).toHaveValue('2x'); // not changed behind the user's back
    expect(order).toHaveAttribute('aria-invalid', 'true');
    expect(order).toHaveAccessibleDescription(/nur ganze Zahlen von 0 bis 999/);
    expect(screen.getAllByRole('alert')).toHaveLength(1); // one shared hint, not one per field

    await userEvent.type(order, '{Backspace}');
    expect(order).toHaveAttribute('aria-invalid', 'false');
    await userEvent.click(screen.getByRole('button', { name: /Tag simulieren/ }));
    // the draft kept the last valid value (2) while "2x" was shown as invalid
    expect(api.configureSessionApi).toHaveBeenCalledWith(
      '4827',
      expect.objectContaining({ daily_orders: expect.objectContaining({ 'S-RT': 2 }) })
    );
    expect(await screen.findByText(/nicht erreichbar/)).toBeInTheDocument();
  });

  it('rejects more than 999 per variant in the field and keeps the draft', async () => {
    await renderDashboard();
    const order = screen.getByLabelText('Tagesauftrag Salz (Deckel blau) · Gehäuse rot');
    await userEvent.type(order, '{Backspace}1000');
    expect(order).toHaveAttribute('aria-invalid', 'true');
    // Starting stays locked while a field shows invalid input; nothing is sent.
    expect(screen.getByRole('button', { name: /Tag simulieren/ })).toBeDisabled();
    expect(api.configureSessionApi).not.toHaveBeenCalled();
  });

  it('lists the incoming customer order in the orders table', async () => {
    const session = makeSession({
      daily_orders: { 'S-RT': 2 },
      orders: [
        {
          order_id: 'o1',
          source: 'customer',
          customer_name: 'Mia',
          items: { 'S-RT': 2 },
          created_at: '2026-10-13T08:00:00Z',
        },
      ],
    });
    await renderDashboard(session);
    expect(screen.getByRole('heading', { name: 'Tagesbestellung' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Eingegangene Bestellungen' })).toBeInTheDocument();
    expect(screen.getByText('Mia')).toBeInTheDocument();
    expect(screen.getByText('2× Roter Salzstreuer')).toBeInTheDocument();
  });

  it('hides every preparation section while RUNNING (#118)', async () => {
    await renderDashboard(makeSession({ state: 'RUNNING', daily_orders: { 'P-SW': 1 } }));
    expect(screen.getByRole('heading', { name: 'Stationen' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Auftragsfortschritt' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Konfiguration' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Tagesbestellung' })).not.toBeInTheDocument();
    expect(screen.queryByText('Teilnehmende beitreten lassen')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'QR-Code anzeigen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Besetzung' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Konfiguration speichern' })
    ).not.toBeInTheDocument();
  });

  it.each([
    ['CONFIGURING', false],
    ['RUNNING', true],
  ] as const)('shows the live blocks only while the day runs (%s)', async (state, live) => {
    const session = makeSession({ state, daily_orders: { 'S-RT': 4, 'P-SW': 6 } });
    session.stations = claimedStations(session);
    await renderDashboard(session);
    const present = (el: HTMLElement | null) =>
      live ? expect(el).toBeInTheDocument() : expect(el).not.toBeInTheDocument();
    present(screen.queryByRole('heading', { name: 'Stationen' }));
    present(screen.queryByRole('heading', { name: 'Auftragsfortschritt' }));
    present(screen.queryByRole('table', { name: 'Fortschritt je Variante' }));
    present(screen.queryByTestId('live-station-3'));
  });

  it('shows the dashboard header with the occupancy count (#96)', async () => {
    const session = makeSession();
    session.stations = session.stations.map((s) =>
      s.station_id <= 2 ? { ...s, claimed_by: `W${s.station_id}` } : s
    );
    await renderDashboard(session);
    expect(screen.getByText('Simulation · Sitzung 4827')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dashboard Tagesproduktion' })).toBeInTheDocument();
    expect(screen.getByText(/Wartet auf Start · 2 von 5 Stationen besetzt/)).toBeInTheDocument();
  });

  it('offers Pull and Push as two cards (#96, #145)', async () => {
    await renderDashboard();
    expect(screen.getByText('Produktionsstrategie')).toBeInTheDocument();
    expect(screen.getByLabelText(/Pull/)).toBeChecked();
    expect(screen.getByLabelText(/Push/)).not.toBeChecked();
  });

  it('shows the Push plan total and hides it again in Pull (#96, #145)', async () => {
    await renderDashboard(
      makeSession({ strategy: 'PUSH', daily_production_limits: { 'S-RT': 5, 'P-SW': 2 } })
    );
    expect(screen.getByRole('heading', { name: 'Tagesproduktion (Push)' })).toBeInTheDocument();
    expect(screen.getByText('7 Stück geplant')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/Pull/));
    expect(
      screen.queryByRole('heading', { name: 'Tagesproduktion (Push)' })
    ).not.toBeInTheDocument();
  });

  it('shows the order sentence, the total and a stepper per variant (#113)', async () => {
    const session = makeSession({
      daily_orders: { 'S-RT': 4, 'P-SW': 3 },
      orders: [
        {
          order_id: 'o1',
          source: 'customer',
          customer_name: null,
          items: { 'S-RT': 4, 'P-SW': 3 },
          created_at: '2026-10-13T08:00:00Z',
        },
      ],
    });
    await renderDashboard(session);
    expect(screen.getByRole('heading', { name: 'Tagesbestellung' })).toBeInTheDocument();
    expect(
      screen.getByText('1 WebShop-Bestellung eingegangen. Mengen sind frei änderbar.')
    ).toBeInTheDocument();
    expect(screen.getByText('7 Stück')).toBeInTheDocument();
    expect(screen.getByText('Deckel Blau · Gehäuse Rot')).toBeInTheDocument();
    expect(screen.queryByText('Bestellung weicht von den WebShop-Bestellungen ab.')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Salzstreuer · Rot mehr' }));
    expect(screen.getByText('8 Stück')).toBeInTheDocument();
    expect(screen.getByLabelText('Tagesauftrag Salz (Deckel blau) · Gehäuse rot')).toHaveValue('5');
    expect(
      screen.getByText('Bestellung weicht von den WebShop-Bestellungen ab.')
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Salzstreuer · Rot weniger' }));
    expect(screen.getByText('7 Stück')).toBeInTheDocument();
    expect(screen.queryByText('Bestellung weicht von den WebShop-Bestellungen ab.')).toBeNull();
  });

  it('says so when no WebShop order arrived yet and does not step below zero (#113)', async () => {
    await renderDashboard(makeSession());
    expect(
      screen.getByText('Noch keine WebShop-Bestellungen eingegangen. Mengen sind frei änderbar.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salzstreuer · Rot weniger' })).toBeDisabled();
  });

  it('offers one join link and QR for everybody instead of one QR per role (#94, #160)', async () => {
    await renderDashboard();
    expect(screen.getByText('Teilnehmende beitreten lassen')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'QR-Code anzeigen' })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Besetzung' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'QR-Code anzeigen' }));
    expect(screen.getByText(/\/join\/4827$/)).toBeInTheDocument();
  });

  it('shows the KPI summary when finished and can be left', async () => {
    const onLeave = await renderDashboard(makeSession({ state: 'FINISHED' }));
    expect(screen.getByText('Zusammenfassung')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sitzung verlassen' }));
    expect(onLeave).toHaveBeenCalledOnce();
  });

  describe('clearing a station (#194)', () => {
    it('shows a small X on the five stations but not on the customer tile', async () => {
      await renderDashboard();
      for (const nr of [1, 2, 3, 4, 5]) {
        expect(screen.getByRole('button', { name: `Station ${nr} leeren` })).toBeInTheDocument();
      }
      expect(screen.getAllByRole('button', { name: /Station \d leeren/ })).toHaveLength(5);
      expect(within(screen.getByTestId('customer-count')).queryByRole('button')).toBeNull();
    });

    it('releases the confirmed station through the API', async () => {
      const taken = makeSession();
      taken.stations = claimedStations(taken);
      api.releaseStationApi.mockResolvedValue(taken);
      await renderDashboard(taken);
      await userEvent.click(screen.getByRole('button', { name: 'Station 4 leeren' }));
      await userEvent.click(screen.getByRole('button', { name: 'Ja, leeren' }));
      expect(api.releaseStationApi).toHaveBeenCalledExactlyOnceWith('4827', 4);
    });

    it('offers the X on the live station tiles while the day runs', async () => {
      const running = makeSession({ state: 'RUNNING', daily_orders: { 'S-RT': 2 } });
      running.stations = claimedStations(running);
      await renderDashboard(running);
      expect(
        within(screen.getByTestId('live-station-3')).getByRole('button', {
          name: 'Station 3 leeren',
        })
      ).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /Station \d leeren/ })).toHaveLength(5);
    });
  });
});
