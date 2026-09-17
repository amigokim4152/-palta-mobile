import type {
  CredentialKek,
  CredentialKekProvider,
} from '../src/adapters/secrets/credentialEnvelopeCrypto.js';
import { openFiscalCredentials } from '../src/adapters/secrets/envelopeFiscalSecretStore.js';
import { FiscalConnectionProvisioningService } from '../src/fiscal/chile/fiscalConnectionProvisioningService.js';
import type { FiscalProviderConnection } from '../src/fiscal/chile/fiscalProviderConnection.js';
import type {
  FiscalCredentialProvisioningCommit,
  FiscalCredentialProvisioningRepository,
  FiscalCredentialProvisioningResult,
} from '../src/persistence/fiscalCredentialProvisioningRepository.js';
import { FiscalCredentialProvisioningError } from '../src/persistence/fiscalCredentialProvisioningRepository.js';
import { PostgresFiscalCredentialProvisioningRepository } from '../src/persistence/postgresFiscalCredentialProvisioningRepository.js';
import type { SqlDatabase, SqlExecutor, SqlQueryResult } from '../src/persistence/sqlDatabase.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const kek: CredentialKek = {
  id: 'kek-v1',
  key: await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']),
};
class Keks implements CredentialKekProvider {
  async current() { return kek; }
  async byId(id: string) { return id === kek.id ? kek : null; }
}

const pendingConnection: FiscalProviderConnection = {
  id: '11111111-1111-4111-8111-111111111111',
  businessId: '22222222-2222-4222-8222-222222222222',
  issuerRut: '76123456-7',
  providerKey: 'dte_comges',
  environment: 'certification',
  status: 'pending_credentials',
  enabledDocumentTypes: ['boleta_39', 'factura_33'],
  safeConfiguration: {},
  revision: 3,
  createdAt: '2026-09-17T19:30:00.000Z',
  updatedAt: '2026-09-17T19:30:00.000Z',
};

class CapturingRepository implements FiscalCredentialProvisioningRepository {
  commit?: FiscalCredentialProvisioningCommit;
  async provisionNewCredential(commit: FiscalCredentialProvisioningCommit): Promise<FiscalCredentialProvisioningResult> {
    this.commit = commit;
    return { connection: commit.connection, envelope: commit.envelope };
  }
}

const capturing = new CapturingRepository();
const service = new FiscalConnectionProvisioningService(
  capturing,
  new Keks(),
  {
    envelopeId: () => '33333333-3333-4333-8333-333333333333',
    credentialRef: () => 'credential://business-a/dte-comges/1',
  },
);
const provisioned = await service.provision({
  connection: pendingConnection,
  bundle: { api_key: 'DTE-COMGES-RAW-API-KEY' },
  occurredAt: '2026-09-17T19:31:00.000Z',
});
assert(provisioned.connection.status === 'ready_for_test', 'Fiscal credential onboarding must move connection to ready_for_test.');
assert(provisioned.connection.revision === 4, 'Fiscal credential onboarding must consume exactly one connection revision.');
assert(provisioned.connection.credentialRef === 'credential://business-a/dte-comges/1', 'Connection stores only opaque fiscal credential reference.');
assert(!JSON.stringify(provisioned.connection).includes('DTE-COMGES-RAW-API-KEY'), 'Raw fiscal API key must never enter canonical connection state.');
assert(capturing.commit?.expectedConnectionRevision === 3, 'Atomic provisioning must compare-and-swap original fiscal connection revision.');
const decrypted = await openFiscalCredentials({ envelope: provisioned.envelope, kek });
assert(decrypted.api_key === 'DTE-COMGES-RAW-API-KEY', 'Encrypted fiscal envelope must contain API key bundle.');

type Row = Record<string, unknown>;
class AtomicDb implements SqlDatabase {
  transactionCount = 0;
  rootWriteAttempted = false;
  transactionQueries: string[] = [];
  constructor(private readonly connectionRowCount = 1) {}
  async query<T extends Row>(_sql: string, _params: readonly unknown[] = []): Promise<SqlQueryResult<T>> {
    this.rootWriteAttempted = true;
    throw new Error('Fiscal provisioning must never write outside SQL transaction.');
  }
  async transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    const tx: SqlExecutor = {
      query: async <TRow extends Row>(sql: string): Promise<SqlQueryResult<TRow>> => {
        this.transactionQueries.push(sql);
        if (sql.includes('insert into fiscal_credential_envelope')) {
          return { rows: [{ id: provisioned.envelope.id }] as unknown as TRow[], rowCount: 1 };
        }
        if (sql.includes('update fiscal_provider_connection')) {
          return {
            rows: this.connectionRowCount === 1
              ? ([{ id: provisioned.connection.id }] as unknown as TRow[])
              : [],
            rowCount: this.connectionRowCount,
          };
        }
        throw new Error(`Unexpected fiscal provisioning SQL: ${sql}`);
      },
    };
    return work(tx);
  }
}

const atomicDb = new AtomicDb();
const atomicResult = await new PostgresFiscalCredentialProvisioningRepository(atomicDb)
  .provisionNewCredential({
    connection: provisioned.connection,
    envelope: provisioned.envelope,
    expectedConnectionRevision: pendingConnection.revision,
  });
assert(atomicResult.connection.status === 'ready_for_test', 'Atomic fiscal repository should return provisioned connection.');
assert(
  atomicDb.transactionCount === 1 &&
    atomicDb.rootWriteAttempted === false &&
    atomicDb.transactionQueries.some((sql) => sql.includes('insert into fiscal_credential_envelope')) &&
    atomicDb.transactionQueries.some((sql) => sql.includes('update fiscal_provider_connection')),
  'Encrypted fiscal credential insert and connection activation must use one SQL transaction.',
);

const conflictDb = new AtomicDb(0);
let conflictBlocked = false;
try {
  await new PostgresFiscalCredentialProvisioningRepository(conflictDb)
    .provisionNewCredential({
      connection: provisioned.connection,
      envelope: provisioned.envelope,
      expectedConnectionRevision: pendingConnection.revision,
    });
} catch (error) {
  conflictBlocked = error instanceof FiscalCredentialProvisioningError;
}
assert(conflictBlocked, 'Fiscal provider connection revision conflict must abort atomic credential provisioning.');
assert(conflictDb.transactionCount === 1, 'Fiscal provisioning conflict must happen inside rollback-capable transaction boundary.');

console.log('PASS: atomic encrypted fiscal provider credential onboarding tests');
