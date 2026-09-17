import {
  assessCompatibilityManifestFreshness,
  assessPrinterRuntimeCompatibility,
  compareNumericVersions,
  mayClaimFreshCertification,
} from '../src/printing/compatibilityPolicy.js';
import type {
  CompatibilityManifestEntry,
  PrinterCompatibilityManifest,
} from '../src/printing/printRouting.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

assertEqual(compareNumericVersions('2.5.0', '2.5'), 0, 'Equivalent numeric versions must compare equal.');
assertEqual(compareNumericVersions('2.5.1', '2.5.0'), 1, 'Newer patch version must compare greater.');
assertEqual(compareNumericVersions('2.4.9', '2.5.0'), -1, 'Older minor version must compare lower.');

const entry: CompatibilityManifestEntry = {
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
};

const compatible = assessPrinterRuntimeCompatibility({
  entry,
  runtime: {
    appVersion: '2.5.0',
    bridgeVersion: '1.4.2',
    bridgeProtocolVersion: 2,
    adapterVersions: { 'epson-epos': '3.1.1' },
  },
});
assert(compatible.compatible, 'Current app/bridge/adapter must satisfy manifest requirements.');
assertEqual(compatible.action, 'none', 'Compatible runtime needs no update action.');

const oldApp = assessPrinterRuntimeCompatibility({
  entry,
  runtime: {
    appVersion: '2.4.9',
    bridgeVersion: '1.4.2',
    bridgeProtocolVersion: 2,
    adapterVersions: { 'epson-epos': '3.1.1' },
  },
});
assert(!oldApp.compatible, 'Old app must not claim exact compatibility.');
assertEqual(oldApp.action, 'update_app', 'Old app must request app update.');

const noBridge = assessPrinterRuntimeCompatibility({
  entry,
  runtime: {
    appVersion: '2.5.0',
    adapterVersions: { 'epson-epos': '3.1.1' },
  },
});
assert(!noBridge.compatible, 'Bridge-dependent profile must reject missing bridge runtime.');
assertEqual(noBridge.action, 'bridge_required', 'Missing bridge must produce a simple bridge-required action.');

const oldBridge = assessPrinterRuntimeCompatibility({
  entry,
  runtime: {
    appVersion: '2.5.0',
    bridgeVersion: '1.3.9',
    bridgeProtocolVersion: 1,
    adapterVersions: { 'epson-epos': '3.1.1' },
  },
});
assert(!oldBridge.compatible, 'Old bridge must not claim compatibility.');
assertEqual(oldBridge.action, 'update_bridge', 'Old bridge must request bridge update.');

const oldAdapter = assessPrinterRuntimeCompatibility({
  entry,
  runtime: {
    appVersion: '2.5.0',
    bridgeVersion: '1.4.2',
    bridgeProtocolVersion: 2,
    adapterVersions: { 'epson-epos': '3.0.9' },
  },
});
assert(!oldAdapter.compatible, 'Old adapter must not claim compatibility.');
assertEqual(oldAdapter.action, 'update_adapter', 'Old adapter must request adapter update.');

const noRequirements = assessPrinterRuntimeCompatibility({
  entry: { ...entry, runtimeRequirements: undefined },
  runtime: { appVersion: '1.0.0', adapterVersions: {} },
});
assert(noRequirements.compatible, 'Manifest entries without runtime requirements remain backward compatible.');

const manifest: PrinterCompatibilityManifest = {
  schemaVersion: 1,
  revision: '2026-09-17.1',
  generatedAt: '2026-09-17T12:00:00Z',
  entries: [entry],
};
const fresh = assessCompatibilityManifestFreshness({
  manifest,
  now: '2026-09-17T19:00:00Z',
});
assertEqual(fresh, 'fresh', 'Same-day manifest must be fresh.');
assert(mayClaimFreshCertification(fresh), 'Fresh manifest may support a new certification claim.');

const stale = assessCompatibilityManifestFreshness({
  manifest,
  now: '2026-11-01T12:00:00Z',
});
assertEqual(stale, 'stale', 'Old manifest must be marked stale.');
assert(!mayClaimFreshCertification(stale), 'Stale manifest must not create a new certified/recommended promise.');

const future = assessCompatibilityManifestFreshness({
  manifest: { ...manifest, generatedAt: '2026-09-18T12:00:00Z' },
  now: '2026-09-17T12:00:00Z',
});
assertEqual(future, 'future_timestamp', 'Future manifest timestamp must be flagged.');

console.log('printer-compatibility-policy-tests: ok');
