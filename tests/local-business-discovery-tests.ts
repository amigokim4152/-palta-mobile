import {
  projectLocalBusinesses,
  LOCAL_BUSINESS_SHORTCUTS,
} from '../src/business/localBusinessDiscovery.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const items = [
  {
    entityId: 'place-1',
    entityType: 'place' as const,
    name: 'Plaza',
    distanceM: 50,
    location: { lat: -33.4, lng: -70.6 },
  },
  {
    entityId: 'biz-2',
    entityType: 'business' as const,
    name: 'Taller B',
    distanceM: 900,
    verificationStatus: 'verified',
    location: { lat: -33.4, lng: -70.6 },
  },
  {
    entityId: 'biz-1',
    entityType: 'business' as const,
    name: 'Taller A',
    distanceM: 200,
    verificationStatus: 'unverified',
    location: { lat: -33.4, lng: -70.6 },
  },
];

const projected = projectLocalBusinesses(items);
assert(projected.length === 2, 'Only businesses should remain.');
assert(projected[0]?.entityId === 'biz-1', 'Businesses should sort by distance.');

const verified = projectLocalBusinesses(items, { verifiedOnly: true });
assert(verified.length === 1 && verified[0]?.entityId === 'biz-2', 'Verified-only filter must be explicit.');
assert(LOCAL_BUSINESS_SHORTCUTS.length > 0, 'Discovery shortcuts should exist.');

console.log('PASS: Local Business discovery projection');
