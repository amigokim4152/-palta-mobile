import {
  assertPrintJob,
  type PrintContent,
  type PrintDocumentKind,
  type PrintJob,
  type PrintJobStatus,
} from '../printing/printCore.js';
import {
  PrintJobConcurrencyError,
  type PrintJobByIdempotencyLookup,
  type PrintJobLookup,
  type PrintJobRepository,
  type PrintJobWrite,
  type RecoverablePrintJobQuery,
} from './printJobRepository.js';
import type { SqlDatabase } from './sqlDatabase.js';

type PrintJobRow = {
  id: string;
  business_id: string;
  printer_id: string;
  document_kind: PrintDocumentKind;
  content_json: unknown;
  status: PrintJobStatus;
  idempotency_key: string;
  revision: number | string;
  retry_authorized: boolean;
  provider_job_id: string | null;
  error_code: string | null;
  reprint_of_job_id: string | null;
  created_at: string;
  submitted_at: string | null;
  completed_at: string | null;
};

const PRINT_JOB_COLUMNS = `
  id,
  business_id,
  printer_id,
  document_kind,
  content_json,
  status,
  idempotency_key,
  revision,
  retry_authorized,
  provider_job_id,
  error_code,
  reprint_of_job_id,
  created_at,
  submitted_at,
  completed_at
`;

function safeInteger(value: number | string, label: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`);
  }
  return parsed;
}

function contentFromJson(value: unknown, documentKind: PrintDocumentKind): PrintContent {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Print content_json must be a JSON object.');
  }
  const content = value as Partial<PrintContent> & { kind?: unknown };
  if (content.kind !== documentKind) {
    throw new Error('Persisted print content kind does not match document_kind.');
  }
  return value as PrintContent;
}

function rowToPrintJob(row: PrintJobRow): PrintJob {
  const job: PrintJob = {
    id: row.id,
    businessId: row.business_id,
    printerId: row.printer_id,
    documentKind: row.document_kind,
    content: contentFromJson(row.content_json, row.document_kind),
    status: row.status,
    idempotencyKey: row.idempotency_key,
    revision: safeInteger(row.revision, 'Print job revision'),
    retryAuthorized: row.retry_authorized,
    createdAt: row.created_at,
  };
  if (row.provider_job_id !== null) job.providerJobId = row.provider_job_id;
  if (row.error_code !== null) job.errorCode = row.error_code;
  if (row.reprint_of_job_id !== null) job.reprintOfJobId = row.reprint_of_job_id;
  if (row.submitted_at !== null) job.submittedAt = row.submitted_at;
  if (row.completed_at !== null) job.completedAt = row.completed_at;
  assertPrintJob(job);
  return job;
}

export class PostgresPrintJobRepository implements PrintJobRepository {
  constructor(private readonly db: SqlDatabase) {}

  async findJob(lookup: PrintJobLookup): Promise<PrintJob | null> {
    const result = await this.db.query<PrintJobRow>(
      `select ${PRINT_JOB_COLUMNS}
       from print_job
       where business_id = $1 and id = $2
       limit 1`,
      [lookup.businessId, lookup.printJobId],
    );
    const row = result.rows[0];
    return row ? rowToPrintJob(row) : null;
  }

  async findByIdempotency(lookup: PrintJobByIdempotencyLookup): Promise<PrintJob | null> {
    const result = await this.db.query<PrintJobRow>(
      `select ${PRINT_JOB_COLUMNS}
       from print_job
       where business_id = $1 and idempotency_key = $2
       limit 1`,
      [lookup.businessId, lookup.idempotencyKey],
    );
    const row = result.rows[0];
    return row ? rowToPrintJob(row) : null;
  }

  async listRecoverable(query: RecoverablePrintJobQuery): Promise<PrintJob[]> {
    if (!query.businessId.trim()) throw new Error('Recoverable print query requires businessId.');
    if (!Number.isSafeInteger(query.limit) || query.limit < 1 || query.limit > 100) {
      throw new Error('Recoverable print query limit must be an integer between 1 and 100.');
    }

    const result = await this.db.query<PrintJobRow>(
      `select ${PRINT_JOB_COLUMNS}
       from print_job
       where business_id = $1
         and (
           status in ('queued', 'dispatching', 'submitted', 'outcome_unknown')
           or (status = 'failed' and retry_authorized = true)
         )
       order by created_at asc, id asc
       limit $2`,
      [query.businessId, query.limit],
    );
    return result.rows.map(rowToPrintJob);
  }

  async saveJob(write: PrintJobWrite): Promise<PrintJob> {
    assertPrintJob(write.job);
    const job = write.job;

    if (write.expectedRevision === null) {
      if (job.revision !== 0) {
        throw new PrintJobConcurrencyError('New print job must start at revision 0.');
      }
      const result = await this.db.query<PrintJobRow>(
        `insert into print_job (
          id, business_id, printer_id, document_kind, content_json, status,
          idempotency_key, revision, retry_authorized, provider_job_id, error_code,
          reprint_of_job_id, created_at, submitted_at, completed_at, updated_at
        ) values (
          $1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now()
        )
        on conflict (business_id, idempotency_key) do nothing
        returning ${PRINT_JOB_COLUMNS}`,
        [
          job.id,
          job.businessId,
          job.printerId,
          job.documentKind,
          JSON.stringify(job.content),
          job.status,
          job.idempotencyKey,
          job.revision,
          job.retryAuthorized,
          job.providerJobId ?? null,
          job.errorCode ?? null,
          job.reprintOfJobId ?? null,
          job.createdAt,
          job.submittedAt ?? null,
          job.completedAt ?? null,
        ],
      );
      const row = result.rows[0];
      if (!row) {
        throw new PrintJobConcurrencyError('Print idempotency key already exists for this business.');
      }
      return rowToPrintJob(row);
    }

    if (!Number.isSafeInteger(write.expectedRevision) || write.expectedRevision < 0) {
      throw new PrintJobConcurrencyError('expectedRevision must be a non-negative safe integer.');
    }
    if (job.revision !== write.expectedRevision + 1) {
      throw new PrintJobConcurrencyError('Updated print job revision must equal expectedRevision + 1.');
    }

    const result = await this.db.query<PrintJobRow>(
      `update print_job set
        printer_id = $4,
        content_json = $5::jsonb,
        status = $6,
        retry_authorized = $7,
        provider_job_id = $8,
        error_code = $9,
        reprint_of_job_id = $10,
        submitted_at = $11,
        completed_at = $12,
        revision = $13,
        updated_at = now()
       where business_id = $1
         and id = $2
         and revision = $3
       returning ${PRINT_JOB_COLUMNS}`,
      [
        job.businessId,
        job.id,
        write.expectedRevision,
        job.printerId,
        JSON.stringify(job.content),
        job.status,
        job.retryAuthorized,
        job.providerJobId ?? null,
        job.errorCode ?? null,
        job.reprintOfJobId ?? null,
        job.submittedAt ?? null,
        job.completedAt ?? null,
        job.revision,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new PrintJobConcurrencyError();
    return rowToPrintJob(row);
  }
}
