import {
  assertFiscalCredentialEnvelope,
  type FiscalCredentialEnvelope,
} from '../fiscal/chile/fiscalCredentialEnvelope.js';
import {
  FiscalCredentialConcurrencyError,
  type FiscalCredentialEnvelopeLookup,
  type FiscalCredentialEnvelopeRepository,
  type FiscalCredentialEnvelopeWrite,
} from './fiscalCredentialEnvelopeRepository.js';
import type { SqlDatabase } from './sqlDatabase.js';

type EnvelopeRow = {
  id: string;
  business_id: string;
  provider_connection_id: string;
  provider_key: string;
  issuer_rut: string;
  credential_ref: string;
  algorithm: 'AES-256-GCM';
  ciphertext: unknown;
  data_iv: unknown;
  wrapped_data_key: unknown;
  wrap_iv: unknown;
  kek_id: string;
  aad_version: number | string;
  revision: number | string;
  created_at: string;
  updated_at: string;
};

const COLUMNS = `
  id,
  business_id,
  provider_connection_id,
  provider_key,
  issuer_rut,
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
`;

function safeInteger(value: number | string, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${field} is outside Palta safe-integer range.`);
  }
  return parsed;
}

function bytes(value: unknown, field: string): Uint8Array {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  throw new Error(`${field} must be returned by Postgres as binary data.`);
}

function rowToEnvelope(row: EnvelopeRow): FiscalCredentialEnvelope {
  const envelope: FiscalCredentialEnvelope = {
    id: row.id,
    businessId: row.business_id,
    providerConnectionId: row.provider_connection_id,
    providerKey: row.provider_key,
    issuerRut: row.issuer_rut,
    credentialRef: row.credential_ref,
    algorithm: row.algorithm,
    ciphertext: bytes(row.ciphertext, 'fiscal credential ciphertext'),
    dataIv: bytes(row.data_iv, 'fiscal credential data_iv'),
    wrappedDataKey: bytes(row.wrapped_data_key, 'fiscal credential wrapped_data_key'),
    wrapIv: bytes(row.wrap_iv, 'fiscal credential wrap_iv'),
    kekId: row.kek_id,
    aadVersion: safeInteger(row.aad_version, 'fiscal credential aad_version'),
    revision: safeInteger(row.revision, 'fiscal credential revision'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  assertFiscalCredentialEnvelope(envelope);
  return envelope;
}

export class PostgresFiscalCredentialEnvelopeRepository
  implements FiscalCredentialEnvelopeRepository
{
  constructor(private readonly db: SqlDatabase) {}

  async findEnvelope(
    lookup: FiscalCredentialEnvelopeLookup,
  ): Promise<FiscalCredentialEnvelope | null> {
    const result = await this.db.query<EnvelopeRow>(
      `select ${COLUMNS}
       from fiscal_credential_envelope
       where business_id = $1
         and provider_connection_id = $2
         and provider_key = $3
         and issuer_rut = $4
         and credential_ref = $5
       limit 1`,
      [
        lookup.businessId,
        lookup.providerConnectionId,
        lookup.providerKey,
        lookup.issuerRut,
        lookup.credentialRef,
      ],
    );
    const row = result.rows[0];
    return row ? rowToEnvelope(row) : null;
  }

  async saveEnvelope(
    write: FiscalCredentialEnvelopeWrite,
  ): Promise<FiscalCredentialEnvelope> {
    assertFiscalCredentialEnvelope(write.envelope);

    if (write.expectedRevision === null) {
      if (write.envelope.revision !== 0) {
        throw new FiscalCredentialConcurrencyError(
          'New fiscal credential envelope must start at revision 0.',
        );
      }
      const result = await this.db.query<EnvelopeRow>(
        `insert into fiscal_credential_envelope (
          id, business_id, provider_connection_id, provider_key, issuer_rut,
          credential_ref, algorithm, ciphertext, data_iv, wrapped_data_key,
          wrap_iv, kek_id, aad_version, revision, created_at, updated_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        on conflict (business_id, provider_connection_id, credential_ref) do nothing
        returning ${COLUMNS}`,
        [
          write.envelope.id,
          write.envelope.businessId,
          write.envelope.providerConnectionId,
          write.envelope.providerKey,
          write.envelope.issuerRut,
          write.envelope.credentialRef,
          write.envelope.algorithm,
          write.envelope.ciphertext,
          write.envelope.dataIv,
          write.envelope.wrappedDataKey,
          write.envelope.wrapIv,
          write.envelope.kekId,
          write.envelope.aadVersion,
          write.envelope.revision,
          write.envelope.createdAt,
          write.envelope.updatedAt,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new FiscalCredentialConcurrencyError('Fiscal credential reference already exists.');
      return rowToEnvelope(row);
    }

    if (!Number.isSafeInteger(write.expectedRevision) || write.expectedRevision < 0) {
      throw new FiscalCredentialConcurrencyError('expectedRevision must be a non-negative safe integer.');
    }
    if (write.envelope.revision !== write.expectedRevision + 1) {
      throw new FiscalCredentialConcurrencyError(
        'Updated fiscal credential revision must equal expectedRevision + 1.',
      );
    }

    const result = await this.db.query<EnvelopeRow>(
      `update fiscal_credential_envelope set
        ciphertext = $7,
        data_iv = $8,
        wrapped_data_key = $9,
        wrap_iv = $10,
        kek_id = $11,
        aad_version = $12,
        revision = $13,
        updated_at = $14
       where business_id = $1
         and provider_connection_id = $2
         and provider_key = $3
         and issuer_rut = $4
         and credential_ref = $5
         and id = $6
         and revision = $15
       returning ${COLUMNS}`,
      [
        write.envelope.businessId,
        write.envelope.providerConnectionId,
        write.envelope.providerKey,
        write.envelope.issuerRut,
        write.envelope.credentialRef,
        write.envelope.id,
        write.envelope.ciphertext,
        write.envelope.dataIv,
        write.envelope.wrappedDataKey,
        write.envelope.wrapIv,
        write.envelope.kekId,
        write.envelope.aadVersion,
        write.envelope.revision,
        write.envelope.updatedAt,
        write.expectedRevision,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new FiscalCredentialConcurrencyError();
    return rowToEnvelope(row);
  }
}
