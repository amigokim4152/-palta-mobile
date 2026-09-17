import type {
  PrintDocumentKind,
  PrinterProtocol,
  PrinterSupportTier,
  PrinterTransport,
} from './printCore.js';
import type { CompatibilityManifestEntry } from './printRouting.js';

export type PrinterCertificationPlatform = 'windows' | 'android' | 'ios' | 'macos' | 'linux_bridge';
export type PrinterCertificationStatus = 'candidate' | 'passed' | 'limited' | 'failed' | 'retired';
export type PrinterProcurementStatus =
  | 'not_evaluated'
  | 'available_chile'
  | 'preferred_chile'
  | 'unavailable_chile';

export type PrinterCertificationCheck =
  | 'connection'
  | 'spanish_text'
  | 'receipt_layout'
  | 'qr_code'
  | 'barcode'
  | 'cutter'
  | 'cash_drawer'
  | 'label_alignment'
  | 'restart_recovery'
  | 'duplicate_suppression'
  | 'status_reconciliation';

export type PrinterCertificationCheckResult = {
  check: PrinterCertificationCheck;
  passed: boolean;
  code?: string;
};

export type PrinterCertificationRecord = {
  id: string;
  manufacturer: string;
  /** Regex pattern used by the generated compatibility manifest. */
  modelPattern: string;
  platform: PrinterCertificationPlatform;
  transport: PrinterTransport;
  protocol: PrinterProtocol;
  adapterKey: string;
  adapterVersion: string;
  appVersion: string;
  bridgeVersion?: string;
  bridgeProtocolVersion?: number;
  firmwareVersion?: string;
  paperWidthMm?: number;
  documentKinds: readonly PrintDocumentKind[];
  checks: readonly PrinterCertificationCheckResult[];
  status: PrinterCertificationStatus;
  procurementStatus: PrinterProcurementStatus;
  testedAt: string;
  /** Optional expiry for a precise certification claim. */
  validUntil?: string;
};

const BASE_REQUIRED_CHECKS: readonly PrinterCertificationCheck[] = [
  'connection',
  'spanish_text',
  'restart_recovery',
  'duplicate_suppression',
];

function requiredChecks(record: PrinterCertificationRecord): Set<PrinterCertificationCheck> {
  const checks = new Set<PrinterCertificationCheck>(BASE_REQUIRED_CHECKS);
  if (
    record.documentKinds.includes('receipt') ||
    record.documentKinds.includes('kitchen_ticket') ||
    record.documentKinds.includes('packing_slip')
  ) {
    checks.add('receipt_layout');
    checks.add('status_reconciliation');
  }
  if (record.documentKinds.includes('label')) {
    checks.add('barcode');
    checks.add('label_alignment');
  }
  return checks;
}

function validTimestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${field} must be a valid timestamp.`);
  return parsed;
}

function assertVersion(value: string, field: string): void {
  if (!/^\d+(?:\.\d+){0,3}(?:-[A-Za-z0-9.-]+)?$/.test(value.trim())) {
    throw new Error(`${field} must be a normalized release version.`);
  }
}

export function assertPrinterCertificationRecord(record: PrinterCertificationRecord): void {
  if (!record.id.trim() || !record.manufacturer.trim() || !record.modelPattern.trim()) {
    throw new Error('Printer certification identity, manufacturer and modelPattern are required.');
  }
  try {
    new RegExp(record.modelPattern, 'i');
  } catch {
    throw new Error('Printer certification modelPattern must be a valid regular expression.');
  }
  if (!record.adapterKey.trim()) throw new Error('Printer certification adapterKey is required.');
  assertVersion(record.adapterVersion, 'adapterVersion');
  assertVersion(record.appVersion, 'appVersion');
  if (record.bridgeVersion !== undefined) assertVersion(record.bridgeVersion, 'bridgeVersion');
  if (
    record.bridgeProtocolVersion !== undefined &&
    (!Number.isSafeInteger(record.bridgeProtocolVersion) || record.bridgeProtocolVersion < 1)
  ) {
    throw new Error('bridgeProtocolVersion must be a positive safe integer.');
  }
  if (record.documentKinds.length === 0) {
    throw new Error('Printer certification must cover at least one document kind.');
  }
  validTimestamp(record.testedAt, 'testedAt');
  if (record.validUntil !== undefined) {
    if (validTimestamp(record.validUntil, 'validUntil') <= validTimestamp(record.testedAt, 'testedAt')) {
      throw new Error('Printer certification validUntil must be after testedAt.');
    }
  }

  const seen = new Set<PrinterCertificationCheck>();
  for (const result of record.checks) {
    if (seen.has(result.check)) throw new Error(`Duplicate certification check: ${result.check}`);
    seen.add(result.check);
    if (result.code !== undefined && !/^[A-Za-z0-9_.:-]{1,96}$/.test(result.code)) {
      throw new Error('Certification failure code must be normalized technical text.');
    }
  }

  if (record.status === 'passed') {
    for (const check of requiredChecks(record)) {
      const result = record.checks.find((candidate) => candidate.check === check);
      if (!result?.passed) {
        throw new Error(`Passed certification is missing required successful check: ${check}`);
      }
    }
  }
}

export function certificationIsCurrent(record: PrinterCertificationRecord, now: string): boolean {
  assertPrinterCertificationRecord(record);
  const nowMs = validTimestamp(now, 'now');
  if (record.validUntil === undefined) return true;
  return nowMs <= validTimestamp(record.validUntil, 'validUntil');
}

/**
 * "Recommended" is deliberately stronger than "Certified": the exact technical
 * combination must pass AND Palta must have a procurement/support reason to prefer
 * buying it in Chile. Community observations alone can never create this tier.
 */
export function supportTierFromCertification(
  record: PrinterCertificationRecord,
  now: string,
): PrinterSupportTier {
  assertPrinterCertificationRecord(record);
  if (!certificationIsCurrent(record, now)) return 'unknown';
  if (record.status === 'passed' && record.procurementStatus === 'preferred_chile') {
    return 'palta_recommended';
  }
  if (record.status === 'passed') return 'palta_certified';
  if (record.status === 'limited') return 'compatible';
  return 'unknown';
}

export function certificationMayPublishManifestEntry(
  record: PrinterCertificationRecord,
  now: string,
): boolean {
  const tier = supportTierFromCertification(record, now);
  return tier === 'palta_certified' || tier === 'palta_recommended' || tier === 'compatible';
}

export function manifestEntryFromCertification(
  record: PrinterCertificationRecord,
  now: string,
): CompatibilityManifestEntry {
  if (!certificationMayPublishManifestEntry(record, now)) {
    throw new Error('Printer certification is not eligible for compatibility manifest publication.');
  }
  const supportTier = supportTierFromCertification(record, now);
  const entry: CompatibilityManifestEntry = {
    manufacturer: record.manufacturer,
    modelPattern: record.modelPattern,
    protocol: record.protocol,
    transports: [record.transport],
    adapterKey: record.adapterKey,
    supportTier,
    runtimeRequirements: {
      minAppVersion: record.appVersion,
      minAdapterVersion: record.adapterVersion,
    },
  };
  if (record.paperWidthMm !== undefined) entry.paperWidthsMm = [record.paperWidthMm];
  if (record.bridgeVersion !== undefined) {
    entry.runtimeRequirements = {
      ...entry.runtimeRequirements,
      minBridgeVersion: record.bridgeVersion,
    };
  }
  if (record.bridgeProtocolVersion !== undefined) {
    entry.runtimeRequirements = {
      ...entry.runtimeRequirements,
      minBridgeProtocolVersion: record.bridgeProtocolVersion,
    };
  }
  return entry;
}
