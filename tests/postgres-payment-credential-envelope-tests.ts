import type { PaymentCredentialEnvelope } from '../src/payment/paymentCredentialEnvelope.js';
import { PaymentCredentialConcurrencyError } from '../src/persistence/paymentCredentialEnvelopeRepository.js';
import { PostgresPaymentCredentialEnvelopeRepository } from '../src/persistence/postgresPaymentCredentialEnvelopeRepository.js';
import type {
  SqlDatabase,
  SqlExecutor,
  SqlQueryResult,
} from '../src/persistence/sqlDatabase.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type Row = Record<string, unknown>;
class FakeDb implements SqlDatabase {
  queries: Array<{ sql: string; params: readonly unknown[] }> = [];
  constructor(private readonly responses: Array<SqlQueryResult<Row>>) {}
  async query<T extends Row>(sql: string, params: readonly unknown[] = []): Promise<SqlQueryResult<T>> {
    this.queries.push({ sql, params });
    const response = this.responses.shift();
    if (!response) throw new Error(`No fake response for ${sql}`);
    return response as SqlQueryResult<T>;
  }
  async transaction<T>(_work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    throw new Error('Credential envelope repository uses single-statement CAS operations.');
  }
}

const envelope: PaymentCredentialEnvelope = {
  id: '11111111-1111-4111-8111-111111111111',
  businessId: '22222222-2222-4222-8222-222222222222',
  providerConnectionId: '33333333-3333-4333-8333-333333333333',
  providerKey: 'mercadopago_point',
  credentialRef: 'credential://business-a/mp',
  algorithm: 'AES-256-GCM',
  ciphertext: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
  dataIv: new Uint8Array(12).fill(1),
  wrappedDataKey: new Uint8Array(48).fill(2),
  wrapIv: new Uint8Array(12).fill(3),
  kekId: 'kek-v1',
  aadVersion: 1,
  revision: 0,
  createdAt: '2026-09-17T18:10:00.000Z',
  updatedAt: '2026-09-17T18:10:00.000Z',
};

function row(value: PaymentCredentialEnvelope): Row {
  return {
    id: value.id,
    business_id: value.businessId,
    provider_connection_id: value.providerConnectionId,
    provider_key: value.providerKey,
    credential_ref: value.credentialRef,
    algorithm: value.algorithm,
    ciphertext: value.ciphertext,
    data_iv: value.dataIv,
    wrapped_data_key: value.wrappedDataKey,
    wrap_iv: value.wrapIv,
    kek_id: value.kekId,
    aad_version: value.aadVersion,
    revision: value.revision,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
  };
}

const createDb = new FakeDb([{ rows: [row(envelope)], rowCount: 1 }]);
const created = await new PostgresPaymentCredentialEnvelopeRepository(createDb).saveEnvelope({
  envelope,
  expectedRevision: null,
});
assert(created.credentialRef === envelope.credentialRef, 'Encrypted credential create must round-trip canonical reference.');
assert(
  createDb.queries[0]?.sql.includes('on conflict (business_id, provider_connection_id, credential_ref) do nothing'),
  'Credential creation must have a database-level duplicate reference guard.',
);
assert(
  createDb.queries[0]?.params.includes(envelope.ciphertext) &&
    !createDb.queries[0]?.params.includes('ACCESS-TOKEN'),
  'Credential persistence receives ciphertext bytes, never plaintext provider tokens.',
);

const lookupDb = new FakeDb([{ rows: [row(envelope)], rowCount: 1 }]);
const found = await new PostgresPaymentCredentialEnvelopeRepository(lookupDb).findEnvelope({
  businessId: envelope.businessId,
  providerConnectionId: envelope.providerConnectionId,
  providerKey: envelope.providerKey,
  credentialRef: envelope.credentialRef,
});
assert(found?.businessId === envelope.businessId, 'Credential lookup must return matching business envelope.');
assert(
  lookupDb.queries[0]?.sql.includes('business_id = $1') &&
    lookupDb.queries[0]?.sql.includes('provider_connection_id = $2') &&
    lookupDb.queries[0]?.sql.includes('provider_key = $3') &&
    lookupDb.queries[0]?.sql.includes('credential_ref = $4'),
  'Credential lookup must bind all tenant/provider/connection/reference dimensions.',
);

const rotated: PaymentCredentialEnvelope = {
  ...envelope,
  ciphertext: new Uint8Array(envelope.ciphertext).fill(9),
  kekId: 'kek-v2',
  revision: 1,
  updatedAt: '2026-09-17T18:11:00.000Z',
};
const updateDb = new FakeDb([{ rows: [row(rotated)], rowCount: 1 }]);
const updated = await new PostgresPaymentCredentialEnvelopeRepository(updateDb).saveEnvelope({
  envelope: rotated,
  expectedRevision: 0,
});
assert(updated.revision === 1 && updated.kekId === 'kek-v2', 'Credential rotation must persist revision and new KEK identity.');
assert(
  updateDb.queries[0]?.sql.includes('and revision = $14'),
  'Credential rotation must use compare-and-swap revision in SQL.',
);

const staleDb = new FakeDb([{ rows: [], rowCount: 0 }]);
let staleBlocked = false;
try {
  await new PostgresPaymentCredentialEnvelopeRepository(staleDb).saveEnvelope({
    envelope: rotated,
    expectedRevision: 0,
  });
} catch (error) {
  staleBlocked = error instanceof PaymentCredentialConcurrencyError;
}
assert(staleBlocked, 'Stale credential rotation must fail instead of overwriting newer secret material.');

console.log('PASS: Postgres encrypted payment credential envelope tests');
