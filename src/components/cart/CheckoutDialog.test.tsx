import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';

import { ApiRequestError } from '@/api/requestApi';
import { addOrderApi, createSaleOrderApi } from '@/test/mockApis';
import { makeCartItem } from '@/test/fixtures';
import type { CartItem } from '@/types/cart';

import CheckoutDialog from './CheckoutDialog';

vi.mock('@/api/simulation/sessionApi', async () =>
  (await import('@/test/mockApis')).sessionApiModule()
);

vi.mock('@/api/saleOrders/createSaleOrderApi', async () =>
  (await import('@/test/mockApis')).saleOrderApiModule()
);

function setup(items: CartItem[] = [makeCartItem({ id: 1, price: 2 }, 2)], isOpen = true) {
  const props = {
    isOpen,
    onClose: vi.fn(),
    items,
    onRemove: vi.fn(),
    onUpdateQuantity: vi.fn(),
    onOrderPlaced: vi.fn(),
  };
  const view = render(<CheckoutDialog {...props} />);
  return { props, ...view };
}

const submit = () => screen.getByRole('button', { name: 'Bestellung Aufgeben' });

describe('CheckoutDialog', () => {
  beforeEach(() => {
    createSaleOrderApi.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders nothing when closed', () => {
    setup(undefined, false);
    expect(screen.queryByText('Kasse')).not.toBeInTheDocument();
  });

  it('shows items and the total', () => {
    setup();
    expect(screen.getByText('Gehäuse rot')).toBeInTheDocument();
    expect(screen.getByText('€4.00')).toBeInTheDocument();
  });

  it('shows an empty cart and disables submit', () => {
    setup([]);
    expect(screen.getByText('Ihr Warenkorb ist leer.')).toBeInTheDocument();
    expect(submit()).toBeDisabled();
  });

  it('notes unpriced items', () => {
    setup([makeCartItem({ price: null })]);
    expect(screen.getByText('* Artikel auf Anfrage nicht enthalten')).toBeInTheDocument();
  });

  it('requires a payment method before ordering', async () => {
    setup();
    await userEvent.click(submit());
    expect(screen.getByText('Bitte eine Bezahlmethode auswählen.')).toBeInTheDocument();
    expect(createSaleOrderApi).not.toHaveBeenCalled();
  });

  it('marks the selected payment method', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Kreditkarte' }));
    expect(screen.getByRole('button', { name: 'Kreditkarte' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Banküberweisung' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('places the order, notifies the parent and shows the confirmation', async () => {
    createSaleOrderApi.mockResolvedValue({ id: 55 });
    const { props } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Kreditkarte' }));
    await userEvent.click(submit());
    expect(await screen.findByText('#55')).toBeInTheDocument();
    expect(props.onOrderPlaced).toHaveBeenCalledOnce();
    expect(createSaleOrderApi).toHaveBeenCalledWith({
      customer_id: 1,
      products: [{ productId: 1, quantity: 2 }],
    });
  });

  it('shows the API error and does not notify the parent', async () => {
    createSaleOrderApi.mockRejectedValue(new ApiRequestError('x', 401, '/o', null));
    const { props } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Kreditkarte' }));
    await userEvent.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent('Keine Berechtigung');
    expect(props.onOrderPlaced).not.toHaveBeenCalled();
    expect(submit()).toBeEnabled();
  });

  it('locks the form while submitting', async () => {
    createSaleOrderApi.mockReturnValue(new Promise(() => {}));
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Kreditkarte' }));
    await userEvent.click(submit());
    expect(await screen.findByRole('button', { name: 'Bestellung wird gesendet…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dialog schließen' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Kreditkarte' })).toBeDisabled();
  });

  it('forwards quantity changes and removal', async () => {
    const { props } = setup([makeCartItem({ id: 9, name: 'X', availableQuantity: 5 }, 2)]);
    await userEvent.click(screen.getByRole('button', { name: 'Menge erhöhen' }));
    expect(props.onUpdateQuantity).toHaveBeenCalledWith(9, 3);
    await userEvent.click(screen.getByRole('button', { name: 'Menge verringern' }));
    expect(props.onUpdateQuantity).toHaveBeenCalledWith(9, 1);
    await userEvent.click(screen.getByRole('button', { name: 'X entfernen' }));
    expect(props.onRemove).toHaveBeenCalledWith(9);
  });

  it('closes via the X button', async () => {
    const { props } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Dialog schließen' }));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('clears the error when closed so a reopen starts clean', async () => {
    createSaleOrderApi.mockRejectedValue(new ApiRequestError('x', 500, '/o', null));
    const { props } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Kreditkarte' }));
    await userEvent.click(submit());
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: 'Dialog schließen' }));
    expect(props.onClose).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  describe('simulation mode', () => {
    const simulationProps = {
      isOpen: true,
      onClose: vi.fn(),
      items: [makeCartItem({ id: 1, price: 2 }, 1)],
      onRemove: vi.fn(),
      onUpdateQuantity: vi.fn(),
      onOrderPlaced: vi.fn(),
      simulationSessionId: '4827',
    };

    it('prefills the name from the join page and sends it with the order', async () => {
      addOrderApi.mockResolvedValue({});
      render(<CheckoutDialog {...simulationProps} initialCustomerName="Mia K." />);
      expect(screen.getByLabelText(/Dein Name/)).toHaveValue('Mia K.');
      await userEvent.click(submit());
      await waitFor(() =>
        expect(addOrderApi).toHaveBeenCalledWith(
          '4827',
          expect.objectContaining({ customer_name: 'Mia K.' })
        )
      );
    });

    it('fills the name when it arrives after the dialog was mounted', () => {
      const { rerender } = render(<CheckoutDialog {...simulationProps} />);
      expect(screen.getByLabelText(/Dein Name/)).toHaveValue('');
      rerender(<CheckoutDialog {...simulationProps} initialCustomerName="Jan" />);
      expect(screen.getByLabelText(/Dein Name/)).toHaveValue('Jan');
    });
  });
});
