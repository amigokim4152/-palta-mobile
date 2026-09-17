import {
  assertSanitizedPrinterDiagnosticPayload,
  createSanitizedPrinterDiagnostic,
  toCompatibilityObservation,
} from '../src/printing/printerDiagnostics.js';
import type { PrinterIdentity } from '../src/printing/printCore.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertThrows(fn: () => unknown, message: string): void {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(message);
}

const fingerprintHash = '7'.repeat(64);
const printer: PrinterIdentity = {
  id: 'printer-1',
  businessId: 'biz-private-do-not-export',
  displayName: 'Caja receipt printer',
  manufacturer: 'Epson',
  model: 'TM-T20IV-SP',
  firmwareVersion: '01.02',
  connectionFingerprintHash: fingerprintHash,
  transport: 'network',
  protocol: 'epson_epos',
  supportTier: 'compatible',
  paperWidthMm: 80,
  health: 'network_unreachable',
  adapterKey: 'epson-epos',
};

const diagnostic = createSanitizedPrinterDiagnostic({
  diagnosticId: 'diag-1',
  occurredAt: '2026-09-17T19:30:00Z',
  printer,
  adapterVersion: '1.2.0',
  bridgeVersion: '0.4.0',
  platform: 'windows',
  appVersion: '2.5.0',
  eventCode: 'network_unreachable',
  normalizedErrorCode: 'EPOS.NETWORK.TIMEOUT',
});

assertSanitizedPrinterDiagnosticPayload(diagnostic as unknown as Record<string, unknown>);
const serialized = JSON.stringify(diagnostic);
assert(!serialized.includes('biz-private-do-not-export'), 'Support diagnostic must not contain business ID.');
assert(!serialized.includes('Caja receipt printer'), 'Support diagnostic must not contain user-assigned printer display name.');
assert(diagnostic.connectionFingerprintHash === fingerprintHash, 'Only SHA-256 connection identity may cross the support boundary.');

assertThrows(
  () => assertSanitizedPrinterDiagnosticPayload({ ...diagnostic, receiptText: 'customer purchase details' }),
  'Receipt text must be rejected from support diagnostics.',
);
assertThrows(
  () => createSanitizedPrinterDiagnostic({
    diagnosticId: 'diag-2',
    occurredAt: '2026-09-17T19:31:00Z',
    printer,
    adapterVersion: '1.2.0',
    eventCode: 'print_failed',
    normalizedErrorCode: 'socket failed: 192.168.1.22',
  }),
  'Free-form network details must not be accepted as normalized diagnostic codes.',
);

const observation = toCompatibilityObservation(diagnostic, false);
const observationJson = JSON.stringify(observation);
assert(observation.manufacturer === 'Epson' && observation.model === 'TM-T20IV-SP', 'Compatibility observation should retain device family metadata.');
assert(observation.failureCode === 'EPOS.NETWORK.TIMEOUT', 'Compatibility observation should retain normalized failure code.');
assert(!observationJson.includes('diag-1'), 'Aggregated compatibility observations should not retain diagnostic IDs.');
assert(!observationJson.includes(fingerprintHash), 'Aggregated compatibility observations should not retain connection fingerprints.');

console.log('printer-diagnostics-tests: ok');
