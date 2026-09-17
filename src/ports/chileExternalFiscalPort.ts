import type {
  ChileDteType,
  FiscalReceiver,
  FiscalReference,
  FiscalTotals,
} from '../fiscal/chile/fiscalModel.js';

export type ExternalFiscalLine = {
  id: string;
  description: string;
  quantity: number;
  unitCode: string;
  /** Net unit price before VAT. Required for initial Chile provider adapters. */
  unitNetAmountMinor: number;
  /** Customer-facing gross unit price, retained for reconciliation. */
  unitGrossAmountMinor: number;
  lineNetAmountMinor: number;
  lineVatAmountMinor: number;
  lineTotalAmountMinor: number;
  exempt: boolean;
};

export type ExternalFiscalIssueInput = {
  canonicalFiscalRequestId: string;
  businessId: string;
  issuerRut: string;
  documentType: ChileDteType;
  idempotencyKey: string;
  receiver: FiscalReceiver;
  lines: ExternalFiscalLine[];
  totals: FiscalTotals;
  references?: FiscalReference[];
};

export type ExternalFiscalProviderStatus =
  | 'queued'
  | 'issued'
  | 'pending_authority'
  | 'accepted'
  | 'observed'
  | 'rejected'
  | 'failed'
  | 'unknown';

export type ExternalFiscalProviderResult = {
  providerKey: string;
  status: ExternalFiscalProviderStatus;
  providerStatus: string;
  providerReference?: string;
  queueTicketReference?: string;
  folio?: number;
  authorityTrackId?: string;
  authorityStatus?: string;
  authorityMessage?: string;
  xmlUrl?: string;
  pdfUrl?: string;
  tedXml?: string;
  issuedAt?: string;
  providerTotals?: FiscalTotals;
  canonicalTotalsMatch?: boolean;
};

export type ExternalFiscalReconcileInput = {
  providerReference?: string;
  queueTicketReference?: string;
  /**
   * Required only when the initial POST outcome was unknown and no provider/ticket
   * reference was received. The adapter may replay exactly the same provider
   * idempotency identity; it must never invent a replacement fiscal operation.
   */
  originalIssue?: ExternalFiscalIssueInput;
};

/**
 * External Chile DTE provider boundary.
 *
 * Providers such as DTE Comges/LibreDTE may own CAF allocation, signing and SII
 * transport. They must not be forced through the SII Direct build/sign/send
 * lifecycle. Core persists provider-neutral execution/evidence instead.
 */
export interface ChileExternalFiscalPort {
  readonly country: 'CL';
  readonly providerKey: string;
  supportsDocumentType(type: ChileDteType): boolean;
  issue(input: ExternalFiscalIssueInput): Promise<ExternalFiscalProviderResult>;
  reconcile(input: ExternalFiscalReconcileInput): Promise<ExternalFiscalProviderResult>;
}
