import type { ChileDteType, FiscalTotals } from './fiscalModel.js';
import type { ExternalFiscalProviderResult } from '../../ports/chileExternalFiscalPort.js';

export type FiscalExecutionMode = 'sii_direct' | 'external_provider';
export type FiscalExecutionEnvironment = 'certification' | 'production';

export type FiscalExecutionStatus =
  | 'created'
  | 'submitting'
  | 'queued'
  | 'issued'
  | 'pending_authority'
  | 'accepted'
  | 'observed'
  | 'rejected'
  | 'failed'
  | 'unknown'
  | 'cancelled';

export type FiscalExecution = {
  id: string;
  businessId: string;
  fiscalRequestId: string;
  issuerRut: string;
  documentType: ChileDteType;
  mode: FiscalExecutionMode;
  environment: FiscalExecutionEnvironment;
  status: FiscalExecutionStatus;
  idempotencyKey: string;
  revision: number;
  providerKey?: string;
  providerConnectionId?: string;
  providerReference?: string;
  providerTicketReference?: string;
  folio?: number;
  authorityTrackId?: string;
  authorityStatus?: string;
  authorityMessage?: string;
  xmlAssetRef?: string;
  pdfAssetRef?: string;
  providerTotals?: FiscalTotals;
  canonicalTotalsMatch?: boolean;
  createdAt: string;
  updatedAt: string;
};

const ALLOWED_EXECUTION_TRANSITIONS: Readonly<Record<FiscalExecutionStatus, readonly FiscalExecutionStatus[]>> = {
  created: ['submitting', 'cancelled'],
  submitting: ['queued', 'issued', 'pending_authority', 'accepted', 'observed', 'rejected', 'failed', 'unknown'],
  queued: ['issued', 'pending_authority', 'accepted', 'observed', 'rejected', 'failed', 'unknown', 'cancelled'],
  issued: ['pending_authority', 'accepted', 'observed', 'rejected', 'failed', 'unknown'],
  pending_authority: ['accepted', 'observed', 'rejected', 'failed', 'unknown'],
  accepted: [],
  observed: ['accepted', 'rejected', 'unknown'],
  rejected: [],
  failed: ['submitting', 'cancelled'],
  unknown: ['queued', 'issued', 'pending_authority', 'accepted', 'observed', 'rejected', 'failed'],
  cancelled: [],
};

function assertExecutionTransitionAllowed(
  current: FiscalExecutionStatus,
  next: FiscalExecutionStatus,
): void {
  if (current === next) return;
  if (!ALLOWED_EXECUTION_TRANSITIONS[current].includes(next)) {
    throw new Error(`Invalid fiscal execution transition: ${current} -> ${next}`);
  }
}

export function assertFiscalExecution(execution: FiscalExecution): void {
  if (
    !execution.id.trim() ||
    !execution.businessId.trim() ||
    !execution.fiscalRequestId.trim() ||
    !execution.issuerRut.trim() ||
    !execution.idempotencyKey.trim()
  ) {
    throw new Error('Fiscal execution identity fields are required.');
  }
  if (!Number.isSafeInteger(execution.revision) || execution.revision < 0) {
    throw new Error('Fiscal execution revision must be a non-negative safe integer.');
  }
  if (execution.mode === 'external_provider') {
    if (!execution.providerKey?.trim() || !execution.providerConnectionId?.trim()) {
      throw new Error('External fiscal execution requires provider key and connection ID.');
    }
  } else if (execution.providerKey !== undefined || execution.providerConnectionId !== undefined) {
    throw new Error('SII Direct fiscal execution must not reference an external provider.');
  }
  if (execution.folio !== undefined && (!Number.isSafeInteger(execution.folio) || execution.folio <= 0)) {
    throw new Error('Fiscal execution folio must be a positive safe integer.');
  }
  if (execution.status === 'queued' && !execution.providerTicketReference?.trim()) {
    throw new Error('Queued fiscal execution requires provider ticket evidence.');
  }
  if (
    execution.mode === 'external_provider' &&
    execution.status === 'accepted' &&
    (!execution.providerReference?.trim() || execution.folio === undefined)
  ) {
    throw new Error('Accepted external fiscal execution requires document reference and folio.');
  }
}

export function createFiscalExecution(input: {
  id: string;
  businessId: string;
  fiscalRequestId: string;
  issuerRut: string;
  documentType: ChileDteType;
  mode: FiscalExecutionMode;
  environment: FiscalExecutionEnvironment;
  idempotencyKey: string;
  createdAt: string;
  providerKey?: string;
  providerConnectionId?: string;
}): FiscalExecution {
  const execution: FiscalExecution = {
    id: input.id,
    businessId: input.businessId,
    fiscalRequestId: input.fiscalRequestId,
    issuerRut: input.issuerRut,
    documentType: input.documentType,
    mode: input.mode,
    environment: input.environment,
    status: 'created',
    idempotencyKey: input.idempotencyKey,
    revision: 0,
    ...(input.providerKey === undefined ? {} : { providerKey: input.providerKey }),
    ...(input.providerConnectionId === undefined ? {} : { providerConnectionId: input.providerConnectionId }),
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
  assertFiscalExecution(execution);
  return execution;
}

export function transitionFiscalExecution(
  execution: FiscalExecution,
  next: FiscalExecutionStatus,
  occurredAt: string,
): FiscalExecution {
  assertFiscalExecution(execution);
  if (execution.status === next) return execution;
  assertExecutionTransitionAllowed(execution.status, next);
  const updated: FiscalExecution = {
    ...execution,
    status: next,
    revision: execution.revision + 1,
    updatedAt: occurredAt,
  };
  assertFiscalExecution(updated);
  return updated;
}

export function fiscalExecutionNeedsReconciliation(status: FiscalExecutionStatus): boolean {
  return (
    status === 'submitting' ||
    status === 'queued' ||
    status === 'issued' ||
    status === 'pending_authority' ||
    status === 'observed' ||
    status === 'unknown'
  );
}

export function fiscalExecutionIsAuthoritativelyAccepted(execution: FiscalExecution): boolean {
  return execution.status === 'accepted';
}

function sameTotals(a: FiscalTotals | undefined, b: FiscalTotals | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return (
    a.netAmountMinor === b.netAmountMinor &&
    a.exemptAmountMinor === b.exemptAmountMinor &&
    a.vatAmountMinor === b.vatAmountMinor &&
    a.totalAmountMinor === b.totalAmountMinor
  );
}

export function applyExternalFiscalProviderResult(
  execution: FiscalExecution,
  result: ExternalFiscalProviderResult,
  occurredAt: string,
): FiscalExecution {
  assertFiscalExecution(execution);
  if (execution.mode !== 'external_provider') {
    throw new Error('External provider result cannot update SII Direct execution.');
  }
  if (execution.providerKey !== result.providerKey) {
    throw new Error('Fiscal provider result belongs to another configured provider.');
  }
  if (
    execution.providerReference !== undefined &&
    result.providerReference !== undefined &&
    execution.providerReference !== result.providerReference
  ) {
    throw new Error('Fiscal provider document reference changed for one canonical execution.');
  }
  if (
    execution.providerTicketReference !== undefined &&
    result.queueTicketReference !== undefined &&
    execution.providerTicketReference !== result.queueTicketReference
  ) {
    throw new Error('Fiscal provider queue ticket changed for one canonical execution.');
  }

  const statusChanged = execution.status !== result.status;
  if (statusChanged) assertExecutionTransitionAllowed(execution.status, result.status);

  const evidenceChanged =
    (result.providerReference !== undefined && execution.providerReference !== result.providerReference) ||
    (result.queueTicketReference !== undefined && execution.providerTicketReference !== result.queueTicketReference) ||
    (result.folio !== undefined && execution.folio !== result.folio) ||
    (result.authorityTrackId !== undefined && execution.authorityTrackId !== result.authorityTrackId) ||
    (result.authorityStatus !== undefined && execution.authorityStatus !== result.authorityStatus) ||
    (result.authorityMessage !== undefined && execution.authorityMessage !== result.authorityMessage) ||
    (result.xmlUrl !== undefined && execution.xmlAssetRef !== result.xmlUrl) ||
    (result.pdfUrl !== undefined && execution.pdfAssetRef !== result.pdfUrl) ||
    (result.canonicalTotalsMatch !== undefined && execution.canonicalTotalsMatch !== result.canonicalTotalsMatch) ||
    (result.providerTotals !== undefined && !sameTotals(execution.providerTotals, result.providerTotals));

  if (!statusChanged && !evidenceChanged) return execution;

  // Provider state and the evidence required to justify it are one canonical
  // mutation. Never create an intermediate queued/accepted object without its
  // ticket/document/folio evidence.
  const withEvidence: FiscalExecution = {
    ...execution,
    status: result.status,
    revision: execution.revision + 1,
    updatedAt: occurredAt,
    ...(result.providerReference === undefined ? {} : { providerReference: result.providerReference }),
    ...(result.queueTicketReference === undefined ? {} : { providerTicketReference: result.queueTicketReference }),
    ...(result.folio === undefined ? {} : { folio: result.folio }),
    ...(result.authorityTrackId === undefined ? {} : { authorityTrackId: result.authorityTrackId }),
    ...(result.authorityStatus === undefined ? {} : { authorityStatus: result.authorityStatus }),
    ...(result.authorityMessage === undefined ? {} : { authorityMessage: result.authorityMessage }),
    ...(result.xmlUrl === undefined ? {} : { xmlAssetRef: result.xmlUrl }),
    ...(result.pdfUrl === undefined ? {} : { pdfAssetRef: result.pdfUrl }),
    ...(result.providerTotals === undefined ? {} : { providerTotals: { ...result.providerTotals } }),
    ...(result.canonicalTotalsMatch === undefined ? {} : { canonicalTotalsMatch: result.canonicalTotalsMatch }),
  };
  assertFiscalExecution(withEvidence);
  return withEvidence;
}
