import { useEffect } from 'react';
import createApiKeyApi from '@/api/apikey/createApiKeyApi';

export const API_KEY_STORAGE_KEY = 'api_auth_token';

// Geteiltes Promise: verhindert Doppel-Request (React StrictMode) und lässt API-Requests auf den Key warten.
let apiKeyPromise: Promise<string> | null = null;

export function ensureApiKey(): Promise<string> {
  const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
  if (storedKey) return Promise.resolve(storedKey);

  if (!apiKeyPromise) {
    apiKeyPromise = createApiKeyApi()
      .then((apikey) => {
        localStorage.setItem(API_KEY_STORAGE_KEY, apikey);
        return apikey;
      })
      .finally(() => {
        apiKeyPromise = null;
      });
  }
  return apiKeyPromise;
}

/** `enabled = false` skips the ERP key request (simulation mode talks to the simulation server only). */
export default function useApiKeyInit(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    ensureApiKey().catch((err) => {
      console.error('API-Key konnte nicht abgerufen werden:', err);
    });
  }, [enabled]);
}
