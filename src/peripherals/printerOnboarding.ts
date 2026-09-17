import type {
  PrintDocumentKind,
  PrintLanguage,
  PrinterClass,
  PrinterDeviceProfile,
  PrinterSupportTier,
  PrinterTransport,
} from './printCore.js';

export type PrinterHealthCode =
  | 'ready'
  | 'offline'
  | 'paper_out'
  | 'cover_open'
  | 'busy'
  | 'permission_required'
  | 'bridge_unreachable'
  | 'driver_missing'
  | 'unsupported_language'
  | 'network_unreachable'
  | 'unknown';

export type PrinterFingerprint = {
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  usbVendorId?: string;
  usbProductId?: string;
  networkServiceName?: string;
  macAddressHash?: string;
};

export type DiscoveredPrinter = {
  candidateId: string;
  displayName: string;
  printerClassHint?: PrinterClass;
  fingerprint: PrinterFingerprint;
  transports: PrinterTransport[];
  languages: PrintLanguage[];
  paperWidthMm?: number;
  cutter?: boolean;
  cashDrawerPulse?: boolean;
  barcode?: boolean;
  qrCode?: boolean;
};

export type CompatibilityRule = {
  id: string;
  manufacturerPattern?: string;
  modelPattern?: string;
  usbVendorId?: string;
  usbProductId?: string;
  requiredLanguage?: PrintLanguage;
  supportTier: Exclude<PrinterSupportTier, 'unsupported'>;
  preferredTransport?: PrinterTransport;
};

export type PrinterAssessment = {
  supportTier: PrinterSupportTier;
  matchedRuleId?: string;
  preferredTransport?: PrinterTransport;
  reason:
    | 'certified_model_match'
    | 'compatible_model_match'
    | 'protocol_family_match'
    | 'generic_system_printer'
    | 'no_supported_protocol';
};

function normalized(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function patternMatches(value: string | undefined, pattern: string | undefined): boolean {
  if (!pattern) return true;
  return normalized(value).includes(normalized(pattern));
}

export function assessPrinterCompatibility(
  candidate: DiscoveredPrinter,
  rules: CompatibilityRule[],
): PrinterAssessment {
  for (const rule of rules) {
    if (!patternMatches(candidate.fingerprint.manufacturer, rule.manufacturerPattern)) continue;
    if (!patternMatches(candidate.fingerprint.model, rule.modelPattern)) continue;
    if (rule.usbVendorId && normalized(candidate.fingerprint.usbVendorId) !== normalized(rule.usbVendorId)) continue;
    if (rule.usbProductId && normalized(candidate.fingerprint.usbProductId) !== normalized(rule.usbProductId)) continue;
    if (rule.requiredLanguage && !candidate.languages.includes(rule.requiredLanguage)) continue;

    return {
      supportTier: rule.supportTier,
      matchedRuleId: rule.id,
      preferredTransport: rule.preferredTransport,
      reason: rule.supportTier === 'certified' ? 'certified_model_match' : 'compatible_model_match',
    };
  }

  if (candidate.languages.some((language) => ['escpos', 'zpl', 'epl', 'tspl'].includes(language))) {
    return {
      supportTier: 'compatible',
      reason: 'protocol_family_match',
    };
  }

  if (candidate.transports.includes('os_spooler')) {
    return {
      supportTier: 'generic',
      preferredTransport: 'os_spooler',
      reason: 'generic_system_printer',
    };
  }

  return {
    supportTier: 'unsupported',
    reason: 'no_supported_protocol',
  };
}

export type PrinterDiagnosticCheck =
  | 'connection'
  | 'text_spanish'
  | 'barcode'
  | 'qr_code'
  | 'cutter'
  | 'cash_drawer'
  | 'label_alignment';

export type PrinterDiagnosticResult = {
  check: PrinterDiagnosticCheck;
  passed: boolean;
  healthCode: PrinterHealthCode;
  detail?: string;
};

export type PrinterDiagnosticSummary = {
  ready: boolean;
  blocking: PrinterDiagnosticResult[];
  warnings: PrinterDiagnosticResult[];
};

const OPTIONAL_CHECKS: ReadonlySet<PrinterDiagnosticCheck> = new Set([
  'barcode',
  'qr_code',
  'cutter',
  'cash_drawer',
  'label_alignment',
]);

export function summarizePrinterDiagnostics(
  results: PrinterDiagnosticResult[],
): PrinterDiagnosticSummary {
  const blocking = results.filter((result) => !result.passed && !OPTIONAL_CHECKS.has(result.check));
  const warnings = results.filter((result) => !result.passed && OPTIONAL_CHECKS.has(result.check));
  return {
    ready: blocking.length === 0,
    blocking,
    warnings,
  };
}

export function buildPrinterProfile(input: {
  id: string;
  businessId: string;
  candidate: DiscoveredPrinter;
  assessment: PrinterAssessment;
  printerClass: PrinterClass;
  transport: PrinterTransport;
  endpointRef: string;
  testedAt: string;
}): PrinterDeviceProfile {
  if (input.assessment.supportTier === 'unsupported') {
    throw new Error('Unsupported printer cannot be registered as an active Palta printer.');
  }
  if (!input.candidate.transports.includes(input.transport)) {
    throw new Error('Selected transport was not discovered for this printer.');
  }
  if (!input.endpointRef.trim()) throw new Error('Printer endpoint reference is required.');

  const profile: PrinterDeviceProfile = {
    id: input.id,
    businessId: input.businessId,
    displayName: input.candidate.displayName,
    printerClass: input.printerClass,
    supportTier: input.assessment.supportTier,
    capability: {
      languages: [...input.candidate.languages],
      transports: [...input.candidate.transports],
    },
    connection: {
      transport: input.transport,
      endpointRef: input.endpointRef,
    },
    enabled: true,
    lastTestedAt: input.testedAt,
    lastSeenAt: input.testedAt,
  };

  if (input.candidate.fingerprint.manufacturer) profile.manufacturer = input.candidate.fingerprint.manufacturer;
  if (input.candidate.fingerprint.model) profile.model = input.candidate.fingerprint.model;
  if (input.candidate.fingerprint.serialNumber) profile.serialNumber = input.candidate.fingerprint.serialNumber;
  if (input.candidate.paperWidthMm !== undefined) profile.capability.paperWidthMm = input.candidate.paperWidthMm;
  if (input.candidate.cutter !== undefined) profile.capability.cutter = input.candidate.cutter;
  if (input.candidate.cashDrawerPulse !== undefined) profile.capability.cashDrawerPulse = input.candidate.cashDrawerPulse;
  if (input.candidate.barcode !== undefined) profile.capability.barcode = input.candidate.barcode;
  if (input.candidate.qrCode !== undefined) profile.capability.qrCode = input.candidate.qrCode;

  return profile;
}

export function requiredDiagnosticChecks(
  printerClass: PrinterClass,
  useCases: PrintDocumentKind[],
): PrinterDiagnosticCheck[] {
  const checks: PrinterDiagnosticCheck[] = ['connection', 'text_spanish'];
  if (printerClass === 'receipt_thermal') checks.push('cutter');
  if (printerClass === 'label') checks.push('label_alignment');
  if (useCases.some((kind) => kind === 'label' || kind === 'shipping_label')) checks.push('barcode');
  if (useCases.some((kind) => kind === 'receipt' || kind === 'kitchen_ticket')) checks.push('qr_code');
  return [...new Set(checks)];
}
