import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, vi } from 'vitest';

import * as sessionApi from '@/api/simulation/sessionApi';
import { makeSession } from '@/test/fixtures';

import QrCodeCard from './QrCodeCard';
import JoinCard from './JoinCard';
import JoinPage from './JoinPage';
import RoleOverviewGrid from './RoleOverviewGrid';

vi.mock('@/api/simulation/sessionApi');

beforeEach(() => {
  vi.stubEnv('VITE_PUBLIC_BASE_URL', 'http://nas:50460');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('QrCodeCard', () => {
  it('opens the QR code in a modal on demand and closes it again', async () => {
    render(<QrCodeCard label="Station 1" link="http://x/?a=1" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'QR-Code anzeigen' }));
    const dialog = screen.getByRole('dialog', { name: 'QR-Code Station 1' });
    expect(within(dialog).getByRole('img', { name: 'QR-Code Station 1' })).toBeInTheDocument();
    expect(within(dialog).getByText('http://x/?a=1')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the modal via backdrop click and Escape but not by clicking inside', async () => {
    render(<QrCodeCard label="Station 1" link="http://x/?a=1" />);
    await userEvent.click(screen.getByRole('button', { name: 'QR-Code anzeigen' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('heading'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'QR-Code anzeigen' }));
    await userEvent.click(screen.getByRole('presentation'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('copies the link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<QrCodeCard label="Station 1" link="http://x/?a=1" />);
    await userEvent.click(screen.getByRole('button', { name: 'Link kopieren: Station 1' }));
    expect(writeText).toHaveBeenCalledWith('http://x/?a=1');
    expect(await screen.findByText('Kopiert')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('handles copy failures gracefully without displaying "Kopiert"', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) },
    });
    render(<QrCodeCard label="Station 1" link="http://x/?a=1" />);
    await userEvent.click(screen.getByRole('button', { name: 'Link kopieren: Station 1' }));
    expect(screen.queryByText('http://x/?a=1')).not.toBeInTheDocument();
    expect(screen.queryByText('Kopiert')).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

describe('RoleOverviewGrid', () => {
  it('lists every role with one title (description folded in) and a Frei / Besetzt badge (Besetzung)', () => {
    const base = makeSession().stations;
    const session = makeSession({
      stations: base.map((station) => {
        if (station.station_id === 1) return { ...station, claimed_by: 'Mia' };
        if (station.station_id === 3)
          return { ...station, claimed_by: 'Jan', status: 'ACTIVE' as const };
        return station;
      }),
    });
    render(<RoleOverviewGrid session={session} />);

    expect(screen.getByTestId('tile-station1_lids')).toHaveTextContent(
      'Station 1 · Zulieferung Deckel'
    );
    expect(screen.getByTestId('tile-station1_lids')).toHaveTextContent('Besetzt · Mia');
    expect(screen.getByTestId('tile-station3_production')).toHaveTextContent('Besetzt · Jan');
    expect(screen.getByTestId('tile-station2_housings')).toHaveTextContent('Frei');
    expect(screen.queryByTestId('tile-customer')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'QR-Code anzeigen' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });

  it('shows the number of connected customers in the Kunde row', () => {
    render(<RoleOverviewGrid session={makeSession({ customer_count: 7 })} />);
    const row = screen.getByTestId('customer-count');
    expect(row).toHaveTextContent('Kunde');
    expect(row).toHaveTextContent('7 verbunden');
  });

  it('treats a missing station entry as free', () => {
    render(<RoleOverviewGrid session={makeSession({ stations: [] })} />);
    expect(screen.getByTestId('tile-station1_lids')).toHaveTextContent('Frei');
  });
});

describe('JoinCard', () => {
  it('shows one QR code and copy button for everybody', async () => {
    render(<JoinCard sessionId="4827" />);
    expect(screen.getByText('Teilnehmende beitreten lassen')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'QR-Code anzeigen' })).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'QR-Code anzeigen' }));
    const dialog = screen.getByRole('dialog', { name: 'QR-Code Beitrittsseite' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('http://nas:50460/join/4827')).toBeInTheDocument();
  });
});

describe('JoinPage', () => {
  beforeEach(() => {
    vi.mocked(sessionApi.getSessionApi).mockReset();
  });

  function occupied(...entries: [number, string][]) {
    return makeSession({
      stations: makeSession().stations.map((s) => {
        const hit = entries.find(([id]) => id === s.station_id);
        return hit ? { ...s, claimed_by: hit[1] } : s;
      }),
    });
  }

  it('does not allow picking an occupied station', async () => {
    vi.mocked(sessionApi.getSessionApi).mockResolvedValue(occupied([2, 'Mia']));
    render(<JoinPage onJoin={vi.fn()} sessionId="4827" />);
    await screen.findByText('Besetzt · Mia');
    expect(screen.getAllByRole('radio')).toHaveLength(6);
    expect(screen.getAllByText('Frei')).toHaveLength(4);
    expect(screen.getByRole('radio', { name: /Station 2/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Station 3/ })).toBeEnabled();
    expect(screen.getByRole('radio', { name: /Kunde/ })).toBeEnabled();
  });

  it('needs a role and, for stations, a name; shows an inline hint instead of silent disabled button', async () => {
    vi.mocked(sessionApi.getSessionApi).mockResolvedValue(makeSession());
    const onJoin = vi.fn();
    render(<JoinPage onJoin={onJoin} sessionId="4827" />);
    const button = screen.getByRole('button', { name: 'Station beitreten' });
    expect(button).toBeDisabled();

    await userEvent.click(screen.getByRole('radio', { name: /Station 4/ }));
    expect(button).toBeEnabled();

    // Joining without a name shows an inline hint and does not submit
    await userEvent.click(button);
    expect(onJoin).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte einen Namen eingeben.');
    expect(screen.getByLabelText('Benutzername')).toHaveAttribute('aria-invalid', 'true');

    await userEvent.type(screen.getByLabelText('Benutzername'), '  Jan  ');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Benutzername')).toHaveAttribute('aria-invalid', 'false');

    await userEvent.click(button);
    expect(onJoin).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'station4_storage' }),
      'Jan'
    );
  });

  it('lets a customer join without a name and shows "Zum WebShop"', async () => {
    vi.mocked(sessionApi.getSessionApi).mockResolvedValue(makeSession());
    const onJoin = vi.fn();
    render(<JoinPage onJoin={onJoin} sessionId="4827" />);
    await userEvent.click(screen.getByRole('radio', { name: /Kunde/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Zum WebShop' }));
    expect(onJoin).toHaveBeenCalledWith(expect.objectContaining({ role: 'customer' }), '');
  });

  it('prefills the name when coming back from a station', () => {
    vi.mocked(sessionApi.getSessionApi).mockResolvedValue(makeSession());
    render(<JoinPage initialName="Mia" onJoin={vi.fn()} sessionId="4827" />);
    expect(screen.getByLabelText('Benutzername')).toHaveValue('Mia');
  });

  it('shows a loading status and then an error when the session cannot be loaded', async () => {
    vi.mocked(sessionApi.getSessionApi).mockRejectedValue(new Error('offline'));
    render(<JoinPage onJoin={vi.fn()} sessionId="4827" />);
    expect(screen.getByRole('status')).toHaveTextContent('Belegung wird geladen…');
    expect(await screen.findByRole('alert')).toHaveTextContent('nicht geladen');
    expect(screen.queryByText('Frei')).not.toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(6);
  });
});
