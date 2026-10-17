const DEFAULT_API_BASE_URL = 'http://localhost:8000';

export default function getApiBaseUrl(): string {
  const baseUrl =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || DEFAULT_API_BASE_URL;
  return baseUrl.replace(/\/+$/, '');
}
