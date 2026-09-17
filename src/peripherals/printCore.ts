export type PrintDocumentKind =
  | 'receipt'
  | 'kitchen_ticket'
  | 'label'
  | 'shipping_label'
  | 'fiscal_copy'
  | 'a4_document';

export type PrinterClass =
  | 'receipt_thermal'
  | 'label'
  | 'general_document';

export type PrintLanguage =
  | 'escpos'
  | 'zpl'
  | 'epl'
  | 'tspl'
  | 'raster'
  | 'pdf'
  | 'vendor';

export type PrinterTransport =
  | 'network_raw'
  | 'network_vendor'
  | 'usb_local_bridge'
  | 'bluetooth_native'
  | 'os_spooler'
  | 'vendor_sdk'
  | 'cloud_pull';

export type PrinterSupportTier =
  | 'certified'
  | 'compatible'
  | 'generic'
  | 'unsupported';

export type PrinterCapability = {
  paperWidthMm?: number;
  dpi?: number;
  cutter?: boolean;
  cashDrawerPulse?: boolean;
  barcode?: boolean;
  qrCode?: boolean;
  color?: boolean;
  languages: PrintLanguage[];
  transports: PrinterTransport[];
};

export type PrinterDeviceProfile = {
  id: string;
  businessId: string;
  displayName: string;
  printerClass: PrinterClass;
  supportTier: PrinterSupportTier;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  capability: PrinterCapability;
  connection: {
    transport: PrinterTransport;
    endpointRef: string;
  };
  enabled: boolean;
  lastTestedAt?: string;
  lastSeenAt?: string;
};

export type PrintJobStatus =
  | 'created'
  | 'queued'
  | 'sending'
  | 'printed'
  | 'unknown'
  | 'failed'
  | 'cancelled';

export type PrintJob = {
  id: string;
  businessId: string;
  documentKind: PrintDocumentKind;
  printerId: string;
  payloadRef: string;
  contentHash: string;
  idempotencyKey: string;
  status: PrintJobStatus;
  copies: number;
  createdAt: string;
  attempts: number;
  lastErrorCode?: string;
};

export type PrintSurface =
  | 'phone_native'
  | 'tablet_native'
  | 'android_pos_native'
  | 'desktop_web'
  | 'desktop_native';

export type PrintRuntimeCapability = {
  surface: PrintSurface;
  localBridgeAvailable: boolean;
  osSpoolerAvailable: boolean;
  nativeBluetoothAvailable: boolean;
  nativeUsbAvailable: boolean;
  sameLanPrinterAccess: boolean;
};

export type PrintRoute = {
  transport: PrinterTransport;
  reason:
    | 'certified_network_path'
    | 'vendor_network_sdk'
    | 'local_bridge_for_usb'
    | 'native_bluetooth'
    | 'native_vendor_sdk'
    | 'os_spooler_document'
    | 'cloud_pull_supported'
    | 'no_safe_route';
};

const RECEIPT_KINDS: ReadonlySet<PrintDocumentKind> = new Set([
  'receipt',
  'kitchen_ticket',
  'fiscal_copy',
]);

function supportsKind(device: PrinterDeviceProfile, kind: PrintDocumentKind): boolean {
  if (kind === 'label' || kind === 'shipping_label') {
    return device.printerClass === 'label' || device.printerClass === 'general_document';
  }
  if (kind === 'a4_document') {
    return device.printerClass === 'general_document';
  }
  return RECEIPT_KINDS.has(kind) && device.printerClass === 'receipt_thermal';
}

export function assertPrintable(device: PrinterDeviceProfile, kind: PrintDocumentKind): void {
  if (!device.enabled) throw new Error('Printer is disabled.');
  if (device.supportTier === 'unsupported') throw new Error('Printer is explicitly unsupported.');
  if (!supportsKind(device, kind)) {
    throw new Error(`Printer class ${device.printerClass} cannot print ${kind}.`);
  }
}

export function selectPrintRoute(
  device: PrinterDeviceProfile,
  runtime: PrintRuntimeCapability,
  kind: PrintDocumentKind,
): PrintRoute {
  assertPrintable(device, kind);
  const transports = new Set(device.capability.transports);

  if (transports.has('network_raw') && runtime.sameLanPrinterAccess) {
    return { transport: 'network_raw', reason: 'certified_network_path' };
  }
  if (transports.has('network_vendor') && runtime.sameLanPrinterAccess) {
    return { transport: 'network_vendor', reason: 'vendor_network_sdk' };
  }
  if (
    transports.has('usb_local_bridge') &&
    runtime.localBridgeAvailable &&
    (runtime.surface === 'desktop_web' || runtime.surface === 'desktop_native')
  ) {
    return { transport: 'usb_local_bridge', reason: 'local_bridge_for_usb' };
  }
  if (transports.has('vendor_sdk') && runtime.surface !== 'desktop_web') {
    return { transport: 'vendor_sdk', reason: 'native_vendor_sdk' };
  }
  if (transports.has('bluetooth_native') && runtime.nativeBluetoothAvailable) {
    return { transport: 'bluetooth_native', reason: 'native_bluetooth' };
  }
  if (
    transports.has('os_spooler') &&
    runtime.osSpoolerAvailable &&
    (kind === 'a4_document' || device.capability.languages.includes('pdf'))
  ) {
    return { transport: 'os_spooler', reason: 'os_spooler_document' };
  }
  if (transports.has('cloud_pull')) {
    return { transport: 'cloud_pull', reason: 'cloud_pull_supported' };
  }
  return { transport: device.connection.transport, reason: 'no_safe_route' };
}

export function createPrintJob(input: {
  id: string;
  businessId: string;
  documentKind: PrintDocumentKind;
  printer: PrinterDeviceProfile;
  payloadRef: string;
  contentHash: string;
  idempotencyKey: string;
  createdAt: string;
  copies?: number;
}): PrintJob {
  assertPrintable(input.printer, input.documentKind);
  const copies = input.copies ?? 1;
  if (!Number.isSafeInteger(copies) || copies < 1 || copies > 20) {
    throw new Error('Print copies must be a safe integer between 1 and 20.');
  }
  if (
    !input.id.trim() ||
    !input.businessId.trim() ||
    !input.payloadRef.trim() ||
    !input.contentHash.trim() ||
    !input.idempotencyKey.trim()
  ) {
    throw new Error('Print job identity, payload, hash and idempotency key are required.');
  }
  if (input.printer.businessId !== input.businessId) {
    throw new Error('Printer belongs to another business.');
  }
  return {
    id: input.id,
    businessId: input.businessId,
    documentKind: input.documentKind,
    printerId: input.printer.id,
    payloadRef: input.payloadRef,
    contentHash: input.contentHash,
    idempotencyKey: input.idempotencyKey,
    status: 'created',
    copies,
    createdAt: input.createdAt,
    attempts: 0,
  };
}

export function printingIsAuthoritative(status: PrintJobStatus): boolean {
  return status === 'printed';
}

export function printRequiresOperatorCheck(status: PrintJobStatus): boolean {
  return status === 'unknown';
}
