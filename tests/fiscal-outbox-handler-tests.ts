import type { CommerceOutboxEvent } from '../src/commerce/outbox.js';
import {
  ExternalFiscalOutboxHandler,
  StaticExternalFiscalPortResolver,
} from '../src/fiscal/chile/fiscalOutboxHandler.js';
import { createFiscalExecution, type FiscalExecution } from '../src/fiscal/chile/fiscalExecution.js';
import { FiscalProviderOperationError } from '../src/fiscal/chile/fiscalProviderIncident.js';
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
  ChileExternalFiscalPort,
  ExternalFiscalIssueInput,
  ExternalFiscalProviderResult,
  ExternalFiscalReconcileInput,
} from '../src/ports/chileExternalFiscalPort.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function cloneExecution(value: FiscalExecution): FiscalExecution {
  return {
    ...value,
    ...(value.providerTotals === undefined ? {} : { providerTotals: { ...value.providerTotals } }),
  };
}

class MemoryExecutionRepository implements FiscalExecutionRepository {
  constructor(public execution: FiscalExecution) {}

  async findExecution(lookup: FiscalExecutionLookup): Promise<FiscalExecution | null> {
    return lookup.businessId === this.execution.businessId && lookup.executionId === this.execution.id
      ? cloneExecution(this.execution)
      : null;
  }

  async findByFiscalRequest(lookup: FiscalExecutionByRequestLookup): Promise<FiscalExecution | null> {
    return lookup.businessId === this.execution.businessId && lookup.fiscalRequestId === this.execution.fiscalRequestId
      ? cloneExecution(this.execution)
      : null;
  }

  async saveExecution(write: FiscalExecutionWrite): Promise<FiscalExecution> {
    if (write.expectedRevision === null) throw new Error('Test repository already has an execution.');
    if (this.execution.revision !== write.expectedRevision) throw new FiscalExecutionConcurrencyError();
    if (write.execution.revision !== write.expectedRevision + 1) throw new FiscalExecutionConcurrencyError();
    this.execution = cloneExecution(write.execution);
    return cloneExecution(this.execution);
  }
}

class MemoryRequestRepository implements FiscalRequestRepository {
  constructor(private readonly request: FiscalRequest) {}
  async findRequest(lookup: FiscalRequestLookup): Promise<FiscalRequest | null> {
    return lookup.businessId === this.request.businessId && lookup.fiscalRequestId === this.request.id
      ? this.request
      : null;
  }
}

class ScriptedFiscalPort implements ChileExternalFiscalPort {
  readonly country = 'CL' as const;
  readonly providerKey = 'dte_comges';
  issueCalls = 0;
  reconcileCalls = 0;
  lastIssue?: ExternalFiscalIssueInput;
  lastReconcile?: ExternalFiscalReconcileInput;

  constructor(
    private readonly issueBehavior: () => Promise<ExternalFiscalProviderResult>,
    private readonly reconcileBehavior: () => Promise<ExternalFiscalProviderResult>,
  ) {}

  supportsDocumentType(type: FiscalRequest['documentType']): boolean {
    return type === 'boleta_39' || type === 'factura_33';
  }

  async issue(input: ExternalFiscalIssueInput): Promise<ExternalFiscalProviderResult> {
    this.issueCalls += 1;
    this.lastIssue = input;
    return this.issueBehavior();
  }

  async reconcile(input: ExternalFiscalReconcileInput): Promise<ExternalFiscalProviderResult> {
    this.reconcileCalls += 1;
    this.lastReconcile = input;
    return this.reconcileBehavior();
  }
}

const request: FiscalRequest = {
  id: '11111111-1111-4111-8111-111111111111',
  businessId: '22222222-2222-4222-8222-222222222222',
  transactionId: '33333333-3333-4333-8333-333333333333',
  issuerRut: '76123456-7',
  documentType: 'boleta_39',
  idempotencyKey: 'fiscal-request-1',
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
  requestedAt: '2026-09-17T18:40:00.000Z',
  updatedAt: '2026-09-17T18:40:00.000Z',
};

function newExecution(): FiscalExecution {
  return createFiscalExecution({
    id: '44444444-4444-4444-8444-444444444444',
    businessId: request.businessId,
    fiscalRequestId: request.id,
    issuerRut: request.issuerRut,
    documentType: request.documentType,
    mode: 'external_provider',
    environment: 'certification',
    idempotencyKey: 'execution-1',
    providerKey: 'dte_comges',
    providerConnectionId: '55555555-5555-4555-8555-555555555555',
    createdAt: request.requestedAt,
  });
}

function event(attempts: number): CommerceOutboxEvent {
  return {
    id: '66666666-6666-4666-8666-666666666666',
    businessId: request.businessId,
    aggregateType: 'fiscal_execution',
    aggregateId: '44444444-4444-4444-8444-444444444444',
    eventType: 'fiscal.issue.requested',
    idempotencyKey: 'outbox-fiscal-1',
    payload: { fiscalExecutionId: '44444444-4444-4444-8444-444444444444' },
    status: 'processing',
    attempts,
    createdAt: request.requestedAt,
    updatedAt: request.requestedAt,
  };
}

let clockIndex = 0;
const clockValues = [
  '2026-09-17T18:40:01.000Z',
  '2026-09-17T18:40:02.000Z',
  '2026-09-17T18:40:03.000Z',
  '2026-09-17T18:40:04.000Z',
  '2026-09-17T18:40:05.000Z',
  '2026-09-17T18:40:06.000Z',
];
const now = () => clockValues[Math.min(clockIndex++, clockValues.length - 1)] ?? '2026-09-17T18:40:06.000Z';

// 201/202-safe path: first issue queues, second delivery reconciles ticket to accepted.
const queueRepo = new MemoryExecutionRepository(newExecution());
const queuePort = new ScriptedFiscalPort(
  async () => ({
    providerKey: 'dte_comges',
    status: 'queued',
    providerStatus: 'Pendiente',
    queueTicketReference: 'ticket-1',
  }),
  async () => ({
    providerKey: 'dte_comges',
    status: 'accepted',
    providerStatus: 'Aceptado',
    providerReference: 'doc-1',
    queueTicketReference: 'ticket-1',
    folio: 1001,
    authorityTrackId: 'track-1',
    authorityStatus: 'Aceptado',
    providerTotals: { ...request.totals },
    canonicalTotalsMatch: true,
  }),
);
const queueHandler = new ExternalFiscalOutboxHandler(
  queueRepo,
  new MemoryRequestRepository(request),
  new StaticExternalFiscalPortResolver([queuePort]),
  now,
);
const first = await queueHandler.handle(event(1));
assert(first.kind === 'retryable', 'Queued provider response must schedule reconciliation rather than mark delivered.');
assert(queueRepo.execution.status === 'queued' && queueRepo.execution.providerTicketReference === 'ticket-1', 'Queue ticket must be durable before retry.');
assert(queuePort.issueCalls === 1 && queuePort.reconcileCalls === 0, 'First delivery may call provider issue exactly once.');

const second = await queueHandler.handle(event(2));
assert(second.kind === 'delivered', 'Accepted reconciliation must complete the outbox event.');
assert(queueRepo.execution.status === 'accepted' && queueRepo.execution.folio === 1001, 'Accepted fiscal result must be durable.');
assert(queuePort.issueCalls === 1 && queuePort.reconcileCalls === 1, 'Redelivery must reconcile, never issue a replacement DTE.');
assert(queuePort.lastReconcile?.queueTicketReference === 'ticket-1', 'Queued retry must reconcile by durable ticket identity.');

// Response-loss path: first provider call outcome unknown, second delivery must exact-replay/reconcile same FiscalRequest identity.
const unknownRepo = new MemoryExecutionRepository(newExecution());
const unknownPort = new ScriptedFiscalPort(
  async () => {
    throw new FiscalProviderOperationError({
      providerKey: 'dte_comges',
      incidentKind: 'outcome_unknown',
      message: 'Response lost after POST.',
    });
  },
  async () => ({
    providerKey: 'dte_comges',
    status: 'accepted',
    providerStatus: 'Aceptado',
    providerReference: 'doc-recovered',
    folio: 1002,
    authorityStatus: 'Aceptado',
    providerTotals: { ...request.totals },
    canonicalTotalsMatch: true,
  }),
);
const unknownHandler = new ExternalFiscalOutboxHandler(
  unknownRepo,
  new MemoryRequestRepository(request),
  new StaticExternalFiscalPortResolver([unknownPort]),
  now,
);
const unknownFirst = await unknownHandler.handle(event(1));
assert(unknownFirst.kind === 'retryable' && unknownRepo.execution.status === 'unknown', 'Lost provider response must persist unknown and require reconciliation.');
const unknownSecond = await unknownHandler.handle(event(2));
assert(unknownSecond.kind === 'delivered' && unknownRepo.execution.status === 'accepted', 'Unknown execution must recover to accepted through reconciliation.');
assert(unknownPort.issueCalls === 1 && unknownPort.reconcileCalls === 1, 'Unknown recovery must never perform a second independent issue call.');
assert(
  unknownPort.lastReconcile?.originalIssue?.canonicalFiscalRequestId === request.id,
  'Unknown recovery without provider reference must carry the original canonical FiscalRequest identity for idempotent replay.',
);

// If provider totals disagree, preserve the issued document evidence but stop automatic completion/reissue.
const mismatchRepo = new MemoryExecutionRepository(newExecution());
const mismatchPort = new ScriptedFiscalPort(
  async () => ({
    providerKey: 'dte_comges',
    status: 'accepted',
    providerStatus: 'Aceptado',
    providerReference: 'doc-mismatch',
    folio: 1003,
    providerTotals: {
      netAmountMinor: 37814,
      exemptAmountMinor: 0,
      vatAmountMinor: 7186,
      totalAmountMinor: 45000,
    },
    canonicalTotalsMatch: false,
  }),
  async () => {
    throw new Error('Mismatch test must not reconcile during first delivery.');
  },
);
const mismatchHandler = new ExternalFiscalOutboxHandler(
  mismatchRepo,
  new MemoryRequestRepository(request),
  new StaticExternalFiscalPortResolver([mismatchPort]),
  now,
);
const mismatch = await mismatchHandler.handle(event(1));
assert(mismatch.kind === 'dead_letter' && mismatch.errorCode === 'fiscal_provider_totals_mismatch', 'Provider/canonical totals mismatch must stop automatic completion.');
assert(
  mismatchRepo.execution.status === 'accepted' &&
    mismatchRepo.execution.providerReference === 'doc-mismatch' &&
    mismatchRepo.execution.canonicalTotalsMatch === false,
  'Totals mismatch must retain already-issued provider evidence and must never fabricate failure/reissue.',
);

console.log('PASS: external fiscal outbox issue/reconcile/restart safety tests');
