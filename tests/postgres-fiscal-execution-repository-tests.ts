import {
  createFiscalExecution,
  transitionFiscalExecution,
  type FiscalExecution,
} from '../src/fiscal/chile/fiscalExecution.js';
import { FiscalExecutionConcurrencyError } from '../src/persistence/fiscalExecutionRepository.js';
import { PostgresFiscalExecutionRepository } from '../src/persistence/postgresFiscalExecutionRepository.js';
import type { SqlDatabase, SqlExecutor, SqlQueryResult } from '../src/persistence/sqlDatabase.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type Row = Record<string, unknown>;

function dbRow(execution: FiscalExecution): Row {
  return {
    id: execution.id,
    business_id: execution.businessId,
    fiscal_request_id: execution.fiscalRequestId,
    issuer_rut: execution.issuerRut,
    document_type: 39,
    mode: execution.mode,
    environment: execution.environment,
    status: execution.status,
    idempotency_key: execution.idempotencyKey,
    provider_key: execution.providerKey ?? null,
    provider_connection_id: execution.providerConnectionId ?? null,
    provider_reference: execution.providerReference ?? null,
    provider_ticket_reference: execution.providerTicketReference ?? null,
    folio: execution.folio ?? null,
    authority_track_id: execution.authorityTrackId ?? null,
    authority_status: execution.authorityStatus ?? null,
    authority_message: execution.authorityMessage ?? null,
    xml_asset_ref: execution.xmlAssetRef ?? null,
    pdf_asset_ref: execution.pdfAssetRef ?? null,
    provider_totals: execution.providerTotals ?? null,
    canonical_totals_match: execution.canonicalTotalsMatch ?? null,
    revision: execution.revision,
    created_at: execution.createdAt,
    updated_at: execution.updatedAt,
  };
}

class ScriptDb implements SqlDatabase {
  readonly calls: Array<{ sql: string; params: readonly unknown[] }> = [];
  constructor(private responses: Array<SqlQueryResult<Row>>) {}

  async query<TRow extends Row>(sql: string, params: readonly unknown[] = []): Promise<SqlQueryResult<TRow>> {
    this.calls.push({ sql, params });
    const response = this.responses.shift();
    if (!response) throw new Error(`Unexpected SQL: ${sql}`);
    return response as unknown as SqlQueryResult<TRow>;
  }

  async transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    return work(this);
  }
}

const created = createFiscalExecution({
  id: '11111111-1111-4111-8111-111111111111',
  businessId: '22222222-2222-4222-8222-222222222222',
  fiscalRequestId: '33333333-3333-4333-8333-333333333333',
  issuerRut: '76123456-7',
  documentType: 'boleta_39',
  mode: 'external_provider',
  environment: 'certification',
  idempotencyKey: 'execution-sql-1',
  providerKey: 'dte_comges',
  providerConnectionId: '44444444-4444-4444-8444-444444444444',
  createdAt: '2026-09-17T18:50:00.000Z',
});

const createDb = new ScriptDb([{ rows: [dbRow(created)], rowCount: 1 }]);
const createRepo = new PostgresFiscalExecutionRepository(createDb);
const inserted = await createRepo.saveExecution({ execution: created, expectedRevision: null });
assert(inserted.revision === 0 && inserted.status === 'created', 'New fiscal execution should round-trip from Postgres.');
assert(createDb.calls[0]?.sql.includes('on conflict (fiscal_request_id) do nothing'), 'Create must enforce one execution per canonical FiscalRequest.');
assert(createDb.calls[0]?.params[4] === 39, 'Canonical boleta_39 must persist numeric DTE code 39.');

const submitting = transitionFiscalExecution(created, 'submitting', '2026-09-17T18:50:01.000Z');
const updateDb = new ScriptDb([{ rows: [dbRow(submitting)], rowCount: 1 }]);
const updateRepo = new PostgresFiscalExecutionRepository(updateDb);
const updated = await updateRepo.saveExecution({ execution: submitting, expectedRevision: 0 });
assert(updated.status === 'submitting' && updated.revision === 1, 'CAS update should return the next revision.');
const updateCall = updateDb.calls[0];
assert(
  updateCall?.sql.includes('and revision = $3') && updateCall.params[2] === 0,
  'Fiscal execution update must compare-and-swap the expected DB revision.',
);

const conflictDb = new ScriptDb([{ rows: [], rowCount: 0 }]);
let conflictBlocked = false;
try {
  await new PostgresFiscalExecutionRepository(conflictDb).saveExecution({
    execution: submitting,
    expectedRevision: 0,
  });
} catch (error) {
  conflictBlocked = error instanceof FiscalExecutionConcurrencyError;
}
assert(conflictBlocked, 'Lost fiscal execution CAS must surface a concurrency error, never silently overwrite another worker.');

const findDb = new ScriptDb([{ rows: [dbRow(submitting)], rowCount: 1 }]);
const found = await new PostgresFiscalExecutionRepository(findDb).findByFiscalRequest({
  businessId: created.businessId,
  fiscalRequestId: created.fiscalRequestId,
});
assert(found?.id === created.id, 'Worker must be able to resolve the one durable execution by canonical FiscalRequest.');
assert(
  findDb.calls[0]?.sql.includes('business_id = $1 and fiscal_request_id = $2'),
  'Fiscal execution lookup must remain explicitly business scoped.',
);

console.log('PASS: Postgres fiscal execution CAS repository tests');
