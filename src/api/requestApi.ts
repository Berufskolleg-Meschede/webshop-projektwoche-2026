import { API_KEY_STORAGE_KEY, ensureApiKey } from '@/hooks/useApiKeyInit';
import getApiAuthToken from './getApiAuthToken';
import getApiBaseUrl from './getApiBaseUrl';

export class ApiRequestError extends Error {
  status: number;
  path: string;
  responseBody: unknown;

  constructor(message: string, status: number, path: string, responseBody: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.path = path;
    this.responseBody = responseBody;
  }
}

type ApiRequestOptions = RequestInit & {
  withAuth?: boolean;
  /** Overrides the ERP base URL, e.g. for the simulation server. */
  baseUrl?: string;
};

async function parseResponseBody(response: Response): Promise<unknown> {
  const responseText = await response.text();

  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

function isStaleKeyRejection(status: number, responseBody: unknown): boolean {
  if (status === 401) return true;
  if (status !== 404) return false;
  const text = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
  return /key not found/i.test(text ?? '');
}

export default async function requestApi<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { withAuth = true, baseUrl = getApiBaseUrl(), headers, ...requestInit } = options;

  const send = async (retryOnStaleKey: boolean): Promise<T> => {
    const requestHeaders = new Headers(headers ?? {});
    let usedToken: string | null = null;
    let usedStoredKey = false;

    if (withAuth) {
      // Wait for the key on first load; on failure fall back to the env token via getApiAuthToken().
      await ensureApiKey().catch(() => undefined);
      usedToken = getApiAuthToken();
      usedStoredKey = localStorage.getItem(API_KEY_STORAGE_KEY)?.trim() === usedToken;
      requestHeaders.set('Authorization', `Bearer ${usedToken}`);
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...requestInit,
      headers: requestHeaders,
    });

    const responseBody = await parseResponseBody(response);

    if (!response.ok) {
      // Only a stored key is recoverable; the env fallback token cannot be replaced.
      if (
        retryOnStaleKey &&
        withAuth &&
        usedStoredKey &&
        isStaleKeyRejection(response.status, responseBody)
      ) {
        // A concurrent request may already have replaced the key: only drop the one we sent.
        if (localStorage.getItem(API_KEY_STORAGE_KEY)?.trim() === usedToken) {
          localStorage.removeItem(API_KEY_STORAGE_KEY);
        }
        try {
          await ensureApiKey();
          return await send(false);
        } catch (error) {
          if (error instanceof ApiRequestError) throw error;
          // New key unavailable: report the original rejection.
        }
      }

      throw new ApiRequestError(
        `Request failed with ${response.status} for ${path}`,
        response.status,
        path,
        responseBody
      );
    }

    return responseBody as T;
  };

  return send(true);
}
