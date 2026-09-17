const baseUrl = process.env.PALTA_MOCK_BASE_URL ?? 'http://127.0.0.1:8793';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json();
  return { response, body };
}

const ownerInitial = await request('/v1/business/biz-farmacia-1/owner-location');
assert(ownerInitial.response.status === 200, 'verified owner should read owner location');
assert(ownerInitial.body.public_precision === 'exact', 'demo storefront starts as exact public location');
assert(typeof ownerInitial.body.anchor_point?.latitude === 'number', 'owner location should retain its exact management anchor');

const areaOnly = await request('/v1/business/biz-farmacia-1/owner-location', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address_label: 'Vitacura',
    public_precision: 'area_only',
  }),
});
assert(areaOnly.response.status === 200, 'owner should be able to reduce public location precision');
assert(areaOnly.body.public_precision === 'area_only', 'owner location should persist area-only privacy');
assert(typeof areaOnly.body.anchor_point?.latitude === 'number', 'owner management view should retain the private anchor');

const publicDetail = await request('/v1/business/biz-farmacia-1');
assert(publicDetail.response.status === 200, 'public business detail should remain available');
assert(publicDetail.body.location === undefined, 'area-only public business detail must not expose the exact map point');
assert(publicDetail.body.owner_anchor_location === undefined, 'public business object must never serialize the private owner anchor');

const localSearch = await request('/v1/local/search?lat=-33.39&lng=-70.57&q=farmacia');
assert(localSearch.response.status === 200, 'local search should remain available after privacy change');
const pharmacy = localSearch.body.items.find((item) => item.entity_id === 'biz-farmacia-1');
assert(pharmacy, 'area-only business may still be returned by textual local discovery');
assert(pharmacy.location === undefined, 'distance search projection must not leak an area-only exact point');

const hidden = await request('/v1/business/biz-farmacia-1/owner-location', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ public_precision: 'hidden' }),
});
assert(hidden.response.status === 200 && hidden.body.public_precision === 'hidden', 'owner should be able to hide public location');
const hiddenPublic = await request('/v1/business/biz-farmacia-1');
assert(hiddenPublic.body.location === undefined, 'hidden public business detail must not expose an exact point');

const exactAgain = await request('/v1/business/biz-farmacia-1/owner-location', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ public_precision: 'exact' }),
});
assert(exactAgain.response.status === 200, 'storefront can restore exact location using retained owner anchor');
const exactPublic = await request('/v1/business/biz-farmacia-1');
assert(typeof exactPublic.body.location?.lat === 'number', 'restored exact storefront location should project its public point');

console.log('PASS: Local Business owner/public location privacy HTTP smoke');
