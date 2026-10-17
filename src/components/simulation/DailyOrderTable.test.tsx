import { render, screen, within } from '@testing-library/react';

import { makeSession } from '@/test/fixtures';
import type { Order } from '@/types/simulation';

import DailyOrderTable from './DailyOrderTable';

function order(id: string, name: string | null, items: Order['items']): Order {
  return {
    order_id: id,
    source: 'customer',
    customer_name: name,
    items,
    created_at: '2026-10-13T08:00:00Z',
  };
}

describe('DailyOrderTable', () => {
  it('highlights a manually adjusted daily total (K02)', () => {
    render(
      <DailyOrderTable
        session={makeSession({
          daily_orders: { 'S-RT': 5 },
          orders: [order('O1', 'Anna', { 'S-RT': 2 })],
        })}
      />
    );
    expect(screen.getByRole('note')).toHaveTextContent(
      'Die Tagessumme (5 Stück) weicht von den Kundenbestellungen (2 Stück) ab: Sie wurde in der Konfiguration angepasst.'
    );
  });

  it('hides the note when the sum only differs by the carried-over shortfall', () => {
    render(
      <DailyOrderTable
        session={makeSession({
          daily_orders: { 'S-RT': 3 },
          carried_over: { 'S-RT': 3 },
        })}
      />
    );
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('hides the note for carry plus customer orders and shows it after a further edit', () => {
    const orders = [order('O1', 'Anna', { 'S-RT': 2 })];
    const { rerender } = render(
      <DailyOrderTable
        session={makeSession({ daily_orders: { 'S-RT': 5 }, carried_over: { 'S-RT': 3 }, orders })}
      />
    );
    expect(screen.queryByRole('note')).not.toBeInTheDocument();

    rerender(
      <DailyOrderTable
        session={makeSession({ daily_orders: { 'S-RT': 7 }, carried_over: { 'S-RT': 3 }, orders })}
      />
    );
    expect(screen.getByRole('note')).toHaveTextContent(
      'Die Tagessumme (7 Stück) weicht von den Kundenbestellungen (2 Stück) ab: Sie wurde in der Konfiguration angepasst.'
    );
  });

  it('shows an empty state without orders', () => {
    render(<DailyOrderTable session={makeSession()} />);
    expect(screen.getByRole('heading', { name: 'Eingegangene Bestellungen' })).toBeInTheDocument();
    expect(screen.getByText('Noch keine Kundenbestellungen eingegangen.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('lists the customer orders in a table with Nr., Kunde, Positionen and Stück', () => {
    const session = makeSession({
      daily_orders: { 'S-RT': 3, 'P-SW': 1, 'P-RT': 1 },
      orders: [order('o1', 'Mia', { 'S-RT': 3, 'P-SW': 1 }), order('o2', null, { 'P-RT': 1 })],
    });
    render(<DailyOrderTable session={session} />);

    expect(screen.getByRole('heading', { name: 'Eingegangene Bestellungen' })).toBeInTheDocument();
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(
      within(rows[0])
        .getAllByRole('columnheader')
        .map((c) => c.textContent)
    ).toEqual(['Nr.', 'Kunde', 'Positionen', 'Stück']);
    expect(within(rows[1]).getByText('o1')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Mia')).toBeInTheDocument();
    expect(
      within(rows[1]).getByText('3× Roter Salzstreuer, 1× Schwarzer Pfefferstreuer')
    ).toBeInTheDocument();
    expect(within(rows[1]).getByText('4')).toBeInTheDocument();
    expect(within(rows[2]).getByText('o2')).toBeInTheDocument();
    expect(within(rows[2]).getByText('–')).toBeInTheDocument();
    expect(within(rows[2]).getByText('1× Roter Pfefferstreuer')).toBeInTheDocument();
    expect(within(rows[2]).getByText('1')).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});
