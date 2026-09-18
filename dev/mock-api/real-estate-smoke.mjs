const base = process.env.PALTA_MOCK_BASE_URL ?? 'http://127.0.0.1:8787';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function json(path) {
  const response = await fetch(`${base}${path}`);
  const body = await response.json();
  return { response, body };
}

const providenciaRent = await json(
  '/v1/real-estate/listings?q=Providencia&transaction=rent&propertyType=apartment&publisher=owner_direct&maxPriceClp=800000&minBedrooms=2&minBathrooms=2&minParking=1',
);
assert(providenciaRent.response.ok, 'real-estate filtered search failed');
assert(providenciaRent.body.items.length === 1, 'filtered search should return exactly one active listing');
assert(providenciaRent.body.items[0]?.listing_id === 'demo-providencia-001', 'filtered search returned the wrong listing');

const sale = await json('/v1/real-estate/listings?transaction=sale&minBedrooms=3');
assert(sale.response.ok && sale.body.items.length === 2, 'sale search should return two active sale listings');
assert(sale.body.items.every((item) => item.status === 'active'), 'ordinary search must exclude paused listings');

const businessListings = await json(
  '/v1/real-estate/listings?businessId=business-demo-broker-001',
);
assert(
  businessListings.response.ok && businessListings.body.items[0]?.listing_id === 'demo-nunoa-001',
  'Business Profile listing handoff must resolve by canonical business id',
);

const detail = await json('/v1/real-estate/listings/demo-providencia-001');
assert(detail.response.ok && detail.body.property_id === 'property-demo-providencia-001', 'real-estate detail failed');
assert(detail.body.latitude === -33.4311 && detail.body.longitude === -70.6104, 'detail must preserve canonical map point');

const paused = await json('/v1/real-estate/listings/demo-paused-001');
assert(paused.response.status === 404, 'paused listing must not be publicly readable from ordinary detail endpoint');

const missing = await json('/v1/real-estate/listings/does-not-exist');
assert(
  missing.response.status === 404 && missing.body.error === 'real_estate_listing_not_found',
  'unknown real-estate listing must return typed 404 payload',
);

console.log('PASS: Palta real-estate mock API HTTP smoke');
console.log(JSON.stringify({
  filteredListing: providenciaRent.body.items[0].listing_id,
  saleCount: sale.body.items.length,
  businessListing: businessListings.body.items[0].listing_id,
  detailListing: detail.body.listing_id,
}, null, 2));
