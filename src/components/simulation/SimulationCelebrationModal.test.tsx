import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import SimulationCelebrationModal from './SimulationCelebrationModal';

function renderModal(props: { notFulfilled?: boolean; endedByTeacher?: boolean }) {
  render(<SimulationCelebrationModal onClose={vi.fn()} {...props} />);
  return screen.getByTestId('celebration-icon');
}

describe('SimulationCelebrationModal icon', () => {
  it('shows the primary party popper on success', () => {
    const icon = renderModal({});
    expect(icon).toHaveClass('lucide-party-popper', 'text-primary');
    expect(icon).not.toHaveClass('text-ink-muted');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it.each([
    ['notFulfilled', { notFulfilled: true }],
    ['endedByTeacher', { endedByTeacher: true }],
    ['both', { notFulfilled: true, endedByTeacher: true }],
  ])('shows the neutral muted flag for %s', (_name, props) => {
    const icon = renderModal(props);
    expect(icon).toHaveClass('lucide-flag', 'text-ink-muted');
    expect(icon).not.toHaveClass('lucide-party-popper');
    expect(icon).not.toHaveClass('text-primary');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});
