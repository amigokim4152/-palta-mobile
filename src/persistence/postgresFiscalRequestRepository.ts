import {
  CHILE_DTE_CODE,
  assertFiscalLine,
  assertFiscalTotals,
  type ChileDteType,
  type FiscalLine,
  type FiscalReceiver,
  type FiscalReference,
  type FiscalRequest,
  type FiscalRequestStatus,
  type FiscalTotals,
} from '../fiscal/chile/fiscalModel.js';
import type { FiscalRequestLookup, FiscalRequestRepository } from './fiscalRequestRepository.js';
import type { SqlDatabase } from './sqlDatabase.js';

type RequestRow = {
  id: string;
  business_id: string;
  commerce_transaction_id: string;
  issuer_rut: string;
  document_type: number | string;
  idempotency_key: string;
  status: FiscalRequestStatus;
  lines: unknown;
  totals: unknown;
  receiver: unknown;
  references_json: unknown;
  folio: number | string | null;
  sii_track_id: string | null;
  sii_response_code: string | null;
  sii_response_message: string | null;
  requested_at: string;
  updated_at: string;
};

const CODE_TO_DTE = new Map<number, ChileDteType>(
  Object.entries(CHILE_DTE_CODE).map(([type, code]) => [code, type as ChileDteType]),
);

function safeInteger(value: unknown, label: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative safe integer.`);
  return parsed;
}

function dteType(value: unknown): ChileDteType {
  if (typeof value === 'string' && value in CHILE_DTE_CODE) return value as ChileDteType;
  const code = safeInteger(value, 'Fiscal request document_type');
  const type = CODE_TO_DTE.get(code);
  if (!type) throw new Error(`Unsupported Chile DTE code: ${code}`);
  return type;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function optionalString(row: Record<string, unknown>, key: string): string | undefined {
  const value = row[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new Error(`${key} must be a string.`);
  return value;
}

function fiscalTotals(value: unknown): FiscalTotals {
  const row = record(value, 'Fiscal totals');
  const totals: FiscalTotals = {
    netAmountMinor: safeInteger(row.netAmountMinor, 'netAmountMinor'),
    exemptAmountMinor: safeInteger(row.exemptAmountMinor, 'exemptAmountMinor'),
    vatAmountMinor: safeInteger(row.vatAmountMinor, 'vatAmountMinor'),
    totalAmountMinor: safeInteger(row.totalAmountMinor, 'totalAmountMinor'),
  };
  assertFiscalTotals(totals);
  return totals;
}

function fiscalLine(value: unknown): FiscalLine {
  const row = record(value, 'Fiscal line');
  if (typeof row.id !== 'string' || typeof row.description !== 'string') {
    throw new Error('Fiscal line requires string id and description.');
  }
  if (typeof row.quantity !== 'number' || !Number.isFinite(row.quantity)) {
    throw new Error('Fiscal line quantity must be numeric.');
  }
  if (typeof row.exempt !== 'boolean') throw new Error('Fiscal line exempt must be boolean.');
  const line: FiscalLine = {
    id: row.id,
    description: row.description,
    quantity: row.quantity,
    unitAmountMinor: safeInteger(row.unitAmountMinor, 'unitAmountMinor'),
    lineAmountMinor: safeInteger(row.lineAmountMinor, 'lineAmountMinor'),
    exempt: row.exempt,
  };
  const productOrServiceRef = optionalString(row, 'productOrServiceRef');
  if (productOrServiceRef !== undefined) line.productOrServiceRef = productOrServiceRef;
  const unitCode = optionalString(row, 'unitCode');
  if (unitCode !== undefined) line.unitCode = unitCode;
  for (const key of [
    'unitNetAmountMinor',
    'unitGrossAmountMinor',
    'lineNetAmountMinor',
    'lineExemptAmountMinor',
    'lineVatAmountMinor',
    'lineTotalAmountMinor',
  ] as const) {
    if (row[key] !== undefined && row[key] !== null) line[key] = safeInteger(row[key], key);
  }
  assertFiscalLine(line);
  return line;
}

function fiscalLines(value: unknown): FiscalLine[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Fiscal request lines must be a non-empty JSON array.');
  return value.map(fiscalLine);
}

function fiscalReceiver(value: unknown): FiscalReceiver | undefined {
  if (value === null || value === undefined) return undefined;
  const row = record(value, 'Fiscal receiver');
  const receiver: FiscalReceiver = {};
  for (const key of ['rut', 'name', 'giro', 'address', 'commune', 'email'] as const) {
    const item = optionalString(row, key);
    if (item !== undefined) receiver[key] = item;
  }
  return receiver;
}

function fiscalReferences(value: unknown): FiscalReference[] | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error('Fiscal references must be a JSON array.');
  return value.map((item) => {
    const row = record(item, 'Fiscal reference');
    const reference: FiscalReference = {
      documentType: dteType(row.documentType),
      folio: safeInteger(row.folio, 'Fiscal reference folio'),
    };
    const reasonCode = optionalString(row, 'reasonCode');
    const reason = optionalString(row, 'reason');
    if (reasonCode !== undefined) reference.reasonCode = reasonCode;
    if (reason !== undefined) reference.reason = reason;
    return reference;
  });
}

function rowToRequest(row: RequestRow): FiscalRequest {
  const request: FiscalRequest = {
    id: row.id,
    businessId: row.business_id,
    transactionId: row.commerce_transaction_id,
    issuerRut: row.issuer_rut,
    documentType: dteType(row.document_type),
    idempotencyKey: row.idempotency_key,
    lines: fiscalLines(row.lines),
    totals: fiscalTotals(row.totals),
    status: row.status,
    requestedAt: row.requested_at,
    updatedAt: row.updated_at,
  };
  const receiver = fiscalReceiver(row.receiver);
  if (receiver !== undefined) request.receiver = receiver;
  const references = fiscalReferences(row.references_json);
  if (references !== undefined) request.references = references;
  if (row.folio !== null) request.folio = safeInteger(row.folio, 'Fiscal request folio');
  if (row.sii_track_id !== null) request.siiTrackId = row.sii_track_id;
  if (row.sii_response_code !== null) request.siiResponseCode = row.sii_response_code;
  if (row.sii_response_message !== null) request.siiResponseMessage = row.sii_response_message;
  return request;
}

export class PostgresFiscalRequestRepository implements FiscalRequestRepository {
  constructor(private readonly db: SqlDatabase) {}

  async findRequest(lookup: FiscalRequestLookup): Promise<FiscalRequest | null> {
    const result = await this.db.query<RequestRow>(
      `select
        id,
        business_id,
        commerce_transaction_id,
        issuer_rut,
        document_type,
        idempotency_key,
        status,
        lines,
        totals,
        receiver,
        references_json,
        folio,
        sii_track_id,
        sii_response_code,
        sii_response_message,
        requested_at,
        updated_at
       from fiscal_request
       where business_id = $1 and id = $2
       limit 1`,
      [lookup.businessId, lookup.fiscalRequestId],
    );
    const row = result.rows[0];
    return row ? rowToRequest(row) : null;
  }
}
