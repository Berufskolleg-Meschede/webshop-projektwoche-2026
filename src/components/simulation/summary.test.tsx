import { render, screen } from '@testing-library/react';

import { makeSession } from '@/test/fixtures';
import type { Batch } from '@/types/simulation';

import SimulationSummaryReport from './SimulationSummaryReport';

function batch(overrides: Partial<Batch>): Batch {
  return {
    batch_id: 'b',
    variant: 'S-RT',
    quantity: 1,
    status: 'STORED',
    is_replenishment: false,
    reject_reason: null,
    created_at: '',
    ...overrides,
  };
}

const finished = makeSession({
  state: 'FINISHED',
  daily_orders: { 'S-RT': 3, 'P-SW': 1 },
  retrieved: { 'S-RT': 3, 'P-SW': 1 },
  batches: [
    batch({ quantity: 2 }),
    batch({ batch_id: 'r', quantity: 1, is_replenishment: true }),
    batch({ batch_id: 'x', quantity: 5, status: 'REJECTED' }),
    batch({ batch_id: 'p', variant: 'P-SW', quantity: 1, status: 'PRODUCED' }),
  ],
});

describe('session summary', () => {
  it('renders the KPI report', () => {
    render(<SimulationSummaryReport session={finished} />);
    expect(screen.getByText('Gefertigte Einheiten').nextSibling).toHaveTextContent('4');
    expect(screen.getByText('Nachproduktions-Chargen').nextSibling).toHaveTextContent('1');
  });
});
