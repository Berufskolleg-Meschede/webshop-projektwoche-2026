import { act, renderHook } from '@testing-library/react';

import { makeArticle } from '@/test/fixtures';

import { useCart } from './useCart';

describe('useCart', () => {
  it('adds an article and counts it', () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(makeArticle({ availableQuantity: 2 })));
    expect(result.current.cartItems).toHaveLength(1);
    expect(result.current.cartCount).toBe(1);
  });

  it('caps the quantity at the available stock', () => {
    const { result } = renderHook(() => useCart());
    const article = makeArticle({ availableQuantity: 2 });
    act(() => {
      result.current.addToCart(article);
      result.current.addToCart(article);
      result.current.addToCart(article);
    });
    expect(result.current.cartCount).toBe(2);

    act(() => result.current.updateQuantity(article.id, 99));
    expect(result.current.cartCount).toBe(2);
  });

  it('does not add out-of-stock articles', () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(makeArticle({ availableQuantity: 0 })));
    expect(result.current.cartItems).toHaveLength(0);
  });

  it('removes a line when the quantity drops to zero', () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(makeArticle()));
    act(() => result.current.updateQuantity(1, 0));
    expect(result.current.cartItems).toHaveLength(0);
  });

  it('clears the cart', () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.addToCart(makeArticle()));
    act(() => result.current.clearCart());
    expect(result.current.cartCount).toBe(0);
  });

  it('removes a single article', () => {
    const { result } = renderHook(() => useCart());
    act(() => {
      result.current.addToCart(makeArticle({ id: 1 }));
      result.current.addToCart(makeArticle({ id: 2 }));
    });
    act(() => result.current.removeFromCart(1));
    expect(result.current.cartItems.map((item) => item.article.id)).toEqual([2]);
  });

  it('updates the quantity of one line only', () => {
    const { result } = renderHook(() => useCart());
    act(() => {
      result.current.addToCart(makeArticle({ id: 1 }));
      result.current.addToCart(makeArticle({ id: 2 }));
    });
    act(() => result.current.updateQuantity(2, 3));
    expect(result.current.cartItems.map((item) => item.quantity)).toEqual([1, 3]);
    expect(result.current.cartCount).toBe(4);
  });

  it('toggles cart and checkout visibility', () => {
    const { result } = renderHook(() => useCart());
    act(() => result.current.openCart());
    expect(result.current.isCartOpen).toBe(true);
    act(() => result.current.closeCart());
    expect(result.current.isCartOpen).toBe(false);
    act(() => result.current.openCheckout());
    expect(result.current.isCheckoutOpen).toBe(true);
    act(() => result.current.closeCheckout());
    expect(result.current.isCheckoutOpen).toBe(false);
  });
});
