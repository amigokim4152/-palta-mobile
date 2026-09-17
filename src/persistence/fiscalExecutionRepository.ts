import type { FiscalExecution } from '../fiscal/chile/fiscalExecution.js';

export type FiscalExecutionLookup = {
  businessId: string;
  executionId: string;
};

export type FiscalExecutionByRequestLookup = {
  businessId: string;
  fiscalRequestId: string;
};

export type FiscalExecutionWrite = {
  execution: FiscalExecution;
  /** null means create; number means compare-and-swap current revision. */
  expectedRevision: number | null;
};

export class FiscalExecutionConcurrencyError extends Error {
  constructor(message = 'Fiscal execution revision conflict.') {
    super(message);
    this.name = 'FiscalExecutionConcurrencyError';
  }
}

export interface FiscalExecutionRepository {
  findExecution(lookup: FiscalExecutionLookup): Promise<FiscalExecution | null>;
  findByFiscalRequest(lookup: FiscalExecutionByRequestLookup): Promise<FiscalExecution | null>;
  saveExecution(write: FiscalExecutionWrite): Promise<FiscalExecution>;
}
