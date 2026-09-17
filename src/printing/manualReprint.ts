import {
  canPerformBusinessOperation,
  type BusinessOperationalGrant,
} from '../access/businessOperationalAccess.js';
import {
  createPrintJob,
  type PrintJob,
} from './printCore.js';
import {
  PrintJobConcurrencyError,
  type PrintJobRepository,
} from '../persistence/printJobRepository.js';
import type { AuditLogPort } from '../security/auditLog.js';

export type ManualReprintReason =
  | 'customer_copy'
  | 'operator_recovery'
  | 'paper_issue'
  | 'other';

export type ManualReprintRequest = {
  businessId: string;
  originalPrintJobId: string;
  newPrintJobId: string;
  idempotencyKey: string;
  grant: BusinessOperationalGrant;
  reason: ManualReprintReason;
  /** Required when the original physical outcome cannot be confirmed. */
  duplicateRiskAccepted?: boolean;
  /** Defaults to the original printer. A different target is never chosen implicitly. */
  targetPrinterId?: string;
  /** Must be true when targetPrinterId differs from the original assignment. */
  targetPrinterExplicitlySelected?: boolean;
  correlationId?: string;
};

export type ManualReprintService = {
  create(request: ManualReprintRequest): Promise<PrintJob>;
};

function assertTimestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error('Manual reprint requires a valid timestamp.');
  }
}

function assertRequest(request: ManualReprintRequest): void {
  if (
    !request.businessId.trim() ||
    !request.originalPrintJobId.trim() ||
    !request.newPrintJobId.trim() ||
    !request.idempotencyKey.trim()
  ) {
    throw new Error('Manual reprint requires business, original job, new job and idempotency IDs.');
  }
  if (request.targetPrinterId !== undefined && !request.targetPrinterId.trim()) {
    throw new Error('Manual reprint targetPrinterId cannot be blank.');
  }
  if (request.correlationId !== undefined && !request.correlationId.trim()) {
    throw new Error('Manual reprint correlationId cannot be blank.');
  }
}

function verifyOriginalCanBeReprinted(
  original: PrintJob,
  request: ManualReprintRequest,
): void {
  if (original.status === 'printed') return;
  if (original.status === 'outcome_unknown') {
    if (request.duplicateRiskAccepted !== true) {
      throw new Error('Unknown print outcome requires explicit duplicate-risk acknowledgement before reprint.');
    }
    return;
  }
  if (original.status === 'dispatching' || original.status === 'submitted') {
    throw new Error('Unresolved print must be reconciled before manual reprint.');
  }
  if (original.status === 'failed' && original.retryAuthorized) {
    throw new Error('Definitive no-output failure must use the existing retry path instead of creating a reprint.');
  }
  throw new Error(`Print job status ${original.status} is not eligible for manual reprint.`);
}

function targetPrinter(original: PrintJob, request: ManualReprintRequest): string {
  const selected = request.targetPrinterId ?? original.printerId;
  if (
    selected !== original.printerId &&
    request.targetPrinterExplicitlySelected !== true
  ) {
    throw new Error('A different physical printer requires explicit operator selection.');
  }
  return selected;
}

function sameReprint(existing: PrintJob, original: PrintJob, printerId: string): boolean {
  return (
    existing.businessId === original.businessId &&
    existing.reprintOfJobId === original.id &&
    existing.printerId === printerId &&
    existing.documentKind === original.documentKind
  );
}

export function createManualReprintService(input: {
  repository: PrintJobRepository;
  audit: AuditLogPort;
  now: () => string;
  createAuditEventId: () => string;
}): ManualReprintService {
  return {
    async create(request): Promise<PrintJob> {
      assertRequest(request);
      const occurredAt = input.now();
      assertTimestamp(occurredAt);

      const original = await input.repository.findJob({
        businessId: request.businessId,
        printJobId: request.originalPrintJobId,
      });
      if (!original) throw new Error('Original print job was not found for this business.');

      verifyOriginalCanBeReprinted(original, request);
      const printerId = targetPrinter(original, request);

      const existing = await input.repository.findByIdempotency({
        businessId: request.businessId,
        idempotencyKey: request.idempotencyKey,
      });
      if (existing) {
        if (!sameReprint(existing, original, printerId)) {
          throw new Error('Manual reprint idempotency key is already bound to another print operation.');
        }
        return existing;
      }

      const authorized = canPerformBusinessOperation({
        grant: request.grant,
        businessId: request.businessId,
        capability: 'printing.reprint',
        now: occurredAt,
      });
      const auditEventId = input.createAuditEventId().trim();
      if (!auditEventId) throw new Error('Manual reprint audit event ID is required.');

      await input.audit.append({
        id: auditEventId,
        occurredAt,
        actorId: request.grant.userId,
        actorType: 'business_user',
        action: 'printing.reprint.authorize',
        resourceType: 'print_job',
        resourceId: request.newPrintJobId,
        outcome: authorized ? 'allowed' : 'denied',
        reason: `${request.reason}:${original.status}`,
        ...(request.correlationId !== undefined
          ? { correlationId: request.correlationId }
          : {}),
      });

      if (!authorized) {
        throw new Error('Business user is not authorized to create a manual reprint.');
      }

      const reprint = createPrintJob({
        id: request.newPrintJobId,
        businessId: original.businessId,
        printerId,
        content: original.content,
        idempotencyKey: request.idempotencyKey,
        createdAt: occurredAt,
        reprintOfJobId: original.id,
      });

      try {
        return await input.repository.saveJob({
          job: reprint,
          expectedRevision: null,
        });
      } catch (error) {
        if (!(error instanceof PrintJobConcurrencyError)) throw error;

        const raced = await input.repository.findByIdempotency({
          businessId: request.businessId,
          idempotencyKey: request.idempotencyKey,
        });
        if (raced && sameReprint(raced, original, printerId)) return raced;
        throw error;
      }
    },
  };
}
