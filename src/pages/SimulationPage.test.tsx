import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';

import * as sessionApi from '@/api/simulation/sessionApi';
import { ApiRequestError } from '@/api/requestApi';
import { makeSession } from '@/test/fixtures';
import { parseRole } from '@/types/simulationRoles';

import SimulationPage from './SimulationPage';

vi.mock('@/api/simulation/sessionApi');
const api = vi.mocked(sessionApi);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('SimulationPage', () => {
  it('creates a session and shows its stations', async () => {
    const session = makeSession({
      stations: makeSession().stations.map((s) =>
        s.station_id === 2 ? { ...s, status: 'ACTIVE' as const, claimed_by: 'Mia' } : s
      ),
    });
    api.createSessionApi.mockResolvedValue(session);
    api.getSessionApi.mockResolvedValue(session);
    render(<SimulationPage onNavigate={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Sitzung erstellen' }));
    expect(
      await screen.findByRole('heading', { name: 'Dashboard Tagesproduktion' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Wartet auf Start · 1 von 5 Stationen besetzt/)).toBeInTheDocument();
    expect(screen.getByText('Simulation · Sitzung 4827')).toBeInTheDocument();
    expect(screen.getByTestId('tile-station5_retrieval')).toHaveTextContent('Auslagerung');
    expect(screen.getByTestId('tile-station2_housings')).toHaveTextContent('Besetzt · Mia');
  });

  it('uses "Sitzung" in the start page texts', () => {
    render(<SimulationPage onNavigate={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Neue Sitzung' })).toBeInTheDocument();
    expect(
      screen.getByText('Erstellt eine Sitzung mit einem 4-stelligen Code für alle Geräte.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Öffnet das Dashboard einer bestehenden Sitzung (Start, Nächster Tag).')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Sitzungs-Code (Lehrkraft)')).toBeInTheDocument();
    expect(screen.getByLabelText('Sitzungs-Code (Schüler)')).toBeInTheDocument();
  });

  it('shows an error when creating fails', async () => {
    api.createSessionApi.mockRejectedValue(new Error('x'));
    render(<SimulationPage onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Sitzung erstellen' }));
    expect(await screen.findByText('Sitzung konnte nicht erstellt werden.')).toBeInTheDocument();
  });

  it('only allows joining with a 4-digit code', async () => {
    render(<SimulationPage onNavigate={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Als Lehrkraft öffnen' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Als Schüler beitreten' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Sitzungs-Code (Lehrkraft)'), '48');
    expect(screen.getByRole('button', { name: 'Als Lehrkraft öffnen' })).toBeDisabled();
  });

  it('opens the dashboard when a teacher enters a code', async () => {
    api.getSessionApi.mockResolvedValue(makeSession());
    render(<SimulationPage onNavigate={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Sitzungs-Code (Lehrkraft)'), '4827');
    await userEvent.click(screen.getByRole('button', { name: 'Als Lehrkraft öffnen' }));
    await waitFor(() => expect(api.getSessionApi).toHaveBeenCalledWith('4827', expect.anything()));
    expect(await screen.findByRole('button', { name: 'Sitzung verlassen' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Rolle wählen' })).not.toBeInTheDocument();
  });

  it('sends a student with a typed code to the role selection, not the dashboard', async () => {
    api.getSessionApi.mockResolvedValue(makeSession());
    render(<SimulationPage onNavigate={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Sitzungs-Code (Schüler)'), '4827');
    await userEvent.click(screen.getByRole('button', { name: 'Als Schüler beitreten' }));
    expect(await screen.findByRole('heading', { name: 'Rolle wählen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sitzung verlassen' })).not.toBeInTheDocument();
  });

  it('leaves the dashboard back to the start page', async () => {
    api.createSessionApi.mockResolvedValue(makeSession());
    api.getSessionApi.mockResolvedValue(makeSession());
    render(<SimulationPage onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Sitzung erstellen' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sitzung verlassen' }));
    expect(screen.getByRole('button', { name: 'Sitzung erstellen' })).toBeInTheDocument();
  });

  describe('QR join flow', () => {
    beforeEach(() => sessionStorage.clear());

    it('claims the station from the link and shows the role badge', async () => {
      api.claimStationApi.mockResolvedValue(makeSession());
      render(
        <SimulationPage
          joinTarget={{ sessionId: '4827', role: parseRole('station3_production') }}
          onNavigate={vi.fn()}
        />
      );
      await userEvent.type(screen.getByLabelText('Dein Name'), 'Mia');
      await userEvent.click(screen.getByRole('button', { name: 'Station übernehmen' }));
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Produktion' })
      ).toBeInTheDocument();
    });

    async function joinStation(role: string, session: ReturnType<typeof makeSession>) {
      api.claimStationApi.mockResolvedValue(session);
      api.getSessionApi.mockResolvedValue(session);
      render(
        <SimulationPage
          joinTarget={{ sessionId: '4827', role: parseRole(role) }}
          onNavigate={vi.fn()}
        />
      );
      await userEvent.type(screen.getByLabelText('Dein Name'), 'Mia');
      await userEvent.click(screen.getByRole('button', { name: 'Station übernehmen' }));
    }

    it('shows the success screen on a finished session and can dismiss it', async () => {
      await joinStation('station1_lids', makeSession({ state: 'FINISHED' }));
      expect(
        await screen.findByText('Produktionsauftrag erfolgreich abgeschlossen!')
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Schließen' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows the dedicated "Station besetzt" screen with the free stations (#95, #90)', async () => {
      api.claimStationApi.mockRejectedValue(
        new ApiRequestError('x', 409, '/p', { detail: 'Jonas M.' })
      );
      api.getSessionApi.mockResolvedValue(
        makeSession({
          stations: makeSession().stations.map((s) =>
            s.station_id === 3 ? { ...s, claimed_by: 'Jonas M.' } : s
          ),
        })
      );
      render(
        <SimulationPage
          joinTarget={{ sessionId: '4827', role: parseRole('station3_production') }}
          onNavigate={vi.fn()}
        />
      );
      await userEvent.type(screen.getByLabelText('Dein Name'), 'Jan');
      await userEvent.click(screen.getByRole('button', { name: 'Station übernehmen' }));

      expect(
        await screen.findByRole('heading', { name: 'Station 3 ist besetzt' })
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Jonas M\. bedient die Produktion\. Pro Station ist nur eine Person erlaubt\./
        )
      ).toBeInTheDocument();
      expect(screen.getByText('Sitzung 4827')).toBeInTheDocument();
      expect(await screen.findByText('Noch frei')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Station 2.*Zulieferung Gehäuse/ })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Station 3.*Produktion/ })
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Andere Rolle wählen' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Als Kunde zum WebShop' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /freigeben/ })).not.toBeInTheDocument();
      expect(api.releaseStationApi).not.toHaveBeenCalled();
    });

    it('jumps from the occupied screen straight to a free station with the typed name', async () => {
      api.claimStationApi
        .mockRejectedValueOnce(new ApiRequestError('x', 409, '/p', { detail: 'Jonas M.' }))
        .mockResolvedValueOnce(makeSession());
      api.getSessionApi.mockResolvedValue(
        makeSession({
          stations: makeSession().stations.map((s) =>
            s.station_id === 3 ? { ...s, claimed_by: 'Jonas M.' } : s
          ),
        })
      );
      render(
        <SimulationPage
          joinTarget={{ sessionId: '4827', role: parseRole('station3_production') }}
          onNavigate={vi.fn()}
        />
      );
      await userEvent.type(screen.getByLabelText('Dein Name'), 'Jan');
      await userEvent.click(screen.getByRole('button', { name: 'Station übernehmen' }));
      await userEvent.click(await screen.findByRole('button', { name: /Station 4.*Einlagerung/ }));

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Einlagerung' })
      ).toBeInTheDocument();
      expect(api.claimStationApi).toHaveBeenLastCalledWith('4827', {
        student_name: 'Jan',
        station_id: 4,
      });
    });

    it('sends a participant from the occupied screen to the shop as customer', async () => {
      api.claimStationApi.mockRejectedValue(
        new ApiRequestError('x', 409, '/p', { detail: 'Lena' })
      );
      api.getSessionApi.mockResolvedValue(makeSession());
      api.joinAsCustomerApi.mockResolvedValue(makeSession());
      const onNavigate = vi.fn();
      render(
        <SimulationPage
          joinTarget={{ sessionId: '4827', role: parseRole('station1_lids') }}
          onNavigate={onNavigate}
        />
      );
      await userEvent.type(screen.getByLabelText('Dein Name'), 'Jan');
      await userEvent.click(screen.getByRole('button', { name: 'Station übernehmen' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Als Kunde zum WebShop' }));
      await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('webshop'));
    });

    it('shows a claim error and leaves via "Andere Rolle wählen"', async () => {
      api.claimStationApi.mockRejectedValue(new ApiRequestError('x', 409, '/p', null));
      render(
        <SimulationPage
          joinTarget={{ sessionId: '4827', role: parseRole('station2_housings') }}
          onNavigate={vi.fn()}
        />
      );
      await userEvent.type(screen.getByLabelText('Dein Name'), 'Jan');
      await userEvent.click(screen.getByRole('button', { name: 'Station übernehmen' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Andere Rolle wählen' }));
      expect(screen.getByRole('heading', { name: 'Rolle wählen' })).toBeInTheDocument();
    });

    it('leaves a claimed station and returns to the role selection', async () => {
      api.claimStationApi.mockResolvedValue(makeSession());
      api.releaseStationApi.mockResolvedValue(makeSession());
      render(
        <SimulationPage
          joinTarget={{ sessionId: '4827', role: parseRole('station4_storage') }}
          onNavigate={vi.fn()}
        />
      );
      await userEvent.type(screen.getByLabelText('Dein Name'), 'Mia');
      await userEvent.click(screen.getByRole('button', { name: 'Station übernehmen' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Station verlassen' }));
      expect(await screen.findByRole('heading', { name: 'Rolle wählen' })).toBeInTheDocument();
    });

    it('offers the join page for links without a valid role and claims with the entered name', async () => {
      api.getSessionApi.mockResolvedValue(makeSession());
      api.claimStationApi.mockResolvedValue(makeSession());
      render(
        <SimulationPage joinTarget={{ sessionId: '4827', role: null }} onNavigate={vi.fn()} />
      );
      await userEvent.type(screen.getByLabelText('Benutzername'), 'Mia');
      await userEvent.click(screen.getByRole('radio', { name: /Station 5/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Station beitreten' }));

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Auslagerung' })
      ).toBeInTheDocument();
      // No second name prompt: the station is claimed right away with the join-page name.
      expect(api.claimStationApi).toHaveBeenCalledTimes(1);
      expect(api.claimStationApi).toHaveBeenCalledWith('4827', {
        student_name: 'Mia',
        station_id: 5,
      });
    });

    it('keeps the claim across a reload by pointing the address bar at the role link', async () => {
      api.getSessionApi.mockResolvedValue(makeSession());
      api.claimStationApi.mockResolvedValue(makeSession());
      window.history.replaceState(null, '', '/join/4827');
      render(
        <SimulationPage joinTarget={{ sessionId: '4827', role: null }} onNavigate={vi.fn()} />
      );
      await userEvent.type(screen.getByLabelText('Benutzername'), 'Mia');
      await userEvent.click(screen.getByRole('radio', { name: /Station 2/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Station beitreten' }));
      await screen.findByRole('heading', { level: 1, name: 'Zulieferung Gehäuse' });
      expect(window.location.pathname + window.location.search).toBe(
        '/?session=4827&role=station2_housings'
      );
      window.history.replaceState(null, '', '/');
    });

    it('shows the occupied screen when the station chosen on the join page was taken meanwhile', async () => {
      api.getSessionApi.mockResolvedValue(makeSession());
      api.claimStationApi.mockRejectedValue(
        new ApiRequestError('x', 409, '/p', { detail: 'Lena' })
      );
      render(
        <SimulationPage joinTarget={{ sessionId: '4827', role: null }} onNavigate={vi.fn()} />
      );
      await userEvent.type(screen.getByLabelText('Benutzername'), 'Mia');
      await userEvent.click(screen.getByRole('radio', { name: /Station 1/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Station beitreten' }));
      expect(
        await screen.findByRole('heading', { name: 'Station 1 ist besetzt' })
      ).toBeInTheDocument();
      expect(screen.getByText(/Lena bedient die Zulieferung Deckel/)).toBeInTheDocument();
      expect(api.claimStationApi).toHaveBeenCalledTimes(1);
    });

    it('sends customers to the webshop', async () => {
      api.joinAsCustomerApi.mockResolvedValue(makeSession());
      const onNavigate = vi.fn();
      render(
        <SimulationPage
          joinTarget={{ sessionId: '4827', role: parseRole('customer') }}
          onNavigate={onNavigate}
        />
      );
      await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('webshop'));
      expect(api.joinAsCustomerApi).toHaveBeenCalledWith('4827');
    });

    it('shows the transition text without a space before the ellipsis', async () => {
      api.joinAsCustomerApi.mockResolvedValue(makeSession());
      render(
        <SimulationPage
          joinTarget={{ sessionId: '4827', role: parseRole('customer') }}
          onNavigate={vi.fn()}
        />
      );
      expect(screen.getByText('Weiter zum Webshop…')).toBeInTheDocument();
      await waitFor(() => expect(api.joinAsCustomerApi).toHaveBeenCalled());
    });

    it('still opens the webshop when counting the customer fails', async () => {
      api.joinAsCustomerApi.mockRejectedValue(new Error('offline'));
      const onNavigate = vi.fn();
      render(
        <SimulationPage
          joinTarget={{ sessionId: '4827', role: parseRole('customer') }}
          onNavigate={onNavigate}
        />
      );
      await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('webshop'));
    });

    it.each([
      ['without a name', ''],
      ['with the typed name', 'Mia K.'],
    ])(
      'lets a customer pick the role on the join page and hands the name over %s',
      async (_case, name) => {
        api.getSessionApi.mockResolvedValue(makeSession());
        api.joinAsCustomerApi.mockResolvedValue(makeSession());
        const onNavigate = vi.fn();
        const onEnterSimulationShop = vi.fn();
        render(
          <SimulationPage
            joinTarget={{ sessionId: '4827', role: null }}
            onEnterSimulationShop={onEnterSimulationShop}
            onNavigate={onNavigate}
          />
        );
        if (name) await userEvent.type(screen.getByLabelText('Benutzername'), name);
        await userEvent.click(screen.getByRole('radio', { name: /Kunde/ }));
        await userEvent.click(screen.getByRole('button', { name: 'Zum WebShop' }));
        await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('webshop'));
        expect(onEnterSimulationShop).toHaveBeenCalledWith('4827', name);
      }
    );
  });
});
