import { Menu, Moon, ShoppingCart, Sun, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { BkmLogo } from '@/components/logo';
import type { Theme } from '@/hooks/useTheme';

export type Page = 'home' | 'webshop' | 'simulation';

const BOUNCE_DURATION_MS = 600;

type Props = {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  cartCount: number;
  onOpenCart: () => void;
  theme: Theme;
  onToggleTheme: () => void;
};

const navLinks: { label: string; page: Page }[] = [
  { label: 'Home', page: 'home' },
  { label: 'Webshop', page: 'webshop' },
  { label: 'Simulation', page: 'simulation' },
];

function Navbar({ currentPage, onNavigate, cartCount, onOpenCart, theme, onToggleTheme }: Props) {
  const [isBouncing, setIsBouncing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const previousCartCountRef = useRef(cartCount);
  const isCartVisible = currentPage === 'webshop' || cartCount > 0;

  useEffect(() => {
    const hasIncreased = cartCount > previousCartCountRef.current;
    previousCartCountRef.current = cartCount;
    if (!hasIncreased) return;

    setIsBouncing(true);
    const timeoutId = window.setTimeout(() => setIsBouncing(false), BOUNCE_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [cartCount]);

  return (
    <header className="sticky top-0 z-20 w-full border-b bg-header">
      <div className="mx-auto flex w-full max-w-[90rem] items-center justify-between px-lg py-sm md:px-xxl md:py-md">
        <div className="flex items-center gap-md">
          <BkmLogo className="h-9 aspect-[2760/795] md:h-12" />
        </div>

        <nav className="hidden items-center gap-10 text-sm font-medium text-ink-muted md:flex">
          {navLinks.map(({ label, page }) => {
            const isActive = currentPage === page;
            return (
              <button
                className={`group relative transition-colors duration-200 hover:text-ink ${
                  isActive ? 'text-ink' : ''
                }`}
                key={label}
                onClick={() => onNavigate(page)}
                type="button"
              >
                {label}
                <span
                  className={`absolute -bottom-1 left-0 h-0.5 bg-ink transition-all duration-300 ${
                    isActive ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}
                />
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-sm">
          <button
            aria-controls="mobile-menu"
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? 'Menü schließen' : 'Menü öffnen'}
            className="rounded-full border bg-card p-sm text-ink shadow-sticker-sm transition-shadow hover:shadow-sticker active:shadow-sticker-press md:hidden"
            onClick={() => setIsMenuOpen((open) => !open)}
            type="button"
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <button
            aria-label={theme === 'dark' ? 'Light Mode aktivieren' : 'Dark Mode aktivieren'}
            className="rounded-full border bg-card p-sm text-ink shadow-sticker-sm transition-shadow hover:shadow-sticker active:shadow-sticker-press"
            onClick={onToggleTheme}
            type="button"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className={!isCartVisible ? 'invisible' : undefined}>
            <button
              aria-label={`Warenkorb öffnen${cartCount > 0 ? `, ${cartCount} Artikel` : ''}`}
              className={`relative rounded-full border bg-card p-sm text-ink shadow-sticker-sm transition-all hover:shadow-sticker active:shadow-sticker-press ${
                isBouncing ? 'scale-110' : ''
              }`}
              onClick={onOpenCart}
              tabIndex={!isCartVisible ? -1 : undefined}
              type="button"
            >
              <ShoppingCart size={20} />
              {cartCount > 0 && (
                <span
                  className={`absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border bg-primary px-1 text-[10px] font-bold text-on-primary shadow-sticker-sm ${
                    isBouncing ? 'animate-pulse' : ''
                  }`}
                >
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
      {isMenuOpen && (
        <nav
          aria-label="Hauptmenü"
          className="flex flex-col border-t bg-header px-lg py-sm md:hidden"
          id="mobile-menu"
        >
          {navLinks.map(({ label, page }) => (
            <button
              aria-current={currentPage === page ? 'page' : undefined}
              className={`py-md text-left text-base font-semibold ${
                currentPage === page ? 'text-ink' : 'text-ink-muted'
              }`}
              key={label}
              onClick={() => {
                setIsMenuOpen(false);
                onNavigate(page);
              }}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}

export default Navbar;
