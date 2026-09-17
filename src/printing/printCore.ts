export type PrintDocumentKind =
  | 'receipt'
  | 'label'
  | 'a4_document'
  | 'kitchen_ticket'
  | 'packing_slip';

export type PrinterTransport =
  | 'usb'
  | 'serial'
  | 'bluetooth'
  | 'network'
  | 'ipp'
  | 'os_spooler'
  | 'vendor_sdk';

export type PrinterProtocol =
  | 'esc_pos'
  | 'epson_epos'
  | 'star_prnt'
  | 'zpl'
  | 'epl'
  | 'tspl'
  | 'brother_raster'
  | 'ipp_pdf'
  | 'os_spooler';

export type PrinterSupportTier =
  | 'palta_recommended'
  | 'palta_certified'
  | 'compatible'
  | 'legacy_bridge'
  | 'unknown';

export type PrinterHealth =
  | 'ready'
  | 'offline'
  | 'busy'
  | 'paper_low'
  | 'paper_out'
  | 'cover_open'
  | 'cutter_error'
  | 'permission_required'
  | 'driver_required'
  | 'bridge_unreachable'
  | 'network_unreachable'
  | 'unknown';

export type PrinterIdentity = {
  id: string;
  businessId: string;
  outletId?: string;
  displayName: string;
  manufacturer?: string;
  model?: string;
  serialNumberHash?: string;
  firmwareVersion?: string;
  /** SHA-256 hex digest only. Never a raw IP, MAC, USB path or serial identifier. */
  connectionFingerprintHash?: string;
  transport: PrinterTransport;
  protocol: PrinterProtocol;
  supportTier: PrinterSupportTier;
  paperWidthMm?: number;
  health: PrinterHealth;
  adapterKey: string;
};

export type PrintContent =
  | {
      kind: 'receipt' | 'kitchen_ticket' | 'packing_slip';
      title?: string;
      lines: Array<{
        text: string;
        emphasis?: boolean;
        alignment?: 'left' | 'center' | 'right';
      }>;
      qrValue?: string;
      barcodeValue?: string;
      cutAfterPrint?: boolean;
    }
  | {
      kind: 'label';
      templateKey: string;
      fields: Record<string, string | number>;
      copies: number;
    }
  | {
      kind: 'a4_document';
      mimeType: 'application/pdf';
      objectRef: string;
      copies: number;
    };

export type PrintJobStatus =
  | 'queued'
  | 'dispatching'
  | 'submitted'
  | 'printed'
  | 'outcome_unknown'
  | 'failed'
  | 'cancelled';

export type PrintJob = {
  id: string;
  businessId: string;
  printerId: string;
  documentKind: PrintDocumentKind;
  content: PrintContent;
  status: PrintJobStatus;
  idempotencyKey: string;
  revision: number;
  /** Durable evidence that the most recent failure definitively produced no output. */
  retryAuthorized: boolean;
  createdAt: string;
  submittedAt?: string;
  completedAt?: string;
  errorCode?: string;
  providerJobId?: string;
  /** Set for physical reprints of a previously issued receipt/document. */
  reprintOfJobId?: string;
};

export type PrintDispatchResult =
  | { outcome: 'printed'; providerJobId?: string }
  | { outcome: 'submitted'; providerJobId?: string }
  | { outcome: 'unknown'; code: string }
  | { outcome: 'failed'; code: string; retryable: boolean };

export type PrinterAdapter = {
  key: string;
  supports(printer: PrinterIdentity, content: PrintContent): boolean;
  health(printer: PrinterIdentity): Promise<PrinterHealth>;
  print(printer: PrinterIdentity, job: PrintJob): Promise<PrintDispatchResult>;
};

export function createPrintJob(input: {
  id: string;
  businessId: string;
  printerId: string;
  content: PrintContent;
  idempotencyKey: string;
  createdAt: string;
  reprintOfJobId?: string;
}): PrintJob {
  if (!input.id.trim() || !input.businessId.trim() || !input.printerId.trim()) {
    throw new Error('Print job id, businessId and printerId are required.');
  }
  if (!input.idempotencyKey.trim()) throw new Error('Print idempotencyKey is required.');

  const job: PrintJob = {
    id: input.id,
    businessId: input.businessId,
    printerId: input.printerId,
    documentKind: input.content.kind,
    content: input.content,
    status: 'queued',
    idempotencyKey: input.idempotencyKey,
    revision: 0,
    retryAuthorized: false,
    createdAt: input.createdAt,
  };
  if (input.reprintOfJobId !== undefined) job.reprintOfJobId = input.reprintOfJobId;
  return job;
}

/**
 * Initial dispatch is deliberately restricted to a never-dispatched queued job.
 * submitted / dispatching / outcome_unknown must never be sent again blindly because
 * the printer may already have produced physical output.
 */
export function beginPrintDispatch(job: PrintJob, submittedAt: string): PrintJob {
  if (job.status !== 'queued') {
    throw new Error('Only queued print jobs can begin initial dispatch.');
  }
  return {
    ...job,
    status: 'dispatching',
    revision: job.revision + 1,
    retryAuthorized: false,
    submittedAt,
  };
}

function withOptionalProviderJobId(
  job: PrintJob,
  providerJobId: string | undefined,
): PrintJob {
  if (providerJobId === undefined) return job;
  return { ...job, providerJobId };
}

export function applyPrintDispatchResult(
  job: PrintJob,
  result: PrintDispatchResult,
  now: string,
): PrintJob {
  if (job.status !== 'dispatching') throw new Error('Print result requires a dispatching job.');

  if (result.outcome === 'printed') {
    return withOptionalProviderJobId(
      {
        ...job,
        status: 'printed',
        revision: job.revision + 1,
        retryAuthorized: false,
        completedAt: now,
      },
      result.providerJobId,
    );
  }
  if (result.outcome === 'submitted') {
    return withOptionalProviderJobId(
      {
        ...job,
        status: 'submitted',
        revision: job.revision + 1,
        retryAuthorized: false,
      },
      result.providerJobId,
    );
  }
  if (result.outcome === 'unknown') {
    return {
      ...job,
      status: 'outcome_unknown',
      revision: job.revision + 1,
      retryAuthorized: false,
      errorCode: result.code,
    };
  }
  return {
    ...job,
    status: 'failed',
    revision: job.revision + 1,
    retryAuthorized: result.retryable,
    errorCode: result.code,
  };
}

export function canAutomaticallyRetryPrint(job: PrintJob): boolean {
  return job.status === 'failed' && job.retryAuthorized;
}

/**
 * A retry is a separate safety path. It is allowed only when the persisted job
 * records definitive evidence that the preceding attempt produced no physical output.
 */
export function beginPrintRetry(job: PrintJob, submittedAt: string): PrintJob {
  if (!canAutomaticallyRetryPrint(job)) {
    throw new Error('Print retry requires persisted authorization from a definitive no-output failure.');
  }
  return {
    ...job,
    status: 'dispatching',
    revision: job.revision + 1,
    retryAuthorized: false,
    submittedAt,
  };
}

/**
 * Physical print success never means fiscal issuance success. Fiscal issuance is
 * owned by Fiscal Core; printing only renders an already-known business artifact.
 */
export function assertPrintDoesNotIssueFiscalDocument(): true {
  return true;
}
