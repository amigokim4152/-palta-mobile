import type {
  AccountStatus,
  ConsentRecord,
  ConsentSource,
  PaltaAccount,
  PaltaUserId,
} from '../auth/accountModel.js';
import type {
  IdentityProvider,
  IdentityState,
  LinkedIdentity,
} from '../auth/identityModel.js';
import type { CoreProfile } from '../profile/profileModel.js';
import type {
  AccountPersistencePort,
  NewAccountBundle,
} from '../ports/accountPersistencePort.js';
import type { DatabasePort } from '../ports/databasePort.js';

type AccountRow = {
  palta_user_id: string;
  status: AccountStatus;
  preferred_language: string;
  timezone: string;
  created_at: string;
  updated_at: string;
  primary_verified_email: string | null;
};

type ConsentRow = {
  policy_key: string;
  version: string;
  accepted_at: string;
  source: ConsentSource;
};

type IdentityRow = {
  identity_id: string;
  palta_user_id: string;
  provider: IdentityProvider;
  provider_subject: string;
  state: IdentityState;
  linked_at: string;
  verified_email: string | null;
  last_verified_at: string | null;
};

type ProfileRow = {
  palta_user_id: string;
  preferred_language: string;
  timezone: string;
  updated_at: string;
  preferred_name: string | null;
  profile_photo_ref: string | null;
  country_code: string | null;
};

function mapConsent(row: ConsentRow): ConsentRecord {
  return {
    policyKey: row.policy_key,
    version: row.version,
    acceptedAt: row.accepted_at,
    source: row.source,
  };
}

function mapAccount(
  row: AccountRow,
  consents: readonly ConsentRecord[],
): PaltaAccount {
  const base: PaltaAccount = {
    paltaUserId: row.palta_user_id,
    status: row.status,
    preferredLanguage: row.preferred_language,
    timezone: row.timezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    consents: [...consents],
  };
  return row.primary_verified_email
    ? { ...base, primaryVerifiedEmail: row.primary_verified_email }
    : base;
}

function mapIdentity(row: IdentityRow): LinkedIdentity {
  return {
    identityId: row.identity_id,
    paltaUserId: row.palta_user_id,
    provider: row.provider,
    providerSubject: row.provider_subject,
    state: row.state,
    linkedAt: row.linked_at,
    ...(row.verified_email ? { verifiedEmail: row.verified_email } : {}),
    ...(row.last_verified_at ? { lastVerifiedAt: row.last_verified_at } : {}),
  };
}

function mapProfile(row: ProfileRow): CoreProfile {
  return {
    paltaUserId: row.palta_user_id,
    preferredLanguage: row.preferred_language,
    timezone: row.timezone,
    updatedAt: row.updated_at,
    ...(row.preferred_name ? { preferredName: row.preferred_name } : {}),
    ...(row.profile_photo_ref ? { profilePhotoRef: row.profile_photo_ref } : {}),
    ...(row.country_code ? { countryCode: row.country_code } : {}),
  };
}

export class PostgresAccountPersistence implements AccountPersistencePort {
  constructor(private readonly db: DatabasePort) {}

  async findAccountById(paltaUserId: PaltaUserId): Promise<PaltaAccount | null> {
    const accountResult = await this.db.query<AccountRow>(
      `select palta_user_id, status, preferred_language, timezone,
              created_at, updated_at, primary_verified_email
         from palta_private.accounts
        where palta_user_id = $1`,
      [paltaUserId],
    );
    const row = accountResult.rows[0];
    if (!row) return null;

    const consentResult = await this.db.query<ConsentRow>(
      `select policy_key, version, accepted_at, source
         from palta_private.consents
        where palta_user_id = $1
        order by accepted_at asc`,
      [paltaUserId],
    );
    return mapAccount(row, consentResult.rows.map(mapConsent));
  }

  async findIdentity(
    provider: IdentityProvider,
    providerSubject: string,
  ): Promise<LinkedIdentity | null> {
    const result = await this.db.query<IdentityRow>(
      `select identity_id, palta_user_id, provider, provider_subject,
              state, linked_at, verified_email, last_verified_at
         from palta_private.identities
        where provider = $1 and provider_subject = $2`,
      [provider, providerSubject],
    );
    const row = result.rows[0];
    return row ? mapIdentity(row) : null;
  }

  async listIdentities(paltaUserId: PaltaUserId): Promise<LinkedIdentity[]> {
    const result = await this.db.query<IdentityRow>(
      `select identity_id, palta_user_id, provider, provider_subject,
              state, linked_at, verified_email, last_verified_at
         from palta_private.identities
        where palta_user_id = $1
        order by linked_at asc`,
      [paltaUserId],
    );
    return result.rows.map(mapIdentity);
  }

  async createAccountWithIdentity(bundle: NewAccountBundle): Promise<void> {
    await this.db.transaction(async (tx) => {
      const { account, identity, profile } = bundle;
      await tx.query(
        `insert into palta_private.accounts
          (palta_user_id, status, preferred_language, timezone,
           created_at, updated_at, primary_verified_email)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          account.paltaUserId,
          account.status,
          account.preferredLanguage,
          account.timezone,
          account.createdAt,
          account.updatedAt,
          account.primaryVerifiedEmail ?? null,
        ],
      );
      await tx.query(
        `insert into palta_private.identities
          (identity_id, palta_user_id, provider, provider_subject,
           state, linked_at, verified_email, last_verified_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          identity.identityId,
          identity.paltaUserId,
          identity.provider,
          identity.providerSubject,
          identity.state,
          identity.linkedAt,
          identity.verifiedEmail ?? null,
          identity.lastVerifiedAt ?? null,
        ],
      );
      await tx.query(
        `insert into palta_private.core_profiles
          (palta_user_id, preferred_language, timezone, updated_at,
           preferred_name, profile_photo_ref, country_code)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          profile.paltaUserId,
          profile.preferredLanguage,
          profile.timezone,
          profile.updatedAt,
          profile.preferredName ?? null,
          profile.profilePhotoRef ?? null,
          profile.countryCode ?? null,
        ],
      );
      for (const consent of account.consents) {
        await tx.query(
          `insert into palta_private.consents
            (palta_user_id, policy_key, version, accepted_at, source)
           values ($1, $2, $3, $4, $5)`,
          [
            account.paltaUserId,
            consent.policyKey,
            consent.version,
            consent.acceptedAt,
            consent.source,
          ],
        );
      }
    });
  }

  async linkIdentity(identity: LinkedIdentity): Promise<LinkedIdentity> {
    const result = await this.db.query<IdentityRow>(
      `insert into palta_private.identities
        (identity_id, palta_user_id, provider, provider_subject,
         state, linked_at, verified_email, last_verified_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (provider, provider_subject) do update
         set state = 'active',
             verified_email = coalesce(excluded.verified_email, palta_private.identities.verified_email),
             last_verified_at = coalesce(excluded.last_verified_at, palta_private.identities.last_verified_at)
       where palta_private.identities.palta_user_id = excluded.palta_user_id
       returning identity_id, palta_user_id, provider, provider_subject,
                 state, linked_at, verified_email, last_verified_at`,
      [
        identity.identityId,
        identity.paltaUserId,
        identity.provider,
        identity.providerSubject,
        identity.state,
        identity.linkedAt,
        identity.verifiedEmail ?? null,
        identity.lastVerifiedAt ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('identity_in_use');
    return mapIdentity(row);
  }

  async revokeIdentity(
    paltaUserId: PaltaUserId,
    identityId: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const identities = await tx.query<IdentityRow>(
        `select identity_id, palta_user_id, provider, provider_subject,
                state, linked_at, verified_email, last_verified_at
           from palta_private.identities
          where palta_user_id = $1
          for update`,
        [paltaUserId],
      );
      const target = identities.rows.find((row) => row.identity_id === identityId);
      if (!target || target.state === 'revoked') return;
      const activeCount = identities.rows.filter((row) => row.state === 'active').length;
      if (activeCount <= 1) throw new Error('last_active_identity');
      await tx.query(
        `update palta_private.identities
            set state = 'revoked'
          where palta_user_id = $1 and identity_id = $2`,
        [paltaUserId, identityId],
      );
    });
  }

  async getCoreProfile(paltaUserId: PaltaUserId): Promise<CoreProfile | null> {
    const result = await this.db.query<ProfileRow>(
      `select palta_user_id, preferred_language, timezone, updated_at,
              preferred_name, profile_photo_ref, country_code
         from palta_private.core_profiles
        where palta_user_id = $1`,
      [paltaUserId],
    );
    const row = result.rows[0];
    return row ? mapProfile(row) : null;
  }

  async upsertCoreProfile(profile: CoreProfile): Promise<CoreProfile> {
    const result = await this.db.query<ProfileRow>(
      `insert into palta_private.core_profiles
        (palta_user_id, preferred_language, timezone, updated_at,
         preferred_name, profile_photo_ref, country_code)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (palta_user_id) do update
         set preferred_language = excluded.preferred_language,
             timezone = excluded.timezone,
             updated_at = excluded.updated_at,
             preferred_name = excluded.preferred_name,
             profile_photo_ref = excluded.profile_photo_ref,
             country_code = excluded.country_code
       returning palta_user_id, preferred_language, timezone, updated_at,
                 preferred_name, profile_photo_ref, country_code`,
      [
        profile.paltaUserId,
        profile.preferredLanguage,
        profile.timezone,
        profile.updatedAt,
        profile.preferredName ?? null,
        profile.profilePhotoRef ?? null,
        profile.countryCode ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('profile_upsert_failed');
    return mapProfile(row);
  }

  async saveConsent(
    paltaUserId: PaltaUserId,
    consent: ConsentRecord,
  ): Promise<void> {
    await this.db.query(
      `insert into palta_private.consents
        (palta_user_id, policy_key, version, accepted_at, source)
       values ($1, $2, $3, $4, $5)
       on conflict (palta_user_id, policy_key, version) do update
         set accepted_at = excluded.accepted_at,
             source = excluded.source`,
      [
        paltaUserId,
        consent.policyKey,
        consent.version,
        consent.acceptedAt,
        consent.source,
      ],
    );
  }
}
