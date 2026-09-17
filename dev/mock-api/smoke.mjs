const base = process.env.PALTA_MOCK_BASE_URL ?? 'http://127.0.0.1:8787';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function json(path, init) {
  const response = await fetch(`${base}${path}`, init);
  const body = await response.json();
  return { response, body };
}

const health = await json('/health');
assert(health.response.ok && health.body.ok === true, 'health failed');

const home = await json('/v1/home?locale=es-CL');
assert(home.response.ok && Array.isArray(home.body.items), 'home failed');

const local = await json('/v1/local/search?lat=-33.39&lng=-70.57&radius_m=5000');
assert(local.response.ok && local.body.items.length >= 2, 'local search failed');
const businessId = local.body.items[0].entity_id;
const verifiedBusinessId = local.body.items.find((item) => item.verification_status === 'verified')?.entity_id;
assert(verifiedBusinessId, 'verified business fixture missing');

const business = await json(`/v1/business/${encodeURIComponent(businessId)}`);
assert(business.response.ok && business.body.id === businessId, 'business detail failed');

const initialRelationship = await json(`/v1/business/${encodeURIComponent(businessId)}/relationship`);
assert(initialRelationship.response.ok, 'relationship read failed');
assert(initialRelationship.body.saved === false, 'relationship should start unsaved');
assert(initialRelationship.body.following === false, 'relationship should start unfollowed');

const savedRelationship = await json(`/v1/business/${encodeURIComponent(businessId)}/relationship`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ saved: true }),
});
assert(savedRelationship.response.ok && savedRelationship.body.saved === true, 'save relationship failed');
assert(savedRelationship.body.following === false, 'saving must not silently create follow');

const followedRelationship = await json(`/v1/business/${encodeURIComponent(businessId)}/relationship`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ following: true }),
});
assert(followedRelationship.response.ok && followedRelationship.body.following === true, 'follow relationship failed');
assert(followedRelationship.body.saved === true, 'following must preserve separate saved state');

const unfollowedRelationship = await json(`/v1/business/${encodeURIComponent(businessId)}/relationship`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ following: false }),
});
assert(unfollowedRelationship.body.saved === true, 'unfollow must not unsave the business');
assert(unfollowedRelationship.body.following === false, 'unfollow should clear only follower state');

const seededCoupon = await json(`/v1/business/${encodeURIComponent(verifiedBusinessId)}/basic-coupons`);
assert(seededCoupon.response.ok && seededCoupon.body.items.length === 1, 'verified business should expose active basic coupon');

const forbiddenCoupon = await json(`/v1/business/${encodeURIComponent(businessId)}/basic-coupon`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'No permitido',
    audience: 'public',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }),
});
assert(
  forbiddenCoupon.response.status === 403 && forbiddenCoupon.body.error === 'verified_owner_required',
  'unverified business must not publish owner-controlled coupon claims',
);

const followerCoupon = await json(`/v1/business/${encodeURIComponent(verifiedBusinessId)}/basic-coupon`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Beneficio para seguidores',
    description: 'Cupón básico, sin campaña automatizada.',
    redemption_instruction: 'Muéstralo antes de pagar.',
    audience: 'followers',
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  }),
});
assert(followerCoupon.response.ok, 'verified owner coupon upsert failed');
assert(followerCoupon.body.items.length === 0, 'follower-only coupon must stay hidden before follow');

const verifiedFollow = await json(`/v1/business/${encodeURIComponent(verifiedBusinessId)}/relationship`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ following: true }),
});
assert(verifiedFollow.response.ok && verifiedFollow.body.following === true, 'verified business follow failed');

const followerCouponVisible = await json(`/v1/business/${encodeURIComponent(verifiedBusinessId)}/basic-coupons`);
assert(
  followerCouponVisible.response.ok && followerCouponVisible.body.items[0]?.title === 'Beneficio para seguidores',
  'follower-only coupon should become visible after explicit follow',
);

const couponRevoked = await json(`/v1/business/${encodeURIComponent(verifiedBusinessId)}/basic-coupon`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'revoked' }),
});
assert(couponRevoked.response.ok && couponRevoked.body.items.length === 0, 'revoked coupon must disappear immediately');

const channelLinks = await json(`/v1/business/${encodeURIComponent(businessId)}/channel-links`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    links: [
      { provider: 'instagram', url: 'https://www.instagram.com/palta-demo/' },
      { provider: 'website', url: 'https://example.cl/' },
    ],
  }),
});
assert(channelLinks.response.ok, 'public channel link update failed');
assert(channelLinks.body.links.length === 2, 'public channel link update should return two links');

const businessAfterLinks = await json(`/v1/business/${encodeURIComponent(businessId)}`);
assert(
  businessAfterLinks.response.ok && businessAfterLinks.body.channel_links.length === 2,
  'public channel links should persist on the canonical mock Business',
);

const unsafeChannelLink = await json(`/v1/business/${encodeURIComponent(businessId)}/channel-links`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    links: [{ provider: 'website', url: 'javascript:alert(1)' }],
  }),
});
assert(
  unsafeChannelLink.response.status === 400 &&
    unsafeChannelLink.body.error === 'unsafe_public_channel_url',
  'unsafe public channel links must be rejected',
);

const idempotencyKey = 'smoke-quote-1';
const care = await json('/v1/care', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey,
  },
  body: JSON.stringify({
    intent_key: 'local_business_quote',
    subject_entity_id: businessId,
    action_type: 'quote_request',
    payload: { description: 'Ruido al frenar' },
  }),
});
assert(care.response.status === 201 && care.body.state === 'wait', 'care create failed');

const careRepeat = await json('/v1/care', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey,
  },
  body: JSON.stringify({
    intent_key: 'local_business_quote',
    subject_entity_id: businessId,
    action_type: 'quote_request',
    payload: { description: 'Ruido al frenar' },
  }),
});
assert(
  careRepeat.response.ok && careRepeat.body.id === care.body.id,
  'care idempotency failed'
);

const careRead = await json(`/v1/care/${encodeURIComponent(care.body.id)}`);
assert(careRead.response.ok && careRead.body.id === care.body.id, 'care read failed');

console.log('PASS: Palta mock API HTTP smoke');
console.log(JSON.stringify({
  homeItems: home.body.items.length,
  localItems: local.body.items.length,
  businessId,
  verifiedBusinessId,
  relationship: {
    saved: unfollowedRelationship.body.saved,
    following: unfollowedRelationship.body.following,
  },
  couponFlow: 'verified/follower/revoke ok',
  publicChannelLinks: businessAfterLinks.body.channel_links.length,
  careId: care.body.id,
}, null, 2));
