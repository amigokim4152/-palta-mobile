import type {
  AuthBrokerUserId,
  PaltaAccount,
  PaltaUserId,
} from './accountModel.js';
import { paltaUserIdFromAuthBrokerUserId } from './accountModel.js';
import type { LinkedIdentity } from './identityModel.js';
import type { ProviderPrincipal } from './providerPrincipal.js';
import {
  assertValidProviderPrincipal,
  validatedPrincipalEmail,
} from './providerPrincipal.js';
import type { CoreProfile } from '../profile/profileModel.js';
import type { AccountPersistencePort } from '../ports/accountPersistencePort.js';

export type AccountResolverDefaults = {
  preferredLanguage: string;
  timezone: string;
};

export type AccountResolverIds = {
  paltaUserId(): PaltaUserId;
  identityId(): string;
};

export type ResolvedAccount = {
  account: PaltaAccount;
  identity: LinkedIdentity;
  profile: CoreProfile;
  created: boolean;
};

export type CanonicalAccountResolution = {
  authBrokerUserId: AuthBrokerUserId;
  paltaUserId: PaltaUserId;
};

export type CanonicalAccountLookup = {
  accountExists(paltaUserId: PaltaUserId): Promise<boolean>;
};

export class AccountResolutionError extends Error {
  constructor(
    readonly code:
      | 'identity_revoked'
      | 'identity_in_use'
      | 'account_restricted'
      | 'account_pending_deletion'
      | 'account_deleted'
      | 'account_missing',
  ) {
    super(code);
    this.name = 'AccountResolutionError';
  }
}

/**
 * Resolve the normalized v1 account after the configured broker has completed
 * Apple/Google/Email identity handling.
 *
 * palta-dev deliberately keys public.palta_account.user_id to auth.users.id.
 * Account creation belongs to the server-owned auth.users bootstrap trigger;
 * this resolver verifies the canonical row and never creates it client-side.
 */
export async function resolveCanonicalAccount(input: {
  authBrokerUserId: AuthBrokerUserId;
  accounts: CanonicalAccountLookup;
}): Promise<CanonicalAccountResolution> {
  const paltaUserId = paltaUserIdFromAuthBrokerUserId(input.authBrokerUserId);
  if (!(await input.accounts.accountExists(paltaUserId))) {
    throw new AccountResolutionError('account_missing');
  }
  return {
    authBrokerUserId: input.authBrokerUserId,
    paltaUserId,
  };
}

function assertAccountUsable(account: PaltaAccount): void {
  switch (account.status) {
    case 'active':
      return;
    case 'restricted':
      throw new AccountResolutionError('account_restricted');
    case 'pending_deletion':
      throw new AccountResolutionError('account_pending_deletion');
    case 'deleted':
      throw new AccountResolutionError('account_deleted');
  }
}

async function resolveExisting(
  store: AccountPersistencePort,
  identity: LinkedIdentity,
): Promise<ResolvedAccount> {
  if (identity.state !== 'active') {
    throw new AccountResolutionError('identity_revoked');
  }
  const account = await store.findAccountById(identity.paltaUserId);
  if (!account) throw new AccountResolutionError('account_missing');
  assertAccountUsable(account);
  const profile =
    (await store.getCoreProfile(identity.paltaUserId)) ?? {
      paltaUserId: identity.paltaUserId,
      preferredLanguage: account.preferredLanguage,
      timezone: account.timezone,
      updatedAt: account.updatedAt,
    };
  return { account, identity, profile, created: false };
}

/**
 * Legacy provider-principal persistence flow retained for existing Core tests and
 * future non-Supabase adapters. The palta-dev mobile runtime must use
 * resolveCanonicalAccount after Supabase Auth has resolved identities; it must
 * not invoke this creation path from the client.
 */
export async function resolveProviderPrincipal(input: {
  store: AccountPersistencePort;
  principal: ProviderPrincipal;
  defaults: AccountResolverDefaults;
  ids: AccountResolverIds;
  now: string;
}): Promise<ResolvedAccount> {
  const { store, principal, defaults, ids, now } = input;
  assertValidProviderPrincipal(principal);

  const existing = await store.findIdentity(
    principal.provider,
    principal.providerSubject,
  );
  if (existing) return resolveExisting(store, existing);

  const paltaUserId = ids.paltaUserId();
  const verifiedEmail = validatedPrincipalEmail(principal);
  const account: PaltaAccount = {
    paltaUserId,
    status: 'active',
    preferredLanguage: defaults.preferredLanguage,
    timezone: defaults.timezone,
    createdAt: now,
    updatedAt: now,
    consents: [],
    ...(verifiedEmail ? { primaryVerifiedEmail: verifiedEmail } : {}),
  };
  const identity: LinkedIdentity = {
    identityId: ids.identityId(),
    paltaUserId,
    provider: principal.provider,
    providerSubject: principal.providerSubject,
    state: 'active',
    linkedAt: now,
    ...(verifiedEmail
      ? { verifiedEmail, lastVerifiedAt: principal.authenticatedAt }
      : {}),
  };
  const profile: CoreProfile = {
    paltaUserId,
    preferredLanguage: defaults.preferredLanguage,
    timezone: defaults.timezone,
    updatedAt: now,
  };

  try {
    await store.createAccountWithIdentity({ account, identity, profile });
  } catch (error) {
    const racedIdentity = await store.findIdentity(
      principal.provider,
      principal.providerSubject,
    );
    if (!racedIdentity) throw error;
    return resolveExisting(store, racedIdentity);
  }

  return { account, identity, profile, created: true };
}

export async function linkProviderPrincipal(input: {
  store: AccountPersistencePort;
  paltaUserId: PaltaUserId;
  principal: ProviderPrincipal;
  identityId: string;
  now: string;
}): Promise<LinkedIdentity> {
  const { store, paltaUserId, principal, identityId, now } = input;
  assertValidProviderPrincipal(principal);

  const account = await store.findAccountById(paltaUserId);
  if (!account) throw new AccountResolutionError('account_missing');
  assertAccountUsable(account);

  const existing = await store.findIdentity(
    principal.provider,
    principal.providerSubject,
  );
  if (existing) {
    if (existing.paltaUserId !== paltaUserId) {
      throw new AccountResolutionError('identity_in_use');
    }
    if (existing.state === 'active') return existing;
  }

  const verifiedEmail = validatedPrincipalEmail(principal);
  return store.linkIdentity({
    identityId: existing?.identityId ?? identityId,
    paltaUserId,
    provider: principal.provider,
    providerSubject: principal.providerSubject,
    state: 'active',
    linkedAt: existing?.linkedAt ?? now,
    ...(verifiedEmail
      ? { verifiedEmail, lastVerifiedAt: principal.authenticatedAt }
      : {}),
  });
}
