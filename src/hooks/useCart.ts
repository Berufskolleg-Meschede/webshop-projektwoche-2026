import { useState } from 'react';

import type { Article } from '@/api/articles/listArticlesApi';
import type { CartItem } from '@/types/cart';

type CartState = {
  cartItems: CartItem[];
  isCartOpen: boolean;
  isCheckoutOpen: boolean;
  cartCount: number;
  addToCart: (article: Article) => void;
  removeFromCart: (articleId: number) => void;
  updateQuantity: (articleId: number, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  openCheckout: () => void;
  closeCheckout: () => void;
};

/** Upper bound for a cart line — orders are hard-capped at the currently available stock. */
function getMaxQuantity(article: Article): number {
  return article.availableQuantity;
}

export function useCart(): CartState {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  function addToCart(article: Article) {
    setCartItems((previousItems) => {
      const existingItem = previousItems.find((cartItem) => cartItem.article.id === article.id);
      if (!existingItem) {
        if (getMaxQuantity(article) < 1) return previousItems;
        return [...previousItems, { article, quantity: 1 }];
      }
      if (existingItem.quantity >= getMaxQuantity(article)) return previousItems;
      return previousItems.map((cartItem) =>
        cartItem.article.id === article.id
          ? { ...existingItem, quantity: existingItem.quantity + 1 }
          : cartItem
      );
    });
  }

  function removeFromCart(articleId: number) {
    setCartItems((previousItems) =>
      previousItems.filter((cartItem) => cartItem.article.id !== articleId)
    );
  }

  function updateQuantity(articleId: number, quantity: number) {
    if (quantity <= 0) {
      removeFromCart(articleId);
      return;
    }
    setCartItems((previousItems) =>
      previousItems.map((cartItem) =>
        cartItem.article.id === articleId
          ? { ...cartItem, quantity: Math.min(quantity, getMaxQuantity(cartItem.article)) }
          : cartItem
      )
    );
  }

  function clearCart() {
    setCartItems([]);
  }

  function openCart() {
    setIsCartOpen(true);
  }

  function closeCart() {
    setIsCartOpen(false);
  }

  function openCheckout() {
    setIsCheckoutOpen(true);
  }

  function closeCheckout() {
    setIsCheckoutOpen(false);
  }

  const cartCount = cartItems.reduce(
    (totalQuantity, cartItem) => totalQuantity + cartItem.quantity,
    0
  );

  return {
    cartItems,
    isCartOpen,
    isCheckoutOpen,
    cartCount,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    openCart,
    closeCart,
    openCheckout,
    closeCheckout,
  };
}
