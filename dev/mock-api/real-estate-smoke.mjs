const base = process.env.PALTA_MOCK_BASE_URL ?? 'http://127.0.0.1:8787';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function json(path, init) {
  const response = await fetch(`${base}${path}`, init);
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

const context = await json('/v1/real-estate/properties/property-demo-providencia-001/context');
assert(context.response.ok, 'property context endpoint failed');
assert(context.body.building?.building_id === 'building-demo-providencia-001', 'context must reference canonical building id');
assert(context.body.nearby.some((item) => item.source_core === 'transport'), 'context must carry shared-core references');

const media = await json('/v1/real-estate/listings/demo-providencia-001/media');
assert(media.response.ok, 'listing media endpoint failed');
assert(media.body.items[0]?.role === 'cover', 'listing media should expose cover relationship first');
assert(typeof media.body.items[0]?.media_asset_id === 'string', 'listing media must reference a Media Core asset id');

const uploadBytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const uploadSession = await json('/v1/real-estate/media/uploads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    draft_id: 'draft-http-smoke',
    kind: 'image',
    role: 'cover',
    content_type: 'image/jpeg',
    byte_size: uploadBytes.length,
    file_name: 'smoke.jpg',
  }),
});
assert(uploadSession.response.status === 201, 'media upload session creation failed');
assert(uploadSession.body.upload_method === 'PUT', 'media upload session must use direct PUT');
assert(typeof uploadSession.body.media_asset_id === 'string', 'media upload session must allocate canonical asset id');

const directUpload = await fetch(uploadSession.body.upload_url, {
  method: 'PUT',
  headers: uploadSession.body.required_headers,
  body: uploadBytes,
});
assert(directUpload.status === 204, 'direct signed-style media upload failed');

const completion = await json(
  `/v1/real-estate/media/uploads/${encodeURIComponent(uploadSession.body.upload_id)}/complete`,
  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
);
assert(completion.response.ok && completion.body.status === 'ready', 'media upload completion failed');
assert(completion.body.media_asset_id === uploadSession.body.media_asset_id, 'completion must preserve canonical asset id');

const delivered = await fetch(completion.body.delivery_url);
const deliveredBytes = Buffer.from(await delivered.arrayBuffer());
assert(delivered.ok, 'uploaded media delivery URL failed');
assert(Buffer.compare(deliveredBytes, uploadBytes) === 0, 'uploaded media bytes must round-trip in mock API');

const publicationPayload = {
  draft_id: 'draft-http-smoke',
  transaction_type: 'rent',
  property_type: 'apartment',
  publisher_type: 'owner_direct',
  comuna: 'Providencia',
  sector_or_address: 'Pedro de Valdivia',
  exact_address_private: true,
  price_clp: 780000,
  usable_area_m2: 68,
  bedrooms: 2,
  bathrooms: 2,
  parking_spaces: 1,
  contact_preference: 'palta',
  media: [{
    media_asset_id: completion.body.media_asset_id,
    kind: 'image',
    role: 'cover',
    sort_order: 0,
  }],
};
const firstSubmission = await json('/v1/real-estate/publications', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'real-estate-publication:draft-http-smoke',
  },
  body: JSON.stringify(publicationPayload),
});
assert(firstSubmission.response.status === 202, 'first publication submission should be accepted for review');
assert(firstSubmission.body.status === 'pending_review', 'publication must not claim to be active before review');

const duplicateSubmission = await json('/v1/real-estate/publications', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'real-estate-publication:draft-http-smoke',
  },
  body: JSON.stringify(publicationPayload),
});
assert(duplicateSubmission.response.status === 200, 'repeated publication submission should resolve idempotently');
assert(
  duplicateSubmission.body.submission_id === firstSubmission.body.submission_id,
  'same draft must never create duplicate publication submissions',
);

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
  contextNearby: context.body.nearby.length,
  mediaCount: media.body.items.length,
  uploadedAsset: completion.body.media_asset_id,
  publicationSubmission: firstSubmission.body.submission_id,
}, null, 2));
