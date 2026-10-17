import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, vi } from 'vitest';

import { makeArticle } from '@/test/fixtures';

import ProductCard from './ProductCard';

describe('ProductCard', () => {
  it('shows name, description, price and stock', () => {
    render(<ProductCard article={makeArticle()} onAddToCart={vi.fn()} quantityInCart={0} />);
    expect(screen.getByRole('heading', { name: 'Gehäuse rot' })).toBeInTheDocument();
    expect(screen.getByText('Rotes Gehäuse')).toBeInTheDocument();
    expect(screen.getByText('€2.50')).toBeInTheDocument();
    expect(screen.getByText('Lager: 5')).toBeInTheDocument();
  });

  it('handles a missing price and description', () => {
    render(
      <ProductCard
        article={makeArticle({ price: null, description: '' })}
        onAddToCart={vi.fn()}
        quantityInCart={0}
      />
    );
    expect(screen.getByText('Preis auf Anfrage')).toBeInTheDocument();
  });

  it('shows neither price nor stock text in the simulation (BUG-10)', () => {
    render(
      <ProductCard
        article={makeArticle({ price: null })}
        isSimulation
        onAddToCart={vi.fn()}
        quantityInCart={0}
      />
    );
    expect(screen.queryByText('Preis auf Anfrage')).not.toBeInTheDocument();
    expect(screen.queryByText(/Lager:/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Warenkorb' })).toBeEnabled();
  });

  it('shows the default product image in the simulation when the article has none', () => {
    render(
      <ProductCard
        article={makeArticle({ imageUrl: null })}
        isSimulation
        onAddToCart={vi.fn()}
        quantityInCart={0}
      />
    );
    const img = screen.getByRole('img', { name: 'Salz- und Pfefferstreuer' });
    expect(img).toHaveAttribute('src', expect.stringContaining('default-product'));
  });

  it('does not use the default product image outside the simulation', () => {
    render(
      <ProductCard
        article={makeArticle({ imageUrl: null })}
        onAddToCart={vi.fn()}
        quantityInCart={0}
      />
    );
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      expect.not.stringContaining('default-product')
    );
    expect(screen.queryByRole('img', { name: 'Salz- und Pfefferstreuer' })).not.toBeInTheDocument();
  });

  it.each([
    ['outside the simulation', false],
    ['in the simulation', true],
  ])('uses the article image when present %s', (_case, isSimulation) => {
    render(
      <ProductCard
        article={makeArticle({ imageUrl: '/a.png' })}
        isSimulation={isSimulation}
        onAddToCart={vi.fn()}
        quantityInCart={0}
      />
    );
    expect(screen.getByRole('img')).toHaveAttribute('src', '/a.png');
  });

  it('adds the article to the cart', async () => {
    const onAddToCart = vi.fn();
    const article = makeArticle();
    render(<ProductCard article={article} onAddToCart={onAddToCart} quantityInCart={0} />);
    await userEvent.click(screen.getByRole('button', { name: /Warenkorb/ }));
    expect(onAddToCart).toHaveBeenCalledWith(article);
  });

  it('is disabled when out of stock', () => {
    render(
      <ProductCard
        article={makeArticle({ availableQuantity: 0 })}
        onAddToCart={vi.fn()}
        quantityInCart={0}
      />
    );
    expect(screen.getByRole('button', { name: 'Nicht verfügbar' })).toBeDisabled();
  });

  it('is disabled once the cart holds all available stock', () => {
    render(
      <ProductCard
        article={makeArticle({ availableQuantity: 2 })}
        onAddToCart={vi.fn()}
        quantityInCart={2}
      />
    );
    expect(screen.getByRole('button', { name: 'Max. Menge erreicht' })).toBeDisabled();
  });

  describe('added confirmation', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('confirms the add and reverts after 1.5 seconds', () => {
      render(<ProductCard article={makeArticle()} onAddToCart={vi.fn()} quantityInCart={0} />);
      fireEvent.click(screen.getByRole('button', { name: /Warenkorb/ }));
      expect(screen.getByRole('button', { name: 'Hinzugefügt!' })).toHaveClass('bg-accent-green');

      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.getByRole('button', { name: 'Warenkorb' })).toHaveClass('bg-primary');
    });

    it('also confirms the add that exhausts the stock, then shows the limit', () => {
      const article = makeArticle({ availableQuantity: 1 });
      const { rerender } = render(
        <ProductCard article={article} onAddToCart={vi.fn()} quantityInCart={0} />
      );
      fireEvent.click(screen.getByRole('button', { name: /Warenkorb/ }));
      rerender(<ProductCard article={article} onAddToCart={vi.fn()} quantityInCart={1} />);

      const confirmed = screen.getByRole('button', { name: 'Hinzugefügt!' });
      expect(confirmed).toBeDisabled();
      expect(confirmed).toHaveClass('bg-accent-green');
      expect(confirmed).not.toHaveClass('disabled:opacity-40');

      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.getByRole('button', { name: 'Max. Menge erreicht' })).toBeDisabled();
    });

    it('restarts the timer on repeated clicks and clears it on unmount', () => {
      const { unmount } = render(
        <ProductCard article={makeArticle()} onAddToCart={vi.fn()} quantityInCart={0} />
      );
      fireEvent.click(screen.getByRole('button', { name: /Warenkorb/ }));
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      fireEvent.click(screen.getByRole('button', { name: 'Hinzugefügt!' }));
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByRole('button', { name: 'Hinzugefügt!' })).toBeInTheDocument();

      unmount();
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
