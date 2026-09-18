import { RealEstatePublicationApiClient } from '../src/api/realEstatePublicationApiClient.js';
import {
  validateRealEstatePublicationReadiness,
} from '../src/realEstate/realEstatePublicationSubmission.js';
import type { RealEstateListingDraft } from '../src/realEstate/realEstatePublishing.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const baseDraft: RealEstateListingDraft = {
  id: 'draft-publication-1',
  status: 'ready_for_review',
  transactionType: 'rent',
  propertyType: 'apartment',
  publisherType: 'owner_direct',
  comuna: 'Providencia',
  sectorOrAddress: 'Pedro de Valdivia',
  priceClp: 780000,
  usableAreaM2: 68,
  bedrooms: 2,
  bathrooms: 2,
  parkingSpaces: 1,
  contactPreference: 'palta',
  photoCount: 0,
  exactAddressPrivate: true,
  createdAt: '2026-09-18T12:00:00Z',
  updatedAt: '2026-09-18T12:00:00Z',
};

const noMediaErrors = validateRealEstatePublicationReadiness(baseDraft);
assert(
  noMediaErrors.some((item) => item.code === 'real_media_required'),
  'A publication submission must require at least one canonical uploaded image.',
);

const readyDraft: RealEstateListingDraft = {
  ...baseDraft,
  photoCount: 1,
  media: [{
    mediaAssetId: 'asset-publication-1',
    kind: 'image',
    role: 'cover',
    sortOrder: 0,
    deliveryUrl: 'https://media.example/asset-publication-1',
  }],
};
assert(
  validateRealEstatePublicationReadiness(readyDraft).length === 0,
  'A complete direct-owner draft with real media should be submit-ready.',
);

const professionalDraft: RealEstateListingDraft = {
  ...readyDraft,
  id: 'draft-publication-professional',
  publisherType: 'broker',
};
assert(
  validateRealEstatePublicationReadiness(professionalDraft)
    .some((item) => item.code === 'verified_business_required'),
  'Professional publisher must link a canonical Business before submission.',
);

const requests: Array<{ url: string; headers?: Record<string, string>; body?: string }> = [];
const client = new RealEstatePublicationApiClient({
  baseUrl: 'https://api.somospalta.cl/',
  getAccessToken: async () => 'publication-token',
  fetch: async (url, init) => {
    requests.push({ url, ...(init?.headers ? { headers: init.headers } : {}), ...(init?.body ? { body: init.body } : {}) });
    return {
      ok: true,
      status: 202,
      async json() {
        return {
          submission_id: 'submission-1',
          draft_id: readyDraft.id,
          status: 'pending_review',
          message: 'Recibido',
        };
      },
    };
  },
});

const result = await client.submitDraft(readyDraft);
assert(result.status === 'pending_review', 'Client must preserve non-published review status.');
assert(requests[0]?.url.endsWith('/v1/real-estate/publications') === true, 'Submission must use canonical publication endpoint.');
assert(
  requests[0]?.headers?.['Idempotency-Key'] === `real-estate-publication:${readyDraft.id}`,
  'Draft id must become the stable publication idempotency key.',
);
assert(requests[0]?.headers?.Authorization === 'Bearer publication-token', 'Publication must use current Palta access token.');
const payload = JSON.parse(requests[0]?.body ?? '{}');
assert(payload.media[0]?.media_asset_id === 'asset-publication-1', 'Submission must reference Media Core asset ids.');
assert(payload.publisher_type === 'owner_direct', 'Submission must preserve publisher semantics.');

console.log('PASS: real-estate publication readiness and idempotent submission contracts');
