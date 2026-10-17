import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import SimulationBanner from './SimulationBanner';

describe('SimulationBanner', () => {
  it('lets the visitor leave the simulation (BUG-09)', async () => {
    const onExit = vi.fn();
    render(<SimulationBanner onExit={onExit} sessionId="4827" />);
    await userEvent.click(screen.getByRole('button', { name: 'Simulation verlassen' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
