import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { makeArticle } from '@/test/fixtures';
import { SIMULATION_CATALOG } from '@/types/simulationCatalog';

import WebshopPage from './WebshopPage';

const useWebshopProducts = vi.fn();
vi.mock('@/hooks/useWebshopProducts', () => ({
  useWebshopProducts: (refreshKey: number) => useWebshopProducts(refreshKey),
}));

describe('WebshopPage in simulation mode', () => {
  it('shows the banner and the static six-variant catalogue without any ERP call', async () => {
    const onAddToCart = vi.fn();
    render(
      <WebshopPage
        cartItems={[]}
        onAddToCart={onAddToCart}
        refreshKey={0}
        simulationSessionId="4827"
      />
    );
    expect(useWebshopProducts).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Simulations-Modus aktiv');
    expect(screen.getByText('Sitzung 4827')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(
      SIMULATION_CATALOG.map((article) => article.name)
    );
    expect(screen.getByText('Roter Salzstreuer')).toBeInTheDocument();
    expect(screen.queryByText('Nicht verfügbar')).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: /Warenkorb/ })[2]);
    expect(onAddToCart).toHaveBeenCalledWith(SIMULATION_CATALOG[2]);
  });

  it('shows neither banner nor catalogue outside the simulation and loads from the ERP', () => {
    const articles = [makeArticle({ id: 77, name: 'ERP-Artikel' })];
    useWebshopProducts.mockReturnValue({ articles, status: 'success', errorMessage: '' });
    render(<WebshopPage cartItems={[]} onAddToCart={vi.fn()} refreshKey={0} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('ERP-Artikel')).toBeInTheDocument();
    expect(screen.queryByText('Roter Salzstreuer')).not.toBeInTheDocument();
  });
});
