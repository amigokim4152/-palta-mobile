import {
  authBrokerUserId,
  paltaUserIdFromAuthBrokerUserId,
} from '../src/auth/accountModel.js';
import {
  AccountResolutionError,
  resolveCanonicalAccount,
} from '../src/auth/accountResolver.js';
import { providerIdentityKey } from '../src/auth/identityModel.js';
import {
  maximumFreshAuthenticationAgeSeconds,
  signOutScopeForReason,
} from '../src/auth/sessionPolicy.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const brokerId = authBrokerUserId('auth-user-001');
const paltaUserId = paltaUserIdFromAuthBrokerUserId(brokerId);
assert(
  String(paltaUserId) === 'auth-user-001',
  'Normalized v1 must map auth broker user id to canonical Palta user id without using a raw provider subject.',
);

let emptyRejected = false;
try {
  authBrokerUserId('   ');
} catch (error) {
  emptyRejected = error instanceof Error && error.message === 'auth_broker_user_id_required';
}
assert(emptyRejected, 'Empty auth broker user ids must be rejected.');

let lookupId = '';
const resolved = await resolveCanonicalAccount({
  authBrokerUserId: brokerId,
  accounts: {
    async accountExists(candidate) {
      lookupId = candidate;
      return true;
    },
  },
});
assert(lookupId === 'auth-user-001', 'Resolver must verify the canonical account id.');
assert(
  resolved.authBrokerUserId === brokerId && resolved.paltaUserId === paltaUserId,
  'Resolver must preserve the explicit broker-to-canonical mapping.',
);

let missingRejected = false;
try {
  await resolveCanonicalAccount({
    authBrokerUserId: brokerId,
    accounts: { async accountExists() { return false; } },
  });
} catch (error) {
  missingRejected =
    error instanceof AccountResolutionError && error.code === 'account_missing';
}
assert(missingRejected, 'Client resolver must fail closed when server bootstrap account is missing.');

assert(
  providerIdentityKey('google', 'subject-123') === 'google:subject-123',
  'Raw provider identity must remain a separate namespace.',
);
assert(
  signOutScopeForReason('user_sign_out') === 'current_session',
  'Normal logout should only end the current local session.',
);
assert(
  maximumFreshAuthenticationAgeSeconds('request_account_deletion') === 300,
  'Sensitive account deletion must retain the stricter fresh-auth policy.',
);

console.log('PASS: auth/account canonical resolution tests');
