import {
  assertPrinterCertificationRecord,
  certificationMayPublishManifestEntry,
  manifestEntryFromCertification,
  supportTierFromCertification,
  type PrinterCertificationRecord,
} from '../src/printing/printerCertification.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}
function assertThrows(work: () => unknown, message: string): void {
  let threw = false;
  try {
    work();
  } catch {
    threw = true;
  }
  if (!threw) throw new Error(message);
}

const passedReceipt: PrinterCertificationRecord = {
  id: 'cert-epson-t20iv-windows-network',
  manufacturer: 'Epson',
  modelPattern: '^TM-T20IV',
  platform: 'windows',
  transport: 'network',
  protocol: 'epson_epos',
  adapterKey: 'epson-epos',
  adapterVersion: '3.1.0',
  appVersion: '2.5.0',
  bridgeVersion: '1.5.0',
  bridgeProtocolVersion: 2,
  firmwareVersion: '10.01',
  paperWidthMm: 80,
  documentKinds: ['receipt'],
  checks: [
    { check: 'connection', passed: true },
    { check: 'spanish_text', passed: true },
    { check: 'restart_recovery', passed: true },
    { check: 'duplicate_suppression', passed: true },
    { check: 'receipt_layout', passed: true },
    { check: 'status_reconciliation', passed: true },
    { check: 'qr_code', passed: true },
    { check: 'cutter', passed: true },
  ],
  status: 'passed',
  procurementStatus: 'available_chile',
  testedAt: '2026-09-17T12:00:00Z',
  validUntil: '2027-03-17T12:00:00Z',
};

assertPrinterCertificationRecord(passedReceipt);
assertEqual(
  supportTierFromCertification(passedReceipt, '2026-09-18T12:00:00Z'),
  'palta_certified',
  'Passed technical certification without preferred procurement must be certified, not recommended.',
);
assert(
  certificationMayPublishManifestEntry(passedReceipt, '2026-09-18T12:00:00Z'),
  'Passed current certification should publish to compatibility manifest.',
);
const manifestEntry = manifestEntryFromCertification(passedReceipt, '2026-09-18T12:00:00Z');
assertEqual(manifestEntry.supportTier, 'palta_certified', 'Manifest must inherit precise certification tier.');
assertEqual(
  manifestEntry.runtimeRequirements?.minBridgeProtocolVersion,
  2,
  'Published manifest must preserve tested bridge protocol floor.',
);
assertEqual(
  manifestEntry.platforms?.[0],
  'windows',
  'Published manifest must preserve the host platform actually certified.',
);
assertEqual(
  manifestEntry.firmwareVersions?.[0],
  '10.01',
  'Published manifest must preserve exact firmware when certification recorded it.',
);

const recommended: PrinterCertificationRecord = {
  ...passedReceipt,
  id: 'cert-epson-t20iv-windows-network-preferred',
  procurementStatus: 'preferred_chile',
};
assertEqual(
  supportTierFromCertification(recommended, '2026-09-18T12:00:00Z'),
  'palta_recommended',
  'Only passed + preferred Chile procurement may become Palta Recommended.',
);

const expired: PrinterCertificationRecord = {
  ...passedReceipt,
  id: 'cert-expired',
  validUntil: '2026-09-17T13:00:00Z',
};
assertEqual(
  supportTierFromCertification(expired, '2026-09-18T12:00:00Z'),
  'unknown',
  'Expired exact certification must not keep a current support promise.',
);
assert(
  !certificationMayPublishManifestEntry(expired, '2026-09-18T12:00:00Z'),
  'Expired certification must not publish a fresh manifest entry.',
);

const incompletePassed: PrinterCertificationRecord = {
  ...passedReceipt,
  id: 'cert-invalid-missing-recovery',
  checks: passedReceipt.checks.filter((item) => item.check !== 'status_reconciliation'),
};
assertThrows(
  () => assertPrinterCertificationRecord(incompletePassed),
  'Receipt certification must not pass without status reconciliation test.',
);

const blankFirmware: PrinterCertificationRecord = {
  ...passedReceipt,
  id: 'cert-invalid-blank-firmware',
  firmwareVersion: '   ',
};
assertThrows(
  () => assertPrinterCertificationRecord(blankFirmware),
  'Certification must reject a blank firmware constraint.',
);

const limitedExisting: PrinterCertificationRecord = {
  id: 'cert-generic-escpos-limited',
  manufacturer: 'Generic',
  modelPattern: '.*',
  platform: 'windows',
  transport: 'os_spooler',
  protocol: 'os_spooler',
  adapterKey: 'system-spooler',
  adapterVersion: '1.0.0',
  appVersion: '2.5.0',
  documentKinds: ['receipt'],
  checks: [
    { check: 'connection', passed: true },
    { check: 'spanish_text', passed: true },
    { check: 'restart_recovery', passed: false, code: 'spooler_status_limited' },
  ],
  status: 'limited',
  procurementStatus: 'not_evaluated',
  testedAt: '2026-09-17T12:00:00Z',
};
assertPrinterCertificationRecord(limitedExisting);
assertEqual(
  supportTierFromCertification(limitedExisting, '2026-09-18T12:00:00Z'),
  'compatible',
  'Legacy hardware with known limitations can be Compatible without being Certified.',
);

const candidate: PrinterCertificationRecord = {
  ...passedReceipt,
  id: 'cert-candidate-only',
  status: 'candidate',
  procurementStatus: 'preferred_chile',
};
assertEqual(
  supportTierFromCertification(candidate, '2026-09-18T12:00:00Z'),
  'unknown',
  'Procurement preference without physical certification must never imply support.',
);
assertThrows(
  () => manifestEntryFromCertification(candidate, '2026-09-18T12:00:00Z'),
  'Candidate hardware must not publish a certified/recommended manifest entry.',
);

console.log('printer-certification-tests: ok');
