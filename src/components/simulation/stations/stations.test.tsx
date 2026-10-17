import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { makeSession } from '@/test/fixtures';

import Station1LidsView from './Station1LidsView';
import Station2HousingsView, { STATION_2_LOCKED_HINT } from './Station2HousingsView';

const session = makeSession({ daily_orders: { 'S-RT': 2, 'P-SW': 3 } });

function completed(stationId: number) {
  return makeSession({
    daily_orders: { 'S-RT': 2, 'P-SW': 3 },
    stations: session.stations.map((s) =>
      s.station_id === stationId ? { ...s, status: 'COMPLETED' as const } : s
    ),
  });
}

describe('Station1LidsView', () => {
  it('shows the lid quantities and only confirms after everything is ticked', async () => {
    const onComplete = vi.fn();
    render(<Station1LidsView onComplete={onComplete} session={session} />);
    expect(screen.getByText('Deckel Blau')).toBeInTheDocument();
    expect(screen.getByText('Salzstreuer')).toBeInTheDocument();
    expect(screen.getByText('Deckel Grün')).toBeInTheDocument();
    expect(screen.getByText('Pfefferstreuer')).toBeInTheDocument();
    expect(screen.getByText('2×')).toBeInTheDocument();
    expect(screen.getByText('3×')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Lege die Deckel in die Zuführung und hake jede Position ab, sobald sie bestückt und dokumentiert ist.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('0 von 2 Positionen bestückt')).toBeInTheDocument();
    expect(screen.getByText('5 Deckel gesamt')).toBeInTheDocument();

    const confirm = screen.getByRole('button', { name: 'Zulieferung bestätigen' });
    expect(confirm).toBeDisabled();
    const [blue, green] = screen.getAllByRole('checkbox');
    await userEvent.click(blue);
    expect(screen.getByText('1 von 2 Positionen bestückt')).toBeInTheDocument();
    expect(confirm).toBeDisabled();
    await userEvent.click(green);
    await userEvent.click(blue);
    expect(confirm).toBeDisabled();
    await userEvent.click(blue);
    await userEvent.click(confirm);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('locks the input once the station is completed', () => {
    render(<Station1LidsView onComplete={vi.fn()} session={completed(1)} />);
    expect(screen.getByText(/Erledigt/)).toBeInTheDocument();
    screen.getAllByRole('checkbox').forEach((box) => {
      expect(box).toBeDisabled();
      expect(box).toBeChecked();
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Station2HousingsView', () => {
  it('shows the locked card while Station 1 is not done', () => {
    render(<Station2HousingsView isActive={false} onComplete={vi.fn()} session={session} />);
    expect(screen.getByText('Noch gesperrt')).toBeInTheDocument();
    expect(screen.getByText(STATION_2_LOCKED_HINT)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Zulieferung bestätigen' })
    ).not.toBeInTheDocument();
  });

  it('shows the three housing colours and confirms when active', async () => {
    const onComplete = vi.fn();
    render(<Station2HousingsView isActive={true} onComplete={onComplete} session={session} />);
    // Silver is not needed for this order: no checkbox for it, only a muted note (BUG-08).
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(screen.getByText('Gehäuse Schwarz')).toBeInTheDocument();
    expect(screen.getByText('Pfeffer 3')).toBeInTheDocument();
    expect(screen.getByText('Salz 2')).toBeInTheDocument();
    expect(screen.getByText('0 von 2 Positionen bestückt')).toBeInTheDocument();
    expect(screen.getByText('5 Gehäuse gesamt')).toBeInTheDocument();
    expect(screen.getByText('Nicht benötigt: Gehäuse Silber')).toBeInTheDocument();
    for (const box of screen.getAllByRole('checkbox')) await userEvent.click(box);
    await userEvent.click(screen.getByRole('button', { name: 'Zulieferung bestätigen' }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('is not completed by another station finishing', () => {
    render(<Station2HousingsView isActive={true} onComplete={vi.fn()} session={completed(1)} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows completed checklist when completed even if not active', () => {
    render(<Station2HousingsView isActive={false} onComplete={vi.fn()} session={completed(2)} />);
    expect(screen.getByText('Erledigt – warte auf die anderen Stationen.')).toBeInTheDocument();
    expect(screen.queryByText('Noch gesperrt')).not.toBeInTheDocument();
  });
});

describe('supply confirm double click', () => {
  it('completes only once when clicked twice quickly', async () => {
    let finish: () => void = () => {};
    const onComplete = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    render(<Station1LidsView onComplete={onComplete} session={session} />);
    for (const box of screen.getAllByRole('checkbox')) await userEvent.click(box);
    const confirm = screen.getByRole('button', { name: 'Zulieferung bestätigen' });
    await userEvent.dblClick(confirm);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();
    finish();
    await waitFor(() => expect(confirm).toBeEnabled());
  });
});

describe('MaterialSupplyChecklist without a needed position (BUG-08)', () => {
  it('can be confirmed right away when nothing has to be supplied', async () => {
    const onComplete = vi.fn();
    render(<Station1LidsView onComplete={onComplete} session={makeSession()} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(
      screen.getByText('Für diesen Auftrag wird hier nichts bereitgestellt.')
    ).toBeInTheDocument();
    expect(screen.getByText(/Nicht benötigt: Deckel Blau, Deckel Grün/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zulieferung bestätigen' }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('hides a zero-quantity lid colour but keeps the needed one tickable', async () => {
    render(
      <Station1LidsView
        onComplete={vi.fn()}
        session={makeSession({ daily_orders: { 'P-SW': 2 } })}
      />
    );
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.getByText('Deckel Grün')).toBeInTheDocument();
    expect(screen.getByText('Nicht benötigt: Deckel Blau')).toBeInTheDocument();
  });
});
