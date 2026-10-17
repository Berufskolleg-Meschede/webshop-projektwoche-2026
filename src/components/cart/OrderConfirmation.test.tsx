import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import OrderConfirmation from './OrderConfirmation';

describe('OrderConfirmation', () => {
  it('shows the order number', () => {
    render(<OrderConfirmation onClose={vi.fn()} orderId={12} />);
    expect(screen.getByText('#12')).toBeInTheDocument();
  });

  it('falls back to a generic message without an order id', () => {
    render(<OrderConfirmation onClose={vi.fn()} orderId={null} />);
    expect(screen.getByText('Ihre Bestellung wurde erfolgreich übermittelt.')).toBeInTheDocument();
  });

  it('closes via the continue button', async () => {
    const onClose = vi.fn();
    render(<OrderConfirmation onClose={onClose} orderId={1} />);
    await userEvent.click(screen.getByRole('button', { name: 'Weiter einkaufen' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
