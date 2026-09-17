import type { PrintJob } from '../printing/printCore.js';

export type PrintJobLookup = {
  businessId: string;
  printJobId: string;
};

export type PrintJobByIdempotencyLookup = {
  businessId: string;
  idempotencyKey: string;
};

export type PrintJobWrite = {
  job: PrintJob;
  /** null for insert, otherwise compare-and-swap against the persisted revision. */
  expectedRevision: number | null;
};

export class PrintJobConcurrencyError extends Error {
  constructor(message = 'Print job was changed by another operation.') {
    super(message);
    this.name = 'PrintJobConcurrencyError';
  }
}

export interface PrintJobRepository {
  findJob(lookup: PrintJobLookup): Promise<PrintJob | null>;
  findByIdempotency(lookup: PrintJobByIdempotencyLookup): Promise<PrintJob | null>;
  saveJob(write: PrintJobWrite): Promise<PrintJob>;
}
