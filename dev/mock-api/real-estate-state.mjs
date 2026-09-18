import {
  demoRealEstateContexts,
  demoRealEstateListings,
} from './real-estate-demo-fixtures.mjs';

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function optionalNumber(searchParams, key) {
  const raw = searchParams.get(key);
  if (raw === null || raw.trim() === '') return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function within(value, min, max) {
  if (min !== undefined && (value === undefined || value < min)) return false;
  if (max !== undefined && (value === undefined || value > max)) return false;
  return true;
}

function matchesListing(item, url) {
  if (item.status !== 'active') return false;

  const q = normalize(url.searchParams.get('q'));
  const businessId = url.searchParams.get('businessId');
  const transaction = url.searchParams.get('transaction');
  const propertyType = url.searchParams.get('propertyType');
  const publisher = url.searchParams.get('publisher');

  if (businessId && item.publisher_business_id !== businessId) return false;
  if (transaction && item.transaction_type !== transaction) return false;
  if (propertyType && item.property_type !== propertyType) return false;
  if (publisher && item.publisher_type !== publisher) return false;

  if (!within(item.price_clp, optionalNumber(url.searchParams, 'minPriceClp'), optionalNumber(url.searchParams, 'maxPriceClp'))) return false;
  if (!within(item.price_uf, optionalNumber(url.searchParams, 'minPriceUf'), optionalNumber(url.searchParams, 'maxPriceUf'))) return false;
  if (!within(item.usable_area_m2, optionalNumber(url.searchParams, 'minArea'), optionalNumber(url.searchParams, 'maxArea'))) return false;
  if (!within(item.bedrooms, optionalNumber(url.searchParams, 'minBedrooms'), undefined)) return false;
  if (!within(item.bathrooms, optionalNumber(url.searchParams, 'minBathrooms'), undefined)) return false;
  if (!within(item.parking_spaces, optionalNumber(url.searchParams, 'minParking'), undefined)) return false;

  if (!q) return true;
  const haystack = normalize([
    item.comuna,
    item.sector,
    item.display_address,
    item.publisher_label,
    item.property_type,
  ].filter(Boolean).join(' '));
  return q.split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
}

export function searchRealEstateListings(url) {
  return demoRealEstateListings
    .filter((item) => matchesListing(item, url))
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
}

export async function handleRealEstateRequest({ req, res, url, json }) {
  if (req.method !== 'GET') return false;

  if (url.pathname === '/v1/real-estate/listings') {
    json(res, 200, {
      generated_at: new Date().toISOString(),
      items: searchRealEstateListings(url),
    });
    return true;
  }

  const contextMatch = url.pathname.match(/^\/v1\/real-estate\/properties\/([^/]+)\/context$/);
  if (contextMatch) {
    const propertyId = decodeURIComponent(contextMatch[1]);
    const context = demoRealEstateContexts.find((candidate) => candidate.property_id === propertyId);
    if (!context) {
      json(res, 404, { error: 'real_estate_property_context_not_found' });
      return true;
    }
    json(res, 200, context);
    return true;
  }

  if (url.pathname.startsWith('/v1/real-estate/listings/')) {
    const listingId = decodeURIComponent(url.pathname.slice('/v1/real-estate/listings/'.length));
    const item = demoRealEstateListings.find((candidate) => candidate.listing_id === listingId);
    if (!item || item.status !== 'active') {
      json(res, 404, { error: 'real_estate_listing_not_found' });
      return true;
    }
    json(res, 200, item);
    return true;
  }

  return false;
}
