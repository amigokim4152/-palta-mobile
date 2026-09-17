import {
  addCanonicalBusinessService,
  addPendingBusinessServicePhrase,
  removeCanonicalBusinessService,
  suggestBusinessServices,
  validateBusinessServiceProfile,
  type BusinessServiceProfile,
} from '../src/business/businessServiceProfile.js';
import { CHILE_LOCAL_SERVICE_SEED } from '../src/business/chileServiceSeed.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const base: BusinessServiceProfile = {
  businessId: 'biz-1',
  canonicalServiceIds: ['home.plumbing.general'],
  pendingOwnerPhrases: [],
};

assert(validateBusinessServiceProfile(base, CHILE_LOCAL_SERVICE_SEED).length === 0, 'valid service profile should pass');

const suggestions = suggestBusinessServices(
  'Hacemos destape de cañerías y alcantarillado',
  CHILE_LOCAL_SERVICE_SEED,
  ['HOME_REPAIR_MAINTENANCE'],
);
assert(suggestions[0]?.serviceId === 'home.plumbing.drain_unclogging', 'owner wording should resolve through canonical service resolver');
assert(suggestions.length <= 3, 'service edit should never turn into a large taxonomy browser');

const added = addCanonicalBusinessService(base, 'home.plumbing.drain_unclogging', CHILE_LOCAL_SERVICE_SEED);
assert(added.changed, 'new canonical service should be added');
assert(added.profile.canonicalServiceIds.includes('home.plumbing.drain_unclogging'), 'canonical id should be preserved');

const duplicate = addCanonicalBusinessService(added.profile, 'home.plumbing.drain_unclogging', CHILE_LOCAL_SERVICE_SEED);
assert(!duplicate.changed, 'adding the same canonical service should be idempotent');

const removed = removeCanonicalBusinessService(added.profile, 'home.plumbing.general');
assert(!removed.profile.canonicalServiceIds.includes('home.plumbing.general'), 'owner should be able to remove an obsolete service');

const pending = addPendingBusinessServicePhrase(base, 'Instalación de un servicio muy específico todavía no clasificado');
assert(pending.profile.pendingOwnerPhrases.length === 1, 'unmatched owner wording may be retained for later mapping');
assert(base.canonicalServiceIds.length === 1, 'pending owner wording must not mutate canonical taxonomy automatically');

let unknownRejected = false;
try {
  addCanonicalBusinessService(base, 'owner.free.text.fake-service', CHILE_LOCAL_SERVICE_SEED);
} catch {
  unknownRejected = true;
}
assert(unknownRejected, 'free text must not be accepted as a canonical service id');

console.log('PASS: Local Business owner service profile contract');
