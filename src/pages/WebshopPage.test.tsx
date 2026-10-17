import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { makeArticle, makeCartItem } from '@/test/fixtures';

import WebshopPage from './WebshopPage';

const useWebshopProducts = vi.fn();
vi.mock('@/hooks/useWebshopProducts', () => ({
  useWebshopProducts: (refreshKey: number) => useWebshopProducts(refreshKey),
}));

describe('WebshopPage', () => {
  it('shows the loading state', () => {
    useWebshopProducts.mockReturnValue({ articles: [], status: 'loading', errorMessage: '' });
    render(<WebshopPage cartItems={[]} onAddToCart={vi.fn()} refreshKey={0} />);
    expect(screen.getByText('Produkte werden geladen…')).toBeInTheDocument();
  });

  it('shows the error state', () => {
    useWebshopProducts.mockReturnValue({ articles: [], status: 'error', errorMessage: 'kaputt' });
    render(<WebshopPage cartItems={[]} onAddToCart={vi.fn()} refreshKey={0} />);
    expect(screen.getByText('Fehler beim Laden: kaputt')).toBeInTheDocument();
  });

  it('shows the empty state', () => {
    useWebshopProducts.mockReturnValue({ articles: [], status: 'success', errorMessage: '' });
    render(<WebshopPage cartItems={[]} onAddToCart={vi.fn()} refreshKey={0} />);
    expect(screen.getByText('Keine Produkte verfügbar.')).toBeInTheDocument();
  });

  it('renders a card per article and passes the refresh key', async () => {
    const articles = [makeArticle({ id: 1, name: 'A' }), makeArticle({ id: 2, name: 'B' })];
    useWebshopProducts.mockReturnValue({ articles, status: 'success', errorMessage: '' });
    const onAddToCart = vi.fn();
    render(<WebshopPage cartItems={[]} onAddToCart={onAddToCart} refreshKey={4} />);
    expect(useWebshopProducts).toHaveBeenLastCalledWith(4);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);
    await userEvent.click(screen.getAllByRole('button', { name: /Warenkorb/ })[1]);
    expect(onAddToCart).toHaveBeenCalledWith(articles[1]);
  });

  it('limits cards by the quantity already in the cart', () => {
    const article = makeArticle({ id: 1, availableQuantity: 2 });
    useWebshopProducts.mockReturnValue({
      articles: [article],
      status: 'success',
      errorMessage: '',
    });
    render(
      <WebshopPage
        cartItems={[makeCartItem({ id: 1, availableQuantity: 2 }, 2)]}
        onAddToCart={vi.fn()}
        refreshKey={0}
      />
    );
    expect(screen.getByRole('button', { name: 'Max. Menge erreicht' })).toBeDisabled();
  });
});
