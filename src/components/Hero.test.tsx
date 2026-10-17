import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import Hero from './Hero';

describe('Hero', () => {
  it.each([
    ['Zum Webshop', 'webshop'],
    ['Zur Simulation', 'simulation'],
  ])('navigates via "%s" to %s', async (label, page) => {
    const onNavigate = vi.fn();
    render(<Hero onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('button', { name: label }));
    expect(onNavigate).toHaveBeenCalledWith(page);
  });
});
