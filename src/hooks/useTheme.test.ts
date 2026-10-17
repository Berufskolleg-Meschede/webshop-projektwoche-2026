import { act, renderHook } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

import { useTheme } from './useTheme';

function mockSystemDark(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches }));
}

describe('useTheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.documentElement.className = '';
  });

  it('follows the OS preference without a stored choice', () => {
    mockSystemDark(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).not.toHaveClass('light');
  });

  it('prefers the stored theme over the OS', () => {
    mockSystemDark(true);
    localStorage.setItem('bkm-webshop-theme', 'light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement).toHaveClass('light');
  });

  it('toggles and persists the choice', () => {
    mockSystemDark(false);
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem('bkm-webshop-theme')).toBe('dark');
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('still works when localStorage throws', () => {
    mockSystemDark(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('dark');
  });
});
