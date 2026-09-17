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
