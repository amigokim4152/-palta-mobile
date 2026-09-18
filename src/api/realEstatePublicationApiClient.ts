import type { FetchLike } from './paltaApiClient.js';
import type { RealEstateListingDraft } from '../realEstate/realEstatePublishing.js';
import {
  type RealEstatePublicationGateway,
  type RealEstatePublicationSubmissionResult,
  validateRealEstatePublicationReadiness,
} from '../realEstate/realEstatePublicationSubmission.js';

export type RealEstatePublicationApiClientOptions = {
  baseUrl: string;
  fetch: FetchLike;
  getAccessToken?: () => Promise<string | null>;
};

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function validateResult(value: unknown): RealEstatePublicationSubmissionResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Publication submission returned a non-object payload.');
  }
  const row = value as Record<string, unknown>;
  const statuses = ['pending_review', 'requires_verification', 'published'];
  if (
    typeof row.submission_id !== 'string' ||
    typeof row.draft_id !== 'string' ||
    typeof row.status !== 'string' ||
    !statuses.includes(row.status) ||
    (row.listing_id !== undefined && typeof row.listing_id !== 'string') ||
    (row.message !== undefined && typeof row.message !== 'string')
  ) {
    throw new Error('Publication submission returned an invalid payload.');
  }
  return {
    submissionId: row.submission_id,
    draftId: row.draft_id,
    status: row.status as RealEstatePublicationSubmissionResult['status'],
    ...(typeof row.listing_id === 'string' ? { listingId: row.listing_id } : {}),
    ...(typeof row.message === 'string' ? { message: row.message } : {}),
  };
}

function submissionBody(draft: RealEstateListingDraft) {
  return {
    draft_id: draft.id,
    transaction_type: draft.transactionType,
    property_type: draft.propertyType,
    publisher_type: draft.publisherType,
    ...(draft.publisherBusinessId ? { publisher_business_id: draft.publisherBusinessId } : {}),
    comuna: draft.comuna,
    sector_or_address: draft.sectorOrAddress,
    exact_address_private: draft.exactAddressPrivate,
    ...(draft.priceClp !== undefined ? { price_clp: draft.priceClp } : {}),
    ...(draft.priceUf !== undefined ? { price_uf: draft.priceUf } : {}),
    ...(draft.commonExpensesClp !== undefined ? { common_expenses_clp: draft.commonExpensesClp } : {}),
    ...(draft.usableAreaM2 !== undefined ? { usable_area_m2: draft.usableAreaM2 } : {}),
    ...(draft.totalAreaM2 !== undefined ? { total_area_m2: draft.totalAreaM2 } : {}),
    ...(draft.bedrooms !== undefined ? { bedrooms: draft.bedrooms } : {}),
    ...(draft.bathrooms !== undefined ? { bathrooms: draft.bathrooms } : {}),
    ...(draft.parkingSpaces !== undefined ? { parking_spaces: draft.parkingSpaces } : {}),
    ...(draft.description ? { description: draft.description } : {}),
    contact_preference: draft.contactPreference,
    media: (draft.media ?? []).map((item) => ({
      media_asset_id: item.mediaAssetId,
      kind: item.kind,
      role: item.role,
      sort_order: item.sortOrder,
    })),
  };
}

export class RealEstatePublicationApiClient implements RealEstatePublicationGateway {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly getAccessToken: (() => Promise<string | null>) | undefined;

  constructor(options: RealEstatePublicationApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetch;
    this.getAccessToken = options.getAccessToken;
  }

  async submitDraft(draft: RealEstateListingDraft): Promise<RealEstatePublicationSubmissionResult> {
    const readinessErrors = validateRealEstatePublicationReadiness(draft);
    if (readinessErrors.length) {
      throw new Error(readinessErrors.map((item) => item.message).join(' '));
    }

    const token = this.getAccessToken ? await this.getAccessToken() : null;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Idempotency-Key': `real-estate-publication:${draft.id}`,
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await this.fetchImpl(joinUrl(this.baseUrl, '/v1/real-estate/publications'), {
      method: 'POST',
      headers,
      body: JSON.stringify(submissionBody(draft)),
    });
    if (!response.ok) {
      throw new Error(`Palta real-estate publication API failed: ${response.status}`);
    }
    return validateResult(await response.json());
  }
}
