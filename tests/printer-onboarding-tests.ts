import {
  assessDiscoveredPrinter,
  createPrinterIdentityFromDiscovery,
  printerHealthAction,
  requiredPrinterDiagnostics,
  summarizePrinterDiagnostics,
} from '../src/printing/printerOnboarding.js';
import type { PrinterCompatibilityManifest } from '../src/printing/printRouting.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const manifest: PrinterCompatibilityManifest = {
  schemaVersion: 1,
  revision: '2026-09-17.2',
  generatedAt: '2026-09-17T18:00:00Z',
  entries: [
    {
      manufacturer: 'Epson',
      modelPattern: '^TM-T20(III|IIIL|IV.*)$',
      protocol: 'epson_epos',
      transports: ['network', 'usb'],
      adapterKey: 'epson-epos',
      supportTier: 'compatible',
      paperWidthsMm: [80, 58],
    },
    {
      manufacturer: 'Zebra',
      modelPattern: '^ZD421.*$',
      protocol: 'zpl',
      transports: ['network', 'usb', 'bluetooth'],
      adapterKey: 'zebra-zpl',
      supportTier: 'compatible',
    },
  ],
};

const epsonCandidate = {
  candidateId: 'candidate-epson',
  displayName: 'Epson TM-T20IV-SP',
  fingerprint: {
    manufacturer: 'Epson',
    model: 'TM-T20IV-SP',
    connectionFingerprint: 'network:sha256:epson-1',
  },
  transports: ['network', 'usb'] as const,
  protocolHints: ['epson_epos', 'esc_pos'] as const,
  paperWidthMm: 80,
};
const epsonAssessment = assessDiscoveredPrinter({ candidate: epsonCandidate, manifest });
assert(epsonAssessment.reason === 'manifest_match', 'Known Epson family should match the compatibility manifest.');
assert(epsonAssessment.adapterKey === 'epson-epos', 'Known Epson family must select the Epson adapter.');
assert(epsonAssessment.transport === 'network', 'Network should be selected when it is a supported manifest transport.');

const genericReceiptCandidate = {
  candidateId: 'candidate-generic',
  displayName: 'Generic 80mm POS Printer',
  fingerprint: {
    connectionFingerprint: 'usb:sha256:generic-1',
  },
  transports: ['usb'] as const,
  protocolHints: ['esc_pos'] as const,
  paperWidthMm: 80,
};
const genericAssessment = assessDiscoveredPrinter({ candidate: genericReceiptCandidate, manifest });
assert(genericAssessment.supportTier === 'compatible', 'Unknown model with ESC/POS support should remain reusable as compatible.');
assert(genericAssessment.adapterKey === 'generic-esc-pos', 'Generic ESC/POS printer must use the shared ESC/POS adapter.');

const unknownCandidate = {
  candidateId: 'candidate-unknown',
  displayName: 'Mystery Printer',
  fingerprint: {
    connectionFingerprint: 'usb:sha256:mystery',
  },
  transports: ['usb'] as const,
  protocolHints: [] as const,
};
const unknownAssessment = assessDiscoveredPrinter({ candidate: unknownCandidate, manifest });
assert(unknownAssessment.supportTier === 'unknown', 'Unknown printer must not be presented as supported before a protocol is proven.');
assert(unknownAssessment.reason === 'unknown_device', 'Unknown printer must enter guided diagnosis.');

const receiptChecks = requiredPrinterDiagnostics({
  documentKinds: ['receipt'],
  protocol: 'esc_pos',
  paperWidthMm: 80,
});
assert(receiptChecks.includes('connection'), 'Receipt onboarding must validate connectivity.');
assert(receiptChecks.includes('spanish_text'), 'Receipt onboarding must validate Spanish characters.');
assert(receiptChecks.includes('cutter'), 'Receipt onboarding should test cutter capability.');
assert(receiptChecks.includes('qr_code'), 'Receipt onboarding should test QR output.');

const diagnostic = summarizePrinterDiagnostics([
  { check: 'connection', passed: true, health: 'ready' },
  { check: 'spanish_text', passed: true, health: 'ready' },
  { check: 'cutter', passed: false, health: 'cutter_error' },
]);
assert(diagnostic.ready, 'Optional cutter failure must not make a reusable printer impossible to register.');
assert(diagnostic.warnings.length === 1, 'Optional hardware failure must be surfaced as a warning.');

const registered = createPrinterIdentityFromDiscovery({
  id: 'printer-1',
  businessId: 'biz-1',
  candidate: genericReceiptCandidate,
  assessment: genericAssessment,
  initialHealth: 'ready',
});
assert(registered.protocol === 'esc_pos', 'Registered generic receipt printer must preserve detected protocol.');
assert(registered.connectionFingerprint === 'usb:sha256:generic-1', 'Printer connection fingerprint must be retained for stable reconnect.');
assert(printerHealthAction('paper_out') === 'add_paper', 'Paper-out must translate to a direct user action.');
assert(printerHealthAction('bridge_unreachable') === 'restart_bridge', 'Bridge outage must translate to a bridge recovery action.');
assert(printerHealthAction('network_unreachable') === 'check_network', 'Network outage must translate to a network recovery action.');

console.log('printer-onboarding-tests: ok');
