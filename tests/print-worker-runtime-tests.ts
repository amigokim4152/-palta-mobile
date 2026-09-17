import {
  beginPrintDispatch,
  createPrintJob,
  type PrintDispatchResult,
  type PrintJob,
  type PrinterAdapter,
  type PrinterIdentity,
} from '../src/printing/printCore.js';
import type {
  PrintReconciliationPort,
  PrintReconciliationResult,
} from '../src/printing/printReconciliation.js';
import {
  PrintJobConcurrencyError,
  type PrintJobRepository,
  type PrintJobWrite,
} from '../src/persistence/printJobRepository.js';
import {
  processPrintJob,
  type PrintPortResolver,
} from '../src/runtime/printWorker.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

async function assertRejects(fn: () => Promise<unknown>, message: string): Promise<void> {
  let threw = false;
  try {
    await fn();
  } catch {
    threw = true;
  }
  if (!threw) throw new Error(message);
}

class MemoryPrintJobRepository implements PrintJobRepository {
  current: PrintJob | null;
  conflictNextSave = false;

  constructor(job: PrintJob | null) {
    this.current = job;
  }

  async findJob(input: { businessId: string; printJobId: string }): Promise<PrintJob | null> {
    if (!this.current) return null;
    return this.current.businessId === input.businessId && this.current.id === input.printJobId
      ? this.current
      : null;
  }

  async findByIdempotency(input: { businessId: string; idempotencyKey: string }): Promise<PrintJob | null> {
    if (!this.current) return null;
    return this.current.businessId === input.businessId && this.current.idempotencyKey === input.idempotencyKey
      ? this.current
      : null;
  }

  async saveJob(write: PrintJobWrite): Promise<PrintJob> {
    if (this.conflictNextSave) {
      this.conflictNextSave = false;
      throw new PrintJobConcurrencyError('simulated conflict');
    }
    if (!this.current) throw new Error('Memory repository has no existing job.');
    if (write.expectedRevision !== this.current.revision) {
      throw new PrintJobConcurrencyError('revision mismatch');
    }
    if (write.job.revision !== this.current.revision + 1) {
      throw new PrintJobConcurrencyError('next revision mismatch');
    }
    this.current = write.job;
    return write.job;
  }
}

function makeJob(id: string): PrintJob {
  return createPrintJob({
    id,
    businessId: 'biz-1',
    printerId: 'printer-1',
    content: { kind: 'receipt', lines: [{ text: 'Receipt' }] },
    idempotencyKey: `idem-${id}`,
    createdAt: '2026-09-17T21:00:00Z',
  });
}

const printer: PrinterIdentity = {
  id: 'printer-1',
  businessId: 'biz-1',
  displayName: 'Front receipt',
  transport: 'network',
  protocol: 'esc_pos',
  supportTier: 'palta_certified',
  health: 'ready',
  adapterKey: 'escpos-network-v1',
};

function makeAdapter(input: {
  onPrint: () => Promise<PrintDispatchResult>;
  onCall?: () => void;
}): PrinterAdapter {
  return {
    key: 'escpos-network-v1',
    supports: () => true,
    health: async () => 'ready',
    print: async () => {
      input.onCall?.();
      return input.onPrint();
    },
  };
}

function makeResolver(input: {
  adapter: PrinterAdapter;
  reconciliation?: PrintReconciliationPort | null;
  resolvedPrinter?: PrinterIdentity;
}): PrintPortResolver {
  return {
    resolveDispatch: async () => ({
      printer: input.resolvedPrinter ?? printer,
      adapter: input.adapter,
    }),
    resolveReconciliation: async () => input.reconciliation ?? null,
  };
}

const now = () => '2026-09-17T21:00:01Z';

// Initial queued dispatch is claimed durably before physical I/O and runs once.
{
  const repository = new MemoryPrintJobRepository(makeJob('job-1'));
  let printCalls = 0;
  const adapter = makeAdapter({
    onCall: () => {
      printCalls += 1;
    },
    onPrint: async () => ({ outcome: 'printed', providerJobId: 'provider-1' }),
  });
  const resolver = makeResolver({ adapter });

  const first = await processPrintJob({
    repository,
    portResolver: resolver,
    businessId: 'biz-1',
    printJobId: 'job-1',
    now,
  });
  assertEqual(first.kind, 'dispatched', 'Queued job must dispatch.');
  assert(repository.current, 'Printed job must remain persisted.');
  assertEqual(repository.current.status, 'printed', 'Printed result must be durable.');
  assertEqual(printCalls, 1, 'Initial dispatch must call physical adapter exactly once.');

  const second = await processPrintJob({
    repository,
    portResolver: resolver,
    businessId: 'biz-1',
    printJobId: 'job-1',
    now,
  });
  assertEqual(second.kind, 'terminal', 'Printed job must become terminal.');
  assertEqual(printCalls, 1, 'Terminal job must never physically print again.');
}

// Losing the CAS claim must happen before adapter.print, preventing duplicate output.
{
  const repository = new MemoryPrintJobRepository(makeJob('job-2'));
  repository.conflictNextSave = true;
  let printCalls = 0;
  const adapter = makeAdapter({
    onCall: () => {
      printCalls += 1;
    },
    onPrint: async () => ({ outcome: 'printed' }),
  });

  const result = await processPrintJob({
    repository,
    portResolver: makeResolver({ adapter }),
    businessId: 'biz-1',
    printJobId: 'job-2',
    now,
  });
  assertEqual(result.kind, 'lost_claim', 'CAS conflict must yield lost_claim.');
  assertEqual(printCalls, 0, 'Worker that lost the claim must not touch the printer.');
}

// An adapter exception after dispatch begins is ambiguous and must never authorize retry.
{
  const repository = new MemoryPrintJobRepository(makeJob('job-3'));
  let printCalls = 0;
  const adapter = makeAdapter({
    onCall: () => {
      printCalls += 1;
    },
    onPrint: async () => {
      throw new Error('socket reset after write');
    },
  });
  const resolver = makeResolver({ adapter, reconciliation: null });

  const first = await processPrintJob({
    repository,
    portResolver: resolver,
    businessId: 'biz-1',
    printJobId: 'job-3',
    now,
  });
  assertEqual(first.kind, 'dispatched', 'Adapter exception must still persist a dispatch result.');
  assert(repository.current, 'Unknown job must remain persisted.');
  assertEqual(repository.current.status, 'outcome_unknown', 'Adapter exception must become outcome_unknown.');
  assertEqual(repository.current.retryAuthorized, false, 'Ambiguous adapter exception must deny automatic retry.');

  const second = await processPrintJob({
    repository,
    portResolver: resolver,
    businessId: 'biz-1',
    printJobId: 'job-3',
    now,
  });
  assertEqual(second.kind, 'blocked', 'Unknown job without reconciliation must block.');
  assert(second.kind === 'blocked', 'Expected blocked result.');
  assertEqual(second.reason, 'reconciliation_unavailable', 'Unknown job must require reconciliation.');
  assertEqual(printCalls, 1, 'Unknown outcome must not blindly print a second time.');
}

// Reconciliation is status-only. failed_before_output authorizes a later, separate retry invocation.
{
  const unresolved = beginPrintDispatch(makeJob('job-4'), '2026-09-17T21:00:00Z');
  const repository = new MemoryPrintJobRepository(unresolved);
  let printCalls = 0;
  const adapter = makeAdapter({
    onCall: () => {
      printCalls += 1;
    },
    onPrint: async () => ({ outcome: 'printed' }),
  });
  const reconciliation: PrintReconciliationPort = {
    lookup: async (): Promise<PrintReconciliationResult> => ({
      outcome: 'failed_before_output',
      observedAt: '2026-09-17T21:00:02Z',
      code: 'bridge_restarted_before_write',
    }),
  };
  const resolver = makeResolver({ adapter, reconciliation });

  const first = await processPrintJob({
    repository,
    portResolver: resolver,
    businessId: 'biz-1',
    printJobId: 'job-4',
    now,
  });
  assertEqual(first.kind, 'reconciled', 'Unresolved job must reconcile before retry.');
  assert(repository.current, 'Reconciled job must be persisted.');
  assertEqual(repository.current.status, 'failed', 'Definitive no-output evidence must become failed.');
  assertEqual(repository.current.retryAuthorized, true, 'Definitive no-output evidence must authorize retry.');
  assertEqual(printCalls, 0, 'Reconciliation invocation itself must never print.');

  const second = await processPrintJob({
    repository,
    portResolver: resolver,
    businessId: 'biz-1',
    printJobId: 'job-4',
    now,
  });
  assertEqual(second.kind, 'dispatched', 'Authorized retry may dispatch on a later invocation.');
  assert(repository.current, 'Retried job must remain persisted.');
  assertEqual(repository.current.status, 'printed', 'Authorized retry may complete printing.');
  assertEqual(printCalls, 1, 'Authorized retry must produce one physical attempt.');
}

// Resolver must never substitute another physical printer for the durable assignment.
{
  const repository = new MemoryPrintJobRepository(makeJob('job-5'));
  let printCalls = 0;
  const adapter = makeAdapter({
    onCall: () => {
      printCalls += 1;
    },
    onPrint: async () => ({ outcome: 'printed' }),
  });
  const wrongPrinter: PrinterIdentity = { ...printer, id: 'printer-2' };

  await assertRejects(
    () =>
      processPrintJob({
        repository,
        portResolver: makeResolver({ adapter, resolvedPrinter: wrongPrinter }),
        businessId: 'biz-1',
        printJobId: 'job-5',
        now,
      }),
    'Worker must reject silent physical printer substitution.',
  );
  assertEqual(printCalls, 0, 'Rejected printer substitution must not produce physical output.');
}

console.log('print-worker-runtime-tests: ok');
