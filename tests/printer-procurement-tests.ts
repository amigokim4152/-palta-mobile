import assert from 'node:assert/strict';
import {
  assessProcurementCandidate,
  decideExistingPrinterReuse,
  planPrinterPackage,
} from '../src/printing/printerProcurement.js';
import type { PrinterCertificationRecord } from '../src/printing/printerCertification.js';

const now = '2026-09-17T20:00:00Z';

const fixed = planPrinterPackage('fixed_multi_register');
assert.equal(fixed.requirements[0]?.role, 'receipt');
assert.deepEqual(fixed.requirements[0]?.preferredTransports.slice(0, 2), ['network', 'vendor_sdk']);

const mobile = planPrinterPackage('mobile_solo');
assert.equal(mobile.requirements[0]?.required, false);
assert(mobile.guidance.includes('digital_receipt_first'));

const label = planPrinterPackage('warehouse_label');
assert.equal(label.requirements[0]?.documentKinds[0], 'label');

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
const networkDecision = assessProcurementCandidate({ record: networkReceipt, requirement, now });
const usbDecision = assessProcurementCandidate({ record: usbReceipt, requirement, now });
assert.equal(networkDecision.eligible, true);
assert.equal(usbDecision.eligible, true);
assert(networkDecision.score > usbDecision.score, 'Preferred Chile network candidate should score higher.');

const unavailable: PrinterCertificationRecord = {
  ...networkReceipt,
  id: 'cert-3',
  procurementStatus: 'unavailable_chile',
};
assert.equal(
  assessProcurementCandidate({ record: unavailable, requirement, now }).eligible,
  false,
);

assert.equal(
  decideExistingPrinterReuse({
    supportTier: 'compatible',
    requiredForOperation: true,
    diagnosticsPassed: true,
  }),
  'reuse_after_test',
);
assert.equal(
  decideExistingPrinterReuse({
    supportTier: 'unknown',
    requiredForOperation: true,
    diagnosticsPassed: false,
  }),
  'replace_if_printing_is_critical',
);
assert.equal(
  decideExistingPrinterReuse({
    supportTier: 'unknown',
    requiredForOperation: false,
    diagnosticsPassed: false,
  }),
  'guided_diagnosis',
);

console.log('printer-procurement-tests: ok');
