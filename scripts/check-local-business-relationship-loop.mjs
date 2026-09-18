import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const actionBarPath = path.join(root, 'mobile-overlay/src/components/business/BusinessActionBar.tsx');
const profilePath = path.join(root, 'mobile-overlay/src/features/business/BusinessProfileExperience.tsx');
const followingPath = path.join(root, 'mobile-overlay/src/app/local-businesses/following.tsx');
const apiPath = path.join(root, 'src/api/paltaApiClient.ts');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const file of [actionBarPath, profilePath, followingPath, apiPath]) {
  assert(fs.existsSync(file), `Missing relationship-loop source: ${path.relative(root, file)}`);
}

const actionBar = fs.readFileSync(actionBarPath, 'utf8');
const profile = fs.readFileSync(profilePath, 'utf8');
const following = fs.readFileSync(followingPath, 'utf8');
const api = fs.readFileSync(apiPath, 'utf8');

assert(
  profile.includes('getBusinessRelationship(businessId)') &&
    profile.includes('updateBusinessRelationship(businessId, update)'),
  'Business profile must read and update the canonical save/follow relationship.',
);
assert(
  actionBar.includes('relationship.following') &&
    actionBar.includes('Ver novedades y beneficios') &&
    actionBar.includes("router.push('/local-businesses/following')"),
  'A followed business must expose a direct path from the profile action area into the relationship feed.',
);
assert(
  following.includes('getFollowedBusinessUpdates()') &&
    following.includes('item.kind') &&
    following.includes("router.push(`/business/${encodeURIComponent(item.business_id)}`)"),
  'Following feed must use canonical followed updates and return each update to its Business profile.',
);
assert(
  api.includes("'/v1/local-business/following-updates'") &&
    api.includes('BusinessFollowedUpdatesApiResponse'),
  'Relationship feed must stay behind the canonical Local Business API contract.',
);
assert(
  following.includes('no activa por sí solo mensajes promocionales ni notificaciones'),
  'Following must not silently grant marketing or notification consent.',
);

console.log('PASS: Local Business follow → updates/benefits → profile relationship loop');
