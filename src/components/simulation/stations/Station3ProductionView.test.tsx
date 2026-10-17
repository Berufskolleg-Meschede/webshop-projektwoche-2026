import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { makeBatch, makeSession } from '@/test/fixtures';

import Station3ProductionView from './Station3ProductionView';

const session = makeSession({
  daily_orders: { 'S-RT': 5, 'P-SW': 2 },
  batches: [makeBatch({ variant: 'P-SW' })],
});

const SALT = 'Salzstreuer · Rot';
const PEPPER = 'Pfefferstreuer · Schwarz';
const more = (title: string) => screen.getByRole('button', { name: `${title} mehr` });
const less = (title: string) => screen.getByRole('button', { name: `${title} weniger` });
const sendButton = () => screen.getByRole('button', { name: /Charge senden|Menge wählen/ });

describe('Station3ProductionView', () => {
  it('lists all variants in one list with open and sent counts', () => {
    render(<Station3ProductionView isActive onProduceBatch={vi.fn()} session={session} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('offen 5 · gesendet 0')).toBeInTheDocument();
    expect(screen.getByText('2 von 2 gesendet')).toBeInTheDocument();
    expect(screen.getByText('2 von 7 gesendet')).toBeInTheDocument();
    expect(screen.getByText('Fertig')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `${PEPPER} mehr` })).not.toBeInTheDocument();
  });

  it('disables sending until a quantity is chosen and caps rows at what is open', async () => {
    render(<Station3ProductionView isActive onProduceBatch={vi.fn()} session={session} />);
    expect(sendButton()).toBeDisabled();
    expect(sendButton()).toHaveTextContent('Menge wählen');
    expect(less(SALT)).toBeDisabled();
    for (let i = 0; i < 5; i++) await userEvent.click(more(SALT));
    expect(screen.getByLabelText(`${SALT} Menge`)).toHaveTextContent('5');
    expect(more(SALT)).toBeDisabled();
    expect(sendButton()).toHaveTextContent('Charge senden · 5 Stück');
  });

  it('sends one batch per chosen variant and resets the row quantities', async () => {
    const two = makeSession({ daily_orders: { 'S-RT': 5, 'P-SW': 3 } });
    const onProduceBatch = vi.fn().mockResolvedValue(true);
    render(<Station3ProductionView isActive onProduceBatch={onProduceBatch} session={two} />);
    await userEvent.click(more(SALT));
    await userEvent.click(more(SALT));
    await userEvent.click(more(PEPPER));
    expect(sendButton()).toHaveTextContent('Charge senden · 3 Stück');
    await userEvent.click(sendButton());
    expect(onProduceBatch).toHaveBeenNthCalledWith(1, 'S-RT', 2);
    expect(onProduceBatch).toHaveBeenNthCalledWith(2, 'P-SW', 1);
    expect(sendButton()).toHaveTextContent('Menge wählen');
  });

  it('keeps the remaining rows selected when a hand-over fails', async () => {
    const two = makeSession({ daily_orders: { 'S-RT': 5, 'P-SW': 3 } });
    const onProduceBatch = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    render(<Station3ProductionView isActive onProduceBatch={onProduceBatch} session={two} />);
    await userEvent.click(more(SALT));
    await userEvent.click(more(PEPPER));
    await userEvent.click(sendButton());
    expect(onProduceBatch).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText(`${SALT} Menge`)).toHaveTextContent('0');
    expect(screen.getByLabelText(`${PEPPER} Menge`)).toHaveTextContent('1');
    expect(sendButton()).toHaveTextContent('Charge senden · 1 Stück');
  });

  it('highlights replenishment from station 4', () => {
    const withReplenishment = makeSession({
      daily_orders: { 'S-RT': 1 },
      replenishment_queue: [{ variant: 'S-RT', quantity: 1, reason: 'Falsche Farbe' }],
    });
    render(
      <Station3ProductionView isActive onProduceBatch={vi.fn()} session={withReplenishment} />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Nachproduktion erforderlich');
    expect(screen.getByRole('alert')).toHaveTextContent(
      '1× Salz (Deckel blau) · Gehäuse rot – Falsche Farbe'
    );
  });

  it('shows the completion hint once everything is produced and an empty hint without order', () => {
    const done = makeSession({
      daily_orders: { 'S-RT': 1 },
      batches: [
        {
          batch_id: 'b',
          variant: 'S-RT',
          quantity: 1,
          status: 'PRODUCED',
          is_replenishment: false,
          reject_reason: null,
          created_at: '',
        },
      ],
    });
    const { unmount } = render(
      <Station3ProductionView isActive onProduceBatch={vi.fn()} session={done} />
    );
    expect(
      screen.getByText('Alles gefertigt und an Station 4 gesendet – warte auf die Rückmeldung.')
    ).toBeInTheDocument();
    unmount();
    render(<Station3ProductionView isActive onProduceBatch={vi.fn()} session={makeSession()} />);
    expect(screen.getByText('Kein Produktionsauftrag vorhanden.')).toBeInTheDocument();
  });
});

describe('Station3ProductionView Pull waiting for the retrieval (#198)', () => {
  it('says production waits for Station 5 once the supply is done', () => {
    const supplied = makeSession({ daily_orders: { 'S-RT': 2 } });
    supplied.stations = supplied.stations.map((entry) =>
      entry.station_id <= 2 ? { ...entry, status: 'COMPLETED' as const } : entry
    );
    render(<Station3ProductionView isActive={false} onProduceBatch={vi.fn()} session={supplied} />);
    expect(
      screen.getByText('Die Produktion startet, sobald Station 5 die Bestellung ausgelagert hat.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Die Produktion startet, sobald die Zulieferung (Station 1 & 2) abgeschlossen ist.'
      )
    ).not.toBeInTheDocument();
  });
});

describe('Station3ProductionView order and highlight', () => {
  const produced = (variant: 'S-RT' | 'S-SI' | 'P-RT', quantity: number) => ({
    batch_id: `b-${variant}`,
    variant,
    quantity,
    status: 'PRODUCED' as const,
    is_replenishment: false,
    reject_reason: null,
    created_at: '',
  });

  it('keeps the fixed variant order whatever the order of the orders, skipping missing ones', () => {
    const mixed = makeSession({ daily_orders: { 'P-SW': 1, 'S-SI': 1, 'S-RT': 1, 'P-RT': 1 } });
    render(<Station3ProductionView isActive onProduceBatch={vi.fn()} session={mixed} />);
    const titles = screen
      .getAllByRole('listitem')
      .map((item) => item.querySelector('span > span')?.textContent);
    expect(titles).toEqual([
      'Salzstreuer · Rot',
      'Salzstreuer · Silber',
      'Pfefferstreuer · Rot',
      'Pfefferstreuer · Schwarz',
    ]);
  });

  it('highlights the topmost entry that is not counted up completely', () => {
    const partly = makeSession({
      daily_orders: { 'S-RT': 2, 'S-SI': 2, 'P-RT': 2 },
      batches: [produced('S-RT', 2), produced('S-SI', 1)],
    });
    render(<Station3ProductionView isActive onProduceBatch={vi.fn()} session={partly} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).not.toHaveAttribute('aria-current');
    expect(items[1]).toHaveAttribute('aria-current', 'true');
    expect(items[1]).toHaveClass('border-primary');
    expect(items[2]).not.toHaveAttribute('aria-current');
  });

  it('highlights nothing once everything is done', () => {
    const done = makeSession({ daily_orders: { 'S-RT': 1 }, batches: [produced('S-RT', 1)] });
    render(<Station3ProductionView isActive onProduceBatch={vi.fn()} session={done} />);
    expect(screen.getByRole('listitem')).not.toHaveAttribute('aria-current');
  });
});

describe('Station3ProductionView gating and double clicks', () => {
  it('shows only the waiting state while inactive, without list or send button', () => {
    render(<Station3ProductionView isActive={false} onProduceBatch={vi.fn()} session={session} />);
    expect(
      screen.getByText(
        'Die Produktion startet, sobald die Zulieferung (Station 1 & 2) abgeschlossen ist.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('sends only one request when the send button is clicked twice quickly', async () => {
    let finish: (ok: boolean) => void = () => {};
    const onProduceBatch = vi.fn(() => new Promise<boolean>((resolve) => (finish = resolve)));
    render(<Station3ProductionView isActive onProduceBatch={onProduceBatch} session={session} />);
    await userEvent.click(more(SALT));
    const send = sendButton();
    await userEvent.dblClick(send);
    expect(onProduceBatch).toHaveBeenCalledTimes(1);
    expect(send).toBeDisabled();
    finish(true);
    await waitFor(() => expect(sendButton()).toHaveTextContent('Menge wählen'));
  });
});
