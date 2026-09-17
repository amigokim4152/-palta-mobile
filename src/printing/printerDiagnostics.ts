import type {
  PrinterHealth,
  PrinterIdentity,
  PrinterProtocol,
  PrinterTransport,
} from './printCore.js';

export type PrinterDiagnosticEventCode =
  | 'discovery_failed'
  | 'adapter_not_found'
  | 'connection_failed'
  | 'test_print_failed'
  | 'print_failed'
  | 'print_outcome_unknown'
  | 'paper_out'
  | 'cover_open'
  | 'cutter_error'
  | 'bridge_unreachable'
  | 'network_unreachable'
  | 'permission_required'
  | 'driver_required'
  | 'recovered';

export type SanitizedPrinterDiagnostic = {
  schemaVersion: 1;
  diagnosticId: string;
  occurredAt: string;
  adapterKey: string;
  adapterVersion: string;
  bridgeVersion?: string;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  protocol: PrinterProtocol;
  transport: PrinterTransport;
  supportTier: PrinterIdentity['supportTier'];
  health: PrinterHealth;
  eventCode: PrinterDiagnosticEventCode;
  connectionFingerprintHash?: string;
  platform?: 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown';
  appVersion?: string;
  /** Short normalized technical code only. Never raw receipt/customer/business text. */
  normalizedErrorCode?: string;
};

const FORBIDDEN_FREE_TEXT_FIELDS = new Set([
  'customerName',
  'customerEmail',
  'customerPhone',
  'receiptText',
  'labelText',
  'documentBody',
  'rawPayload',
  'ipAddress',
  'macAddress',
  'serialNumber',
]);

function assertNormalizedCode(value: string, field: string): void {
  if (!/^[A-Za-z0-9_.:-]{1,96}$/.test(value)) {
    throw new Error(`${field} must be a short normalized technical code.`);
  }
}

export function createSanitizedPrinterDiagnostic(input: {
  diagnosticId: string;
  occurredAt: string;
  printer: PrinterIdentity;
  adapterVersion: string;
  eventCode: PrinterDiagnosticEventCode;
  bridgeVersion?: string;
  platform?: SanitizedPrinterDiagnostic['platform'];
  appVersion?: string;
  normalizedErrorCode?: string;
}): SanitizedPrinterDiagnostic {
  if (!input.diagnosticId.trim() || !input.adapterVersion.trim()) {
    throw new Error('Diagnostic ID and adapter version are required.');
  }
  if (input.normalizedErrorCode !== undefined) {
    assertNormalizedCode(input.normalizedErrorCode, 'normalizedErrorCode');
  }

  const result: SanitizedPrinterDiagnostic = {
    schemaVersion: 1,
    diagnosticId: input.diagnosticId,
    occurredAt: input.occurredAt,
    adapterKey: input.printer.adapterKey,
    adapterVersion: input.adapterVersion,
    protocol: input.printer.protocol,
    transport: input.printer.transport,
    supportTier: input.printer.supportTier,
    health: input.printer.health,
    eventCode: input.eventCode,
  };

  if (input.bridgeVersion !== undefined) result.bridgeVersion = input.bridgeVersion;
  if (input.printer.manufacturer !== undefined) result.manufacturer = input.printer.manufacturer;
  if (input.printer.model !== undefined) result.model = input.printer.model;
  if (input.printer.firmwareVersion !== undefined) result.firmwareVersion = input.printer.firmwareVersion;
  if (input.printer.connectionFingerprint !== undefined) {
    result.connectionFingerprintHash = input.printer.connectionFingerprint;
  }
  if (input.platform !== undefined) result.platform = input.platform;
  if (input.appVersion !== undefined) result.appVersion = input.appVersion;
  if (input.normalizedErrorCode !== undefined) result.normalizedErrorCode = input.normalizedErrorCode;
  return result;
}

/**
 * Defense-in-depth guard for diagnostics crossing the support boundary.
 * Only the normalized schema above is accepted; arbitrary free-text fields are rejected.
 */
export function assertSanitizedPrinterDiagnosticPayload(payload: Record<string, unknown>): void {
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_FREE_TEXT_FIELDS.has(key)) {
      throw new Error(`Printer diagnostic payload contains forbidden field: ${key}`);
    }
  }
  if (payload.schemaVersion !== 1) throw new Error('Unsupported printer diagnostic schema.');
  if (typeof payload.diagnosticId !== 'string' || !payload.diagnosticId.trim()) {
    throw new Error('Printer diagnostic ID is required.');
  }
  if (typeof payload.adapterKey !== 'string' || !payload.adapterKey.trim()) {
    throw new Error('Printer adapter key is required.');
  }
  if (typeof payload.normalizedErrorCode === 'string') {
    assertNormalizedCode(payload.normalizedErrorCode, 'normalizedErrorCode');
  }
}

export type CompatibilityObservation = {
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  protocol: PrinterProtocol;
  transport: PrinterTransport;
  adapterKey: string;
  adapterVersion: string;
  testPassed: boolean;
  failureCode?: string;
};

/**
 * Aggregation input for the central compatibility registry. It contains no business ID,
 * customer data, receipt content, IP/MAC address or raw serial number.
 */
export function toCompatibilityObservation(
  diagnostic: SanitizedPrinterDiagnostic,
  testPassed: boolean,
): CompatibilityObservation {
  const observation: CompatibilityObservation = {
    protocol: diagnostic.protocol,
    transport: diagnostic.transport,
    adapterKey: diagnostic.adapterKey,
    adapterVersion: diagnostic.adapterVersion,
    testPassed,
  };
  if (diagnostic.manufacturer !== undefined) observation.manufacturer = diagnostic.manufacturer;
  if (diagnostic.model !== undefined) observation.model = diagnostic.model;
  if (diagnostic.firmwareVersion !== undefined) observation.firmwareVersion = diagnostic.firmwareVersion;
  if (!testPassed && diagnostic.normalizedErrorCode !== undefined) {
    observation.failureCode = diagnostic.normalizedErrorCode;
  }
  return observation;
}
