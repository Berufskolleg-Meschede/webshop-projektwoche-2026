import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';

import { ApiRequestError } from '@/api/requestApi';
import { makeSession } from '@/test/fixtures';
import { addOrderApi, createSaleOrderApi } from '@/test/mockApis';
import { SIMULATION_CATALOG } from '@/types/simulationCatalog';

import CartDrawer from './CartDrawer';
import CheckoutDialog from './CheckoutDialog';

vi.mock('@/api/saleOrders/createSaleOrderApi', async () =>
  (await import('@/test/mockApis')).saleOrderApiModule()
);

vi.mock('@/api/simulation/sessionApi', async () =>
  (await import('@/test/mockApis')).sessionApiModule()
);

const items = [{ article: SIMULATION_CATALOG[0], quantity: 2 }];

function setup() {
  const onOrderPlaced = vi.fn();
  render(
    <CheckoutDialog
      isOpen
      items={items}
      onClose={vi.fn()}
      onOrderPlaced={onOrderPlaced}
      onRemove={vi.fn()}
      onUpdateQuantity={vi.fn()}
      simulationSessionId="4827"
    />
  );
  return { onOrderPlaced };
}

describe('CheckoutDialog in simulation mode', () => {
  beforeEach(() => {
    createSaleOrderApi.mockReset();
    addOrderApi.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('needs no payment method, shows the school hint and sends the name', async () => {
    addOrderApi.mockResolvedValue(makeSession());
    const { onOrderPlaced } = setup();
    expect(screen.queryByRole('button', { name: 'Kreditkarte' })).not.toBeInTheDocument();
    expect(screen.getByText(/Schul-Simulation:/)).toBeInTheDocument();
    expect(screen.queryByText('Gesamtbetrag')).not.toBeInTheDocument();
    expect(screen.getByText('Stückzahl')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Dein Name/), 'Mia');
    await userEvent.click(screen.getByRole('button', { name: 'Bestellung Aufgeben' }));

    expect(addOrderApi).toHaveBeenCalledWith('4827', {
      customer_name: 'Mia',
      items: [{ variant: 'S-RT', quantity: 2 }],
    });
    expect(createSaleOrderApi).not.toHaveBeenCalled();
    expect(await screen.findByText('Vielen Dank für Ihre Bestellung!')).toBeInTheDocument();
    expect(onOrderPlaced).toHaveBeenCalledOnce();
  });

  it('shows the closed-order message when the simulation already runs', async () => {
    addOrderApi.mockRejectedValue(new ApiRequestError('x', 409, '/orders/add', { detail: 'x' }));
    const { onOrderPlaced } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Bestellung Aufgeben' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Die Tagesbestellung ist bereits geschlossen – die Simulation läuft.'
    );
    expect(onOrderPlaced).not.toHaveBeenCalled();
  });
});

describe('CartDrawer in simulation mode', () => {
  it('shows the piece count instead of a price', () => {
    render(
      <CartDrawer
        cartCount={2}
        isOpen
        isSimulation
        items={items}
        onClearCart={vi.fn()}
        onClose={vi.fn()}
        onOpenCheckout={vi.fn()}
        onRemove={vi.fn()}
        onUpdateQuantity={vi.fn()}
      />
    );
    const drawer = screen.getByRole('complementary', { name: 'Warenkorb' });
    expect(within(drawer).getByText('Stückzahl')).toBeInTheDocument();
    expect(within(drawer).queryByText('Preis')).not.toBeInTheDocument();
    expect(within(drawer).queryByText('* Artikel auf Anfrage nicht enthalten')).toBeNull();
  });
});
