import getApiBaseUrl from '../getApiBaseUrl';

type CreateApiKeyResponse = {
  apikey: string;
};

export default async function createApiKeyApi(): Promise<string> {
  const response = await fetch(`${getApiBaseUrl()}/apikey/create`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Fehler beim Abrufen des API-Keys: ${response.status}`);
  }

  const data: CreateApiKeyResponse = await response.json();
  return data.apikey;
}
