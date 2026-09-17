import type { BusinessOperationalGrant } from '../src/access/businessOperationalAccess.js';
import {
  applyPrintDispatchResult,
  beginPrintDispatch,
  createPrintJob,
  type PrintJob,
} from '../src/printing/printCore.js';
import { createManualReprintService } from '../src/printing/manualReprint.js';
import {
  PrintJobConcurrencyError,
  type PrintJobRepository,
  type PrintJobWrite,
} from '../src/persistence/printJobRepository.js';
import type { AuditEvent, AuditLogPort } from '../src/security/auditLog.js';

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

class MemoryPrintRepository implements PrintJobRepository {
  readonly jobs = new Map<string, PrintJob>();
  saves = 0;
  conflictNextInsert = false;

  constructor(...jobs: PrintJob[]) {
    for (const job of jobs) this.jobs.set(job.id, job);
  }

  async findJob(input: { businessId: string; printJobId: string }): Promise<PrintJob | null> {
    const job = this.jobs.get(input.printJobId);
    return job?.businessId === input.businessId ? job : null;
  }

  async findByIdempotency(input: { businessId: string; idempotencyKey: string }): Promise<PrintJob | null> {
    for (const job of this.jobs.values()) {
      if (job.businessId === input.businessId && job.idempotencyKey === input.idempotencyKey) return job;
    }
    return null;
  }

  async saveJob(write: PrintJobWrite): Promise<PrintJob> {
    if (write.expectedRevision !== null) throw new Error('Manual reprint test only expects inserts.');
    if (this.conflictNextInsert) {
      this.conflictNextInsert = false;
      throw new PrintJobConcurrencyError('simulated race');
    }
    this.saves += 1;
    this.jobs.set(write.job.id, write.job);
    return write.job;
  }
}

class MemoryAudit implements AuditLogPort {
  readonly events: AuditEvent[] = [];
  fail = false;

  async append(event: AuditEvent): Promise<void> {
    if (this.fail) throw new Error('audit unavailable');
    this.events.push(event);
  }
}

const businessId = 'biz-1';
const cashierGrant: BusinessOperationalGrant = {
  businessId,
  userId: 'cashier-1',
  role: 'cashier',
  status: 'active',
  grantedByUserId: 'owner-1',
  grantedAt: '2026-09-17T20:00:00Z',
};
const accountantGrant: BusinessOperationalGrant = {
  ...cashierGrant,
  userId: 'accountant-1',
  role: 'accountant',
};

function printedOriginal(id = 'original-1'): PrintJob {
  const queued = createPrintJob({
    id,
    businessId,
    printerId: 'printer-1',
    content: { kind: 'receipt', lines: [{ text: 'Venta' }] },
    idempotencyKey: `idem-${id}`,
    createdAt: '2026-09-17T20:10:00Z',
  });
  const dispatching = beginPrintDispatch(queued, '2026-09-17T20:10:01Z');
  return applyPrintDispatchResult(
    dispatching,
    { outcome: 'printed' },
    '2026-09-17T20:10:02Z',
  );
}

function service(repository: MemoryPrintRepository, audit: MemoryAudit) {
  return createManualReprintService({
    repository,
    audit,
    now: () => '2026-09-17T21:00:00Z',
    createAuditEventId: () => 'audit-1',
  });
}

// Ordinary printed receipt reprint is a new auditable PrintJob, never a retry mutation.
{
  const original = printedOriginal();
  const repository = new MemoryPrintRepository(original);
  const audit = new MemoryAudit();
  const reprint = await service(repository, audit).create({
    businessId,
    originalPrintJobId: original.id,
    newPrintJobId: 'reprint-1',
    idempotencyKey: 'reprint-request-1',
    grant: cashierGrant,
    reason: 'customer_copy',
  });

  assertEqual(reprint.status, 'queued', 'Manual reprint must create a fresh queued physical job.');
  assertEqual(reprint.reprintOfJobId, original.id, 'Manual reprint must link to the original print job.');
  assertEqual(reprint.printerId, original.printerId, 'Manual reprint must keep the original printer by default.');
  assertEqual(repository.saves, 1, 'Manual reprint must create exactly one new durable job.');
  assertEqual(audit.events.length, 1, 'Manual reprint authorization must be audited before creation.');
  assertEqual(audit.events[0]?.outcome, 'allowed', 'Authorized cashier reprint must be audited as allowed.');
  assertEqual(audit.events[0]?.action, 'printing.reprint.authorize', 'Audit action must be reprint-specific.');

  const duplicate = await service(repository, audit).create({
    businessId,
    originalPrintJobId: original.id,
    newPrintJobId: 'ignored-retry-id',
    idempotencyKey: 'reprint-request-1',
    grant: cashierGrant,
    reason: 'customer_copy',
  });
  assertEqual(duplicate.id, reprint.id, 'API retry with same idempotency key must return existing reprint.');
  assertEqual(repository.saves, 1, 'Idempotent API retry must not create another physical job.');
}

// Unknown outcome requires an explicit human duplicate-risk acknowledgement.
{
  const original = applyPrintDispatchResult(
    beginPrintDispatch(
      createPrintJob({
        id: 'original-unknown',
        businessId,
        printerId: 'printer-1',
        content: { kind: 'receipt', lines: [{ text: 'Unknown receipt' }] },
        idempotencyKey: 'original-unknown-key',
        createdAt: '2026-09-17T20:20:00Z',
      }),
      '2026-09-17T20:20:01Z',
    ),
    { outcome: 'unknown', code: 'bridge_timeout' },
    '2026-09-17T20:20:02Z',
  );
  const repository = new MemoryPrintRepository(original);
  const audit = new MemoryAudit();

  await assertRejects(
    () =>
      service(repository, audit).create({
        businessId,
        originalPrintJobId: original.id,
        newPrintJobId: 'reprint-unknown-blocked',
        idempotencyKey: 'reprint-unknown-blocked-key',
        grant: cashierGrant,
        reason: 'operator_recovery',
      }),
    'Unknown physical outcome must not create a reprint without explicit duplicate-risk acceptance.',
  );
  assertEqual(repository.saves, 0, 'Blocked unknown reprint must not create a durable physical job.');

  const accepted = await service(repository, audit).create({
    businessId,
    originalPrintJobId: original.id,
    newPrintJobId: 'reprint-unknown-explicit',
    idempotencyKey: 'reprint-unknown-explicit-key',
    grant: cashierGrant,
    reason: 'operator_recovery',
    duplicateRiskAccepted: true,
  });
  assertEqual(accepted.reprintOfJobId, original.id, 'Explicit unknown-outcome reprint must remain linked to original.');
}

// Definitive no-output failure uses retry, not a second reprint lineage.
{
  const queued = createPrintJob({
    id: 'failed-original',
    businessId,
    printerId: 'printer-1',
    content: { kind: 'receipt', lines: [{ text: 'Retry me' }] },
    idempotencyKey: 'failed-original-key',
    createdAt: '2026-09-17T20:30:00Z',
  });
  const failed = applyPrintDispatchResult(
    beginPrintDispatch(queued, '2026-09-17T20:30:01Z'),
    { outcome: 'failed', code: 'offline_before_write', retryable: true },
    '2026-09-17T20:30:02Z',
  );
  const repository = new MemoryPrintRepository(failed);
  const audit = new MemoryAudit();
  await assertRejects(
    () =>
      service(repository, audit).create({
        businessId,
        originalPrintJobId: failed.id,
        newPrintJobId: 'wrong-reprint',
        idempotencyKey: 'wrong-reprint-key',
        grant: cashierGrant,
        reason: 'operator_recovery',
      }),
    'Retry-authorized no-output failure must reuse retry path instead of creating a reprint.',
  );
  assertEqual(repository.saves, 0, 'Retry path guard must prevent extra durable reprint job.');
}

// Different printer is permitted only as an explicit operator selection.
{
  const original = printedOriginal('original-target');
  const repository = new MemoryPrintRepository(original);
  const audit = new MemoryAudit();
  await assertRejects(
    () =>
      service(repository, audit).create({
        businessId,
        originalPrintJobId: original.id,
        newPrintJobId: 'reprint-target-blocked',
        idempotencyKey: 'reprint-target-blocked-key',
        grant: cashierGrant,
        reason: 'paper_issue',
        targetPrinterId: 'printer-2',
      }),
    'Different physical printer must never be selected implicitly.',
  );

  const explicit = await service(repository, audit).create({
    businessId,
    originalPrintJobId: original.id,
    newPrintJobId: 'reprint-target-explicit',
    idempotencyKey: 'reprint-target-explicit-key',
    grant: cashierGrant,
    reason: 'paper_issue',
    targetPrinterId: 'printer-2',
    targetPrinterExplicitlySelected: true,
  });
  assertEqual(explicit.printerId, 'printer-2', 'Explicit manual target must be persisted on reprint job.');
}

// Accountant does not gain checkout reprint authority; denial is itself audited.
{
  const original = printedOriginal('original-accountant');
  const repository = new MemoryPrintRepository(original);
  const audit = new MemoryAudit();
  await assertRejects(
    () =>
      service(repository, audit).create({
        businessId,
        originalPrintJobId: original.id,
        newPrintJobId: 'reprint-accountant',
        idempotencyKey: 'reprint-accountant-key',
        grant: accountantGrant,
        reason: 'customer_copy',
      }),
    'Accountant role must not gain operational physical-reprint authority.',
  );
  assertEqual(repository.saves, 0, 'Denied reprint must not create a durable physical job.');
  assertEqual(audit.events[0]?.outcome, 'denied', 'Denied reprint attempt must be audited.');
}

// Audit durability is a prerequisite: no audit means no new physical reprint job.
{
  const original = printedOriginal('original-audit-down');
  const repository = new MemoryPrintRepository(original);
  const audit = new MemoryAudit();
  audit.fail = true;
  await assertRejects(
    () =>
      service(repository, audit).create({
        businessId,
        originalPrintJobId: original.id,
        newPrintJobId: 'reprint-audit-down',
        idempotencyKey: 'reprint-audit-down-key',
        grant: cashierGrant,
        reason: 'customer_copy',
      }),
    'Manual reprint must fail closed if authorization audit cannot be persisted.',
  );
  assertEqual(repository.saves, 0, 'Audit failure must happen before reprint persistence.');
}

console.log('manual-reprint-tests: ok');
