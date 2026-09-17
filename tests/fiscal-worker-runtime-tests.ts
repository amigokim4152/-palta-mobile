import type { CommerceOutboxEvent } from '../src/commerce/outbox.js';
import { StaticExternalFiscalPortResolver } from '../src/fiscal/chile/fiscalOutboxHandler.js';
import { createFiscalExecution, type FiscalExecution } from '../src/fiscal/chile/fiscalExecution.js';
import type { FiscalRequest } from '../src/fiscal/chile/fiscalModel.js';
import {
  FiscalExecutionConcurrencyError,
  type FiscalExecutionByRequestLookup,
  type FiscalExecutionLookup,
  type FiscalExecutionRepository,
  type FiscalExecutionWrite,
} from '../src/persistence/fiscalExecutionRepository.js';
import type { FiscalRequestLookup, FiscalRequestRepository } from '../src/persistence/fiscalRequestRepository.js';
import type {
  OutboxClaimRequest,
  OutboxCompleteRequest,
  OutboxDeadLetterRequest,
  OutboxDispatchCandidate,
  OutboxDispatchCandidateRequest,
  OutboxEventClaimRequest,
  OutboxRepository,
  OutboxRetryRequest,
} from '../src/persistence/outboxRepository.js';
import type {
  ChileExternalFiscalPort,
  ExternalFiscalIssueInput,
  ExternalFiscalProviderResult,
  ExternalFiscalReconcileInput,
} from '../src/ports/chileExternalFiscalPort.js';
import { processFiscalQueueMessage } from '../src/runtime/fiscalWorker.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const request: FiscalRequest = {
  id: '11111111-1111-4111-8111-111111111111',
  businessId: '22222222-2222-4222-8222-222222222222',
  transactionId: '33333333-3333-4333-8333-333333333333',
  issuerRut: '76123456-7',
  documentType: 'boleta_39',
  idempotencyKey: 'runtime-fiscal-request-1',
  lines: [
    {
      id: 'line-1',
      description: 'Jardinería',
      quantity: 1,
      unitAmountMinor: 45000,
      lineAmountMinor: 45000,
      exempt: false,
      unitNetAmountMinor: 37815,
      unitGrossAmountMinor: 45000,
      lineNetAmountMinor: 37815,
      lineExemptAmountMinor: 0,
      lineVatAmountMinor: 7185,
      lineTotalAmountMinor: 45000,
      unitCode: 'UN',
    },
  ],
  totals: {
    netAmountMinor: 37815,
    exemptAmountMinor: 0,
    vatAmountMinor: 7185,
    totalAmountMinor: 45000,
  },
  status: 'pending',
  receiver: { rut: '66666666-6', name: 'Consumidor final' },
  requestedAt: '2026-09-17T19:00:00.000Z',
  updatedAt: '2026-09-17T19:00:00.000Z',
};

const initialExecution = createFiscalExecution({
  id: '44444444-4444-4444-8444-444444444444',
  businessId: request.businessId,
  fiscalRequestId: request.id,
  issuerRut: request.issuerRut,
  documentType: request.documentType,
  mode: 'external_provider',
  environment: 'certification',
  idempotencyKey: 'runtime-fiscal-execution-1',
  providerKey: 'runtime-dte-provider',
  providerConnectionId: '55555555-5555-4555-8555-555555555555',
  createdAt: request.requestedAt,
});

const event: CommerceOutboxEvent = {
  id: '66666666-6666-4666-8666-666666666666',
  businessId: request.businessId,
  aggregateType: 'fiscal_execution',
  aggregateId: initialExecution.id,
  eventType: 'fiscal.issue.requested',
  idempotencyKey: 'runtime-fiscal-outbox-1',
  payload: { fiscalExecutionId: initialExecution.id },
  status: 'processing',
  attempts: 1,
  createdAt: request.requestedAt,
  updatedAt: request.updatedAt,
};

class RuntimeOutboxRepository implements OutboxRepository {
  claimRequest?: OutboxEventClaimRequest;
  deliveredRequest?: OutboxCompleteRequest;
  retryRequest?: OutboxRetryRequest;
  deadLetterRequest?: OutboxDeadLetterRequest;
  claimValue: CommerceOutboxEvent | null = event;

  async claimEvent(requestValue: OutboxEventClaimRequest) {
    this.claimRequest = requestValue;
    return this.claimValue;
  }
  async markDelivered(requestValue: OutboxCompleteRequest) {
    this.deliveredRequest = requestValue;
    return true;
  }
  async markRetryable(requestValue: OutboxRetryRequest) {
    this.retryRequest = requestValue;
    return true;
  }
  async markDeadLetter(requestValue: OutboxDeadLetterRequest) {
    this.deadLetterRequest = requestValue;
    return true;
  }
  async claimBatch(_request: OutboxClaimRequest): Promise<CommerceOutboxEvent[]> { return []; }
  async listDispatchCandidates(_request: OutboxDispatchCandidateRequest): Promise<OutboxDispatchCandidate[]> { return []; }
}

function cloneExecution(value: FiscalExecution): FiscalExecution {
  return {
    ...value,
    ...(value.providerTotals === undefined ? {} : { providerTotals: { ...value.providerTotals } }),
  };
}

class RuntimeExecutionRepository implements FiscalExecutionRepository {
  current = cloneExecution(initialExecution);
  saves = 0;

  async findExecution(lookup: FiscalExecutionLookup) {
    return lookup.businessId === this.current.businessId && lookup.executionId === this.current.id
      ? cloneExecution(this.current)
      : null;
  }
  async findByFiscalRequest(lookup: FiscalExecutionByRequestLookup) {
    return lookup.businessId === this.current.businessId && lookup.fiscalRequestId === this.current.fiscalRequestId
      ? cloneExecution(this.current)
      : null;
  }
  async saveExecution(write: FiscalExecutionWrite) {
    if (write.expectedRevision === null) throw new Error('Runtime test already has an execution.');
    if (this.current.revision !== write.expectedRevision) throw new FiscalExecutionConcurrencyError();
    if (write.execution.revision !== write.expectedRevision + 1) throw new FiscalExecutionConcurrencyError();
    this.current = cloneExecution(write.execution);
    this.saves += 1;
    return cloneExecution(this.current);
  }
}

class RuntimeRequestRepository implements FiscalRequestRepository {
  async findRequest(lookup: FiscalRequestLookup) {
    return lookup.businessId === request.businessId && lookup.fiscalRequestId === request.id
      ? request
      : null;
  }
}

class RuntimeFiscalPort implements ChileExternalFiscalPort {
  readonly country = 'CL' as const;
  readonly providerKey = 'runtime-dte-provider';
  issueCalls = 0;
  reconcileCalls = 0;

  supportsDocumentType(type: FiscalRequest['documentType']) {
    return type === 'boleta_39';
  }
  async issue(_input: ExternalFiscalIssueInput): Promise<ExternalFiscalProviderResult> {
    this.issueCalls += 1;
    return {
      providerKey: this.providerKey,
      status: 'accepted',
      providerStatus: 'Aceptado',
      providerReference: 'runtime-doc-1',
      folio: 501,
      authorityTrackId: 'runtime-track-1',
      authorityStatus: 'Aceptado',
      providerTotals: { ...request.totals },
      canonicalTotalsMatch: true,
    };
  }
  async reconcile(_input: ExternalFiscalReconcileInput): Promise<ExternalFiscalProviderResult> {
    this.reconcileCalls += 1;
    throw new Error('Immediate-accepted runtime test should not reconcile.');
  }
}

const outbox = new RuntimeOutboxRepository();
const executions = new RuntimeExecutionRepository();
const port = new RuntimeFiscalPort();
const result = await processFiscalQueueMessage({
  rawMessage: { outboxEventId: event.id },
  outboxRepository: outbox,
  fiscalExecutionRepository: executions,
  fiscalRequestRepository: new RuntimeRequestRepository(),
  fiscalPortResolver: new StaticExternalFiscalPortResolver([port]),
  workerId: 'fiscal-worker-test-1',
  now: () => '2026-09-17T19:01:00.000Z',
  leaseSeconds: 45,
});

assert(result.status === 'delivered', 'Fiscal Worker should complete an accepted provider result.');
assert(port.issueCalls === 1 && port.reconcileCalls === 0, 'First claimed delivery may issue exactly once.');
assert(executions.current.status === 'accepted', 'Fiscal Worker must persist accepted state before outbox delivery.');
assert(executions.current.providerReference === 'runtime-doc-1' && executions.current.folio === 501, 'Fiscal Worker must persist definitive provider evidence.');
assert(executions.saves === 2, 'Fiscal Worker should persist submitting before provider call, then accepted evidence after it.');
assert(outbox.claimRequest?.leaseExpiresAt === '2026-09-17T19:01:45.000Z', 'Fiscal Worker must calculate bounded DB lease expiry.');
assert(outbox.deliveredRequest?.workerId === 'fiscal-worker-test-1', 'Outbox completion must be owned by the same Fiscal Worker lease owner.');

const duplicateOutbox = new RuntimeOutboxRepository();
duplicateOutbox.claimValue = null;
const duplicatePort = new RuntimeFiscalPort();
const duplicateResult = await processFiscalQueueMessage({
  rawMessage: { outboxEventId: event.id },
  outboxRepository: duplicateOutbox,
  fiscalExecutionRepository: new RuntimeExecutionRepository(),
  fiscalRequestRepository: new RuntimeRequestRepository(),
  fiscalPortResolver: new StaticExternalFiscalPortResolver([duplicatePort]),
  workerId: 'fiscal-worker-test-2',
  now: () => '2026-09-17T19:01:05.000Z',
});
assert(duplicateResult.status === 'not_claimed', 'Duplicate Queue delivery must stop when the DB lease cannot be acquired.');
assert(duplicatePort.issueCalls === 0, 'Unclaimed duplicate Queue delivery must never reach the DTE provider.');

let invalidLeaseRejected = false;
try {
  await processFiscalQueueMessage({
    rawMessage: { outboxEventId: event.id },
    outboxRepository: new RuntimeOutboxRepository(),
    fiscalExecutionRepository: new RuntimeExecutionRepository(),
    fiscalRequestRepository: new RuntimeRequestRepository(),
    fiscalPortResolver: new StaticExternalFiscalPortResolver([new RuntimeFiscalPort()]),
    workerId: 'fiscal-worker-test-3',
    now: () => '2026-09-17T19:01:10.000Z',
    leaseSeconds: 2,
  });
} catch {
  invalidLeaseRejected = true;
}
assert(invalidLeaseRejected, 'Fiscal Worker must reject unsafe lease durations.');

console.log('PASS: provider-neutral external Fiscal Worker runtime tests');
