import type { PaltaAccount, PaltaUserId } from '../src/auth/accountModel.js';
import type {
  IdentityProvider,
  LinkedIdentity,
} from '../src/auth/identityModel.js';
import type { CoreProfile } from '../src/profile/profileModel.js';
import type {
  AccountPersistencePort,
  NewAccountBundle,
} from '../src/ports/accountPersistencePort.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class MemoryAccountStore implements AccountPersistencePort {
  readonly accounts = new Map<PaltaUserId, PaltaAccount>();
  readonly identities = new Map<string, LinkedIdentity>();
  readonly profiles = new Map<PaltaUserId, CoreProfile>();

  private identityKey(provider: IdentityProvider, subject: string): string {
    return `${provider}:${subject}`;
  }

  async findAccountById(paltaUserId: PaltaUserId): Promise<PaltaAccount | null> {
    return this.accounts.get(paltaUserId) ?? null;
  }

  async findIdentity(
    provider: IdentityProvider,
    providerSubject: string,
  ): Promise<LinkedIdentity | null> {
    return this.identities.get(this.identityKey(provider, providerSubject)) ?? null;
  }

  async listIdentities(paltaUserId: PaltaUserId): Promise<LinkedIdentity[]> {
    return [...this.identities.values()].filter(
      (identity) => identity.paltaUserId === paltaUserId,
    );
  }

  async createAccountWithIdentity(bundle: NewAccountBundle): Promise<void> {
    const key = this.identityKey(
      bundle.identity.provider,
      bundle.identity.providerSubject,
    );
    if (this.identities.has(key)) throw new Error('identity_conflict');
    this.accounts.set(bundle.account.paltaUserId, bundle.account);
    this.identities.set(key, bundle.identity);
    this.profiles.set(bundle.profile.paltaUserId, bundle.profile);
  }

  async linkIdentity(identity: LinkedIdentity): Promise<LinkedIdentity> {
    const key = this.identityKey(identity.provider, identity.providerSubject);
    const existing = this.identities.get(key);
    if (existing && existing.paltaUserId !== identity.paltaUserId) {
      throw new Error('identity_in_use');
    }
    this.identities.set(key, identity);
    return identity;
  }

  async revokeIdentity(
    paltaUserId: PaltaUserId,
    identityId: string,
  ): Promise<void> {
    const identities = await this.listIdentities(paltaUserId);
    const target = identities.find((identity) => identity.identityId === identityId);
    if (!target || target.state === 'revoked') return;
    if (identities.filter((identity) => identity.state === 'active').length <= 1) {
      throw new Error('last_active_identity');
    }
    this.identities.set(
      this.identityKey(target.provider, target.providerSubject),
      { ...target, state: 'revoked' },
    );
  }

  async getCoreProfile(paltaUserId: PaltaUserId): Promise<CoreProfile | null> {
    return this.profiles.get(paltaUserId) ?? null;
  }

  async upsertCoreProfile(profile: CoreProfile): Promise<CoreProfile> {
    this.profiles.set(profile.paltaUserId, profile);
    return profile;
  }

  async saveConsent(
    paltaUserId: PaltaUserId,
    consent: PaltaAccount['consents'][number],
  ): Promise<void> {
    const account = this.accounts.get(paltaUserId);
    if (!account) throw new Error('account_missing');
    const consents = account.consents.filter(
      (item) =>
        item.policyKey !== consent.policyKey || item.version !== consent.version,
    );
    this.accounts.set(paltaUserId, {
      ...account,
      consents: [...consents, consent],
    });
  }
}

const {
  AccountResolutionError,
  linkProviderPrincipal,
  resolveProviderPrincipal,
} = await import('../src/auth/accountResolver.js');
const {
  signOutScopeForReason,
  requiresFreshAuthentication,
} = await import('../src/auth/sessionPolicy.js');
const {
  initialOnboardingState,
} = await import('../src/profile/onboardingState.js');

const store = new MemoryAccountStore();
let userSequence = 0;
let identitySequence = 0;
const ids = {
  paltaUserId: () => `palta-user-${++userSequence}`,
  identityId: () => `identity-${++identitySequence}`,
};
const defaults = {
  preferredLanguage: 'es-CL',
  timezone: 'America/Santiago',
};

const google = await resolveProviderPrincipal({
  store,
  principal: {
    provider: 'google',
    providerSubject: 'google-123',
    authenticatedAt: '2026-09-17T20:00:00-03:00',
    emailVerified: true,
    verifiedEmail: 'person@example.com',
  },
  defaults,
  ids,
  now: '2026-09-17T20:00:00-03:00',
});
assert(google.created, 'First provider identity should create a Palta account.');

const googleAgain = await resolveProviderPrincipal({
  store,
  principal: {
    provider: 'google',
    providerSubject: 'google-123',
    authenticatedAt: '2026-09-17T20:01:00-03:00',
    emailVerified: true,
    verifiedEmail: 'person@example.com',
  },
  defaults,
  ids,
  now: '2026-09-17T20:01:00-03:00',
});
assert(
  googleAgain.account.paltaUserId === google.account.paltaUserId &&
    googleAgain.identity.providerSubject === 'google-123' &&
    googleAgain.created === false,
  'The same provider subject must resolve to the same Palta account.',
);

const appleSameEmail = await resolveProviderPrincipal({
  store,
  principal: {
    provider: 'apple',
    providerSubject: 'apple-456',
    authenticatedAt: '2026-09-17T20:02:00-03:00',
    emailVerified: true,
    verifiedEmail: 'person@example.com',
  },
  defaults,
  ids,
  now: '2026-09-17T20:02:00-03:00',
});
assert(
  appleSameEmail.account.paltaUserId !== google.account.paltaUserId,
  'Matching email alone must never merge canonical Palta accounts.',
);

const phone = await linkProviderPrincipal({
  store,
  paltaUserId: google.account.paltaUserId,
  principal: {
    provider: 'phone',
    providerSubject: '+56911112222',
    authenticatedAt: '2026-09-17T20:03:00-03:00',
    emailVerified: false,
  },
  identityId: 'identity-phone',
  now: '2026-09-17T20:03:00-03:00',
});
assert(
  phone.paltaUserId === google.account.paltaUserId,
  'A newly verified identity should link to the authenticated Palta account.',
);

let collisionBlocked = false;
try {
  await linkProviderPrincipal({
    store,
    paltaUserId: google.account.paltaUserId,
    principal: {
      provider: 'apple',
      providerSubject: 'apple-456',
      authenticatedAt: '2026-09-17T20:04:00-03:00',
      emailVerified: true,
      verifiedEmail: 'person@example.com',
    },
    identityId: 'identity-should-not-link',
    now: '2026-09-17T20:04:00-03:00',
  });
} catch (error) {
  collisionBlocked =
    error instanceof AccountResolutionError && error.code === 'identity_in_use';
}
assert(collisionBlocked, 'An identity already owned by another Palta account must not be stolen.');

const onboarding = initialOnboardingState({
  profile: google.profile,
  lifeAreas: [],
});
assert(
  onboarding.canEnterHome === true &&
    onboarding.complete === false &&
    onboarding.prompts.length === 2,
  'A new user may enter Home even when optional onboarding fields are skipped.',
);

assert(
  signOutScopeForReason('user_sign_out') === 'current_session' &&
    signOutScopeForReason('suspected_compromise') === 'all_sessions' &&
    signOutScopeForReason('account_deletion') === 'all_sessions',
  'Routine sign-out should be local while recovery/security events revoke all sessions.',
);
assert(
  requiresFreshAuthentication('unlink_identity') &&
    requiresFreshAuthentication('request_account_deletion'),
  'Sensitive account changes must require fresh authentication.',
);

await store.revokeIdentity(google.account.paltaUserId, phone.identityId);
const remaining = await store.listIdentities(google.account.paltaUserId);
assert(
  remaining.filter((identity) => identity.state === 'active').length === 1,
  'Unlinking is allowed only while another active identity remains.',
);

let lastIdentityBlocked = false;
try {
  await store.revokeIdentity(google.account.paltaUserId, google.identity.identityId);
} catch (error) {
  lastIdentityBlocked =
    error instanceof Error && error.message === 'last_active_identity';
}
assert(lastIdentityBlocked, 'Persistence must also protect the last active identity.');

console.log('PASS: Palta auth/profile persistence and session tests');
