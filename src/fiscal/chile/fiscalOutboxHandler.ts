import type { CommerceOutboxEvent } from '../../commerce/outbox.js';
import { prepareExternalFiscalIssue } from './externalFiscalPreparation.js';
import {
  applyExternalFiscalProviderResult,
  fiscalExecutionNeedsReconciliation,
  transitionFiscalExecution,
  type FiscalExecution,
} from './fiscalExecution.js';
import { FiscalProviderOperationError } from './fiscalProviderIncident.js';
import type { FiscalExecutionRepository } from '../../persistence/fiscalExecutionRepository.js';
import type { FiscalRequestRepository } from '../../persistence/fiscalRequestRepository.js';
import type {
  ChileExternalFiscalPort,
  ExternalFiscalIssueInput,
} from '../../ports/chileExternalFiscalPort.js';
import type { OutboxEventHandler, OutboxHandlerResult } from '../../runtime/outboxConsumer.js';

export type ExternalFiscalPortResolutionInput = {
  businessId: string;
  issuerRut: string;
  providerKey: string;
  providerConnectionId: string;
  environment: 'certification' | 'production';
};

export interface ExternalFiscalPortResolver {
  resolve(input: ExternalFiscalPortResolutionInput): Promise<ChileExternalFiscalPort | null>;
}

/** Test/local only. Production must resolve one business-scoped connection/secret. */
export class StaticExternalFiscalPortResolver implements ExternalFiscalPortResolver {
  private readonly ports = new Map<string, ChileExternalFiscalPort>();

  constructor(ports: readonly ChileExternalFiscalPort[]) {
    for (const port of ports) {
      if (this.ports.has(port.providerKey)) throw new Error(`Duplicate fiscal provider: ${port.providerKey}`);
      this.ports.set(port.providerKey, port);
    }
  }

  async resolve(input: ExternalFiscalPortResolutionInput): Promise<ChileExternalFiscalPort | null> {
    return this.ports.get(input.providerKey) ?? null;
  }
}

const RETRY_SECONDS = [5, 15, 30, 60, 120, 300, 600] as const;

function retryAt(now: string, attempts: number): string {
  const parsed = Date.parse(now);
  if (Number.isNaN(parsed)) throw new Error('Fiscal worker now must be a valid timestamp.');
  const index = Math.min(Math.max(attempts - 1, 0), RETRY_SECONDS.length - 1);
  const seconds = RETRY_SECONDS[index] ?? 600;
  return new Date(parsed + seconds * 1000).toISOString();
}

function retryable(event: CommerceOutboxEvent, now: string, errorCode: string): OutboxHandlerResult {
  return { kind: 'retryable', nextAttemptAt: retryAt(now, event.attempts), errorCode };
}

function executionId(event: CommerceOutboxEvent): string {
  if (event.aggregateType !== 'fiscal_execution') {
    throw new Error('Fiscal worker received a non-fiscal-execution Outbox aggregate.');
  }
  const payloadId = event.payload.fiscalExecutionId;
  if (payloadId !== undefined && payloadId !== event.aggregateId) {
    throw new Error('Fiscal Outbox payload identity does not match aggregate ID.');
  }
  return event.aggregateId;
}

function reconciliationInput(execution: FiscalExecution, originalIssue: ExternalFiscalIssueInput) {
  if (execution.providerReference !== undefined) return { providerReference: execution.providerReference };
  if (execution.providerTicketReference !== undefined) {
    return { queueTicketReference: execution.providerTicketReference };
  }
  return { originalIssue };
}

export class ExternalFiscalOutboxHandler implements OutboxEventHandler {
  constructor(
    private readonly executions: FiscalExecutionRepository,
    private readonly requests: FiscalRequestRepository,
    private readonly providers: ExternalFiscalPortResolver,
    private readonly now: () => string,
  ) {}

  async handle(event: CommerceOutboxEvent): Promise<OutboxHandlerResult> {
    if (!event.eventType.startsWith('fiscal.')) {
      return { kind: 'dead_letter', errorCode: 'unsupported_fiscal_event_type' };
    }

    const execution = await this.executions.findExecution({
      businessId: event.businessId,
      executionId: executionId(event),
    });
    if (!execution) return { kind: 'dead_letter', errorCode: 'fiscal_execution_not_found' };
    if (execution.businessId !== event.businessId) {
      return { kind: 'dead_letter', errorCode: 'fiscal_business_mismatch' };
    }
    if (execution.mode !== 'external_provider') {
      return { kind: 'dead_letter', errorCode: 'fiscal_execution_not_external_provider' };
    }
    if (!execution.providerKey || !execution.providerConnectionId) {
      return { kind: 'dead_letter', errorCode: 'fiscal_provider_not_selected' };
    }
    if (execution.status === 'accepted' || execution.status === 'rejected' || execution.status === 'cancelled') {
      return { kind: 'delivered' };
    }
    if (execution.status === 'failed') {
      return { kind: 'dead_letter', errorCode: 'fiscal_execution_failed_requires_operator' };
    }

    const request = await this.requests.findRequest({
      businessId: execution.businessId,
      fiscalRequestId: execution.fiscalRequestId,
    });
    if (!request) return { kind: 'dead_letter', errorCode: 'fiscal_request_not_found' };
    if (
      request.businessId !== execution.businessId ||
      request.issuerRut !== execution.issuerRut ||
      request.documentType !== execution.documentType
    ) {
      return { kind: 'dead_letter', errorCode: 'fiscal_request_execution_mismatch' };
    }

    let originalIssue: ExternalFiscalIssueInput;
    try {
      originalIssue = prepareExternalFiscalIssue(request);
    } catch {
      if (execution.status === 'created') {
        const submitting = transitionFiscalExecution(execution, 'submitting', this.now());
        const savedSubmitting = await this.executions.saveExecution({
          execution: submitting,
          expectedRevision: execution.revision,
        });
        const failed = transitionFiscalExecution(savedSubmitting, 'failed', this.now());
        await this.executions.saveExecution({
          execution: failed,
          expectedRevision: savedSubmitting.revision,
        });
      }
      return { kind: 'dead_letter', errorCode: 'fiscal_preparation_failed' };
    }

    const port = await this.providers.resolve({
      businessId: execution.businessId,
      issuerRut: execution.issuerRut,
      providerKey: execution.providerKey,
      providerConnectionId: execution.providerConnectionId,
      environment: execution.environment,
    });
    if (!port) return { kind: 'dead_letter', errorCode: 'fiscal_provider_adapter_missing' };
    if (port.providerKey !== execution.providerKey) {
      return { kind: 'dead_letter', errorCode: 'fiscal_provider_resolution_mismatch' };
    }
    if (!port.supportsDocumentType(execution.documentType)) {
      return { kind: 'dead_letter', errorCode: 'fiscal_document_type_not_supported' };
    }

    let current = execution;
    const wasCreatedThisAttempt = current.status === 'created';
    if (wasCreatedThisAttempt) {
      const submitting = transitionFiscalExecution(current, 'submitting', this.now());
      current = await this.executions.saveExecution({
        execution: submitting,
        expectedRevision: current.revision,
      });
    }

    const occurredAt = this.now();
    try {
      // Only the first delivery may call issue(). Any redelivery/restart uses
      // reconcile(), which may replay only the exact same provider idempotency identity.
      const firstProviderAttempt = wasCreatedThisAttempt && event.attempts <= 1;
      const result = firstProviderAttempt
        ? await port.issue(originalIssue)
        : await port.reconcile(reconciliationInput(current, originalIssue));

      const updated = applyExternalFiscalProviderResult(current, result, occurredAt);
      const saved = updated === current
        ? current
        : await this.executions.saveExecution({ execution: updated, expectedRevision: current.revision });

      if (saved.canonicalTotalsMatch === false) {
        return { kind: 'dead_letter', errorCode: 'fiscal_provider_totals_mismatch' };
      }
      if (saved.status === 'accepted' || saved.status === 'rejected' || saved.status === 'cancelled') {
        return { kind: 'delivered' };
      }
      if (saved.status === 'failed') {
        return { kind: 'dead_letter', errorCode: 'fiscal_execution_failed_requires_operator' };
      }
      if (fiscalExecutionNeedsReconciliation(saved.status) || saved.status === 'observed') {
        return retryable(event, occurredAt, 'fiscal_status_not_final');
      }
      return { kind: 'delivered' };
    } catch (error) {
      if (!(error instanceof FiscalProviderOperationError)) throw error;
      return this.handleProviderError(event, current, error, occurredAt);
    }
  }

  private async handleProviderError(
    event: CommerceOutboxEvent,
    execution: FiscalExecution,
    error: FiscalProviderOperationError,
    occurredAt: string,
  ): Promise<OutboxHandlerResult> {
    const incident = error.incident;

    if (incident.requiresReconciliation) {
      const unknown = execution.status === 'unknown'
        ? execution
        : transitionFiscalExecution(execution, 'unknown', occurredAt);
      if (unknown !== execution) {
        await this.executions.saveExecution({ execution: unknown, expectedRevision: execution.revision });
      }
      if (incident.operatorActionRequired) {
        return { kind: 'dead_letter', errorCode: incident.kind };
      }
      return retryable(event, occurredAt, incident.kind);
    }

    if (incident.retrySameOperation) {
      return retryable(event, occurredAt, incident.kind);
    }

    // An auth/config/validation error while a document is already queued or at
    // the authority is an access/operation incident, not proof the DTE failed.
    if (execution.status !== 'submitting') {
      return { kind: 'dead_letter', errorCode: incident.kind };
    }

    const failed = transitionFiscalExecution(execution, 'failed', occurredAt);
    await this.executions.saveExecution({ execution: failed, expectedRevision: execution.revision });
    return { kind: 'dead_letter', errorCode: incident.kind };
  }
}
