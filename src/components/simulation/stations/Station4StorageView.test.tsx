import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { vi } from 'vitest';

import { createEngineHarness } from '@/test/engineHarness';
import { makeBatch, makeSession } from '@/test/fixtures';
import type { ShakerVariant, SimulationSession } from '@/types/simulation';

import Station3ProductionView from './Station3ProductionView';
import Station4StorageView from './Station4StorageView';

describe('Station4StorageView', () => {
  it('stores an incoming batch directly from the card', async () => {
    const onStoreBatch = vi.fn().mockResolvedValue(true);
    render(
      <Station4StorageView
        isActive
        onReportDeviation={vi.fn()}
        onStoreBatch={onStoreBatch}
        session={makeSession({ daily_orders: { 'S-RT': 2 }, batches: [makeBatch()] })}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Stimmt – eingelagert' }));
    expect(onStoreBatch).toHaveBeenCalledWith('b1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Prüfen' })).not.toBeInTheDocument();
  });

  it('keeps the batch and both buttons if storing fails', async () => {
    render(
      <Station4StorageView
        isActive
        onReportDeviation={vi.fn()}
        onStoreBatch={vi.fn().mockResolvedValue(false)}
        session={makeSession({
          daily_orders: { 'S-RT': 2 },
          batches: [makeBatch({ is_replenishment: true })],
        })}
      />
    );
    expect(screen.getByText('Nachproduktion')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Stimmt – eingelagert' }));
    expect(screen.getByRole('button', { name: 'Stimmt – eingelagert' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Abweichung melden' })).toBeEnabled();
  });

  it('validates and submits a deviation report', async () => {
    const onReportDeviation = vi.fn().mockResolvedValue(true);
    render(
      <Station4StorageView
        isActive
        onReportDeviation={onReportDeviation}
        onStoreBatch={vi.fn()}
        session={makeSession({ daily_orders: { 'S-RT': 2 }, batches: [makeBatch()] })}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Abweichung melden' }));

    const submit = screen.getByRole('button', { name: 'Abweichung melden' });
    expect(submit).toBeDisabled(); // reason missing
    await userEvent.type(screen.getByLabelText('Grund'), '  Falsche Farbe ');
    expect(submit).toBeEnabled();

    const missing = screen.getByLabelText(/Wie viele Teile/);
    await userEvent.clear(missing);
    await userEvent.type(missing, '5');
    expect(screen.getByRole('alert')).toHaveTextContent('Die Charge hat nur 2 Stück.');
    expect(submit).toBeDisabled();
    await userEvent.clear(missing);
    await userEvent.type(missing, '1');

    await userEvent.click(submit);
    expect(onReportDeviation).toHaveBeenCalledWith('b1', 'Falsche Farbe', 1);
    expect(screen.queryByLabelText('Grund')).not.toBeInTheDocument();
  });

  it('offers one-tap reasons that fill the free-text field (BUG-13)', async () => {
    const onReportDeviation = vi.fn().mockResolvedValue(true);
    render(
      <Station4StorageView
        isActive
        onReportDeviation={onReportDeviation}
        onStoreBatch={vi.fn()}
        session={makeSession({ daily_orders: { 'S-RT': 2 }, batches: [makeBatch()] })}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Abweichung melden' }));
    const chips = within(screen.getByRole('group', { name: 'Häufige Gründe' }));
    expect(chips.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Deckel defekt',
      'Kratzer',
      'Falsche Farbe',
    ]);
    expect(screen.getByRole('button', { name: 'Abweichung melden' })).toBeDisabled();

    await userEvent.click(chips.getByRole('button', { name: 'Kratzer' }));
    expect(screen.getByLabelText('Grund')).toHaveValue('Kratzer');
    expect(chips.getByRole('button', { name: 'Kratzer' })).toHaveAttribute('aria-pressed', 'true');

    // the free text can still be refined afterwards
    await userEvent.type(screen.getByLabelText('Grund'), ' am Deckel');
    // a chip never throws away what was typed: it is appended
    await userEvent.click(chips.getByRole('button', { name: 'Falsche Farbe' }));
    expect(screen.getByLabelText('Grund')).toHaveValue('Kratzer am Deckel, Falsche Farbe');
    await userEvent.click(chips.getByRole('button', { name: 'Falsche Farbe' })); // no duplicate
    expect(screen.getByLabelText('Grund')).toHaveValue('Kratzer am Deckel, Falsche Farbe');
    await userEvent.click(screen.getByRole('button', { name: 'Abweichung melden' }));
    expect(onReportDeviation).toHaveBeenCalledWith('b1', 'Kratzer am Deckel, Falsche Farbe', 1);
  });

  it('goes back from the deviation form', async () => {
    render(
      <Station4StorageView
        isActive
        onReportDeviation={vi.fn().mockResolvedValue(false)}
        onStoreBatch={vi.fn()}
        session={makeSession({ daily_orders: { 'S-RT': 2 }, batches: [makeBatch()] })}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Abweichung melden' }));
    await userEvent.type(screen.getByLabelText('Grund'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Abweichung melden' }));
    expect(screen.getByLabelText('Grund')).toBeInTheDocument(); // failed → form stays
    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(screen.getByRole('button', { name: 'Stimmt – eingelagert' })).toBeInTheDocument();
  });
});

/** Real engine behind the stations: the loopback runs against the actual booking rules. */
function Harness() {
  const [backend] = useState(() => {
    const engine = createEngineHarness({ strategy: 'PULL', daily_orders: { 'S-RT': 2 } });
    engine.completeSupply();
    // Pull: production only opens once Station 5 has retrieved the customer order.
    return { engine, initial: engine.retrieve('S-RT', 2) };
  });
  const [session, setSession] = useState<SimulationSession>(backend.initial);

  async function book(action: () => SimulationSession) {
    setSession(action());
    return true;
  }
  const produceBatch = (variant: ShakerVariant, quantity: number) =>
    book(() => backend.engine.produceBatch(variant, quantity));
  const storeBatch = (batchId: string) => book(() => backend.engine.storeBatch(batchId));
  const reportDeviation = (batchId: string, reason: string, missing: number) =>
    book(() => backend.engine.reportDeviation(batchId, reason, missing));

  return (
    <>
      <div data-testid="station3">
        <Station3ProductionView isActive onProduceBatch={produceBatch} session={session} />
      </div>
      <div data-testid="station4">
        <Station4StorageView
          isActive
          onReportDeviation={reportDeviation}
          onStoreBatch={storeBatch}
          session={session}
        />
      </div>
    </>
  );
}

describe('Station4StorageView batch wording', () => {
  it('lists the missing parts and omits them once the batch completes the order', () => {
    const props = { isActive: true, onReportDeviation: vi.fn(), onStoreBatch: vi.fn() };
    const { rerender } = render(
      <Station4StorageView
        {...props}
        session={makeSession({
          daily_orders: { 'S-SI': 2, 'P-RT': 2, 'P-SW': 3 },
          batches: [
            makeBatch({ batch_id: 'a', variant: 'S-SI', quantity: 2, status: 'STORED' }),
            makeBatch({ batch_id: 'b', variant: 'P-RT', quantity: 1 }),
          ],
        })}
      />
    );
    expect(screen.getByText('Pfefferstreuer · Rot')).toBeInTheDocument();
    expect(screen.getByText('Bereits eingelagert 2 von 7')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Mit dieser Charge: 3 von 7. Pfefferstreuer Rot 1 und Schwarz 3 fehlen noch.'
      )
    ).toBeInTheDocument();

    rerender(
      <Station4StorageView
        {...props}
        session={makeSession({ daily_orders: { 'S-RT': 2 }, batches: [makeBatch()] })}
      />
    );
    expect(screen.getByText('Mit dieser Charge: 2 von 2.')).toBeInTheDocument();
  });
});

describe('Station4StorageView gating and double clicks', () => {
  const withBatch = makeSession({ daily_orders: { 'S-RT': 2 }, batches: [makeBatch()] });

  it('does not allow storing or reporting while the station is not active', () => {
    render(
      <Station4StorageView
        isActive={false}
        onReportDeviation={vi.fn()}
        onStoreBatch={vi.fn()}
        session={withBatch}
      />
    );
    expect(screen.getByRole('button', { name: 'Stimmt – eingelagert' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Abweichung melden' })).toBeDisabled();
  });

  it('stores only once on a double click', async () => {
    let finish: (ok: boolean) => void = () => {};
    const onStoreBatch = vi.fn(() => new Promise<boolean>((resolve) => (finish = resolve)));
    render(
      <Station4StorageView
        isActive
        onReportDeviation={vi.fn()}
        onStoreBatch={onStoreBatch}
        session={withBatch}
      />
    );
    await userEvent.dblClick(screen.getByRole('button', { name: 'Stimmt – eingelagert' }));
    expect(onStoreBatch).toHaveBeenCalledTimes(1);
    finish(true);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Stimmt – eingelagert' })).toBeEnabled()
    );
  });

  it('reports a deviation only once on a double click', async () => {
    let finish: (ok: boolean) => void = () => {};
    const onReportDeviation = vi.fn(() => new Promise<boolean>((resolve) => (finish = resolve)));
    render(
      <Station4StorageView
        isActive
        onReportDeviation={onReportDeviation}
        onStoreBatch={vi.fn()}
        session={withBatch}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Abweichung melden' }));
    await userEvent.type(screen.getByLabelText('Grund'), 'Kratzer');
    await userEvent.dblClick(screen.getByRole('button', { name: 'Abweichung melden' }));
    expect(onReportDeviation).toHaveBeenCalledTimes(1);
    finish(true);
    await waitFor(() => expect(screen.queryByLabelText('Grund')).not.toBeInTheDocument());
  });
});

describe('Loopback Station 3 → 4 → defect → 3 → 4', () => {
  it('re-produces what Station 4 reports as missing until the order is stored', async () => {
    render(<Harness />);
    const station3 = screen.getByTestId('station3');
    const station4 = screen.getByTestId('station4');
    const within3 = (name: string | RegExp) =>
      Array.from(station3.querySelectorAll('button')).find((b) => b.textContent?.match(name))!;

    // Station 3 produces the full order of 2.
    const more3 = () => screen.getByRole('button', { name: /Salzstreuer · Rot mehr/ });
    await userEvent.click(more3());
    await userEvent.click(more3());
    await userEvent.click(within3('Charge senden'));
    expect(station3).toHaveTextContent('Fertig');
    expect(station4).toHaveTextContent('Bereits eingelagert 0 von 2');

    // Station 4 finds 1 piece defective: 1 stored, 1 comes back.
    await userEvent.click(screen.getByRole('button', { name: 'Abweichung melden' }));
    await userEvent.type(screen.getByLabelText('Grund'), 'Kratzer');
    await userEvent.click(screen.getByRole('button', { name: 'Abweichung melden' }));
    expect(station4).toHaveTextContent('Bereits eingelagert 1 von 2');
    expect(station3).toHaveTextContent('Nachproduktion erforderlich');
    expect(station3).toHaveTextContent('Kratzer');
    expect(station3).toHaveTextContent('offen 1 · gesendet 1');

    // Station 3 re-produces the missing piece, Station 4 stores it.
    await userEvent.click(more3());
    await userEvent.click(within3('Charge senden'));
    expect(station4).toHaveTextContent('Nachproduktion');
    await userEvent.click(screen.getByRole('button', { name: 'Stimmt – eingelagert' }));

    expect(station4).toHaveTextContent('Bereits eingelagert 2 von 2');
    expect(station4).toHaveTextContent('Der gesamte Auftrag ist eingelagert.');
    expect(station3).not.toHaveTextContent('Nachproduktion erforderlich');
  });
});
