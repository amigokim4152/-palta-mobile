import { assertPrintJob, type PrintJob } from './printCore.js';
import type { PrintJobRepository } from '../persistence/printJobRepository.js';

export type PrintReconciliationLookup = {
  businessId: string;
  printJobId: string;
  printerId: string;
  idempotencyKey: string;
  providerJobId?: string;
};

export type PrintReconciliationResult =
  | { outcome: 'printed'; observedAt: string; providerJobId?: string }
  | { outcome: 'accepted'; observedAt: string; providerJobId?: string }
  | { outcome: 'failed_before_output'; observedAt: string; code: string }
  | { outcome: 'unknown'; observedAt: string; code?: string }
  | { outcome: 'not_found'; observedAt: string; code?: string };

export interface PrintReconciliationPort {
  lookup(input: PrintReconciliationLookup): Promise<PrintReconciliationResult>;
}

function withOptionalProviderJobId(job: PrintJob, providerJobId: string | undefined): PrintJob {
  if (providerJobId === undefined) return job;
  return { ...job, providerJobId };
}

export function printJobNeedsReconciliation(job: PrintJob): boolean {
  return job.status === 'dispatching' || job.status === 'submitted' || job.status === 'outcome_unknown';
}

/**
 * Reconciliation never sends a physical print command. It only applies authoritative
 * status evidence from a bridge/spooler/vendor ledger to an existing durable job.
 */
export function applyPrintReconciliationResult(
  job: PrintJob,
  result: PrintReconciliationResult,
): PrintJob {
  assertPrintJob(job);
  if (!printJobNeedsReconciliation(job)) {
    throw new Error('Only unresolved print jobs may be reconciled.');
  }
  if (!Number.isFinite(Date.parse(result.observedAt))) {
    throw new Error('Print reconciliation observedAt must be a valid timestamp.');
  }

  let next: PrintJob;
  if (result.outcome === 'printed') {
    next = withOptionalProviderJobId(
      {
        ...job,
        status: 'printed',
        revision: job.revision + 1,
        retryAuthorized: false,
        completedAt: result.observedAt,
      },
      result.providerJobId,
    );
  } else if (result.outcome === 'accepted') {
    next = withOptionalProviderJobId(
      {
        ...job,
        status: 'submitted',
        revision: job.revision + 1,
        retryAuthorized: false,
      },
      result.providerJobId,
    );
  } else if (result.outcome === 'failed_before_output') {
    next = {
      ...job,
      status: 'failed',
      revision: job.revision + 1,
      retryAuthorized: true,
      errorCode: result.code,
    };
  } else if (result.outcome === 'unknown') {
    next = {
      ...job,
      status: 'outcome_unknown',
      revision: job.revision + 1,
      retryAuthorized: false,
      errorCode: result.code ?? 'reconciliation_unknown',
    };
  } else {
    // not_found is deliberately NOT interpreted as safe-to-retry. A local bridge
    // ledger could have been reset/reinstalled. Human confirmation is safer than a
    // duplicate receipt/label/kitchen ticket.
    next = {
      ...job,
      status: 'outcome_unknown',
      revision: job.revision + 1,
      retryAuthorized: false,
      errorCode: result.code ?? 'reconciliation_not_found',
    };
  }

  assertPrintJob(next);
  return next;
}

export async function reconcileDurablePrintJob(input: {
  repository: PrintJobRepository;
  port: PrintReconciliationPort;
  businessId: string;
  printJobId: string;
}): Promise<PrintJob> {
  const current = await input.repository.findJob({
    businessId: input.businessId,
    printJobId: input.printJobId,
  });
  if (!current) throw new Error('Print job was not found.');
  if (!printJobNeedsReconciliation(current)) return current;

  const lookup: PrintReconciliationLookup = {
    businessId: current.businessId,
    printJobId: current.id,
    printerId: current.printerId,
    idempotencyKey: current.idempotencyKey,
  };
  if (current.providerJobId !== undefined) lookup.providerJobId = current.providerJobId;

  const result = await input.port.lookup(lookup);
  const next = applyPrintReconciliationResult(current, result);
  return input.repository.saveJob({
    job: next,
    expectedRevision: current.revision,
  });
}
