import {
  assertFiscalExecution,
  type FiscalExecution,
  type FiscalExecutionEnvironment,
  type FiscalExecutionMode,
  type FiscalExecutionStatus,
} from '../fiscal/chile/fiscalExecution.js';
import { CHILE_DTE_CODE, type ChileDteType, type FiscalTotals } from '../fiscal/chile/fiscalModel.js';
import {
  FiscalExecutionConcurrencyError,
  type FiscalExecutionByRequestLookup,
  type FiscalExecutionLookup,
  type FiscalExecutionRepository,
  type FiscalExecutionWrite,
} from './fiscalExecutionRepository.js';
import type { SqlDatabase } from './sqlDatabase.js';

type ExecutionRow = {
  id: string;
  business_id: string;
  fiscal_request_id: string;
  issuer_rut: string;
  document_type: number | string;
  mode: FiscalExecutionMode;
  environment: FiscalExecutionEnvironment;
  status: FiscalExecutionStatus;
  idempotency_key: string;
  provider_key: string | null;
  provider_connection_id: string | null;
  provider_reference: string | null;
  provider_ticket_reference: string | null;
  folio: number | string | null;
  authority_track_id: string | null;
  authority_status: string | null;
  authority_message: string | null;
  xml_asset_ref: string | null;
  pdf_asset_ref: string | null;
  provider_totals: unknown;
  canonical_totals_match: boolean | null;
  revision: number | string;
  created_at: string;
  updated_at: string;
};

const EXECUTION_COLUMNS = `
  id,
  business_id,
  fiscal_request_id,
  issuer_rut,
  document_type,
  mode,
  environment,
  status,
  idempotency_key,
  provider_key,
  provider_connection_id,
  provider_reference,
  provider_ticket_reference,
  folio,
  authority_track_id,
  authority_status,
  authority_message,
  xml_asset_ref,
  pdf_asset_ref,
  provider_totals,
  canonical_totals_match,
  revision,
  created_at,
  updated_at
`;

const CODE_TO_DTE = new Map<number, ChileDteType>(
  Object.entries(CHILE_DTE_CODE).map(([type, code]) => [code, type as ChileDteType]),
);

function safeInteger(value: number | string, label: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${label} is outside safe-integer range.`);
  return parsed;
}

function dteType(value: number | string): ChileDteType {
  const code = safeInteger(value, 'Fiscal execution document_type');
  const type = CODE_TO_DTE.get(code);
  if (!type) throw new Error(`Unsupported Chile DTE code in fiscal execution: ${code}`);
  return type;
}

function fiscalTotals(value: unknown): FiscalTotals | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Fiscal execution provider_totals must be a JSON object.');
  }
  const row = value as Record<string, unknown>;
  const keys = ['netAmountMinor', 'exemptAmountMinor', 'vatAmountMinor', 'totalAmountMinor'] as const;
  const result = {} as FiscalTotals;
  for (const key of keys) {
    const item = row[key];
    if (typeof item !== 'number' || !Number.isSafeInteger(item) || item < 0) {
      throw new Error(`Fiscal execution provider_totals.${key} must be a non-negative safe integer.`);
    }
    result[key] = item;
  }
  return result;
}

function rowToExecution(row: ExecutionRow): FiscalExecution {
  const execution: FiscalExecution = {
    id: row.id,
    businessId: row.business_id,
    fiscalRequestId: row.fiscal_request_id,
    issuerRut: row.issuer_rut,
    documentType: dteType(row.document_type),
    mode: row.mode,
    environment: row.environment,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    revision: safeInteger(row.revision, 'Fiscal execution revision'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.provider_key !== null) execution.providerKey = row.provider_key;
  if (row.provider_connection_id !== null) execution.providerConnectionId = row.provider_connection_id;
  if (row.provider_reference !== null) execution.providerReference = row.provider_reference;
  if (row.provider_ticket_reference !== null) execution.providerTicketReference = row.provider_ticket_reference;
  if (row.folio !== null) execution.folio = safeInteger(row.folio, 'Fiscal execution folio');
  if (row.authority_track_id !== null) execution.authorityTrackId = row.authority_track_id;
  if (row.authority_status !== null) execution.authorityStatus = row.authority_status;
  if (row.authority_message !== null) execution.authorityMessage = row.authority_message;
  if (row.xml_asset_ref !== null) execution.xmlAssetRef = row.xml_asset_ref;
  if (row.pdf_asset_ref !== null) execution.pdfAssetRef = row.pdf_asset_ref;
  const totals = fiscalTotals(row.provider_totals);
  if (totals !== undefined) execution.providerTotals = totals;
  if (row.canonical_totals_match !== null) execution.canonicalTotalsMatch = row.canonical_totals_match;
  assertFiscalExecution(execution);
  return execution;
}

export class PostgresFiscalExecutionRepository implements FiscalExecutionRepository {
  constructor(private readonly db: SqlDatabase) {}

  async findExecution(lookup: FiscalExecutionLookup): Promise<FiscalExecution | null> {
    const result = await this.db.query<ExecutionRow>(
      `select ${EXECUTION_COLUMNS}
       from fiscal_execution
       where business_id = $1 and id = $2
       limit 1`,
      [lookup.businessId, lookup.executionId],
    );
    const row = result.rows[0];
    return row ? rowToExecution(row) : null;
  }

  async findByFiscalRequest(lookup: FiscalExecutionByRequestLookup): Promise<FiscalExecution | null> {
    const result = await this.db.query<ExecutionRow>(
      `select ${EXECUTION_COLUMNS}
       from fiscal_execution
       where business_id = $1 and fiscal_request_id = $2
       limit 1`,
      [lookup.businessId, lookup.fiscalRequestId],
    );
    const row = result.rows[0];
    return row ? rowToExecution(row) : null;
  }

  async saveExecution(write: FiscalExecutionWrite): Promise<FiscalExecution> {
    assertFiscalExecution(write.execution);
    const e = write.execution;

    if (write.expectedRevision === null) {
      if (e.revision !== 0) {
        throw new FiscalExecutionConcurrencyError('New fiscal execution must start at revision 0.');
      }
      const result = await this.db.query<ExecutionRow>(
        `insert into fiscal_execution (
          id, business_id, fiscal_request_id, issuer_rut, document_type, mode,
          environment, status, idempotency_key, provider_key,
          provider_connection_id, provider_reference, provider_ticket_reference,
          folio, authority_track_id, authority_status, authority_message,
          xml_asset_ref, pdf_asset_ref, provider_totals, canonical_totals_match,
          revision, created_at, updated_at
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21,$22,$23,$24
        )
        on conflict (fiscal_request_id) do nothing
        returning ${EXECUTION_COLUMNS}`,
        [
          e.id,
          e.businessId,
          e.fiscalRequestId,
          e.issuerRut,
          CHILE_DTE_CODE[e.documentType],
          e.mode,
          e.environment,
          e.status,
          e.idempotencyKey,
          e.providerKey ?? null,
          e.providerConnectionId ?? null,
          e.providerReference ?? null,
          e.providerTicketReference ?? null,
          e.folio ?? null,
          e.authorityTrackId ?? null,
          e.authorityStatus ?? null,
          e.authorityMessage ?? null,
          e.xmlAssetRef ?? null,
          e.pdfAssetRef ?? null,
          e.providerTotals === undefined ? null : JSON.stringify(e.providerTotals),
          e.canonicalTotalsMatch ?? null,
          e.revision,
          e.createdAt,
          e.updatedAt,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new FiscalExecutionConcurrencyError('Fiscal execution already exists for request.');
      return rowToExecution(row);
    }

    if (!Number.isSafeInteger(write.expectedRevision) || write.expectedRevision < 0) {
      throw new FiscalExecutionConcurrencyError('expectedRevision must be a non-negative safe integer.');
    }
    if (e.revision !== write.expectedRevision + 1) {
      throw new FiscalExecutionConcurrencyError('Updated fiscal execution revision must equal expectedRevision + 1.');
    }

    const result = await this.db.query<ExecutionRow>(
      `update fiscal_execution set
        status = $4,
        provider_reference = $5,
        provider_ticket_reference = $6,
        folio = $7,
        authority_track_id = $8,
        authority_status = $9,
        authority_message = $10,
        xml_asset_ref = $11,
        pdf_asset_ref = $12,
        provider_totals = $13::jsonb,
        canonical_totals_match = $14,
        revision = $15,
        updated_at = $16
       where business_id = $1
         and id = $2
         and revision = $3
       returning ${EXECUTION_COLUMNS}`,
      [
        e.businessId,
        e.id,
        write.expectedRevision,
        e.status,
        e.providerReference ?? null,
        e.providerTicketReference ?? null,
        e.folio ?? null,
        e.authorityTrackId ?? null,
        e.authorityStatus ?? null,
        e.authorityMessage ?? null,
        e.xmlAssetRef ?? null,
        e.pdfAssetRef ?? null,
        e.providerTotals === undefined ? null : JSON.stringify(e.providerTotals),
        e.canonicalTotalsMatch ?? null,
        e.revision,
        e.updatedAt,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new FiscalExecutionConcurrencyError();
    return rowToExecution(row);
  }
}
