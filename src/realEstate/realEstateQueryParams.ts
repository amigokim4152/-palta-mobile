import type { PropertyTransactionType, PropertyType } from './realEstateContracts.js';
import type { RealEstateListingQuery } from './realEstateRepository.js';

export type RealEstateQueryParams = {
  q?: string;
  businessId?: string;
  transaction?: string;
  propertyType?: string;
  publisher?: string;
  minPriceClp?: string;
  maxPriceClp?: string;
  minPriceUf?: string;
  maxPriceUf?: string;
  minArea?: string;
  maxArea?: string;
  minBedrooms?: string;
  minBathrooms?: string;
  minParking?: string;
};

const TRANSACTIONS: readonly PropertyTransactionType[] = ['sale', 'rent', 'temporary_rent'];
const PROPERTY_TYPES: readonly PropertyType[] = [
  'apartment', 'house', 'room', 'office', 'commercial', 'land', 'parcel', 'warehouse',
];

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function serializeRealEstateListingQuery(query: RealEstateListingQuery): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.text) params.q = query.text;
  if (query.businessId) params.businessId = query.businessId;
  if (query.transactionType) params.transaction = query.transactionType;
  if (query.propertyType) params.propertyType = query.propertyType;
  if (query.publisherType) params.publisher = query.publisherType;
  if (query.minPriceClp !== undefined) params.minPriceClp = String(query.minPriceClp);
  if (query.maxPriceClp !== undefined) params.maxPriceClp = String(query.maxPriceClp);
  if (query.minPriceUf !== undefined) params.minPriceUf = String(query.minPriceUf);
  if (query.maxPriceUf !== undefined) params.maxPriceUf = String(query.maxPriceUf);
  if (query.minUsableAreaM2 !== undefined) params.minArea = String(query.minUsableAreaM2);
  if (query.maxUsableAreaM2 !== undefined) params.maxArea = String(query.maxUsableAreaM2);
  if (query.minBedrooms !== undefined) params.minBedrooms = String(query.minBedrooms);
  if (query.minBathrooms !== undefined) params.minBathrooms = String(query.minBathrooms);
  if (query.minParkingSpaces !== undefined) params.minParking = String(query.minParkingSpaces);
  return params;
}

export function parseRealEstateListingQueryParams(params: RealEstateQueryParams): RealEstateListingQuery {
  const transactionType = TRANSACTIONS.includes(params.transaction as PropertyTransactionType)
    ? params.transaction as PropertyTransactionType
    : undefined;
  const propertyType = PROPERTY_TYPES.includes(params.propertyType as PropertyType)
    ? params.propertyType as PropertyType
    : undefined;
  const publisherType = params.publisher === 'owner_direct' || params.publisher === 'broker' || params.publisher === 'real_estate_business'
    ? params.publisher
    : undefined;
  const minPriceClp = parseNumber(params.minPriceClp);
  const maxPriceClp = parseNumber(params.maxPriceClp);
  const minPriceUf = parseNumber(params.minPriceUf);
  const maxPriceUf = parseNumber(params.maxPriceUf);
  const minUsableAreaM2 = parseNumber(params.minArea);
  const maxUsableAreaM2 = parseNumber(params.maxArea);
  const minBedrooms = parseNumber(params.minBedrooms);
  const minBathrooms = parseNumber(params.minBathrooms);
  const minParkingSpaces = parseNumber(params.minParking);

  return {
    ...(params.q ? { text: params.q } : {}),
    ...(params.businessId ? { businessId: params.businessId } : {}),
    ...(transactionType ? { transactionType } : {}),
    ...(propertyType ? { propertyType } : {}),
    ...(publisherType ? { publisherType } : {}),
    ...(minPriceClp !== undefined ? { minPriceClp } : {}),
    ...(maxPriceClp !== undefined ? { maxPriceClp } : {}),
    ...(minPriceUf !== undefined ? { minPriceUf } : {}),
    ...(maxPriceUf !== undefined ? { maxPriceUf } : {}),
    ...(minUsableAreaM2 !== undefined ? { minUsableAreaM2 } : {}),
    ...(maxUsableAreaM2 !== undefined ? { maxUsableAreaM2 } : {}),
    ...(minBedrooms !== undefined ? { minBedrooms } : {}),
    ...(minBathrooms !== undefined ? { minBathrooms } : {}),
    ...(minParkingSpaces !== undefined ? { minParkingSpaces } : {}),
  };
}

export function buildRealEstateQueryString(query: RealEstateListingQuery): string {
  return Object.entries(serializeRealEstateListingQuery(query))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}
