import type { AuthBrokerUserId, PaltaUserId } from './accountModel.js';
import { paltaUserIdFromAuthBrokerUserId } from './accountModel.js';

export type CanonicalAccountResolution = {
  authBrokerUserId: AuthBrokerUserId;
  paltaUserId: PaltaUserId;
};

export type CanonicalAccountLookup = {
  accountExists(paltaUserId: PaltaUserId): Promise<boolean>;
};

export class CanonicalAccountResolutionError extends Error {
  constructor(readonly code: 'account_missing') {
    super(code);
    this.name = 'CanonicalAccountResolutionError';
  }
}

export async function resolveCanonicalAccount(input: {
  authBrokerUserId: AuthBrokerUserId;
  accounts: CanonicalAccountLookup;
}): Promise<CanonicalAccountResolution> {
  const paltaUserId = paltaUserIdFromAuthBrokerUserId(input.authBrokerUserId);
  if (!(await input.accounts.accountExists(paltaUserId))) {
    throw new CanonicalAccountResolutionError('account_missing');
  }
  return {
    authBrokerUserId: input.authBrokerUserId,
    paltaUserId,
  };
}
