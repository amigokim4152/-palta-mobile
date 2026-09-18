declare const authBrokerUserIdBrand: unique symbol;
declare const paltaUserIdBrand: unique symbol;

/**
 * Stable user id issued by the configured auth broker (Supabase Auth in palta-dev).
 * This is not an Apple/Google provider subject.
 */
export type AuthBrokerUserId = string & {
  readonly [authBrokerUserIdBrand]: 'AuthBrokerUserId';
};

/** Canonical Palta account id used by application Core. */
export type PaltaUserId = string & {
  readonly [paltaUserIdBrand]: 'PaltaUserId';
};

export type AccountStatus =
  | 'active'
  | 'restricted'
  | 'pending_deletion'
  | 'deleted';

/**
 * Normalized v1 account model. palta-dev currently stores public.palta_account.user_id
 * as a FK to auth.users.id. The explicit conversion keeps that storage decision from
 * collapsing raw provider identities into the Core account type.
 */
export type PaltaAccount = {
  paltaUserId: PaltaUserId;
  status: AccountStatus;
  preferredLocale?: string;
  displayName?: string;
  createdAt?: string;
  updatedAt?: string;
};

export function authBrokerUserId(value: string): AuthBrokerUserId {
  const normalized = value.trim();
  if (!normalized) throw new Error('auth_broker_user_id_required');
  return normalized as AuthBrokerUserId;
}

export function paltaUserIdFromAuthBrokerUserId(
  userId: AuthBrokerUserId,
): PaltaUserId {
  return userId as unknown as PaltaUserId;
}
