import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'bkm-webshop-theme';

/** Stored choice wins; otherwise follow the operating system preference. */
function getInitialTheme(): Theme {
  try {
    const storedTheme = localStorage.getItem(STORAGE_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;
  } catch {
    // localStorage can be unavailable (e.g. blocked by the browser) — fall back to the OS setting.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Tokens in src/styles/tokens.css switch on the `dark` / `light` class on <html>.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => {
      const nextTheme: Theme = currentTheme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, nextTheme);
      } catch {
        // Persisting is best effort; the toggle still works for this session.
      }
      return nextTheme;
    });
  }, []);

  return { theme, toggleTheme };
}
