import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, vi } from 'vitest';

import Navbar from './Navbar';

function setup(overrides: Partial<React.ComponentProps<typeof Navbar>> = {}) {
  const props = {
    currentPage: 'webshop' as const,
    onNavigate: vi.fn(),
    cartCount: 0,
    onOpenCart: vi.fn(),
    theme: 'light' as const,
    onToggleTheme: vi.fn(),
    ...overrides,
  };
  render(<Navbar {...props} />);
  return props;
}

describe('Navbar', () => {
  it.each([
    ['Home', 'home'],
    ['Webshop', 'webshop'],
    ['Simulation', 'simulation'],
  ])('navigates via the "%s" link', async (label, page) => {
    const props = setup();
    await userEvent.click(screen.getByRole('button', { name: label }));
    expect(props.onNavigate).toHaveBeenCalledWith(page);
  });

  it('opens the cart and shows the item count', async () => {
    const props = setup({ cartCount: 3 });
    await userEvent.click(screen.getByRole('button', { name: 'Warenkorb öffnen, 3 Artikel' }));
    expect(props.onOpenCart).toHaveBeenCalledOnce();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('hides the count badge for an empty cart', () => {
    setup({ cartCount: 0 });
    expect(screen.getByRole('button', { name: 'Warenkorb öffnen' })).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows 99+ for very large carts', () => {
    setup({ cartCount: 150 });
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('makes the cart button unreachable outside the webshop', () => {
    setup({ currentPage: 'home' });
    expect(screen.getByRole('button', { name: 'Warenkorb öffnen', hidden: true })).toHaveAttribute(
      'tabindex',
      '-1'
    );
  });

  it('keeps the cart button reachable outside the webshop while the cart has items', () => {
    setup({ currentPage: 'home', cartCount: 2 });
    expect(screen.getByRole('button', { name: 'Warenkorb öffnen, 2 Artikel' })).not.toHaveAttribute(
      'tabindex'
    );
  });

  describe('cart bounce', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    function renderNavbar(cartCount: number) {
      const props = {
        currentPage: 'webshop' as const,
        onNavigate: vi.fn(),
        cartCount,
        onOpenCart: vi.fn(),
        theme: 'light' as const,
        onToggleTheme: vi.fn(),
      };
      const view = render(<Navbar {...props} />);
      return (nextCount: number) => view.rerender(<Navbar {...props} cartCount={nextCount} />);
    }

    it('bounces for 600 ms when the cart count increases', () => {
      const update = renderNavbar(1);
      update(2);
      const button = screen.getByRole('button', { name: 'Warenkorb öffnen, 2 Artikel' });
      expect(button).toHaveClass('scale-110');

      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(button).not.toHaveClass('scale-110');
    });

    it('does not bounce when the count decreases or stays the same', () => {
      const update = renderNavbar(3);
      update(2);
      expect(screen.getByRole('button', { name: 'Warenkorb öffnen, 2 Artikel' })).not.toHaveClass(
        'scale-110'
      );
      update(2);
      expect(screen.getByRole('button', { name: 'Warenkorb öffnen, 2 Artikel' })).not.toHaveClass(
        'scale-110'
      );
    });
  });

  it.each([
    ['dark', 'Light Mode aktivieren'],
    ['light', 'Dark Mode aktivieren'],
  ] as const)('labels and triggers the theme toggle while %s is active', async (theme, label) => {
    const props = setup({ theme });
    await userEvent.click(screen.getByRole('button', { name: label }));
    expect(props.onToggleTheme).toHaveBeenCalledOnce();
  });

  describe('mobile menu (BUG-02)', () => {
    it('is closed by default and toggles via the hamburger button', async () => {
      setup();
      expect(screen.queryByRole('navigation', { name: 'Hauptmenü' })).not.toBeInTheDocument();
      const toggle = screen.getByRole('button', { name: 'Menü öffnen' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');

      await userEvent.click(toggle);
      expect(screen.getByRole('navigation', { name: 'Hauptmenü' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Menü schließen' })).toHaveAttribute(
        'aria-expanded',
        'true'
      );

      await userEvent.click(screen.getByRole('button', { name: 'Menü schließen' }));
      expect(screen.queryByRole('navigation', { name: 'Hauptmenü' })).not.toBeInTheDocument();
    });

    it('lists all pages, marks the current one, navigates and closes', async () => {
      const props = setup({ currentPage: 'simulation' });
      await userEvent.click(screen.getByRole('button', { name: 'Menü öffnen' }));
      const menu = within(screen.getByRole('navigation', { name: 'Hauptmenü' }));
      expect(menu.getAllByRole('button').map((b) => b.textContent)).toEqual([
        'Home',
        'Webshop',
        'Simulation',
      ]);
      expect(menu.getByRole('button', { name: 'Simulation' })).toHaveAttribute(
        'aria-current',
        'page'
      );

      await userEvent.click(menu.getByRole('button', { name: 'Webshop' }));
      expect(props.onNavigate).toHaveBeenCalledWith('webshop');
      expect(screen.queryByRole('navigation', { name: 'Hauptmenü' })).not.toBeInTheDocument();
    });
  });
});
