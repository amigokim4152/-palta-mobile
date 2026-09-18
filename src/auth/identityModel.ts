import type { PaltaUserId } from './accountModel.js';

export type IdentityProvider = 'apple' | 'google' | 'email' | 'phone';
export type IdentityState = 'active' | 'revoked';

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
  return `${provider}:${providerSubject}`;
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

export function sameProviderIdentity(
  left: LinkedIdentity,
  right: Pick<LinkedIdentity, 'provider' | 'providerSubject'>,
): boolean {
  return (
    left.provider === right.provider &&
    left.providerSubject === right.providerSubject
  );
}
