import type { AuthPort } from '../ports/authPort.js';
import {
  BusinessCorrectionsApiClient,
} from './businessCorrectionsApiClient.js';
import {
  BusinessLocationApiClient,
} from './businessLocationApiClient.js';
import {
  BusinessOperatingRulesApiClient,
} from './businessOperatingRulesApiClient.js';
import {
  BusinessOwnerProfileApiClient,
} from './businessOwnerProfileApiClient.js';
import {
  BusinessQuotesApiClient,
} from './businessQuotesApiClient.js';
import {
  BusinessReviewsApiClient,
} from './businessReviewsApiClient.js';
import {
  BusinessServicesApiClient,
} from './businessServicesApiClient.js';
import {
  PaltaApiClient,
  type FetchLike,
} from './paltaApiClient.js';

export type PaltaApiClientWithDomains = PaltaApiClient & {
  operatingRules: BusinessOperatingRulesApiClient;
  reviews: BusinessReviewsApiClient;
  corrections: BusinessCorrectionsApiClient;
  ownerProfile: BusinessOwnerProfileApiClient;
  quotes: BusinessQuotesApiClient;
  services: BusinessServicesApiClient;
  location: BusinessLocationApiClient;
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

  client.reviews = new BusinessReviewsApiClient({
    baseUrl: input.baseUrl,
    fetch: input.fetch,
    ...(getAccessToken ? { getAccessToken } : {}),
  });

  client.corrections = new BusinessCorrectionsApiClient({
    baseUrl: input.baseUrl,
    fetch: input.fetch,
    ...(getAccessToken ? { getAccessToken } : {}),
  });

  client.ownerProfile = new BusinessOwnerProfileApiClient({
    baseUrl: input.baseUrl,
    fetch: input.fetch,
    ...(getAccessToken ? { getAccessToken } : {}),
  });

  client.quotes = new BusinessQuotesApiClient({
    baseUrl: input.baseUrl,
    fetch: input.fetch,
    ...(getAccessToken ? { getAccessToken } : {}),
  });

  client.services = new BusinessServicesApiClient({
    baseUrl: input.baseUrl,
    fetch: input.fetch,
    ...(getAccessToken ? { getAccessToken } : {}),
  });

  client.location = new BusinessLocationApiClient({
    baseUrl: input.baseUrl,
    fetch: input.fetch,
    ...(getAccessToken ? { getAccessToken } : {}),
  });

  return client;
}
