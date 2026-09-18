import type { AuthPort } from '../ports/authPort.js';
import { PublicDataApiClient } from './publicDataApiClient.js';
import {
  PaltaApiClient,
  type FetchLike,
} from './paltaApiClient.js';

export function createPaltaApiClient(input: {
  baseUrl: string;
  fetch: FetchLike;
  auth?: AuthPort;
}): PaltaApiClient {
  return new PaltaApiClient({
    baseUrl: input.baseUrl,
    fetch: input.fetch,
    ...(input.auth
      ? { getAccessToken: () => input.auth!.getAccessToken() }
      : {}),
  });
}

export function createPublicDataApiClient(input: {
  baseUrl: string;
  fetch: FetchLike;
}): PublicDataApiClient {
  return new PublicDataApiClient({
    baseUrl: input.baseUrl,
    fetch: input.fetch,
  });
}
