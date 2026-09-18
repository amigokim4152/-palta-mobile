import type { ConsentRecord, PaltaAccount, PaltaUserId } from '../auth/accountModel.js';
import type { IdentityProvider, LinkedIdentity } from '../auth/identityModel.js';
import type { CoreProfile } from '../profile/profileModel.js';

export type NewAccountBundle = {
  account: PaltaAccount;
  identity: LinkedIdentity;
  profile: CoreProfile;
};

export interface AccountPersistencePort {
  findAccountById(paltaUserId: PaltaUserId): Promise<PaltaAccount | null>;
  findIdentity(
    provider: IdentityProvider,
    providerSubject: string,
  ): Promise<LinkedIdentity | null>;
  listIdentities(paltaUserId: PaltaUserId): Promise<LinkedIdentity[]>;
  createAccountWithIdentity(bundle: NewAccountBundle): Promise<void>;
  linkIdentity(identity: LinkedIdentity): Promise<LinkedIdentity>;
  revokeIdentity(
    paltaUserId: PaltaUserId,
    identityId: string,
  ): Promise<void>;
  getCoreProfile(paltaUserId: PaltaUserId): Promise<CoreProfile | null>;
  upsertCoreProfile(profile: CoreProfile): Promise<CoreProfile>;
  saveConsent(
    paltaUserId: PaltaUserId,
    consent: ConsentRecord,
  ): Promise<void>;
}
