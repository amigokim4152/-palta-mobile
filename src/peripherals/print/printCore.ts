export type PrintJobKind =
  | 'receipt'
  | 'kitchen_ticket'
  | 'product_label'
  | 'shipping_label'
  | 'fiscal_copy'
  | 'document';

export type PrinterClass = 'receipt' | 'label' | 'document';

export type PrinterTransport =
  | 'usb'
  | 'bluetooth'
  | 'ethernet'
  | 'wifi'
  | 'os_queue'
  | 'cloud'
  | 'embedded';

export type PrinterProtocol =
  | 'escpos'
  | 'zpl'
  | 'tspl'
  | 'brother_raster'
  | 'vendor_sdk'
  | 'ipp'
  | 'pdf'
  | 'unknown';

export type PrinterCapability =
  | 'cut'
  | 'cash_drawer_pulse'
  | 'barcode_1d'
  | 'qr_code'
  | 'bitmap'
  | 'color'
  | 'peel'
  | 'label_gap_sensor'
  | 'continuous_media'
  | 'a4_or_letter';

export type PrinterStatus =
  | 'ready'
  | 'busy'
  | 'paper_out'
  | 'cover_open'
  | 'offline'
  | 'error'
  | 'unknown';

export type PrinterProfile = {
  id: string;
  businessId: string;
  name: string;
  printerClass: PrinterClass;
  transport: PrinterTransport;
  protocol: PrinterProtocol;
  capabilities: ReadonlySet<PrinterCapability>;
  enabled: boolean;
  verified: boolean;
  model?: string;
  vendor?: string;
  outletId?: string;
  deviceBridgeId?: string;
  connectionRef?: string;
  mediaWidthMm?: number;
  dpi?: number;
};

export type PrintTextAlignment = 'left' | 'center' | 'right';

export type PrintBlock =
  | {
      type: 'text';
      text: string;
      bold?: boolean;
      alignment?: PrintTextAlignment;
      scale?: 1 | 2;
    }
  | { type: 'rule' }
  | { type: 'feed'; lines: number }
  | { type: 'barcode'; value: string; symbology: 'code128' | 'ean13' | 'code39' }
  | { type: 'qr'; value: string; size?: number }
  | { type: 'image_ref'; objectRef: string }
  | { type: 'cut' };

export type PrintDocument = {
  title?: string;
  blocks: readonly PrintBlock[];
};

export type PrintJobStatus =
  | 'queued'
  | 'sending'
  | 'printed'
  | 'unknown'
  | 'failed'
  | 'cancelled';

export type PrintJob = {
  id: string;
  businessId: string;
  kind: PrintJobKind;
  printerClass: PrinterClass;
  status: PrintJobStatus;
  document: PrintDocument;
  copies: number;
  createdAt: string;
  idempotencyKey: string;
  revision: number;
  outletId?: string;
  preferredPrinterId?: string;
  selectedPrinterId?: string;
  sourceReferenceId?: string;
  attemptCount?: number;
  printedAt?: string;
  failureCode?: string;
};

export type PrintRequirement = {
  printerClass: PrinterClass;
  requiredCapabilities: ReadonlySet<PrinterCapability>;
  preferredMediaWidthMm?: number;
};

export function createPrintJob(input: {
  id: string;
  businessId: string;
  kind: PrintJobKind;
  printerClass: PrinterClass;
  document: PrintDocument;
  copies?: number;
  createdAt: string;
  idempotencyKey: string;
  outletId?: string;
  preferredPrinterId?: string;
  sourceReferenceId?: string;
}): PrintJob {
  if (!input.id.trim() || !input.businessId.trim() || !input.idempotencyKey.trim()) {
    throw new Error('print job id, businessId and idempotencyKey are required.');
  }
  if (input.document.blocks.length === 0) {
    throw new Error('print job requires at least one document block.');
  }
  const copies = input.copies ?? 1;
  if (!Number.isSafeInteger(copies) || copies < 1 || copies > 99) {
    throw new Error('print copies must be an integer between 1 and 99.');
  }

  const job: PrintJob = {
    id: input.id,
    businessId: input.businessId,
    kind: input.kind,
    printerClass: input.printerClass,
    status: 'queued',
    document: input.document,
    copies,
    createdAt: input.createdAt,
    idempotencyKey: input.idempotencyKey,
    revision: 0,
  };
  if (input.outletId !== undefined) job.outletId = input.outletId;
  if (input.preferredPrinterId !== undefined) job.preferredPrinterId = input.preferredPrinterId;
  if (input.sourceReferenceId !== undefined) job.sourceReferenceId = input.sourceReferenceId;
  return job;
}

export function requirementForPrintJob(job: PrintJob): PrintRequirement {
  const required = new Set<PrinterCapability>();
  for (const block of job.document.blocks) {
    if (block.type === 'barcode') required.add('barcode_1d');
    if (block.type === 'qr') required.add('qr_code');
    if (block.type === 'image_ref') required.add('bitmap');
    if (block.type === 'cut') required.add('cut');
  }
  if (job.printerClass === 'document') required.add('a4_or_letter');
  return { printerClass: job.printerClass, requiredCapabilities: required };
}

export function beginPrintAttempt(job: PrintJob, printerId: string): PrintJob {
  if (job.status === 'printed' || job.status === 'cancelled') {
    throw new Error('completed print job cannot start another normal print attempt.');
  }
  if (!printerId.trim()) throw new Error('printerId is required.');
  return {
    ...job,
    status: 'sending',
    selectedPrinterId: printerId,
    attemptCount: (job.attemptCount ?? 0) + 1,
    revision: job.revision + 1,
  };
}

export function markPrintResult(input: {
  job: PrintJob;
  outcome: 'printed' | 'unknown' | 'failed';
  occurredAt: string;
  failureCode?: string;
}): PrintJob {
  if (input.job.status !== 'sending') {
    throw new Error('print result requires a sending job.');
  }
  const next: PrintJob = {
    ...input.job,
    status: input.outcome,
    revision: input.job.revision + 1,
  };
  if (input.outcome === 'printed') next.printedAt = input.occurredAt;
  if (input.failureCode !== undefined) next.failureCode = input.failureCode;
  return next;
}

/**
 * A print timeout is ambiguous: the printer may already have produced paper.
 * Normal automatic retry is therefore unsafe. The operator/device bridge must
 * reconcile printer status or explicitly request a reprint.
 */
export function canAutomaticallyRetryPrint(job: PrintJob): boolean {
  return job.status === 'queued' || job.status === 'failed';
}

export function createExplicitReprint(input: {
  original: PrintJob;
  newId: string;
  createdAt: string;
  idempotencyKey: string;
}): PrintJob {
  if (input.original.status !== 'printed' && input.original.status !== 'unknown') {
    throw new Error('explicit reprint is only for printed or ambiguous jobs.');
  }
  const title = input.original.document.title
    ? `COPY — ${input.original.document.title}`
    : 'COPY';
  return createPrintJob({
    id: input.newId,
    businessId: input.original.businessId,
    kind: input.original.kind,
    printerClass: input.original.printerClass,
    document: {
      ...input.original.document,
      title,
      blocks: [
        { type: 'text', text: 'COPY / REPRINT', bold: true, alignment: 'center' },
        ...input.original.document.blocks,
      ],
    },
    copies: input.original.copies,
    createdAt: input.createdAt,
    idempotencyKey: input.idempotencyKey,
    ...(input.original.outletId !== undefined ? { outletId: input.original.outletId } : {}),
    ...(input.original.preferredPrinterId !== undefined
      ? { preferredPrinterId: input.original.preferredPrinterId }
      : {}),
    ...(input.original.sourceReferenceId !== undefined
      ? { sourceReferenceId: input.original.sourceReferenceId }
      : {}),
  });
}
