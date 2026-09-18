import {
  createRealEstateDraft,
  validateRealEstateDraft,
} from '../src/realEstate/realEstatePublishing.js';
import {
  buildRealEstateQueryString,
  parseRealEstateListingQueryParams,
  serializeRealEstateListingQuery,
} from '../src/realEstate/realEstateQueryParams.js';
import {
  filterRealEstateListings,
  type RealEstateListingSearchItem,
} from '../src/realEstate/realEstateRepository.js';
import { createRealEstateInquiryDraft } from '../src/realEstate/realEstateInquiry.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const fixtures: RealEstateListingSearchItem[] = [
  {
    listing: {
      id: 'rent-1',
      propertyId: 'property-1',
      transactionType: 'rent',
      publisherType: 'owner_direct',
      publisherUserId: 'user-1',
      priceClp: 780000,
      publishedAt: '2026-09-18T00:00:00Z',
      status: 'active',
    },
    property: {
      id: 'property-1',
      type: 'apartment',
      address: { countryCode: 'CL', displayAddress: 'Providencia, Santiago' },
      bedrooms: 2,
      bathrooms: 2,
      parkingSpaces: 1,
      usableAreaM2: 72,
    },
    comuna: 'Providencia',
    sector: 'Pedro de Valdivia',
    publisherLabel: 'Dueño directo',
    publisherType: 'owner_direct',
  },
  {
    listing: {
      id: 'sale-1',
      propertyId: 'property-2',
      transactionType: 'sale',
      publisherType: 'real_estate_business',
      publisherBusinessId: 'business-1',
      priceUf: 8500,
      publishedAt: '2026-09-18T00:00:00Z',
      status: 'active',
    },
    property: {
      id: 'property-2',
      type: 'house',
      address: { countryCode: 'CL', displayAddress: 'Vitacura, Santiago' },
      bedrooms: 4,
      bathrooms: 3,
      parkingSpaces: 2,
      usableAreaM2: 180,
    },
    comuna: 'Vitacura',
    sector: 'Lo Castillo',
    publisherLabel: 'Corredora Demo',
    publisherType: 'real_estate_business',
  },
];

const filtered = filterRealEstateListings(fixtures, {
  transactionType: 'rent',
  propertyType: 'apartment',
  publisherType: 'owner_direct',
  maxPriceClp: 800000,
  minUsableAreaM2: 50,
  minBedrooms: 2,
  minBathrooms: 2,
  minParkingSpaces: 1,
});
assert(filtered.length === 1 && filtered[0]?.listing.id === 'rent-1', 'Real-estate filters must compose deterministically.');

const serialized = serializeRealEstateListingQuery({
  text: 'Providencia',
  transactionType: 'rent',
  propertyType: 'apartment',
  maxPriceClp: 1200000,
  minBedrooms: 2,
});
const restored = parseRealEstateListingQueryParams({
  q: serialized.q,
  transaction: serialized.transaction,
  propertyType: serialized.propertyType,
  maxPriceClp: serialized.maxPriceClp,
  minBedrooms: serialized.minBedrooms,
});
assert(restored.text === 'Providencia', 'Saved search must restore text.');
assert(restored.transactionType === 'rent', 'Saved search must restore transaction type.');
assert(restored.propertyType === 'apartment', 'Saved search must restore property type.');
assert(restored.maxPriceClp === 1200000, 'Saved search must restore CLP price.');
assert(restored.minBedrooms === 2, 'Saved search must restore bedroom filter.');
assert(buildRealEstateQueryString(restored).includes('transaction=rent'), 'Saved search deep link must serialize transaction.');

const incompleteInput = {
  transactionType: 'rent' as const,
  propertyType: 'apartment' as const,
  publisherType: 'owner_direct' as const,
  comuna: '',
  sectorOrAddress: '',
  contactPreference: 'palta' as const,
  photoCount: 0,
  exactAddressPrivate: true,
};
assert(validateRealEstateDraft(incompleteInput).length >= 3, 'Incomplete property draft must report missing core fields.');
const incompleteDraft = createRealEstateDraft(incompleteInput, {
  id: 'draft-1',
  now: '2026-09-18T10:00:00Z',
});
assert(incompleteDraft.status === 'draft', 'Incomplete property draft must stay draft.');

const completeDraft = createRealEstateDraft({
  ...incompleteInput,
  comuna: 'Providencia',
  sectorOrAddress: 'Pedro de Valdivia',
  priceClp: 780000,
  usableAreaM2: 72,
}, {
  id: 'draft-2',
  now: '2026-09-18T10:00:00Z',
});
assert(completeDraft.status === 'ready_for_review', 'Complete property draft must become ready for review.');

const editedDraft = createRealEstateDraft({
  ...incompleteInput,
  comuna: 'Providencia',
  sectorOrAddress: 'Pedro de Valdivia',
  priceClp: 790000,
}, {
  id: completeDraft.id,
  createdAt: completeDraft.createdAt,
  now: '2026-09-18T11:00:00Z',
});
assert(editedDraft.createdAt === completeDraft.createdAt, 'Editing must preserve property draft creation time.');
assert(editedDraft.updatedAt === '2026-09-18T11:00:00Z', 'Editing must refresh property draft update time.');

const inquiry = createRealEstateInquiryDraft({
  listingId: 'rent-1',
  channel: 'whatsapp',
  message: 'Hola, me interesa esta propiedad.',
  visitRequested: true,
  financingQuestion: false,
}, { id: 'inquiry-1', now: '2026-09-18T12:00:00Z' });
assert(inquiry.status === 'ready_to_send', 'A valid inquiry may be prepared for sending.');
assert(inquiry.status !== 'sent', 'Demo inquiry must never mark itself sent without Message/Care handoff.');

console.log('PASS: real-estate discovery, saved-search, publishing and inquiry core contracts');
