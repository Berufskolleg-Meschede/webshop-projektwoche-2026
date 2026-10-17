import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import ClearStationButton from './ClearStationButton';

describe('ClearStationButton', () => {
  it('asks first and releases only after the confirmation', async () => {
    const onClear = vi.fn();
    render(<ClearStationButton onClear={onClear} stationId={3} />);
    await userEvent.click(screen.getByRole('button', { name: 'Station 3 leeren' }));
    expect(onClear).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('Diese Station wirklich leeren?');
    await userEvent.click(screen.getByRole('button', { name: 'Ja, leeren' }));
    expect(onClear).toHaveBeenCalledExactlyOnceWith(3);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does nothing on cancel', async () => {
    const onClear = vi.fn();
    render(<ClearStationButton onClear={onClear} stationId={2} />);
    await userEvent.click(screen.getByRole('button', { name: 'Station 2 leeren' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onClear).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Station 2 leeren' })).toBeInTheDocument();
  });

  it('shows the X in the danger colour', () => {
    render(<ClearStationButton onClear={vi.fn()} stationId={1} />);
    expect(screen.getByRole('button', { name: 'Station 1 leeren' })).toHaveClass('text-danger');
  });

  it('opens a modal popup with focus on the safe button and closes on Escape', async () => {
    const onClear = vi.fn();
    render(<ClearStationButton onClear={onClear} stationId={4} />);
    await userEvent.click(screen.getByRole('button', { name: 'Station 4 leeren' }));
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onClear).not.toHaveBeenCalled();
  });

  it('closes the popup when the backdrop is clicked', async () => {
    const onClear = vi.fn();
    render(<ClearStationButton onClear={onClear} stationId={5} />);
    await userEvent.click(screen.getByRole('button', { name: 'Station 5 leeren' }));
    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
    await userEvent.click(backdrop);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onClear).not.toHaveBeenCalled();
  });
});
