import type {
  PrintDocumentKind,
  PrinterHealth,
  PrinterIdentity,
  PrinterProtocol,
  PrinterSupportTier,
  PrinterTransport,
} from './printCore.js';
import {
  matchCompatibilityEntry,
  type PrinterCompatibilityManifest,
} from './printRouting.js';

export type PrinterDiscoveryFingerprint = {
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  serialNumberHash?: string;
  usbVendorId?: string;
  usbProductId?: string;
  networkServiceName?: string;
  connectionFingerprint: string;
};

export type DiscoveredPrinterCandidate = {
  candidateId: string;
  displayName: string;
  fingerprint: PrinterDiscoveryFingerprint;
  transports: PrinterTransport[];
  protocolHints: PrinterProtocol[];
  paperWidthMm?: number;
};

export type PrinterDiscoveryAssessment = {
  supportTier: PrinterSupportTier;
  protocol?: PrinterProtocol;
  transport?: PrinterTransport;
  adapterKey?: string;
  reason:
    | 'manifest_match'
    | 'generic_protocol_family'
    | 'system_spooler_only'
    | 'unknown_device';
};

const GENERIC_PROTOCOL_PRIORITY: readonly PrinterProtocol[] = [
  'esc_pos',
  'zpl',
  'tspl',
  'epl',
  'ipp_pdf',
  'os_spooler',
];

const GENERIC_ADAPTER_BY_PROTOCOL: Partial<Record<PrinterProtocol, string>> = {
  esc_pos: 'generic-esc-pos',
  zpl: 'generic-zpl',
  tspl: 'generic-tspl',
  epl: 'generic-epl',
  ipp_pdf: 'generic-ipp-pdf',
  os_spooler: 'system-spooler',
};

function firstSupportedTransport(
  preferred: readonly PrinterTransport[],
  available: readonly PrinterTransport[],
): PrinterTransport | undefined {
  for (const transport of preferred) {
    if (available.includes(transport)) return transport;
  }
  return available[0];
}

export function assessDiscoveredPrinter(input: {
  candidate: DiscoveredPrinterCandidate;
  manifest: PrinterCompatibilityManifest;
}): PrinterDiscoveryAssessment {
  const manufacturer = input.candidate.fingerprint.manufacturer ?? '';
  const model = input.candidate.fingerprint.model ?? '';
  const matched = manufacturer && model
    ? matchCompatibilityEntry(input.manifest, manufacturer, model)
    : undefined;

  if (matched) {
    const transport = firstSupportedTransport(matched.transports, input.candidate.transports);
    if (transport) {
      return {
        supportTier: matched.supportTier,
        protocol: matched.protocol,
        transport,
        adapterKey: matched.adapterKey,
        reason: 'manifest_match',
      };
    }
  }

  for (const protocol of GENERIC_PROTOCOL_PRIORITY) {
    if (!input.candidate.protocolHints.includes(protocol)) continue;
    const adapterKey = GENERIC_ADAPTER_BY_PROTOCOL[protocol];
    if (!adapterKey) continue;
    const transport = firstSupportedTransport(
      protocol === 'os_spooler' ? ['os_spooler'] : ['network', 'usb', 'serial', 'bluetooth'],
      input.candidate.transports,
    );
    if (!transport) continue;
    return {
      supportTier: protocol === 'os_spooler' || protocol === 'ipp_pdf' ? 'unknown' : 'compatible',
      protocol,
      transport,
      adapterKey,
      reason: protocol === 'os_spooler' || protocol === 'ipp_pdf'
        ? 'system_spooler_only'
        : 'generic_protocol_family',
    };
  }

  return {
    supportTier: 'unknown',
    reason: 'unknown_device',
  };
}

export type PrinterDiagnosticCheck =
  | 'connection'
  | 'spanish_text'
  | 'barcode'
  | 'qr_code'
  | 'cutter'
  | 'cash_drawer'
  | 'label_alignment';

export type PrinterDiagnosticResult = {
  check: PrinterDiagnosticCheck;
  passed: boolean;
  health: PrinterHealth;
  code?: string;
  detail?: string;
};

export type PrinterDiagnosticSummary = {
  ready: boolean;
  blocking: PrinterDiagnosticResult[];
  warnings: PrinterDiagnosticResult[];
};

const OPTIONAL_DIAGNOSTICS = new Set<PrinterDiagnosticCheck>([
  'barcode',
  'qr_code',
  'cutter',
  'cash_drawer',
  'label_alignment',
]);

export function requiredPrinterDiagnostics(input: {
  documentKinds: readonly PrintDocumentKind[];
  protocol: PrinterProtocol;
  paperWidthMm?: number;
}): PrinterDiagnosticCheck[] {
  const checks: PrinterDiagnosticCheck[] = ['connection', 'spanish_text'];
  if (input.documentKinds.includes('receipt') || input.documentKinds.includes('kitchen_ticket')) {
    checks.push('qr_code', 'cutter');
  }
  if (input.documentKinds.includes('label')) {
    checks.push('barcode', 'label_alignment');
  }
  if (input.protocol === 'esc_pos' && input.paperWidthMm !== undefined) {
    checks.push('cash_drawer');
  }
  return [...new Set(checks)];
}

export function summarizePrinterDiagnostics(
  results: readonly PrinterDiagnosticResult[],
): PrinterDiagnosticSummary {
  const blocking = results.filter(
    (result) => !result.passed && !OPTIONAL_DIAGNOSTICS.has(result.check),
  );
  const warnings = results.filter(
    (result) => !result.passed && OPTIONAL_DIAGNOSTICS.has(result.check),
  );
  return {
    ready: blocking.length === 0,
    blocking,
    warnings,
  };
}

export function createPrinterIdentityFromDiscovery(input: {
  id: string;
  businessId: string;
  outletId?: string;
  candidate: DiscoveredPrinterCandidate;
  assessment: PrinterDiscoveryAssessment;
  initialHealth: PrinterHealth;
}): PrinterIdentity {
  if (!input.assessment.protocol || !input.assessment.transport || !input.assessment.adapterKey) {
    throw new Error('Printer must have a resolved protocol, transport and adapter before registration.');
  }
  if (!input.id.trim() || !input.businessId.trim()) {
    throw new Error('Printer identity and business are required.');
  }

  const printer: PrinterIdentity = {
    id: input.id,
    businessId: input.businessId,
    displayName: input.candidate.displayName,
    transport: input.assessment.transport,
    protocol: input.assessment.protocol,
    supportTier: input.assessment.supportTier,
    health: input.initialHealth,
    adapterKey: input.assessment.adapterKey,
    connectionFingerprint: input.candidate.fingerprint.connectionFingerprint,
  };

  if (input.outletId !== undefined) printer.outletId = input.outletId;
  if (input.candidate.fingerprint.manufacturer !== undefined) {
    printer.manufacturer = input.candidate.fingerprint.manufacturer;
  }
  if (input.candidate.fingerprint.model !== undefined) {
    printer.model = input.candidate.fingerprint.model;
  }
  if (input.candidate.fingerprint.serialNumberHash !== undefined) {
    printer.serialNumberHash = input.candidate.fingerprint.serialNumberHash;
  }
  if (input.candidate.fingerprint.firmwareVersion !== undefined) {
    printer.firmwareVersion = input.candidate.fingerprint.firmwareVersion;
  }
  if (input.candidate.paperWidthMm !== undefined) printer.paperWidthMm = input.candidate.paperWidthMm;

  return printer;
}

export function printerHealthAction(health: PrinterHealth):
  | 'none'
  | 'add_paper'
  | 'close_cover'
  | 'wait_and_retry'
  | 'grant_permission'
  | 'install_driver_or_bridge'
  | 'restart_bridge'
  | 'check_network'
  | 'manual_diagnosis' {
  if (health === 'ready' || health === 'paper_low') return 'none';
  if (health === 'paper_out') return 'add_paper';
  if (health === 'cover_open') return 'close_cover';
  if (health === 'busy') return 'wait_and_retry';
  if (health === 'permission_required') return 'grant_permission';
  if (health === 'driver_required') return 'install_driver_or_bridge';
  if (health === 'bridge_unreachable') return 'restart_bridge';
  if (health === 'network_unreachable' || health === 'offline') return 'check_network';
  return 'manual_diagnosis';
}
