const base = process.env.PALTA_MOCK_BASE_URL ?? 'http://127.0.0.1:8787';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function json(path, init) {
  const response = await fetch(`${base}${path}`, init);
  const body = await response.json();
  return { response, body };
}

const local = await json('/v1/local/search?lat=-33.39&lng=-70.57&radius_m=5000');
assert(local.response.ok, 'local search failed');
const verifiedBusinessId = local.body.items.find((item) => item.verification_status === 'verified')?.entity_id;
assert(verifiedBusinessId, 'verified business fixture missing');

const beforeFollow = await json('/v1/local-business/following-updates');
assert(beforeFollow.response.ok, 'following updates read failed');
assert(beforeFollow.body.items.length === 0, 'following feed should be quiet before explicit follow');

const follow = await json(`/v1/business/${encodeURIComponent(verifiedBusinessId)}/relationship`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ following: true }),
});
assert(follow.response.ok && follow.body.following === true, 'explicit follow failed');

const afterFollow = await json('/v1/local-business/following-updates');
assert(afterFollow.response.ok, 'following feed failed after follow');
assert(
  afterFollow.body.items.some(
    (item) => item.business_id === verifiedBusinessId && item.kind === 'coupon',
  ),
  'active coupon from followed business should appear in following feed',
);
assert(
  afterFollow.body.items.every((item) => item.business_id === verifiedBusinessId),
  'following feed must not include businesses the consumer did not follow',
);

const postKey = 'following-smoke-post-1';
const post = await json(`/v1/business/${encodeURIComponent(verifiedBusinessId)}/basic-posts`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': postKey,
  },
  body: JSON.stringify({
    title: 'Horario especial para seguidores',
    body: 'Abrimos mañana desde las 09:00.',
  }),
});
assert(post.response.status === 201, 'verified business post publish failed');
const postId = post.body.items.find((item) => item.title === 'Horario especial para seguidores')?.id;
assert(postId, 'published post id missing');

const withPost = await json('/v1/local-business/following-updates');
assert(
  withPost.body.items.some(
    (item) =>
      item.business_id === verifiedBusinessId &&
      item.kind === 'post' &&
      item.title === 'Horario especial para seguidores',
  ),
  'published post from followed business should appear in following feed',
);

const unfollow = await json(`/v1/business/${encodeURIComponent(verifiedBusinessId)}/relationship`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ following: false }),
});
assert(unfollow.response.ok && unfollow.body.following === false, 'explicit unfollow failed');

const afterUnfollow = await json('/v1/local-business/following-updates');
assert(
  afterUnfollow.response.ok && afterUnfollow.body.items.length === 0,
  'unfollow should remove that business from the in-app following feed immediately',
);

console.log('PASS: Palta followed business updates HTTP smoke');
console.log(JSON.stringify({
  verifiedBusinessId,
  itemsAfterFollow: afterFollow.body.items.length,
  itemsWithPost: withPost.body.items.length,
  itemsAfterUnfollow: afterUnfollow.body.items.length,
}, null, 2));
