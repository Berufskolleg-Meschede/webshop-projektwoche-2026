import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';

import type { Article } from '@/api/articles/listArticlesApi';
import { makeArticle } from '@/test/fixtures';

import { useWebshopProducts } from './useWebshopProducts';

// A plain function (instead of vi.fn) so rejected promises are only observed by the hook.
type Impl = (signal?: AbortSignal) => Promise<Article[]>;
let impl: Impl = () => Promise.resolve([]);
vi.mock('@/api/articles/listArticlesApi', () => ({
  default: (signal?: AbortSignal) => impl(signal),
}));

describe('useWebshopProducts', () => {
  beforeEach(() => {
    impl = () => Promise.resolve([]);
  });

  it('starts loading and then exposes the articles', async () => {
    impl = () => Promise.resolve([makeArticle()]);
    const { result } = renderHook(() => useWebshopProducts());
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.articles).toHaveLength(1);
  });

  it('exposes the error message on failure', async () => {
    impl = () => Promise.reject(new Error('kaputt'));
    const { result } = renderHook(() => useWebshopProducts());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toBe('kaputt');
  });

  it('uses a generic message for non-Error rejections', async () => {
    impl = () => Promise.reject('x');
    const { result } = renderHook(() => useWebshopProducts());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toBe('Unbekannter Fehler');
  });

  it('ignores aborted requests', async () => {
    impl = () => Promise.reject(new DOMException('aborted', 'AbortError'));
    const { result } = renderHook(() => useWebshopProducts());
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(result.current.status).toBe('loading');
  });

  it('refetches when the refresh key changes and aborts the old request', async () => {
    const signals: AbortSignal[] = [];
    impl = (signal) => {
      if (signal) signals.push(signal);
      return Promise.resolve([]);
    };
    const { rerender } = renderHook(({ key }) => useWebshopProducts(key), {
      initialProps: { key: 0 },
    });
    await waitFor(() => expect(signals).toHaveLength(1));
    rerender({ key: 1 });
    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });
});
