import {
  applyPrintDispatchResult,
  beginPrintDispatch,
  beginPrintRetry,
  createPrintJob,
  type PrintJob,
} from '../src/printing/printCore.js';
import {
  applyPrintReconciliationResult,
  reconcileDurablePrintJob,
  type PrintReconciliationPort,
} from '../src/printing/printReconciliation.js';
import { BridgePrintReconciliationPort } from '../src/printing/bridgePrintReconciliationPort.js';
import type {
  BridgePrintStatusRequest,
  BridgePrintStatusResult,
  PrintBridgeIdentity,
} from '../src/printing/deviceBridge.js';
import {
  PrintJobConcurrencyError,
  type PrintJobRepository,
  type PrintJobWrite,
} from '../src/persistence/printJobRepository.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}
async function assertRejects(work: () => Promise<unknown>, message: string): Promise<void> {
  let rejected = false;
  try {
    await work();
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error(message);
}
function assertThrows(work: () => unknown, message: string): void {
  let threw = false;
  try {
    work();
  } catch {
    threw = true;
  }
  if (!threw) throw new Error(message);
}

class MemoryPrintJobRepository implements PrintJobRepository {
  constructor(public job: PrintJob) {}

  async findJob(input: { businessId: string; printJobId: string }): Promise<PrintJob | null> {
    return this.job.businessId === input.businessId && this.job.id === input.printJobId
      ? { ...this.job }
      : null;
  }

  async findByIdempotency(input: { businessId: string; idempotencyKey: string }): Promise<PrintJob | null> {
    return this.job.businessId === input.businessId && this.job.idempotencyKey === input.idempotencyKey
      ? { ...this.job }
      : null;
  }

  async saveJob(write: PrintJobWrite): Promise<PrintJob> {
    if (write.expectedRevision === null || write.expectedRevision !== this.job.revision) {
      throw new PrintJobConcurrencyError();
    }
    if (write.job.revision !== this.job.revision + 1) {
      throw new PrintJobConcurrencyError('Revision did not advance exactly once.');
    }
    this.job = { ...write.job };
    return { ...this.job };
  }
}

function makeSubmittedJob(): PrintJob {
  const queued = createPrintJob({
    id: '11111111-1111-4111-8111-111111111111',
    businessId: '22222222-2222-4222-8222-222222222222',
    printerId: '33333333-3333-4333-8333-333333333333',
    content: { kind: 'receipt', lines: [{ text: 'Venta 1000' }] },
    idempotencyKey: 'receipt-sale-900',
    createdAt: '2026-09-17T20:10:00.000Z',
  });
  const dispatching = beginPrintDispatch(queued, '2026-09-17T20:10:01.000Z');
  return applyPrintDispatchResult(
    dispatching,
    { outcome: 'submitted', providerJobId: 'bridge-job-900' },
    '2026-09-17T20:10:02.000Z',
  );
}

const submitted = makeSubmittedJob();
const printed = applyPrintReconciliationResult(submitted, {
  outcome: 'printed',
  providerJobId: 'bridge-job-900',
  observedAt: '2026-09-17T20:10:05.000Z',
});
assertEqual(printed.status, 'printed', 'Authoritative reconciliation must close a printed job.');
assertEqual(printed.completedAt, '2026-09-17T20:10:05.000Z', 'Printed evidence must preserve observed time.');
assertEqual(printed.retryAuthorized, false, 'Printed result must never authorize retry.');

const failedBeforeOutput = applyPrintReconciliationResult(submitted, {
  outcome: 'failed_before_output',
  code: 'usb_write_never_started',
  observedAt: '2026-09-17T20:10:06.000Z',
});
assertEqual(failedBeforeOutput.status, 'failed', 'Definitive no-output result must become failed.');
assertEqual(failedBeforeOutput.retryAuthorized, true, 'No-output evidence must authorize explicit retry.');
const retried = beginPrintRetry(failedBeforeOutput, '2026-09-17T20:10:07.000Z');
assertEqual(retried.status, 'dispatching', 'Persisted no-output evidence may start an explicit retry.');

const missing = applyPrintReconciliationResult(submitted, {
  outcome: 'not_found',
  observedAt: '2026-09-17T20:10:08.000Z',
});
assertEqual(missing.status, 'outcome_unknown', 'Missing bridge ledger must remain ambiguous, not safe-to-retry.');
assertEqual(missing.retryAuthorized, false, 'not_found must never authorize automatic reprint.');
assertEqual(missing.errorCode, 'reconciliation_not_found', 'Missing bridge ledger needs an actionable diagnostic code.');

const repo = new MemoryPrintJobRepository(submitted);
let lookupCount = 0;
const statusPort: PrintReconciliationPort = {
  async lookup(input) {
    lookupCount += 1;
    assertEqual(input.providerJobId, 'bridge-job-900', 'Durable provider job ID must be supplied to reconciliation.');
    return {
      outcome: 'printed',
      observedAt: '2026-09-17T20:10:09.000Z',
      providerJobId: 'bridge-job-900',
    };
  },
};
const reconciled = await reconcileDurablePrintJob({
  repository: repo,
  port: statusPort,
  businessId: submitted.businessId,
  printJobId: submitted.id,
});
assertEqual(reconciled.status, 'printed', 'Reconciliation service must persist authoritative output state.');
assertEqual(lookupCount, 1, 'Unresolved print job must perform exactly one status lookup.');

const alreadyPrinted = await reconcileDurablePrintJob({
  repository: repo,
  port: statusPort,
  businessId: submitted.businessId,
  printJobId: submitted.id,
});
assertEqual(alreadyPrinted.status, 'printed', 'Terminal print state must remain stable.');
assertEqual(lookupCount, 1, 'Terminal print state must not call provider status again.');

const bridgeV2: PrintBridgeIdentity = {
  bridgeId: 'bridge-1',
  businessId: submitted.businessId,
  displayName: 'Caja bridge',
  publicKeyFingerprint: '0123456789abcdef0123456789abcdef',
  softwareVersion: '1.5.0',
  protocolVersion: 2,
  transports: ['local_network'],
  advertisedService: '_palta-print._tcp',
};
let capturedRequest: BridgePrintStatusRequest | undefined;
const bridgePort = new BridgePrintReconciliationPort(
  bridgeV2,
  {
    async getPrintStatus(request): Promise<BridgePrintStatusResult> {
      capturedRequest = request;
      return {
        requestId: request.requestId,
        printJobId: request.printJobId,
        idempotencyKey: request.idempotencyKey,
        outcome: 'printed',
        providerJobId: 'bridge-job-900',
        observedAt: '2026-09-17T20:10:10.000Z',
      };
    },
  },
  () => 'status-request-1',
);
const bridgeResult = await bridgePort.lookup({
  businessId: submitted.businessId,
  printJobId: submitted.id,
  printerId: submitted.printerId,
  idempotencyKey: submitted.idempotencyKey,
});
assertEqual(bridgeResult.outcome, 'printed', 'Bridge v2 printed status must map to canonical reconciliation.');
assertEqual(capturedRequest?.protocolVersion, 2, 'Bridge status lookup must use protocol v2.');

const bridgeV1: PrintBridgeIdentity = { ...bridgeV2, protocolVersion: 1 };
assertThrows(
  () => new BridgePrintReconciliationPort(bridgeV1, { async getPrintStatus() { throw new Error('unused'); } }, () => 'x'),
  'Bridge v1 must not pretend to support durable print reconciliation.',
);

await assertRejects(
  () => bridgePort.lookup({
    businessId: '99999999-9999-4999-8999-999999999999',
    printJobId: submitted.id,
    printerId: submitted.printerId,
    idempotencyKey: submitted.idempotencyKey,
  }),
  'Another business must never query this bridge print ledger.',
);

const mismatchedPort = new BridgePrintReconciliationPort(
  bridgeV2,
  {
    async getPrintStatus(request): Promise<BridgePrintStatusResult> {
      return {
        requestId: request.requestId,
        printJobId: 'different-job',
        idempotencyKey: request.idempotencyKey,
        outcome: 'printed',
        observedAt: '2026-09-17T20:10:11.000Z',
      };
    },
  },
  () => 'status-request-2',
);
await assertRejects(
  () => mismatchedPort.lookup({
    businessId: submitted.businessId,
    printJobId: submitted.id,
    printerId: submitted.printerId,
    idempotencyKey: submitted.idempotencyKey,
  }),
  'Mismatched bridge status response must be rejected instead of updating another print job.',
);

console.log('print-reconciliation-tests: ok');
