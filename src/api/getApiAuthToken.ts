import { API_KEY_STORAGE_KEY } from '@/hooks/useApiKeyInit';

const DEFAULT_DEV_API_AUTH_TOKEN = '';

export default function getApiAuthToken(): string {
  const storedToken = localStorage.getItem(API_KEY_STORAGE_KEY);
  if (storedToken && storedToken.trim().length > 0) {
    return storedToken.trim();
  }

  const envToken = import.meta.env.VITE_API_AUTH_TOKEN;
  if (typeof envToken === 'string' && envToken.trim().length > 0) {
    return envToken.trim();
  }

  return DEFAULT_DEV_API_AUTH_TOKEN;
}
