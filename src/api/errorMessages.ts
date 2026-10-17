import { ApiRequestError } from './requestApi';

export const SESSION_NOT_FOUND_MESSAGE = 'Sitzung nicht gefunden.';
export const SERVER_ERROR_MESSAGE = 'Serverfehler. Bitte später erneut versuchen.';
export const NETWORK_ERROR_MESSAGE = 'Server nicht erreichbar. Bitte Verbindung prüfen.';
export const UNKNOWN_ERROR_MESSAGE = 'Unbekannter Fehler';

/** The backend's `detail` string of an error response, if it sent one. */
export function getResponseDetail(responseBody: unknown): string | null {
  if (typeof responseBody === 'object' && responseBody !== null && 'detail' in responseBody) {
    const { detail } = responseBody as { detail: unknown };
    return typeof detail === 'string' ? detail : null;
  }
  return null;
}

/**
 * Error → German message. `mapStatus` gives the context-specific sentence for an HTTP error
 * (or `null` to fall back to the generic server error); transport failures and unknown errors
 * share one wording across all contexts.
 */
export function toApiErrorMessage(
  error: unknown,
  mapStatus: (error: ApiRequestError, detail: string | null) => string | null
): string {
  if (error instanceof ApiRequestError) {
    return mapStatus(error, getResponseDetail(error.responseBody)) ?? SERVER_ERROR_MESSAGE;
  }
  // TypeError is thrown by fetch for transport-level failures (e.g. network offline).
  if (error instanceof TypeError) return NETWORK_ERROR_MESSAGE;
  return error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE;
}
