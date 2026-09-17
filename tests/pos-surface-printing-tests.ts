import assert from 'node:assert/strict';
import { decidePOSSurface, type POSDeviceProfile } from '../src/commerce/posSurfacePolicy.js';
import {
  applyPrintDispatchResult,
  beginPrintDispatch,
  createPrintJob,
  type PrinterIdentity,
} from '../src/printing/printCore.js';
import {
  assertImageFirstTemplate,
  assertRenderedArtifactFitsPrinter,
  canvasToDots,
  type RenderedPrintArtifact,
  type RasterPrinterTarget,
} from '../src/printing/imagePrint.js';
import {
  DEFAULT_BRIDGE_DISCOVERY_POLICY,
  assertValidBridgePairingRequest,
  assertValidBridgePrintEnvelope,
  preferredBridgeDataPath,
} from '../src/printing/deviceBridge.js';
import {
  canFailoverAfterDispatch,
  matchCompatibilityEntry,
  selectReadyPrinter,
  type PrinterCompatibilityManifest,
} from '../src/printing/printRouting.js';

const phone: POSDeviceProfile = {
  formFactor: 'phone', platform: 'ios', viewportWidthCssPx: 390, touch: true, keyboard: false, pointer: false, capabilities: new Set(['camera']),
};
const phoneSurface = decidePOSSurface(phone);
assert.equal(phoneSurface.mode, 'mobile_quick');
assert.equal(phoneSurface.layout, 'single_column');
assert.equal(phoneSurface.cartPinned, false);
assert.equal(phoneSurface.primaryFeatures.includes('backoffice'), false);

const tablet: POSDeviceProfile = {
  formFactor: 'tablet', platform: 'android', viewportWidthCssPx: 900, touch: true, keyboard: false, pointer: false,
  capabilities: new Set(['barcode_scanner', 'receipt_printer', 'payment_terminal']),
};
const tabletSurface = decidePOSSurface(tablet);
assert.equal(tabletSurface.mode, 'touch_register');
assert.equal(tabletSurface.layout, 'catalog_cart_split');
assert.equal(tabletSurface.cartPinned, true);
assert.equal(tabletSurface.showPersistentPeripheralStatus, true);

const desktop: POSDeviceProfile = {
  formFactor: 'desktop', platform: 'windows', viewportWidthCssPx: 1440, touch: false, keyboard: true, pointer: true,
  capabilities: new Set(['barcode_scanner', 'receipt_printer']),
};
const desktopSurface = decidePOSSurface(desktop);
assert.equal(desktopSurface.mode, 'desktop_register');
assert.equal(desktopSurface.layout, 'workspace_split');
assert.equal(desktopSurface.preferKeyboardShortcuts, true);

const labelDots = canvasToDots({ widthMm: 62, heightMm: 29, dpi: 300 });
assert.equal(labelDots.widthDots, 732);
assert.equal(labelDots.heightDots, 343);
assert.doesNotThrow(() => assertImageFirstTemplate({
  id: 'price-label', version: 1, renderMode: 'image_first', canvas: { widthMm: 62, heightMm: 29, dpi: 300 },
}));

const artifact: RenderedPrintArtifact = {
  id: 'artifact-1', kind: 'label_bitmap', mimeType: 'image/png', widthDots: 732, heightDots: 343, dpi: 300,
  objectRef: 'r2://print/artifact-1.png', sha256: 'a'.repeat(64), monochrome: true, createdAt: '2026-09-17T12:00:00Z',
};
const target: RasterPrinterTarget = {
  printerId: 'label-1', dpi: 300, maxWidthDots: 800, supportsImage: true, preferredImageFormat: 'brother_raster',
};
assert.doesNotThrow(() => assertRenderedArtifactFitsPrinter(artifact, target));
assert.throws(() => assertRenderedArtifactFitsPrinter(artifact, { ...target, dpi: 203 }));
assert.throws(() => assertRenderedArtifactFitsPrinter(artifact, { ...target, maxWidthDots: 600 }));

assert.equal(DEFAULT_BRIDGE_DISCOVERY_POLICY.allowPublicInternetDiscovery, false);
assert.doesNotThrow(() => assertValidBridgePairingRequest({
  bridgeId: 'bridge-1', expectedPublicKeyFingerprint: 'fingerprint-1234567890', oneTimeSetupCode: 'AB12-CD34', clientDeviceId: 'ipad-1',
}));
assert.doesNotThrow(() => assertValidBridgePrintEnvelope({
  protocolVersion: 1, requestId: 'req-1', bridgeId: 'bridge-1', printerEndpointId: 'usb-1', printJobId: 'pj-1',
  artifactRef: 'r2://print/artifact-1.png', artifactSha256: 'b'.repeat(64), idempotencyKey: 'idem-1', createdAt: '2026-09-17T12:00:00Z',
}));
assert.equal(preferredBridgeDataPath({ ethernetAvailable: false, localNetworkAvailable: true, bluetoothOnly: true }), 'local_network');

const printer: PrinterIdentity = {
  id: 'receipt-1', businessId: 'biz-1', outletId: 'outlet-1', displayName: 'Receipt Printer', transport: 'network',
  protocol: 'epson_epos', supportTier: 'palta_certified', health: 'ready', adapterKey: 'epson-epos', paperWidthMm: 80,
};
const route = { businessId: 'biz-1', outletId: 'outlet-1', role: 'receipt' as const, primaryPrinterId: 'receipt-1', fallbackPrinterIds: [] };
const selected = selectReadyPrinter({ route, printers: [printer], content: { kind: 'receipt', lines: [{ text: 'OK' }] }, supports: () => true });
assert.equal(selected.id, 'receipt-1');

const job = createPrintJob({
  id: 'job-1', businessId: 'biz-1', printerId: printer.id, content: { kind: 'receipt', lines: [{ text: 'OK' }] }, idempotencyKey: 'print-1', createdAt: '2026-09-17T12:00:00Z',
});
const dispatching = beginPrintDispatch(job, '2026-09-17T12:00:01Z');
const unknown = applyPrintDispatchResult(dispatching, { outcome: 'unknown', code: 'socket_closed_after_write' }, '2026-09-17T12:00:02Z');
assert.equal(unknown.status, 'outcome_unknown');
assert.equal(canFailoverAfterDispatch({ outcome: 'unknown', code: 'socket_closed_after_write' }), false);
assert.throws(() => beginPrintDispatch(unknown, '2026-09-17T12:00:03Z'));

const manifest: PrinterCompatibilityManifest = {
  schemaVersion: 1,
  revision: '2026-09-17.1',
  generatedAt: '2026-09-17T12:00:00Z',
  entries: [{ manufacturer: 'Brother', modelPattern: '^QL-820NWBc?$', protocol: 'brother_raster', transports: ['network', 'bluetooth'], adapterKey: 'brother-mobile-sdk', supportTier: 'compatible', paperWidthsMm: [62] }],
};
assert.equal(matchCompatibilityEntry(manifest, 'Brother', 'QL-820NWB')?.adapterKey, 'brother-mobile-sdk');

console.log('pos-surface-printing-tests: ok');
