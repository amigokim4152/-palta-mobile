import { assertMinorAmount } from '../../commerce/transaction.js';

export type ChileDteType =
  | 'boleta_39'
  | 'factura_33'
  | 'boleta_exenta_41'
  | 'factura_exenta_34'
  | 'nota_credito_61'
  | 'nota_debito_56'
  | 'guia_despacho_52';

export const CHILE_DTE_CODE: Readonly<Record<ChileDteType, number>> = {
  boleta_39: 39,
  factura_33: 33,
  boleta_exenta_41: 41,
  factura_exenta_34: 34,
  nota_credito_61: 61,
  nota_debito_56: 56,
  guia_despacho_52: 52,
};

export type FiscalRequestStatus =
  | 'pending'
  | 'validating'
  | 'ready_to_reserve_folio'
  | 'ready_to_sign'
  | 'signing'
  | 'ready_to_send'
  | 'sending'
  | 'accepted'
  | 'observed'
  | 'rejected'
  | 'failed'
  | 'cancelled';

export type FiscalLine = {
  id: string;
  description: string;
  quantity: number;
  /**
   * Legacy commerce-facing unit/line amount retained for compatibility.
   * Do NOT infer net/gross semantics from these fields for real DTE issuance.
   */
  unitAmountMinor: number;
  lineAmountMinor: number;
  exempt: boolean;
  productOrServiceRef?: string;
  /**
   * Explicit tax decomposition for production fiscal issuance. When any one of
   * these monetary fields is supplied, all six monetary breakdown fields must
   * be supplied and reconcile. This prevents a provider adapter from guessing
   * whether a POS price already contains Chilean VAT.
   */
  unitNetAmountMinor?: number;
  unitGrossAmountMinor?: number;
  lineNetAmountMinor?: number;
  lineExemptAmountMinor?: number;
  lineVatAmountMinor?: number;
  lineTotalAmountMinor?: number;
  unitCode?: string;
};

export type FiscalTotals = {
  netAmountMinor: number;
  exemptAmountMinor: number;
  vatAmountMinor: number;
  totalAmountMinor: number;
};

export type FiscalReceiver = {
  rut?: string;
  name?: string;
  giro?: string;
  address?: string;
  commune?: string;
  email?: string;
};

export type FiscalReference = {
  documentType: ChileDteType;
  folio: number;
  reasonCode?: string;
  reason?: string;
};

export type FiscalRequest = {
  id: string;
  businessId: string;
  transactionId: string;
  issuerRut: string;
  documentType: ChileDteType;
  idempotencyKey: string;
  lines: FiscalLine[];
  totals: FiscalTotals;
  status: FiscalRequestStatus;
  requestedAt: string;
  updatedAt: string;
  receiver?: FiscalReceiver;
  references?: FiscalReference[];
  folio?: number;
  cafRef?: string;
  signedXmlRef?: string;
  siiTrackId?: string;
  siiResponseCode?: string;
  siiResponseMessage?: string;
};

export type FolioReservationRequest = {
  businessId: string;
  issuerRut: string;
  documentType: ChileDteType;
  fiscalRequestId: string;
  idempotencyKey: string;
};

export type FolioReservation = {
  folio: number;
  cafRef: string;
  reservedAt: string;
};

export type FiscalValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  rulesetVersion: string;
};

export type SiiSendResult = {
  status: 'sent' | 'accepted' | 'observed' | 'rejected' | 'unknown';
  observedAt: string;
  trackId?: string;
  responseCode?: string;
  responseMessage?: string;
};

const ALLOWED_FISCAL_TRANSITIONS: Readonly<Record<FiscalRequestStatus, readonly FiscalRequestStatus[]>> = {
  pending: ['validating', 'cancelled'],
  validating: ['ready_to_reserve_folio', 'failed', 'cancelled'],
  ready_to_reserve_folio: ['ready_to_sign', 'failed', 'cancelled'],
  ready_to_sign: ['signing', 'failed', 'cancelled'],
  signing: ['ready_to_send', 'failed'],
  ready_to_send: ['sending', 'failed'],
  sending: ['accepted', 'observed', 'rejected', 'failed'],
  accepted: [],
  observed: ['accepted', 'rejected'],
  rejected: [],
  failed: ['validating', 'ready_to_sign', 'ready_to_send', 'cancelled'],
  cancelled: [],
};

export function assertFiscalTotals(totals: FiscalTotals): void {
  assertMinorAmount(totals.netAmountMinor, 'netAmountMinor');
  assertMinorAmount(totals.exemptAmountMinor, 'exemptAmountMinor');
  assertMinorAmount(totals.vatAmountMinor, 'vatAmountMinor');
  assertMinorAmount(totals.totalAmountMinor, 'totalAmountMinor');
  const calculated = totals.netAmountMinor + totals.exemptAmountMinor + totals.vatAmountMinor;
  if (calculated !== totals.totalAmountMinor) {
    throw new Error('Fiscal totals do not reconcile.');
  }
}

const EXPLICIT_LINE_FIELDS = [
  'unitNetAmountMinor',
  'unitGrossAmountMinor',
  'lineNetAmountMinor',
  'lineExemptAmountMinor',
  'lineVatAmountMinor',
  'lineTotalAmountMinor',
] as const;

export function fiscalLineHasExplicitTaxBreakdown(line: FiscalLine): boolean {
  return EXPLICIT_LINE_FIELDS.every((field) => line[field] !== undefined);
}

export function assertFiscalLine(line: FiscalLine): void {
  if (!line.id.trim() || !line.description.trim()) {
    throw new Error('Fiscal line identity/description are required.');
  }
  if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
    throw new Error('Fiscal line quantity must be positive.');
  }
  assertMinorAmount(line.unitAmountMinor, 'unitAmountMinor');
  assertMinorAmount(line.lineAmountMinor, 'lineAmountMinor');

  const providedCount = EXPLICIT_LINE_FIELDS.reduce(
    (count, field) => count + (line[field] === undefined ? 0 : 1),
    0,
  );
  if (providedCount !== 0 && providedCount !== EXPLICIT_LINE_FIELDS.length) {
    throw new Error('Fiscal line explicit tax breakdown must be complete or omitted entirely.');
  }
  if (providedCount === 0) return;

  const unitNet = line.unitNetAmountMinor;
  const unitGross = line.unitGrossAmountMinor;
  const lineNet = line.lineNetAmountMinor;
  const lineExempt = line.lineExemptAmountMinor;
  const lineVat = line.lineVatAmountMinor;
  const lineTotal = line.lineTotalAmountMinor;
  if (
    unitNet === undefined ||
    unitGross === undefined ||
    lineNet === undefined ||
    lineExempt === undefined ||
    lineVat === undefined ||
    lineTotal === undefined
  ) {
    throw new Error('Fiscal line tax breakdown is unexpectedly incomplete.');
  }
  assertMinorAmount(unitNet, 'unitNetAmountMinor');
  assertMinorAmount(unitGross, 'unitGrossAmountMinor');
  assertMinorAmount(lineNet, 'lineNetAmountMinor');
  assertMinorAmount(lineExempt, 'lineExemptAmountMinor');
  assertMinorAmount(lineVat, 'lineVatAmountMinor');
  assertMinorAmount(lineTotal, 'lineTotalAmountMinor');

  if (lineNet + lineExempt + lineVat !== lineTotal) {
    throw new Error('Fiscal line tax breakdown does not reconcile.');
  }
  if (line.exempt && (lineNet !== 0 || lineVat !== 0 || lineExempt !== lineTotal)) {
    throw new Error('Exempt fiscal line must place the full line amount in lineExemptAmountMinor.');
  }
  if (!line.exempt && lineExempt !== 0) {
    throw new Error('Affected fiscal line must not contain exempt line amount.');
  }
  if (line.unitCode !== undefined && (!line.unitCode.trim() || line.unitCode.length > 16)) {
    throw new Error('Fiscal line unitCode must contain 1 to 16 characters.');
  }
}

export function assertFiscalLinesMatchTotals(lines: readonly FiscalLine[], totals: FiscalTotals): void {
  if (!lines.every(fiscalLineHasExplicitTaxBreakdown)) {
    throw new Error('Production fiscal issuance requires explicit tax breakdown on every line.');
  }
  const sums = lines.reduce(
    (acc, line) => {
      acc.net += line.lineNetAmountMinor ?? 0;
      acc.exempt += line.lineExemptAmountMinor ?? 0;
      acc.vat += line.lineVatAmountMinor ?? 0;
      acc.total += line.lineTotalAmountMinor ?? 0;
      return acc;
    },
    { net: 0, exempt: 0, vat: 0, total: 0 },
  );
  if (
    sums.net !== totals.netAmountMinor ||
    sums.exempt !== totals.exemptAmountMinor ||
    sums.vat !== totals.vatAmountMinor ||
    sums.total !== totals.totalAmountMinor
  ) {
    throw new Error('Fiscal line tax breakdown does not match FiscalRequest totals.');
  }
}

export function createFiscalRequest(input: {
  id: string;
  businessId: string;
  transactionId: string;
  issuerRut: string;
  documentType: ChileDteType;
  idempotencyKey: string;
  lines: FiscalLine[];
  totals: FiscalTotals;
  requestedAt: string;
  receiver?: FiscalReceiver;
  references?: FiscalReference[];
}): FiscalRequest {
  if (!input.id.trim() || !input.businessId.trim() || !input.transactionId.trim() || !input.issuerRut.trim() || !input.idempotencyKey.trim()) {
    throw new Error('Fiscal request identity fields are required.');
  }
  if (input.lines.length === 0) throw new Error('Fiscal request requires at least one line.');
  input.lines.forEach(assertFiscalLine);
  assertFiscalTotals(input.totals);
  if (input.lines.every(fiscalLineHasExplicitTaxBreakdown)) {
    assertFiscalLinesMatchTotals(input.lines, input.totals);
  }

  const request: FiscalRequest = {
    id: input.id,
    businessId: input.businessId,
    transactionId: input.transactionId,
    issuerRut: input.issuerRut,
    documentType: input.documentType,
    idempotencyKey: input.idempotencyKey,
    lines: input.lines.map((line) => ({ ...line })),
    totals: { ...input.totals },
    status: 'pending',
    requestedAt: input.requestedAt,
    updatedAt: input.requestedAt,
  };
  if (input.receiver !== undefined) request.receiver = { ...input.receiver };
  if (input.references !== undefined) request.references = input.references.map((reference) => ({ ...reference }));
  return request;
}

export function transitionFiscalRequest(
  request: FiscalRequest,
  next: FiscalRequestStatus,
  occurredAt: string,
): FiscalRequest {
  if (!ALLOWED_FISCAL_TRANSITIONS[request.status].includes(next)) {
    throw new Error(`Invalid fiscal transition: ${request.status} -> ${next}`);
  }
  return { ...request, status: next, updatedAt: occurredAt };
}

export function attachFolio(
  request: FiscalRequest,
  reservation: FolioReservation,
): FiscalRequest {
  if (request.status !== 'ready_to_reserve_folio') {
    throw new Error('Folio may only be attached after validation and before signing.');
  }
  if (request.folio !== undefined && request.folio !== reservation.folio) {
    throw new Error('Fiscal request already owns a different folio.');
  }
  return {
    ...request,
    folio: reservation.folio,
    cafRef: reservation.cafRef,
    status: 'ready_to_sign',
    updatedAt: reservation.reservedAt,
  };
}

export function fiscalIsAuthoritativelyAccepted(request: FiscalRequest): boolean {
  return request.status === 'accepted';
}
