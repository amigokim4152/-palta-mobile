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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}
function assertThrows(fn: () => unknown, message: string): void {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(message);
}

const phone: POSDeviceProfile = {
  formFactor: 'phone', platform: 'ios', viewportWidthCssPx: 390, touch: true, keyboard: false, pointer: false, capabilities: new Set(['camera']),
};
const phoneSurface = decidePOSSurface(phone);
assertEqual(phoneSurface.mode, 'mobile_quick', 'Phone must use the mobile quick surface.');
assertEqual(phoneSurface.layout, 'single_column', 'Phone must stay single-column.');
assertEqual(phoneSurface.cartPinned, false, 'Phone must not pin the cart.');
assertEqual(phoneSurface.primaryFeatures.includes('backoffice'), false, 'Phone must not surface backoffice as a primary feature.');

const tablet: POSDeviceProfile = {
  formFactor: 'tablet', platform: 'android', viewportWidthCssPx: 900, touch: true, keyboard: false, pointer: false,
  capabilities: new Set(['barcode_scanner', 'receipt_printer', 'payment_terminal']),
};
const tabletSurface = decidePOSSurface(tablet);
assertEqual(tabletSurface.mode, 'touch_register', 'Tablet must use touch-register mode.');
assertEqual(tabletSurface.layout, 'catalog_cart_split', 'Medium tablet must show catalog/cart split.');
assertEqual(tabletSurface.cartPinned, true, 'Tablet must pin cart when width allows.');
assertEqual(tabletSurface.showPersistentPeripheralStatus, true, 'Professional tablet surface must show attached-device health.');

const desktop: POSDeviceProfile = {
  formFactor: 'desktop', platform: 'windows', viewportWidthCssPx: 1440, touch: false, keyboard: true, pointer: true,
  capabilities: new Set(['barcode_scanner', 'receipt_printer']),
};
const desktopSurface = decidePOSSurface(desktop);
assertEqual(desktopSurface.mode, 'desktop_register', 'Desktop must use professional register mode.');
assertEqual(desktopSurface.layout, 'workspace_split', 'Wide desktop must use split workspace.');
assertEqual(desktopSurface.preferKeyboardShortcuts, true, 'Desktop keyboard path must be available.');

const labelDots = canvasToDots({ widthMm: 62, heightMm: 29, dpi: 300 });
assertEqual(labelDots.widthDots, 732, '62 mm at 300 dpi must render to the expected physical width.');
assertEqual(labelDots.heightDots, 343, '29 mm at 300 dpi must render to the expected physical height.');
assertImageFirstTemplate({
  id: 'price-label', version: 1, renderMode: 'image_first', canvas: { widthMm: 62, heightMm: 29, dpi: 300 },
});

const artifact: RenderedPrintArtifact = {
  id: 'artifact-1', kind: 'label_bitmap', mimeType: 'image/png', widthDots: 732, heightDots: 343, dpi: 300,
  objectRef: 'r2://print/artifact-1.png', sha256: 'a'.repeat(64), monochrome: true, createdAt: '2026-09-17T12:00:00Z',
};
const target: RasterPrinterTarget = {
  printerId: 'label-1', dpi: 300, maxWidthDots: 800, supportsImage: true, preferredImageFormat: 'brother_raster',
};
assertRenderedArtifactFitsPrinter(artifact, target);
assertThrows(() => assertRenderedArtifactFitsPrinter(artifact, { ...target, dpi: 203 }), 'Raster artifact must be re-rendered for a different DPI.');
assertThrows(() => assertRenderedArtifactFitsPrinter(artifact, { ...target, maxWidthDots: 600 }), 'Printer width overflow must be blocked.');

assertEqual(DEFAULT_BRIDGE_DISCOVERY_POLICY.allowPublicInternetDiscovery, false, 'Print Bridge must not be public-discovery by default.');
assertValidBridgePairingRequest({
  bridgeId: 'bridge-1', expectedPublicKeyFingerprint: 'fingerprint-1234567890', oneTimeSetupCode: 'AB12-CD34', clientDeviceId: 'ipad-1',
});
assertValidBridgePrintEnvelope({
  protocolVersion: 1, requestId: 'req-1', bridgeId: 'bridge-1', printerEndpointId: 'usb-1', printJobId: 'pj-1',
  artifactRef: 'r2://print/artifact-1.png', artifactSha256: 'b'.repeat(64), idempotencyKey: 'idem-1', createdAt: '2026-09-17T12:00:00Z',
});
assertEqual(preferredBridgeDataPath({ ethernetAvailable: false, localNetworkAvailable: true, bluetoothOnly: true }), 'local_network', 'Large raster jobs should prefer local network over Bluetooth.');

const printer: PrinterIdentity = {
  id: 'receipt-1', businessId: 'biz-1', outletId: 'outlet-1', displayName: 'Receipt Printer', transport: 'network',
  protocol: 'epson_epos', supportTier: 'palta_certified', health: 'ready', adapterKey: 'epson-epos', paperWidthMm: 80,
};
const route = { businessId: 'biz-1', outletId: 'outlet-1', role: 'receipt' as const, primaryPrinterId: 'receipt-1', fallbackPrinterIds: [] };
const selected = selectReadyPrinter({ route, printers: [printer], content: { kind: 'receipt', lines: [{ text: 'OK' }] }, supports: () => true });
assertEqual(selected.id, 'receipt-1', 'Printer routing must choose the ready primary printer.');

const job = createPrintJob({
  id: 'job-1', businessId: 'biz-1', printerId: printer.id, content: { kind: 'receipt', lines: [{ text: 'OK' }] }, idempotencyKey: 'print-1', createdAt: '2026-09-17T12:00:00Z',
});
const dispatching = beginPrintDispatch(job, '2026-09-17T12:00:01Z');
const unknown = applyPrintDispatchResult(dispatching, { outcome: 'unknown', code: 'socket_closed_after_write' }, '2026-09-17T12:00:02Z');
assertEqual(unknown.status, 'outcome_unknown', 'Unknown physical print outcome must remain explicit.');
assertEqual(canFailoverAfterDispatch({ outcome: 'unknown', code: 'socket_closed_after_write' }), false, 'Unknown print outcome must not auto-failover and duplicate output.');
assertThrows(() => beginPrintDispatch(unknown, '2026-09-17T12:00:03Z'), 'Unknown print outcome must reconcile before retry.');

const manifest: PrinterCompatibilityManifest = {
  schemaVersion: 1,
  revision: '2026-09-17.1',
  generatedAt: '2026-09-17T12:00:00Z',
  entries: [{ manufacturer: 'Brother', modelPattern: '^QL-820NWBc?$', protocol: 'brother_raster', transports: ['network', 'bluetooth'], adapterKey: 'brother-mobile-sdk', supportTier: 'compatible', paperWidthsMm: [62] }],
};
assertEqual(matchCompatibilityEntry(manifest, 'Brother', 'QL-820NWB')?.adapterKey, 'brother-mobile-sdk', 'Compatibility manifest must select the expected adapter.');
assert(selected.health === 'ready', 'Selected printer fixture must remain ready.');
console.log('pos-surface-printing-tests: ok');
