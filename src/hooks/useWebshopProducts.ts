import { useEffect, useState } from 'react';

import listArticlesApi from '@/api/articles/listArticlesApi';
import type { Article } from '@/api/articles/listArticlesApi';

type FetchStatus = 'loading' | 'error' | 'success';

type WebshopProductsState = {
  articles: Article[];
  status: FetchStatus;
  errorMessage: string;
};

/**
 * Loads the sellable articles including their available stock.
 * Changing `refreshKey` triggers a refetch (e.g. after an order reserved stock).
 */
export function useWebshopProducts(refreshKey = 0): WebshopProductsState {
  const [articles, setArticles] = useState<Article[]>([]);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const controller = new AbortController();

    async function fetchProducts() {
      try {
        const articleData = await listArticlesApi(controller.signal);
        setArticles(articleData);
        setStatus('success');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setErrorMessage(error instanceof Error ? error.message : 'Unbekannter Fehler');
        setStatus('error');
      }
    }

    fetchProducts();

    return () => controller.abort();
  }, [refreshKey]);

  return { articles, status, errorMessage };
}
