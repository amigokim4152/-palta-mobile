import { decidePrinterReconnect } from '../src/printing/printerReconnect.js';
import type { PrinterIdentity } from '../src/printing/printCore.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const printerA: PrinterIdentity = {
  id: 'printer-a',
  businessId: 'biz-1',
  displayName: 'Caja 1',
  manufacturer: 'Epson',
  model: 'TM-T20IV-SP',
  connectionFingerprintHash: 'a'.repeat(64),
  transport: 'network',
  protocol: 'epson_epos',
  supportTier: 'compatible',
  health: 'ready',
  adapterKey: 'epson-epos',
};
const printerB: PrinterIdentity = {
  ...printerA,
  id: 'printer-b',
  displayName: 'Caja 2',
  connectionFingerprintHash: 'b'.repeat(64),
};

const exact = decidePrinterReconnect({
  businessId: 'biz-1',
  candidate: {
    candidateId: 'discovered-a',
    displayName: 'EPSON Printer',
    fingerprint: {
      manufacturer: 'Epson',
      model: 'TM-T20IV-SP',
      connectionFingerprintHash: 'a'.repeat(64),
    },
    transports: ['network'],
    protocolHints: ['epson_epos'],
  },
  configuredPrinters: [printerA, printerB],
});
assert(exact.kind === 'exact_match' && exact.printer.id === 'printer-a', 'Exact fingerprint must reconnect to the same configured physical printer.');

const sameModelUnknownIdentity = decidePrinterReconnect({
  businessId: 'biz-1',
  candidate: {
    candidateId: 'discovered-c',
    displayName: 'EPSON Printer',
    fingerprint: {
      manufacturer: 'Epson',
      model: 'TM-T20IV-SP',
      connectionFingerprintHash: 'c'.repeat(64),
    },
    transports: ['network'],
    protocolHints: ['epson_epos'],
  },
  configuredPrinters: [printerA, printerB],
});
assert(
  sameModelUnknownIdentity.kind === 'same_model_needs_confirmation' &&
    sameModelUnknownIdentity.possiblePrinters.length === 2,
  'A third identical model must never be auto-bound to Caja 1 or Caja 2 by model name alone.',
);

const newDevice = decidePrinterReconnect({
  businessId: 'biz-1',
  candidate: {
    candidateId: 'zebra-1',
    displayName: 'Zebra label',
    fingerprint: {
      manufacturer: 'Zebra',
      model: 'ZD421',
      connectionFingerprintHash: 'd'.repeat(64),
    },
    transports: ['usb'],
    protocolHints: ['zpl'],
  },
  configuredPrinters: [printerA, printerB],
});
assert(newDevice.kind === 'new_device', 'Different device family must enter new-printer onboarding.');

console.log('printer-reconnect-tests: ok');
