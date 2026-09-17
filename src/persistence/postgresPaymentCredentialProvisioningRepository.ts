import { assertPaymentCredentialEnvelope } from '../payment/paymentCredentialEnvelope.js';
import { assertPaymentProviderConnection } from '../payment/paymentProviderConnection.js';
import {
  PaymentCredentialProvisioningError,
  type PaymentCredentialProvisioningCommit,
  type PaymentCredentialProvisioningRepository,
  type PaymentCredentialProvisioningResult,
} from './paymentCredentialProvisioningRepository.js';
import type { SqlDatabase } from './sqlDatabase.js';

type IdRow = { id: string };

function assertProvisioningCommit(commit: PaymentCredentialProvisioningCommit): void {
  assertPaymentProviderConnection(commit.connection);
  assertPaymentCredentialEnvelope(commit.envelope);

  if (!Number.isSafeInteger(commit.expectedConnectionRevision) || commit.expectedConnectionRevision < 0) {
    throw new PaymentCredentialProvisioningError('expectedConnectionRevision must be a non-negative safe integer.');
  }
  if (commit.connection.revision !== commit.expectedConnectionRevision + 1) {
    throw new PaymentCredentialProvisioningError(
      'Provisioned connection revision must equal expectedConnectionRevision + 1.',
    );
  }
  if (commit.envelope.revision !== 0) {
    throw new PaymentCredentialProvisioningError('Initial credential envelope must start at revision 0.');
  }
  if (
    commit.connection.businessId !== commit.envelope.businessId ||
    commit.connection.id !== commit.envelope.providerConnectionId ||
    commit.connection.providerKey !== commit.envelope.providerKey ||
    commit.connection.credentialRef !== commit.envelope.credentialRef
  ) {
    throw new PaymentCredentialProvisioningError(
      'Provider connection and encrypted credential envelope identity must match exactly.',
    );
  }
  if (commit.connection.status !== 'ready_for_test') {
    throw new PaymentCredentialProvisioningError(
      'Initial encrypted credentials must move connection to ready_for_test.',
    );
  }
}

export class PostgresPaymentCredentialProvisioningRepository
  implements PaymentCredentialProvisioningRepository
{
  constructor(private readonly db: SqlDatabase) {}

  async provisionNewCredential(
    commit: PaymentCredentialProvisioningCommit,
  ): Promise<PaymentCredentialProvisioningResult> {
    assertProvisioningCommit(commit);

    return this.db.transaction(async (tx) => {
      const envelope = await tx.query<IdRow>(
        `insert into payment_credential_envelope (
          id,
          business_id,
          provider_connection_id,
          provider_key,
          credential_ref,
          algorithm,
          ciphertext,
          data_iv,
          wrapped_data_key,
          wrap_iv,
          kek_id,
          aad_version,
          revision,
          created_at,
          updated_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        on conflict (business_id, provider_connection_id, credential_ref) do nothing
        returning id`,
        [
          commit.envelope.id,
          commit.envelope.businessId,
          commit.envelope.providerConnectionId,
          commit.envelope.providerKey,
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
        throw new PaymentCredentialProvisioningError(
          'Encrypted payment credential reference already exists.',
        );
      }

      const connection = await tx.query<IdRow>(
        `update payment_provider_connection set
          status = $5,
          credential_ref = $6,
          merchant_ref = $7,
          capabilities = $8::jsonb,
          safe_configuration = $9::jsonb,
          revision = $10,
          last_verified_at = $11,
          updated_at = $12
        where business_id = $1
          and id = $2
          and provider_key = $3
          and revision = $4
          and status in ('pending_credentials', 'error')
        returning id`,
        [
          commit.connection.businessId,
          commit.connection.id,
          commit.connection.providerKey,
          commit.expectedConnectionRevision,
          commit.connection.status,
          commit.connection.credentialRef,
          commit.connection.merchantRef ?? null,
          JSON.stringify(commit.connection.capabilities),
          JSON.stringify(commit.connection.safeConfiguration),
          commit.connection.revision,
          commit.connection.lastVerifiedAt ?? null,
          commit.connection.updatedAt,
        ],
      );
      if (connection.rowCount !== 1) {
        throw new PaymentCredentialProvisioningError(
          'Provider connection changed while credentials were being provisioned.',
        );
      }

      return {
        connection: commit.connection,
        envelope: commit.envelope,
      };
    });
  }
}
