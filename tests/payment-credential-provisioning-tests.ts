import type {
  CredentialKek,
  CredentialKekProvider,
} from '../src/adapters/secrets/envelopePaymentSecretStore.js';
import { openPaymentCredentials } from '../src/adapters/secrets/envelopePaymentSecretStore.js';
import { PaymentConnectionProvisioningService } from '../src/payment/paymentConnectionProvisioningService.js';
import type { PaymentProviderConnection } from '../src/payment/paymentProviderConnection.js';
import type {
  PaymentCredentialProvisioningCommit,
  PaymentCredentialProvisioningRepository,
  PaymentCredentialProvisioningResult,
} from '../src/persistence/paymentCredentialProvisioningRepository.js';
import { PaymentCredentialProvisioningError } from '../src/persistence/paymentCredentialProvisioningRepository.js';
import { PostgresPaymentCredentialProvisioningRepository } from '../src/persistence/postgresPaymentCredentialProvisioningRepository.js';
import type {
  SqlDatabase,
  SqlExecutor,
  SqlQueryResult,
} from '../src/persistence/sqlDatabase.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const kek: CredentialKek = {
  id: 'kek-v1',
  key: await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  ),
};
class Keks implements CredentialKekProvider {
  async current() { return kek; }
  async byId(id: string) { return id === kek.id ? kek : null; }
}

const pendingConnection: PaymentProviderConnection = {
  id: '11111111-1111-4111-8111-111111111111',
  businessId: '22222222-2222-4222-8222-222222222222',
  providerKey: 'mercadopago_point',
  environment: 'sandbox',
  status: 'pending_credentials',
  capabilities: { card: true },
  safeConfiguration: {},
  revision: 3,
  createdAt: '2026-09-17T18:20:00.000Z',
  updatedAt: '2026-09-17T18:20:00.000Z',
};

class CapturingProvisioningRepository implements PaymentCredentialProvisioningRepository {
  commit?: PaymentCredentialProvisioningCommit;
  async provisionNewCredential(
    commit: PaymentCredentialProvisioningCommit,
  ): Promise<PaymentCredentialProvisioningResult> {
    this.commit = commit;
    return { connection: commit.connection, envelope: commit.envelope };
  }
}

const capturing = new CapturingProvisioningRepository();
const service = new PaymentConnectionProvisioningService(
  capturing,
  new Keks(),
  {
    envelopeId: () => '33333333-3333-4333-8333-333333333333',
    credentialRef: () => 'credential://business-a/mp/1',
  },
);
const provisioned = await service.provision({
  connection: pendingConnection,
  bundle: {
    access_token: 'ACCESS-TOKEN-RAW',
    refresh_token: 'REFRESH-TOKEN-RAW',
  },
  merchantRef: 'MP-MERCHANT-A',
  occurredAt: '2026-09-17T18:21:00.000Z',
});
assert(provisioned.connection.status === 'ready_for_test', 'Credential provisioning must move connection to ready_for_test.');
assert(provisioned.connection.revision === 4, 'Credential provisioning must consume exactly one connection revision.');
assert(provisioned.connection.credentialRef === 'credential://business-a/mp/1', 'Connection stores only opaque credential reference.');
assert(
  !JSON.stringify(provisioned.connection).includes('ACCESS-TOKEN-RAW') &&
    !JSON.stringify(provisioned.connection).includes('REFRESH-TOKEN-RAW'),
  'Raw provider credentials must never enter canonical payment connection state.',
);
assert(capturing.commit?.expectedConnectionRevision === 3, 'Atomic repository must compare-and-swap the original connection revision.');
const decrypted = await openPaymentCredentials({ envelope: provisioned.envelope, kek });
assert(decrypted.access_token === 'ACCESS-TOKEN-RAW', 'Provisioned encrypted envelope must contain the provider credential bundle.');

// Postgres implementation must put both writes on the same transaction executor.
type Row = Record<string, unknown>;
class AtomicDb implements SqlDatabase {
  transactionCount = 0;
  rootWriteAttempted = false;
  transactionQueries: string[] = [];
  constructor(private readonly connectionRowCount = 1) {}
  async query<T extends Row>(_sql: string, _params: readonly unknown[] = []): Promise<SqlQueryResult<T>> {
    this.rootWriteAttempted = true;
    throw new Error('Provisioning must never write outside SQL transaction.');
  }
  async transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    const tx: SqlExecutor = {
      query: async <TRow extends Row>(sql: string): Promise<SqlQueryResult<TRow>> => {
        this.transactionQueries.push(sql);
        if (sql.includes('insert into payment_credential_envelope')) {
          return { rows: [{ id: provisioned.envelope.id }] as TRow[], rowCount: 1 };
        }
        if (sql.includes('update payment_provider_connection')) {
          return {
            rows: this.connectionRowCount === 1
              ? [{ id: provisioned.connection.id }] as TRow[]
              : [],
            rowCount: this.connectionRowCount,
          };
        }
        throw new Error(`Unexpected provisioning SQL: ${sql}`);
      },
    };
    return work(tx);
  }
}

const atomicDb = new AtomicDb();
const atomicResult = await new PostgresPaymentCredentialProvisioningRepository(atomicDb)
  .provisionNewCredential({
    connection: provisioned.connection,
    envelope: provisioned.envelope,
    expectedConnectionRevision: pendingConnection.revision,
  });
assert(atomicResult.connection.status === 'ready_for_test', 'Atomic repository should return provisioned connection.');
assert(
  atomicDb.transactionCount === 1 &&
    atomicDb.rootWriteAttempted === false &&
    atomicDb.transactionQueries.some((sql) => sql.includes('insert into payment_credential_envelope')) &&
    atomicDb.transactionQueries.some((sql) => sql.includes('update payment_provider_connection')),
  'Encrypted credential insert and connection activation must execute inside the same SQL transaction.',
);

// If connection CAS fails after the envelope insert, repository must throw so the DB transaction rolls back both.
const conflictDb = new AtomicDb(0);
let conflictBlocked = false;
try {
  await new PostgresPaymentCredentialProvisioningRepository(conflictDb)
    .provisionNewCredential({
      connection: provisioned.connection,
      envelope: provisioned.envelope,
      expectedConnectionRevision: pendingConnection.revision,
    });
} catch (error) {
  conflictBlocked = error instanceof PaymentCredentialProvisioningError;
}
assert(conflictBlocked, 'Connection revision conflict must abort atomic credential provisioning.');
assert(conflictDb.transactionCount === 1, 'Provisioning conflict must happen inside the rollback-capable transaction boundary.');

console.log('PASS: atomic encrypted payment credential onboarding tests');
