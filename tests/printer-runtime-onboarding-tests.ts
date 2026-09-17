import { assessDiscoveredPrinter } from '../src/printing/printerOnboarding.js';
import type { PrinterCompatibilityManifest } from '../src/printing/printRouting.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

const manifest: PrinterCompatibilityManifest = {
  schemaVersion: 1,
  revision: 'cl-2026-09-17.1',
  generatedAt: '2026-09-17T12:00:00Z',
  entries: [
    {
      manufacturer: 'Epson',
      modelPattern: '^TM-T20IV',
      protocol: 'epson_epos',
      transports: ['network', 'usb'],
      adapterKey: 'epson-epos',
      supportTier: 'palta_certified',
      paperWidthsMm: [80],
      runtimeRequirements: {
        minAppVersion: '2.5.0',
        minBridgeVersion: '1.4.0',
        minBridgeProtocolVersion: 2,
        minAdapterVersion: '3.1.0',
      },
    },
  ],
};

const candidate = {
  candidateId: 'candidate-1',
  displayName: 'Epson receipt printer',
  fingerprint: {
    manufacturer: 'Epson',
    model: 'TM-T20IV-SP',
    connectionFingerprintHash: 'a'.repeat(64),
  },
  transports: ['network', 'usb'] as const,
  protocolHints: ['epson_epos'] as const,
  paperWidthMm: 80,
};

const ready = assessDiscoveredPrinter({
  candidate,
  manifest,
  now: '2026-09-17T20:00:00Z',
  runtime: {
    appVersion: '2.5.0',
    bridgeVersion: '1.4.1',
    bridgeProtocolVersion: 2,
    adapterVersions: { 'epson-epos': '3.1.2' },
  },
});
assertEqual(ready.reason, 'manifest_match', 'Fresh compatible runtime should use manifest match.');
assertEqual(ready.supportTier, 'palta_certified', 'Fresh tested profile may retain certified tier.');
assertEqual(ready.manifestFreshness, 'fresh', 'Onboarding must expose manifest freshness.');

const oldBridge = assessDiscoveredPrinter({
  candidate,
  manifest,
  now: '2026-09-17T20:00:00Z',
  runtime: {
    appVersion: '2.5.0',
    bridgeVersion: '1.3.9',
    bridgeProtocolVersion: 1,
    adapterVersions: { 'epson-epos': '3.1.2' },
  },
});
assertEqual(oldBridge.reason, 'manifest_runtime_incompatible', 'Old bridge must not claim certified support.');
assertEqual(oldBridge.supportTier, 'unknown', 'Runtime mismatch must downgrade support promise.');
assertEqual(oldBridge.runtimeAction, 'update_bridge', 'Onboarding should tell the user to update the bridge.');

const stale = assessDiscoveredPrinter({
  candidate,
  manifest,
  now: '2026-11-01T12:00:00Z',
  runtime: {
    appVersion: '2.5.0',
    bridgeVersion: '1.4.1',
    bridgeProtocolVersion: 2,
    adapterVersions: { 'epson-epos': '3.1.2' },
  },
});
assertEqual(stale.reason, 'manifest_stale', 'Stale compatibility data must be explicit.');
assertEqual(stale.supportTier, 'unknown', 'Stale data must not create a new certification promise.');
assertEqual(stale.manifestFreshness, 'stale', 'Stale timestamp must be surfaced for support diagnostics.');

const genericCandidate = {
  candidateId: 'candidate-2',
  displayName: 'Existing generic receipt printer',
  fingerprint: {
    connectionFingerprintHash: 'b'.repeat(64),
  },
  transports: ['usb'] as const,
  protocolHints: ['esc_pos'] as const,
};
const generic = assessDiscoveredPrinter({
  candidate: genericCandidate,
  manifest,
});
assertEqual(generic.reason, 'generic_protocol_family', 'Existing generic ESC/POS hardware should remain reusable.');
assertEqual(generic.supportTier, 'compatible', 'Safe generic protocol detection should classify as compatible, not certified.');

assert(ready.adapterKey === 'epson-epos', 'Resolved adapter must remain explicit.');
console.log('printer-runtime-onboarding-tests: ok');
