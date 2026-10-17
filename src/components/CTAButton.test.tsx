import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import CTAButton from './CTAButton';

describe('CTAButton', () => {
  it('renders the label and fires onClick', async () => {
    const onClick = vi.fn();
    render(<CTAButton label="Los" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Los' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire when disabled', async () => {
    const onClick = vi.fn();
    render(<CTAButton disabled label="Los" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Los' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
