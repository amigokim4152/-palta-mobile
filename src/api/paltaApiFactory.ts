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
  BusinessReservationsApiClient,
} from './businessReservationsApiClient.js';
import {
  BusinessReviewsApiClient,
} from './businessReviewsApiClient.js';
import {
  BusinessServicesApiClient,
} from './businessServicesApiClient.js';
import { MessagingApiClient } from './messagingApiClient.js';
import { PublicDataApiClient } from './publicDataApiClient.js';
import {
  PaltaApiClient,
  type FetchLike,
} from './paltaApiClient.js';
import { RealEstateApiClient } from './realEstateApiClient.js';
import { RealEstateMediaUploadApiClient } from './realEstateMediaUploadApiClient.js';
import { RealEstatePublicationApiClient } from './realEstatePublicationApiClient.js';

export type PaltaApiClientWithDomains = PaltaApiClient & {
  operatingRules: BusinessOperatingRulesApiClient;
  reviews: BusinessReviewsApiClient;
  corrections: BusinessCorrectionsApiClient;
  ownerProfile: BusinessOwnerProfileApiClient;
  quotes: BusinessQuotesApiClient;
  reservations: BusinessReservationsApiClient;
  services: BusinessServicesApiClient;
  location: BusinessLocationApiClient;
  messaging: MessagingApiClient;
  realEstate: RealEstateApiClient;
  realEstateMediaUpload: RealEstateMediaUploadApiClient;
  realEstatePublication: RealEstatePublicationApiClient;
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

  client.reservations = new BusinessReservationsApiClient({
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

  client.messaging = new MessagingApiClient({
    baseUrl: input.baseUrl,
    fetch: input.fetch,
    ...(getAccessToken ? { getAccessToken } : {}),
  });

  client.realEstate = new RealEstateApiClient({
    baseUrl: input.baseUrl,
    fetch: input.fetch,
    ...(getAccessToken ? { getAccessToken } : {}),
  });

  client.realEstateMediaUpload = new RealEstateMediaUploadApiClient({
    baseUrl: input.baseUrl,
    fetch: input.fetch,
    ...(getAccessToken ? { getAccessToken } : {}),
  });

  client.realEstatePublication = new RealEstatePublicationApiClient({
    baseUrl: input.baseUrl,
    fetch: input.fetch,
    ...(getAccessToken ? { getAccessToken } : {}),
  });

  return client;
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
