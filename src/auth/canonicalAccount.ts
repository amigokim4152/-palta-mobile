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

/**
 * Resolve the normalized v1 account after the configured Auth broker has
 * completed Apple/Google/Email identity handling.
 *
 * palta-dev keys public.palta_account.user_id to auth.users.id. Account creation
 * remains server-owned by the auth.users bootstrap trigger; mobile/runtime code
 * may only verify the resulting canonical row through this contract.
 */
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
