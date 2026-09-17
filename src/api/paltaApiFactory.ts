import type { AuthPort } from '../ports/authPort.js';
import {
  BusinessOperatingRulesApiClient,
} from './businessOperatingRulesApiClient.js';
import {
  PaltaApiClient,
  type FetchLike,
} from './paltaApiClient.js';

export type PaltaApiClientWithDomains = PaltaApiClient & {
  operatingRules: BusinessOperatingRulesApiClient;
};

export function createPaltaApiClient(input: {
  baseUrl: string;
  fetch: FetchLike;
  auth?: AuthPort;
}): PaltaApiClientWithDomains {
  const getAccessToken = input.auth
    ? () => input.auth!.getAccessToken()
    : undefined;
  const client = new PaltaApiClient({
    baseUrl: input.baseUrl,
    fetch: input.fetch,
    ...(getAccessToken ? { getAccessToken } : {}),
  }) as PaltaApiClientWithDomains;

  client.operatingRules = new BusinessOperatingRulesApiClient({
    baseUrl: input.baseUrl,
    fetch: input.fetch,
    ...(getAccessToken ? { getAccessToken } : {}),
  });

  return client;
}
