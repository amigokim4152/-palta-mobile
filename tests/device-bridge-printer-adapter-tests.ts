import {
  beginPrintDispatch,
  createPrintJob,
  type PrinterIdentity,
} from '../src/printing/printCore.js';
import type {
  BridgePrintEnvelope,
  BridgePrinterEndpoint,
  PrintBridgeIdentity,
} from '../src/printing/deviceBridge.js';
import type { RenderedPrintArtifact } from '../src/printing/imagePrint.js';
import {
  DeviceBridgePrinterAdapter,
  type BridgePrinterClient,
} from '../src/printing/deviceBridgePrinterAdapter.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

async function assertRejects(fn: () => Promise<unknown>, message: string): Promise<void> {
  let threw = false;
  try {
    await fn();
  } catch {
    threw = true;
  }
  if (!threw) throw new Error(message);
}

const bridge: PrintBridgeIdentity = {
  bridgeId: 'bridge-1',
  businessId: 'biz-1',
  displayName: 'Front Bridge',
  publicKeyFingerprint: '0123456789abcdef0123456789abcdef',
  softwareVersion: '1.0.0',
  protocolVersion: 2,
  transports: ['local_network'],
  advertisedService: '_palta-print._tcp',
};

const endpoint: BridgePrinterEndpoint = {
  endpointId: 'endpoint-1',
  bridgeId: 'bridge-1',
  displayName: 'Receipt USB',
  manufacturer: 'Generic',
  model: 'ESC/POS',
  transport: 'usb',
  adapterKey: 'bridge-escpos-v1',
  health: 'ready',
};

const printer: PrinterIdentity = {
  id: 'printer-1',
  businessId: 'biz-1',
  displayName: 'Receipt USB',
  transport: 'usb',
  protocol: 'esc_pos',
  supportTier: 'legacy_bridge',
  health: 'ready',
  adapterKey: 'bridge-escpos-v1',
};

function makeDispatchingJob() {
  return beginPrintDispatch(
    createPrintJob({
      id: 'job-1',
      businessId: 'biz-1',
      printerId: 'printer-1',
      content: { kind: 'receipt', lines: [{ text: 'Venta' }] },
      idempotencyKey: 'receipt-sale-1',
      createdAt: '2026-09-17T21:10:00Z',
    }),
    '2026-09-17T21:10:01Z',
  );
}

const receiptArtifact: RenderedPrintArtifact = {
  id: 'artifact-1',
  kind: 'receipt_bitmap',
  mimeType: 'image/png',
  widthDots: 576,
  heightDots: 900,
  dpi: 203,
  objectRef: 'r2://print/job-1/receipt.png',
  sha256: 'a'.repeat(64),
  monochrome: true,
  createdAt: '2026-09-17T21:10:01Z',
};

let capturedEnvelope: BridgePrintEnvelope | undefined;
const acceptedClient: BridgePrinterClient = {
  health: async () => 'ready',
  submitPrint: async (envelope) => {
    capturedEnvelope = envelope;
    return {
      requestId: envelope.requestId,
      printJobId: envelope.printJobId,
      outcome: 'accepted',
    };
  },
};

const acceptedAdapter = new DeviceBridgePrinterAdapter(
  { printerId: 'printer-1', bridge, endpoint },
  acceptedClient,
  { resolve: async () => receiptArtifact },
  () => 'request-1',
);
assert(acceptedAdapter.supports(printer, makeDispatchingJob().content), 'Bound canonical printer must be supported.');
assertEqual(await acceptedAdapter.health(printer), 'ready', 'Bridge health must map to canonical printer health.');
const accepted = await acceptedAdapter.print(printer, makeDispatchingJob());
assertEqual(accepted.outcome, 'submitted', 'Bridge accepted ack must become submitted.');
assertEqual(capturedEnvelope?.artifactRef, receiptArtifact.objectRef, 'Bridge must transport rendered artifact reference.');
assertEqual(capturedEnvelope?.artifactSha256, receiptArtifact.sha256, 'Bridge must transport immutable artifact digest.');
assertEqual(capturedEnvelope?.idempotencyKey, 'receipt-sale-1', 'Bridge must preserve durable print idempotency key.');
assertEqual(capturedEnvelope?.protocolVersion, 2, 'Bridge envelope must use paired bridge protocol version.');

const failedAdapter = new DeviceBridgePrinterAdapter(
  { printerId: 'printer-1', bridge, endpoint },
  {
    health: async () => 'ready',
    submitPrint: async (envelope) => ({
      requestId: envelope.requestId,
      printJobId: envelope.printJobId,
      outcome: 'failed',
      code: 'driver_error_after_submit',
    }),
  },
  { resolve: async () => receiptArtifact },
  () => 'request-2',
);
const failed = await failedAdapter.print(printer, makeDispatchingJob());
assertEqual(failed.outcome, 'unknown', 'Generic bridge failed ack must remain ambiguous without no-output evidence.');
assert(
  failed.outcome === 'unknown' && failed.code === 'driver_error_after_submit',
  'Bridge failure code should survive for diagnostics without authorizing retry.',
);

const printedAdapter = new DeviceBridgePrinterAdapter(
  { printerId: 'printer-1', bridge, endpoint },
  {
    health: async () => 'ready',
    submitPrint: async (envelope) => ({
      requestId: envelope.requestId,
      printJobId: envelope.printJobId,
      outcome: 'printed',
    }),
  },
  { resolve: async () => receiptArtifact },
  () => 'request-3',
);
assertEqual(
  (await printedAdapter.print(printer, makeDispatchingJob())).outcome,
  'printed',
  'Authoritative bridge printed ack must close physical output.',
);

const unreachableAdapter = new DeviceBridgePrinterAdapter(
  { printerId: 'printer-1', bridge, endpoint },
  {
    health: async () => {
      throw new Error('bridge offline');
    },
    submitPrint: async () => {
      throw new Error('unused');
    },
  },
  { resolve: async () => receiptArtifact },
  () => 'request-4',
);
assertEqual(
  await unreachableAdapter.health(printer),
  'bridge_unreachable',
  'Bridge health transport failure must become a canonical health code.',
);

const wrongArtifact: RenderedPrintArtifact = {
  ...receiptArtifact,
  kind: 'label_bitmap',
};
const wrongArtifactAdapter = new DeviceBridgePrinterAdapter(
  { printerId: 'printer-1', bridge, endpoint },
  acceptedClient,
  { resolve: async () => wrongArtifact },
  () => 'request-5',
);
await assertRejects(
  () => wrongArtifactAdapter.print(printer, makeDispatchingJob()),
  'Bridge adapter must reject an artifact whose rendered class does not match the PrintJob.',
);

const otherPrinter: PrinterIdentity = { ...printer, id: 'printer-2' };
assertEqual(
  acceptedAdapter.supports(otherPrinter, makeDispatchingJob().content),
  false,
  'Bridge adapter must never claim support for a different physical printer binding.',
);

const mismatchedAckAdapter = new DeviceBridgePrinterAdapter(
  { printerId: 'printer-1', bridge, endpoint },
  {
    health: async () => 'ready',
    submitPrint: async (envelope) => ({
      requestId: `${envelope.requestId}-wrong`,
      printJobId: envelope.printJobId,
      outcome: 'printed',
    }),
  },
  { resolve: async () => receiptArtifact },
  () => 'request-6',
);
await assertRejects(
  () => mismatchedAckAdapter.print(printer, makeDispatchingJob()),
  'Bridge adapter must reject acknowledgements for another request.',
);

console.log('device-bridge-printer-adapter-tests: ok');
