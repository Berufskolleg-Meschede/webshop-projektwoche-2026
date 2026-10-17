import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { makeBatch, makeSession, makeStation } from '@/test/fixtures';

import {
  BUTTON_FINISH_DAY,
  BUTTON_FINISH_DAY_SHORTFALLS,
  STATION5_FINISHED_TEXT,
} from '@/types/production';

import { SimulationEngine } from '../../../../server/engine';

import Station5RetrievalView from './Station5RetrievalView';

const base = {
  daily_orders: { 'S-RT': 4, 'P-SW': 2, 'S-SI': 1 },
  // software stock differs from everything below on purpose: Station 5 must not depend on it
  stock: { 'S-RT': 0, 'P-SW': 0, 'S-SI': 0 },
  retrieved: { 'S-SI': 1 },
};

describe('Station5RetrievalView', () => {
  it('shows the finished state, not the locked screen, in Pull once Station 5 is COMPLETED', () => {
    const session = makeSession({
      ...base,
      strategy: 'PULL',
      retrieved: { 'S-RT': 4, 'P-SW': 2, 'S-SI': 1 },
    });
    session.stations = session.stations.map((station) =>
      station.station_id === 5 ? { ...station, status: 'COMPLETED' as const } : station
    );
    render(<Station5RetrievalView isActive={false} onRetrieve={vi.fn()} session={session} />);
    expect(screen.getByText('Warte auf Tagesabschluss')).toBeInTheDocument();
    expect(STATION5_FINISHED_TEXT).toBe('Warte auf Tagesabschluss');
    expect(screen.queryByText('Noch gesperrt')).not.toBeInTheDocument();
    expect(screen.queryByText(/Die Auslagerung startet/)).not.toBeInTheDocument();
  });

  it.each(['PULL', 'PUSH'] as const)(
    'shows the locked screen in %s before the supply is done: chip, reason, disabled button',
    (strategy) => {
      const stored = makeBatch({ variant: 'S-RT', quantity: 4, status: 'STORED' });
      render(
        <Station5RetrievalView
          isActive={false}
          onRetrieve={vi.fn()}
          session={makeSession({
            ...base,
            strategy,
            batches: [stored, makeBatch({ batch_id: 'b2', variant: 'S-RT', quantity: 4 })],
          })}
        />
      );
      expect(screen.getByText('Noch gesperrt')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Die Auslagerung startet, sobald die Zulieferung (Station 1 & 2) abgeschlossen ist.'
        )
      ).toBeInTheDocument();
      expect(screen.queryByText(/Eingelagert/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Menge wählen' })).toBeDisabled();
      expect(screen.getAllByRole('button')).toHaveLength(1);
    }
  );

  it.each(['PULL', 'PUSH'] as const)(
    'shows one list with row states and retrieves a chosen quantity in %s once active',
    async (strategy) => {
      const onRetrieve = vi.fn().mockResolvedValue(true);
      render(
        <Station5RetrievalView
          isActive
          onRetrieve={onRetrieve}
          session={makeSession({ ...base, strategy })}
        />
      );
      // all ordered variants in one list; the done row carries a chip instead of a stepper
      expect(screen.getByText('0 von 4 ausgelagert')).toBeInTheDocument();
      expect(screen.getByText('0 von 2 ausgelagert')).toBeInTheDocument();
      expect(screen.getByText('1 von 1 ausgelagert')).toBeInTheDocument();
      expect(screen.getByText('Fertig')).toBeInTheDocument();
      // retrieved 1 (S-SI) of an order of 4 + 2 + 1
      expect(screen.getByText('Ausgelagert 1 von 7')).toBeInTheDocument();
      const button = screen.getByRole('button', { name: 'Menge wählen' });
      expect(button).toBeDisabled();

      await userEvent.click(screen.getByRole('button', { name: 'Salzstreuer · Rot mehr' }));
      await userEvent.click(screen.getByRole('button', { name: 'Salzstreuer · Rot mehr' }));
      expect(screen.getByLabelText('Salzstreuer · Rot Menge')).toHaveTextContent('2');
      await userEvent.click(screen.getByRole('button', { name: '2 Stück auslagern' }));
      expect(onRetrieve).toHaveBeenCalledTimes(1);
      expect(onRetrieve).toHaveBeenCalledWith('S-RT', 2);
    }
  );

  it('retrieves several rows with one button, row by row', async () => {
    const onRetrieve = vi.fn().mockResolvedValue(true);
    render(
      <Station5RetrievalView
        isActive
        onRetrieve={onRetrieve}
        session={makeSession({
          ...base,
          daily_orders: { 'S-RT': 4, 'P-SW': 2 },
          retrieved: {},
        })}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Salzstreuer · Rot mehr' }));
    await userEvent.click(screen.getByRole('button', { name: 'Pfefferstreuer · Schwarz mehr' }));
    await userEvent.click(screen.getByRole('button', { name: 'Pfefferstreuer · Schwarz mehr' }));
    await userEvent.click(screen.getByRole('button', { name: '3 Stück auslagern' }));
    expect(onRetrieve.mock.calls).toEqual([
      ['S-RT', 1],
      ['P-SW', 2],
    ]);
  });

  it('stops at the first failed row and keeps the rest selected', async () => {
    const onRetrieve = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    render(
      <Station5RetrievalView
        isActive
        onRetrieve={onRetrieve}
        session={makeSession({
          ...base,
          daily_orders: { 'S-RT': 4, 'P-SW': 2 },
          retrieved: {},
        })}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Salzstreuer · Rot mehr' }));
    await userEvent.click(screen.getByRole('button', { name: 'Pfefferstreuer · Schwarz mehr' }));
    await userEvent.click(screen.getByRole('button', { name: '2 Stück auslagern' }));
    expect(onRetrieve).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '2 Stück auslagern' })).toBeEnabled();
  });

  it('lets the stepper reach the full remaining order although nothing is in stock', async () => {
    render(<Station5RetrievalView isActive onRetrieve={vi.fn()} session={makeSession(base)} />);
    const more = screen.getByRole('button', { name: 'Salzstreuer · Rot mehr' });
    const less = screen.getByRole('button', { name: 'Salzstreuer · Rot weniger' });
    expect(less).toBeDisabled();
    for (let i = 0; i < 5; i += 1) await userEvent.click(more);
    expect(screen.getByLabelText('Salzstreuer · Rot Menge')).toHaveTextContent('4');
    expect(more).toBeDisabled();
    await userEvent.click(less);
    expect(screen.getByLabelText('Salzstreuer · Rot Menge')).toHaveTextContent('3');
  });

  it('says so without a customer order', () => {
    render(<Station5RetrievalView isActive onRetrieve={vi.fn()} session={makeSession()} />);
    expect(screen.getByText('Kein Kundenauftrag vorhanden.')).toBeInTheDocument();
  });

  it('shows "Beenden" enabled when order is completely retrieved and calls onFinishDay', async () => {
    const onFinishDay = vi.fn().mockResolvedValue(true);
    render(
      <Station5RetrievalView
        isActive
        onFinishDay={onFinishDay}
        onRetrieve={vi.fn()}
        session={makeSession({
          daily_orders: { 'S-RT': 2 },
          retrieved: { 'S-RT': 2 },
          strategy: 'PUSH',
        })}
      />
    );
    const finishButton = screen.getByRole('button', { name: BUTTON_FINISH_DAY });
    expect(finishButton).toBeEnabled();
    await userEvent.click(finishButton);
    expect(onFinishDay).toHaveBeenCalledTimes(1);
  });

  it('shows "Tag mit Fehlständen abschließen" disabled when production/storage open, enabled when completed', async () => {
    const onFinishDay = vi.fn().mockResolvedValue(true);
    const session = makeSession({
      daily_orders: { 'S-RT': 3 },
      retrieved: { 'S-RT': 1 },
      strategy: 'PUSH',
      daily_production_limits: { 'S-RT': 3 },
      stations: [
        makeStation(1, { status: 'COMPLETED' }),
        makeStation(2, { status: 'COMPLETED' }),
        makeStation(3, { status: 'ACTIVE' }),
        makeStation(4, { status: 'IDLE' }),
        makeStation(5, { status: 'ACTIVE' }),
      ],
    });
    const { rerender } = render(
      <Station5RetrievalView
        isActive
        onFinishDay={onFinishDay}
        onRetrieve={vi.fn()}
        session={session}
      />
    );
    const finishButton = screen.getByRole('button', {
      name: BUTTON_FINISH_DAY_SHORTFALLS,
    });
    expect(finishButton).toBeDisabled();

    // Now the plan is produced and stored (the rule reads batches, not station statuses)
    const completedSession = {
      ...session,
      batches: [
        {
          batch_id: 'b1',
          variant: 'S-RT' as const,
          quantity: 3,
          status: 'STORED' as const,
          is_replenishment: false,
          reject_reason: null,
          created_at: '',
        },
      ],
    };
    rerender(
      <Station5RetrievalView
        isActive
        onFinishDay={onFinishDay}
        onRetrieve={vi.fn()}
        session={completedSession}
      />
    );
    expect(finishButton).toBeEnabled();
    await userEvent.click(finishButton);
    expect(onFinishDay).toHaveBeenCalledTimes(1);
  });
});

describe('Station5RetrievalView double click', () => {
  it('retrieves only once when the confirm button is clicked twice quickly', async () => {
    let finish: (ok: boolean) => void = () => {};
    const onRetrieve = vi.fn(() => new Promise<boolean>((resolve) => (finish = resolve)));
    render(<Station5RetrievalView isActive onRetrieve={onRetrieve} session={makeSession(base)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Salzstreuer · Rot mehr' }));
    const button = screen.getByRole('button', { name: '1 Stück auslagern' });
    await userEvent.dblClick(button);
    expect(onRetrieve).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    finish(true);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Menge wählen' })).toBeDisabled()
    );
  });
});

describe('Station5RetrievalView with the real engine (Push, empty plan)', () => {
  it('enables the shortfall button and the server accepts finishing the day', async () => {
    const engine = new SimulationEngine();
    const id = engine.create('PUSH').session_id;
    engine.configure(id, {
      daily_orders: { 'S-RT': 3 },
      daily_production_limits: { 'S-RT': 0, 'S-SI': 0, 'S-SW': 0, 'P-RT': 0, 'P-SI': 0, 'P-SW': 0 },
    });
    engine.setState(id, 'RUNNING');
    engine.completeSupply(id, 1);
    const session = engine.completeSupply(id, 2);
    expect(session.state).toBe('RUNNING');
    // The old status-based rule never saw this state as finished.
    expect(session.stations.find((entry) => entry.station_id === 3)?.status).not.toBe('COMPLETED');

    const onFinishDay = vi.fn().mockResolvedValue(true);
    render(
      <Station5RetrievalView
        isActive
        onFinishDay={onFinishDay}
        onRetrieve={vi.fn()}
        session={session}
      />
    );
    const finishButton = screen.getByRole('button', { name: BUTTON_FINISH_DAY_SHORTFALLS });
    expect(finishButton).toBeEnabled();
    await userEvent.click(finishButton);
    expect(onFinishDay).toHaveBeenCalledTimes(1);

    const finished = engine.finishDayFromStation5(id);
    expect(finished.state).toBe('FINISHED');
    expect(finished.shortfall['S-RT']).toBe(3);
  });
});
