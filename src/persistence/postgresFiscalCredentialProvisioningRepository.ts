import { assertFiscalCredentialEnvelope } from '../fiscal/chile/fiscalCredentialEnvelope.js';
import { assertFiscalProviderConnection } from '../fiscal/chile/fiscalProviderConnection.js';
import {
  FiscalCredentialProvisioningError,
  type FiscalCredentialProvisioningCommit,
  type FiscalCredentialProvisioningRepository,
  type FiscalCredentialProvisioningResult,
} from './fiscalCredentialProvisioningRepository.js';
import type { SqlDatabase } from './sqlDatabase.js';

type IdRow = { id: string };

function assertCommit(commit: FiscalCredentialProvisioningCommit): void {
  assertFiscalProviderConnection(commit.connection);
  assertFiscalCredentialEnvelope(commit.envelope);
  if (!Number.isSafeInteger(commit.expectedConnectionRevision) || commit.expectedConnectionRevision < 0) {
    throw new FiscalCredentialProvisioningError('expectedConnectionRevision must be a non-negative safe integer.');
  }
  if (commit.connection.revision !== commit.expectedConnectionRevision + 1) {
    throw new FiscalCredentialProvisioningError('Provisioned fiscal connection revision must equal expectedConnectionRevision + 1.');
  }
  if (commit.envelope.revision !== 0) {
    throw new FiscalCredentialProvisioningError('Initial fiscal credential envelope must start at revision 0.');
  }
  if (
    commit.connection.businessId !== commit.envelope.businessId ||
    commit.connection.id !== commit.envelope.providerConnectionId ||
    commit.connection.providerKey !== commit.envelope.providerKey ||
    commit.connection.issuerRut !== commit.envelope.issuerRut ||
    commit.connection.credentialRef !== commit.envelope.credentialRef
  ) {
    throw new FiscalCredentialProvisioningError('Fiscal provider connection and encrypted envelope identity must match exactly.');
  }
  if (commit.connection.status !== 'ready_for_test') {
    throw new FiscalCredentialProvisioningError('Initial fiscal credentials must move connection to ready_for_test.');
  }
}

export class PostgresFiscalCredentialProvisioningRepository
  implements FiscalCredentialProvisioningRepository
{
  constructor(private readonly db: SqlDatabase) {}

  async provisionNewCredential(
    commit: FiscalCredentialProvisioningCommit,
  ): Promise<FiscalCredentialProvisioningResult> {
    assertCommit(commit);

    return this.db.transaction(async (tx) => {
      const envelope = await tx.query<IdRow>(
        `insert into fiscal_credential_envelope (
          id, business_id, provider_connection_id, provider_key, issuer_rut,
          credential_ref, algorithm, ciphertext, data_iv, wrapped_data_key,
          wrap_iv, kek_id, aad_version, revision, created_at, updated_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        on conflict (business_id, provider_connection_id, credential_ref) do nothing
        returning id`,
        [
          commit.envelope.id,
          commit.envelope.businessId,
          commit.envelope.providerConnectionId,
          commit.envelope.providerKey,
          commit.envelope.issuerRut,
          commit.envelope.credentialRef,
          commit.envelope.algorithm,
          commit.envelope.ciphertext,
          commit.envelope.dataIv,
          commit.envelope.wrappedDataKey,
          commit.envelope.wrapIv,
          commit.envelope.kekId,
          commit.envelope.aadVersion,
          commit.envelope.revision,
          commit.envelope.createdAt,
          commit.envelope.updatedAt,
        ],
      );
      if (envelope.rowCount !== 1) {
        throw new FiscalCredentialProvisioningError('Encrypted fiscal credential reference already exists.');
      }

      const connection = await tx.query<IdRow>(
        `update fiscal_provider_connection set
          status = $6,
          credential_ref = $7,
          enabled_document_types = $8::jsonb,
          safe_configuration = $9::jsonb,
          revision = $10,
          last_verified_at = $11,
          updated_at = $12
        where business_id = $1
          and id = $2
          and issuer_rut = $3
          and provider_key = $4
          and revision = $5
          and status in ('pending_credentials', 'error')
        returning id`,
        [
          commit.connection.businessId,
          commit.connection.id,
          commit.connection.issuerRut,
          commit.connection.providerKey,
          commit.expectedConnectionRevision,
          commit.connection.status,
          commit.connection.credentialRef,
          JSON.stringify(commit.connection.enabledDocumentTypes),
          JSON.stringify(commit.connection.safeConfiguration),
          commit.connection.revision,
          commit.connection.lastVerifiedAt ?? null,
          commit.connection.updatedAt,
        ],
      );
      if (connection.rowCount !== 1) {
        throw new FiscalCredentialProvisioningError('Fiscal provider connection changed during credential provisioning.');
      }

      return {
        connection: commit.connection,
        envelope: commit.envelope,
      };
    });
  }
}
