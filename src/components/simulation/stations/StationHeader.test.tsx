import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import StationHeader from './StationHeader';

function renderHeader(overrides: Partial<Parameters<typeof StationHeader>[0]> = {}) {
  const onLeave = vi.fn();
  render(
    <StationHeader
      onLeave={onLeave}
      sessionId="4827"
      stationId={1}
      studentName="Jonas M."
      {...overrides}
    />
  );
  return { onLeave };
}

describe('StationHeader', () => {
  it.each([
    [1, 'Zulieferung Deckel'],
    [2, 'Zulieferung Gehäuse'],
    [3, 'Produktion'],
    [4, 'Einlagerung'],
    [5, 'Auslagerung'],
  ] as const)('shows eyebrow, title as h1 and subtitle for station %i', (stationId, title) => {
    renderHeader({ stationId, subtitle: 'Gib ein, was du jetzt tust.' });
    expect(screen.getByText(`STATION ${stationId} · SITZUNG 4827`)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeVisible();
    expect(screen.getByText('Gib ein, was du jetzt tust.')).toBeVisible();
  });

  it('keeps occupant name and the leave action', async () => {
    const { onLeave } = renderHeader();
    expect(screen.getByText('Jonas M.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Station verlassen' }));
    expect(onLeave).toHaveBeenCalledOnce();
  });
});
