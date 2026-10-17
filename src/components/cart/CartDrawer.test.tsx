import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { makeCartItem } from '@/test/fixtures';
import type { CartItem } from '@/types/cart';

import CartDrawer from './CartDrawer';

function setup(items: CartItem[] = [], isOpen = true) {
  const props = {
    isOpen,
    onClose: vi.fn(),
    items,
    cartCount: items.reduce((sum, item) => sum + item.quantity, 0),
    onRemove: vi.fn(),
    onUpdateQuantity: vi.fn(),
    onClearCart: vi.fn(),
    onOpenCheckout: vi.fn(),
  };
  render(<CartDrawer {...props} />);
  return props;
}

describe('CartDrawer', () => {
  it('shows an empty state and disables checkout', () => {
    setup();
    expect(screen.getByText('Ihr Warenkorb ist noch leer.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zur Kasse' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Warenkorb leeren' })).not.toBeInTheDocument();
  });

  it('lets the empty state close the drawer to keep shopping', async () => {
    const props = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Jetzt Produkte ansehen' }));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it('lists items with price and sums the total', () => {
    setup([
      makeCartItem({ id: 1, name: 'A', price: 2.5 }, 2),
      makeCartItem({ id: 2, name: 'B', price: 1 }, 3),
    ]);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('€8.00')).toBeInTheDocument();
  });

  it('excludes unpriced items from the total and says so', () => {
    setup([
      makeCartItem({ id: 1, price: 2 }, 1),
      makeCartItem({ id: 2, name: 'Anfrage', price: null }, 1),
    ]);
    expect(screen.getByText('€2.00', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Preis auf Anfrage')).toBeInTheDocument();
    expect(screen.getByText('* Artikel auf Anfrage nicht enthalten')).toBeInTheDocument();
  });

  it('changes quantities', async () => {
    const props = setup([makeCartItem({ id: 7, availableQuantity: 5 }, 2)]);
    await userEvent.click(screen.getByRole('button', { name: 'Menge erhöhen' }));
    expect(props.onUpdateQuantity).toHaveBeenLastCalledWith(7, 3);
    await userEvent.click(screen.getByRole('button', { name: 'Menge verringern' }));
    expect(props.onUpdateQuantity).toHaveBeenLastCalledWith(7, 1);
  });

  it('disables increase at the stock limit', () => {
    setup([makeCartItem({ availableQuantity: 2 }, 2)]);
    expect(screen.getByRole('button', { name: 'Menge erhöhen' })).toBeDisabled();
  });

  it('removes an item and clears the cart', async () => {
    const props = setup([makeCartItem({ id: 3, name: 'Deckel' }, 1)]);
    await userEvent.click(screen.getByRole('button', { name: 'Deckel entfernen' }));
    expect(props.onRemove).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Warenkorb leeren' }));
    expect(props.onClearCart).toHaveBeenCalledOnce();
  });

  it('closes the drawer and opens the checkout', async () => {
    const props = setup([makeCartItem()]);
    await userEvent.click(screen.getByRole('button', { name: 'Zur Kasse' }));
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(props.onOpenCheckout).toHaveBeenCalledOnce();
  });

  it('closes via the close button', async () => {
    const props = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Warenkorb schließen' }));
    expect(props.onClose).toHaveBeenCalledOnce();
  });
});
