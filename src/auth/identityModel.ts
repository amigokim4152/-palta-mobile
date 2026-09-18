import type { PaltaUserId } from './accountModel.js';

export type IdentityProvider = 'apple' | 'google' | 'email' | 'phone';
export type IdentityState = 'active' | 'revoked';

/**
 * Raw upstream identity. providerSubject must never be used as PaltaUserId directly.
 * Supabase Auth is responsible for provider identity linking before Core sees an
 * AuthBrokerUserId.
 */
export type LinkedIdentity = {
  identityId: string;
  paltaUserId: PaltaUserId;
  provider: IdentityProvider;
  providerSubject: string;
  state: IdentityState;
  linkedAt: string;
  verifiedEmail?: string;
  lastVerifiedAt?: string;
};

export function providerIdentityKey(
  provider: IdentityProvider,
  providerSubject: string,
): string {
  const subject = providerSubject.trim();
  if (!subject) throw new Error('provider_subject_required');
  return `${provider}:${subject}`;
}

export function activeIdentities(
  identities: readonly LinkedIdentity[],
): LinkedIdentity[] {
  return identities.filter((identity) => identity.state === 'active');
}

export function canUnlinkIdentity(
  identities: readonly LinkedIdentity[],
  identityId: string,
): boolean {
  const target = identities.find((identity) => identity.identityId === identityId);
  if (!target || target.state !== 'active') return false;
  return activeIdentities(identities).length > 1;
}
