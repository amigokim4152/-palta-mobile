declare const authBrokerUserIdBrand: unique symbol;

/** Stable user id issued by the configured auth broker (Supabase Auth in palta-dev). */
export type AuthBrokerUserId = string & {
  readonly [authBrokerUserIdBrand]: 'AuthBrokerUserId';
};

/**
 * Canonical application account id.
 *
 * Kept source-compatible with the existing Auth/Profile Core while normalized v1
 * stores this value as public.palta_account.user_id -> auth.users.id. Raw upstream
 * Apple/Google provider subjects must never be passed here directly.
 */
export type PaltaUserId = string;

export type AccountStatus =
  | 'active'
  | 'restricted'
  | 'pending_deletion'
  | 'deleted';

export type ConsentSource = 'onboarding' | 'settings' | 'action';

export type ConsentRecord = {
  policyKey: string;
  version: string;
  acceptedAt: string;
  source: ConsentSource;
};

export type PaltaAccount = {
  paltaUserId: PaltaUserId;
  status: AccountStatus;
  preferredLanguage: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  primaryVerifiedEmail?: string;
  consents: ConsentRecord[];
};

export function authBrokerUserId(value: string): AuthBrokerUserId {
  const normalized = value.trim();
  if (!normalized) throw new Error('auth_broker_user_id_required');
  return normalized as AuthBrokerUserId;
}

/**
 * Normalized v1 maps the Supabase auth.users id to the canonical Palta account id.
 * This conversion is explicit so upstream provider subjects cannot be confused
 * with the broker-resolved application identity.
 */
export function paltaUserIdFromAuthBrokerUserId(
  userId: AuthBrokerUserId,
): PaltaUserId {
  return userId;
}

export function hasAcceptedPolicy(
  account: PaltaAccount,
  policyKey: string,
  version: string,
): boolean {
  return account.consents.some(
    (consent) =>
      consent.policyKey === policyKey && consent.version === version,
  );
}
