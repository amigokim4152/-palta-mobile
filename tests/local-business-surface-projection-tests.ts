import {
  projectCanonicalBusinessToSurface,
  projectCanonicalBusinessToSurfaces,
  visibleBusinessSurfaceExposures,
} from '../src/business/businessSurfaceProjection.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const canonicalBusiness = {
  businessId: 'business-001',
  ownershipState: 'unclaimed' as const,
  lifecycleState: 'active' as const,
  publicDiscoveryEnabled: true,
  serviceIds: ['birthday_party', 'family_activity'],
  offeringIds: ['birthday_pool_package'],
  capabilityIds: ['reservation', 'whatsapp'],
};

const preClaim = projectCanonicalBusinessToSurface(canonicalBusiness, {
  surface: 'play',
  reason: 'birthday_pool',
  serviceIds: ['birthday_party'],
  offeringIds: ['birthday_pool_package'],
});

assert(preClaim.eligible, 'a public discovered business should be projectable before claim');
assert(!preClaim.ownerManaged, 'unclaimed business must not become owner-managed');
assert(preClaim.businessId === 'business-001', 'projection must preserve canonical business identity');

const verified = projectCanonicalBusinessToSurface(
  { ...canonicalBusiness, ownershipState: 'verified' as const },
  {
    surface: 'play',
    reason: 'birthday_pool',
    serviceIds: ['birthday_party'],
    offeringIds: ['birthday_pool_package'],
  },
);

assert(verified.eligible, 'verified business remains visible on the same projection');
assert(verified.ownerManaged, 'verified owner controls the same projected business');
assert(verified.businessId === preClaim.businessId, 'claim must not create a second business identity');

const multiSurface = projectCanonicalBusinessToSurfaces(
  { ...canonicalBusiness, ownershipState: 'verified' as const },
  [
    { surface: 'local_business', reason: 'canonical_profile' },
    { surface: 'play', reason: 'birthday_pool', serviceIds: ['birthday_party'] },
    { surface: 'map', reason: 'physical_location' },
    { surface: 'search', reason: 'service_match', serviceIds: ['birthday_party'] },
    { surface: 'play', reason: 'birthday_pool', serviceIds: ['birthday_party'] },
  ],
);

assert(multiSurface.length === 4, 'duplicate surface/reason candidates should be deduplicated');
assert(visibleBusinessSurfaceExposures(multiSurface).length === 4, 'all valid candidates should be visible');
assert(multiSurface.every((item) => item.businessId === 'business-001'), 'all surfaces must share canonical business id');

const missingOffering = projectCanonicalBusinessToSurface(canonicalBusiness, {
  surface: 'play',
  reason: 'karting_birthday',
  offeringIds: ['karting_package'],
});

assert(!missingOffering.eligible, 'surface must not invent an offering absent from canonical business');
assert(missingOffering.blockedBy.includes('required_offering_missing'), 'missing offering should explain projection block');

const paused = projectCanonicalBusinessToSurface(
  { ...canonicalBusiness, lifecycleState: 'paused' as const },
  { surface: 'search', reason: 'service_match' },
);

assert(!paused.eligible, 'paused business should stop projecting publicly');
assert(paused.blockedBy.includes('business_not_active'), 'paused state should explain projection block');

console.log('local-business surface projection tests passed');
