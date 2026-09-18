import type { AuthBrokerUserId, PaltaUserId } from './accountModel.js';
import { paltaUserIdFromAuthBrokerUserId } from './accountModel.js';

export type CanonicalAccountResolution = {
  authBrokerUserId: AuthBrokerUserId;
  paltaUserId: PaltaUserId;
};

export type CanonicalAccountLookup = {
  accountExists(paltaUserId: PaltaUserId): Promise<boolean>;
};

export class AccountResolutionError extends Error {
  constructor(readonly code: 'account_missing') {
    super(code);
    this.name = 'AccountResolutionError';
  }
}

/**
 * Normalized Gate 01 resolver.
 *
 * Supabase Auth resolves Apple/Google/Email identities into one auth.users row.
 * palta-dev deliberately keys public.palta_account.user_id to that auth.users.id.
 * Account creation remains server-owned by the auth.users bootstrap trigger; this
 * resolver only maps and verifies the canonical account and never creates one.
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
