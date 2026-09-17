import {
  assessProcurementCandidate,
  decideExistingPrinterReuse,
  planPrinterPackage,
} from '../src/printing/printerProcurement.js';
import type { PrinterCertificationRecord } from '../src/printing/printerCertification.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertArrayEqual<T>(actual: readonly T[], expected: readonly T[], message: string): void {
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    throw new Error(
      `${message}: expected [${expected.map(String).join(', ')}], got [${actual.map(String).join(', ')}]`,
    );
  }
}

const now = '2026-09-17T20:00:00Z';

const fixed = planPrinterPackage('fixed_multi_register');
assertEqual(fixed.requirements[0]?.role, 'receipt', 'Fixed multi-register package should require a receipt printer.');
assertArrayEqual(
  fixed.requirements[0]?.preferredTransports.slice(0, 2) ?? [],
  ['network', 'vendor_sdk'],
  'Fixed multi-register package should prefer network/vendor SDK transports.',
);

const mobile = planPrinterPackage('mobile_solo');
assertEqual(mobile.requirements[0]?.required, false, 'Mobile solo package should not require a printer.');
assert(mobile.guidance.includes('digital_receipt_first'), 'Mobile solo package should prefer digital receipts.');

const label = planPrinterPackage('warehouse_label');
assertEqual(label.requirements[0]?.documentKinds[0], 'label', 'Warehouse label package should target label output.');

const baseChecks = [
  { check: 'connection', passed: true },
  { check: 'spanish_text', passed: true },
  { check: 'restart_recovery', passed: true },
  { check: 'duplicate_suppression', passed: true },
  { check: 'receipt_layout', passed: true },
  { check: 'status_reconciliation', passed: true },
] as const;

const networkReceipt: PrinterCertificationRecord = {
  id: 'cert-1',
  manufacturer: 'Example',
  modelPattern: '^ReceiptNet.*$',
  platform: 'windows',
  transport: 'network',
  protocol: 'esc_pos',
  adapterKey: 'generic-esc-pos',
  adapterVersion: '1.0.0',
  appVersion: '1.0.0',
  documentKinds: ['receipt'],
  checks: baseChecks,
  status: 'passed',
  procurementStatus: 'preferred_chile',
  testedAt: '2026-09-01T10:00:00Z',
};

const usbReceipt: PrinterCertificationRecord = {
  ...networkReceipt,
  id: 'cert-2',
  modelPattern: '^ReceiptUsb.*$',
  transport: 'usb',
  procurementStatus: 'available_chile',
};

const requirement = fixed.requirements[0];
if (!requirement) throw new Error('fixed package must require receipt printer');
const networkDecision = assessProcurementCandidate({
  record: networkReceipt,
  requirement,
  platform: 'windows',
  now,
});
const usbDecision = assessProcurementCandidate({
  record: usbReceipt,
  requirement,
  platform: 'windows',
  now,
});
assertEqual(networkDecision.eligible, true, 'Preferred Chile network candidate should be eligible.');
assertEqual(usbDecision.eligible, true, 'Available Chile USB candidate should remain eligible.');
assert(networkDecision.score > usbDecision.score, 'Preferred Chile network candidate should score higher.');
assert(
  networkDecision.reasons.includes('platform:windows'),
  'Eligible procurement decision should preserve the certified host platform in its rationale.',
);

const wrongPlatformDecision = assessProcurementCandidate({
  record: networkReceipt,
  requirement,
  platform: 'android',
  now,
});
assertEqual(
  wrongPlatformDecision.eligible,
  false,
  'Windows certification must not make a printer eligible for an Android POS purchase.',
);
assert(
  wrongPlatformDecision.reasons.includes('platform_not_certified'),
  'Platform mismatch must expose a stable procurement reason code.',
);

const unavailable: PrinterCertificationRecord = {
  ...networkReceipt,
  id: 'cert-3',
  procurementStatus: 'unavailable_chile',
};
assertEqual(
  assessProcurementCandidate({
    record: unavailable,
    requirement,
    platform: 'windows',
    now,
  }).eligible,
  false,
  'Unavailable Chile hardware should not be eligible for procurement.',
);

assertEqual(
  decideExistingPrinterReuse({
    supportTier: 'compatible',
    requiredForOperation: true,
    diagnosticsPassed: true,
  }),
  'reuse_after_test',
  'Compatible hardware that passes diagnostics should be reused after testing.',
);
assertEqual(
  decideExistingPrinterReuse({
    supportTier: 'unknown',
    requiredForOperation: true,
    diagnosticsPassed: false,
  }),
  'replace_if_printing_is_critical',
  'Unknown required hardware that fails diagnostics should be replaced when printing is critical.',
);
assertEqual(
  decideExistingPrinterReuse({
    supportTier: 'unknown',
    requiredForOperation: false,
    diagnosticsPassed: false,
  }),
  'guided_diagnosis',
  'Unknown optional hardware should stay in guided diagnosis before replacement.',
);

console.log('printer-procurement-tests: ok');
