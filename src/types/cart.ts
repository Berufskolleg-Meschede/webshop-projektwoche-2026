import type { Article } from '@/api/articles/listArticlesApi';

export type CartItem = {
  article: Article;
  quantity: number;
};
