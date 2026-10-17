import { describe, expect, it } from 'vitest';

import {
  getResponseDetail,
  SERVER_ERROR_MESSAGE,
  toApiErrorMessage,
  UNKNOWN_ERROR_MESSAGE,
} from './errorMessages';
import { ApiRequestError } from './requestApi';

const apiError = (status: number, body: unknown = null) =>
  new ApiRequestError('failed', status, '/x', body);

describe('getResponseDetail', () => {
  it('returns string details only', () => {
    expect(getResponseDetail({ detail: 'Anna' })).toBe('Anna');
    expect(getResponseDetail({ detail: 5 })).toBeNull();
    expect(getResponseDetail(null)).toBeNull();
    expect(getResponseDetail('text')).toBeNull();
  });
});

describe('toApiErrorMessage', () => {
  const map = (error: ApiRequestError, detail: string | null) =>
    error.status === 404 ? `nicht gefunden ${detail ?? ''}` : null;

  it('uses the mapper for HTTP errors and the server error as fallback', () => {
    expect(toApiErrorMessage(apiError(404, { detail: 'x' }), map)).toBe('nicht gefunden x');
    expect(toApiErrorMessage(apiError(500), map)).toBe(SERVER_ERROR_MESSAGE);
  });

  it('maps transport and unknown errors', () => {
    expect(toApiErrorMessage(new TypeError('Failed to fetch'), map)).toBe(
      'Server nicht erreichbar. Bitte Verbindung prüfen.'
    );
    expect(toApiErrorMessage(new Error('boom'), map)).toBe('boom');
    expect(toApiErrorMessage('x', map)).toBe(UNKNOWN_ERROR_MESSAGE);
    expect(UNKNOWN_ERROR_MESSAGE).toBe('Unbekannter Fehler');
  });
});
