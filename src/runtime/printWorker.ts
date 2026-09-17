import {
  applyPrintDispatchResult,
  beginPrintDispatch,
  beginPrintRetry,
  canAutomaticallyRetryPrint,
  type PrintDispatchResult,
  type PrintJob,
  type PrinterAdapter,
  type PrinterIdentity,
} from '../printing/printCore.js';
import {
  printJobNeedsReconciliation,
  reconcileDurablePrintJob,
  type PrintReconciliationPort,
} from '../printing/printReconciliation.js';
import {
  PrintJobConcurrencyError,
  type PrintJobRepository,
  type RecoverablePrintJobRepository,
} from '../persistence/printJobRepository.js';

export type PrintDispatchResolution = {
  printer: PrinterIdentity;
  adapter: PrinterAdapter;
};

export type PrintPortResolutionInput = {
  businessId: string;
  printerId: string;
};

/**
 * Runtime resolver for the exact durable printer assignment already recorded on
 * the PrintJob. It must not silently select another physical printer.
 */
export interface PrintPortResolver {
  resolveDispatch(input: PrintPortResolutionInput): Promise<PrintDispatchResolution | null>;
  resolveReconciliation(input: PrintPortResolutionInput): Promise<PrintReconciliationPort | null>;
}

export type PrintWorkerResult =
  | { kind: 'not_found' }
  | { kind: 'terminal'; job: PrintJob }
  | { kind: 'blocked'; reason: 'printer_unavailable' | 'printer_not_ready' | 'reconciliation_unavailable'; job: PrintJob }
  | { kind: 'lost_claim'; job: PrintJob }
  | { kind: 'reconciled'; job: PrintJob }
  | { kind: 'dispatched'; job: PrintJob };

export type PrintWorkerRuntimeInput = {
  repository: PrintJobRepository;
  portResolver: PrintPortResolver;
  businessId: string;
  printJobId: string;
  now: () => string;
};

export type PrintRecoveryBatchResult = {
  businessId: string;
  scanned: number;
  results: Array<{ printJobId: string; result: PrintWorkerResult }>;
};

function requireTimestamp(now: () => string): string {
  const value = now();
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error('Print Worker now must return a valid timestamp.');
  }
  return value;
}

function assertExactDispatchTarget(job: PrintJob, resolution: PrintDispatchResolution): void {
  if (resolution.printer.id !== job.printerId) {
    throw new Error('Print resolver returned a different physical printer than the durable job assignment.');
  }
  if (resolution.printer.businessId !== job.businessId) {
    throw new Error('Print resolver returned a printer from another business.');
  }
  if (resolution.adapter.key !== resolution.printer.adapterKey) {
    throw new Error('Print resolver adapter does not match the printer adapterKey.');
  }
  if (!resolution.adapter.supports(resolution.printer, job.content)) {
    throw new Error('Resolved printer adapter does not support this durable print content.');
  }
}

async function currentAfterConflict(
  repository: PrintJobRepository,
  job: PrintJob,
): Promise<PrintJob> {
  return (
    (await repository.findJob({ businessId: job.businessId, printJobId: job.id })) ?? job
  );
}

async function reconcileExistingJob(
  input: PrintWorkerRuntimeInput,
  job: PrintJob,
): Promise<PrintWorkerResult> {
  const port = await input.portResolver.resolveReconciliation({
    businessId: job.businessId,
    printerId: job.printerId,
  });
  if (!port) {
    return { kind: 'blocked', reason: 'reconciliation_unavailable', job };
  }

  try {
    const reconciled = await reconcileDurablePrintJob({
      repository: input.repository,
      port,
      businessId: job.businessId,
      printJobId: job.id,
    });
    return { kind: 'reconciled', job: reconciled };
  } catch (error) {
    if (error instanceof PrintJobConcurrencyError) {
      return {
        kind: 'lost_claim',
        job: await currentAfterConflict(input.repository, job),
      };
    }
    throw error;
  }
}

async function dispatchOneAttempt(
  input: PrintWorkerRuntimeInput,
  job: PrintJob,
): Promise<PrintWorkerResult> {
  const resolution = await input.portResolver.resolveDispatch({
    businessId: job.businessId,
    printerId: job.printerId,
  });
  if (!resolution) {
    return { kind: 'blocked', reason: 'printer_unavailable', job };
  }

  assertExactDispatchTarget(job, resolution);
  const health = await resolution.adapter.health(resolution.printer);
  if (health !== 'ready') {
    return { kind: 'blocked', reason: 'printer_not_ready', job };
  }

  const submittedAt = requireTimestamp(input.now);
  const dispatching =
    job.status === 'queued'
      ? beginPrintDispatch(job, submittedAt)
      : beginPrintRetry(job, submittedAt);

  let claimed: PrintJob;
  try {
    claimed = await input.repository.saveJob({
      job: dispatching,
      expectedRevision: job.revision,
    });
  } catch (error) {
    if (error instanceof PrintJobConcurrencyError) {
      return {
        kind: 'lost_claim',
        job: await currentAfterConflict(input.repository, job),
      };
    }
    throw error;
  }

  let dispatchResult: PrintDispatchResult;
  try {
    dispatchResult = await resolution.adapter.print(resolution.printer, claimed);
  } catch {
    // Once the adapter call starts, an exception is ambiguous unless the adapter
    // explicitly returns a definitive failed-before-output result. Default to
    // unknown so a caller retry cannot duplicate physical output.
    dispatchResult = { outcome: 'unknown', code: 'adapter_exception' };
  }

  const completed = applyPrintDispatchResult(
    claimed,
    dispatchResult,
    requireTimestamp(input.now),
  );

  try {
    const persisted = await input.repository.saveJob({
      job: completed,
      expectedRevision: claimed.revision,
    });
    return { kind: 'dispatched', job: persisted };
  } catch (error) {
    if (error instanceof PrintJobConcurrencyError) {
      return {
        kind: 'lost_claim',
        job: await currentAfterConflict(input.repository, claimed),
      };
    }
    // Do not dispatch again here. The durable state remains dispatching and the
    // next invocation must enter reconciliation before any further physical I/O.
    throw error;
  }
}

/**
 * Process at most one physical print attempt.
 *
 * Safety rules:
 * - queued/retry-authorized jobs are CAS-transitioned to dispatching before I/O;
 * - unresolved jobs reconcile only and never print in the same invocation;
 * - adapter exceptions become outcome_unknown, never automatic retry;
 * - the durable printer assignment is never silently switched by the worker.
 */
export async function processPrintJob(
  input: PrintWorkerRuntimeInput,
): Promise<PrintWorkerResult> {
  if (!input.businessId.trim() || !input.printJobId.trim()) {
    throw new Error('Print Worker businessId and printJobId are required.');
  }

  const current = await input.repository.findJob({
    businessId: input.businessId,
    printJobId: input.printJobId,
  });
  if (!current) return { kind: 'not_found' };

  if (printJobNeedsReconciliation(current)) {
    return reconcileExistingJob(input, current);
  }

  if (current.status === 'queued') {
    return dispatchOneAttempt(input, current);
  }

  if (canAutomaticallyRetryPrint(current)) {
    return dispatchOneAttempt(input, current);
  }

  return { kind: 'terminal', job: current };
}

/**
 * Startup/reconnect recovery for one business. The DB query returns only queued,
 * unresolved and explicitly retry-authorized jobs. Each item is re-read inside
 * processPrintJob, so stale batch rows cannot bypass CAS/reconciliation rules.
 */
export async function processRecoverablePrintJobs(input: {
  repository: RecoverablePrintJobRepository;
  portResolver: PrintPortResolver;
  businessId: string;
  now: () => string;
  limit?: number;
}): Promise<PrintRecoveryBatchResult> {
  if (!input.businessId.trim()) throw new Error('Print recovery batch requires businessId.');
  const limit = input.limit ?? 20;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Print recovery batch limit must be an integer between 1 and 100.');
  }

  const jobs = await input.repository.listRecoverable({
    businessId: input.businessId,
    limit,
  });
  const results: PrintRecoveryBatchResult['results'] = [];

  for (const job of jobs) {
    const result = await processPrintJob({
      repository: input.repository,
      portResolver: input.portResolver,
      businessId: input.businessId,
      printJobId: job.id,
      now: input.now,
    });
    results.push({ printJobId: job.id, result });
  }

  return {
    businessId: input.businessId,
    scanned: jobs.length,
    results,
  };
}
