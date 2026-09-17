import type { ChileDteType } from './fiscalModel.js';

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
  createdAt: string;
  updatedAt: string;
};

const ALLOWED_EXECUTION_TRANSITIONS: Readonly<
  Record<FiscalExecutionStatus, readonly FiscalExecutionStatus[]>
> = {
  created: ['submitting', 'cancelled'],
  submitting: ['queued', 'issued', 'pending_authority', 'accepted', 'observed', 'rejected', 'failed', 'unknown'],
  queued: ['queued', 'issued', 'pending_authority', 'accepted', 'observed', 'rejected', 'failed', 'unknown', 'cancelled'],
  issued: ['pending_authority', 'accepted', 'observed', 'rejected', 'failed', 'unknown'],
  pending_authority: ['accepted', 'observed', 'rejected', 'failed', 'unknown'],
  accepted: [],
  observed: ['accepted', 'rejected'],
  rejected: [],
  failed: [],
  unknown: ['queued', 'issued', 'pending_authority', 'accepted', 'observed', 'rejected', 'failed'],
  cancelled: [],
};

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
  if (
    !input.id.trim() ||
    !input.businessId.trim() ||
    !input.fiscalRequestId.trim() ||
    !input.issuerRut.trim() ||
    !input.idempotencyKey.trim()
  ) {
    throw new Error('Fiscal execution identity fields are required.');
  }
  if (input.mode === 'external_provider' && !input.providerKey?.trim()) {
    throw new Error('External fiscal execution requires providerKey.');
  }
  if (input.mode === 'sii_direct' && input.providerConnectionId !== undefined) {
    throw new Error('SII Direct fiscal execution must not reference an external provider connection.');
  }

  return {
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
    ...(input.providerConnectionId === undefined
      ? {}
      : { providerConnectionId: input.providerConnectionId }),
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}

export function transitionFiscalExecution(
  execution: FiscalExecution,
  next: FiscalExecutionStatus,
  occurredAt: string,
): FiscalExecution {
  if (execution.status === next) return execution;
  if (!ALLOWED_EXECUTION_TRANSITIONS[execution.status].includes(next)) {
    throw new Error(`Invalid fiscal execution transition: ${execution.status} -> ${next}`);
  }
  return {
    ...execution,
    status: next,
    revision: execution.revision + 1,
    updatedAt: occurredAt,
  };
}

export function fiscalExecutionNeedsReconciliation(status: FiscalExecutionStatus): boolean {
  return (
    status === 'submitting' ||
    status === 'queued' ||
    status === 'issued' ||
    status === 'pending_authority' ||
    status === 'unknown'
  );
}

export function fiscalExecutionIsAuthoritativelyAccepted(
  execution: FiscalExecution,
): boolean {
  return execution.status === 'accepted';
}
