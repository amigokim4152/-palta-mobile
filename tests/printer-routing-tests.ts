import {
  canFailoverAfterDispatch,
  resolvePrinterRoute,
  selectReadyPrinter,
  type PrinterRoute,
} from '../src/printing/printRouting.js';
import type { PrintContent, PrinterIdentity } from '../src/printing/printCore.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertThrows(fn: () => unknown, message: string): void {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(message);
}

const receipt: PrintContent = {
  kind: 'receipt',
  lines: [{ text: 'Venta OK' }],
};

const printerA: PrinterIdentity = {
  id: 'printer-a',
  businessId: 'biz-1',
  outletId: 'main',
  displayName: 'Caja 1',
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
};

const routes: PrinterRoute[] = [
  {
    businessId: 'biz-1',
    outletId: 'main',
    role: 'receipt',
    primaryPrinterId: 'printer-b',
    fallbackPrinterIds: [],
  },
  {
    businessId: 'biz-1',
    outletId: 'main',
    registerId: 'caja-1',
    role: 'receipt',
    primaryPrinterId: 'printer-a',
    fallbackPrinterIds: ['printer-b'],
    failoverMode: 'disabled',
  },
  {
    businessId: 'biz-1',
    outletId: 'main',
    registerId: 'caja-2',
    role: 'receipt',
    primaryPrinterId: 'printer-b',
    fallbackPrinterIds: ['printer-a'],
    failoverMode: 'disabled',
  },
];

const caja1Route = resolvePrinterRoute(routes, {
  businessId: 'biz-1', outletId: 'main', registerId: 'caja-1', role: 'receipt',
});
assert(caja1Route.primaryPrinterId === 'printer-a', 'Caja 1 must resolve to its specifically assigned printer.');

const caja2Route = resolvePrinterRoute(routes, {
  businessId: 'biz-1', outletId: 'main', registerId: 'caja-2', role: 'receipt',
});
assert(caja2Route.primaryPrinterId === 'printer-b', 'Caja 2 must resolve to its specifically assigned printer.');

const outletRoute = resolvePrinterRoute(routes, {
  businessId: 'biz-1', outletId: 'main', registerId: 'unconfigured-caja', role: 'receipt',
});
assert(outletRoute.primaryPrinterId === 'printer-b', 'Unconfigured register may use the explicitly configured outlet route.');

const selectedA = selectReadyPrinter({
  route: caja1Route,
  printers: [printerA, printerB],
  content: receipt,
  supports: () => true,
});
assert(selectedA.id === 'printer-a', 'Fixed route must print on the assigned physical printer.');

const offlineA = { ...printerA, health: 'offline' as const };
assertThrows(
  () => selectReadyPrinter({
    route: caja1Route,
    printers: [offlineA, printerB],
    content: receipt,
    supports: () => true,
  }),
  'Fixed route must not silently switch to another printer when its assigned printer is offline.',
);

const explicitFallbackRoute: PrinterRoute = {
  ...caja1Route,
  failoverMode: 'explicit',
};
const selectedFallback = selectReadyPrinter({
  route: explicitFallbackRoute,
  printers: [offlineA, printerB],
  content: receipt,
  supports: () => true,
});
assert(selectedFallback.id === 'printer-b', 'Fallback printer may be used only after explicit route opt-in.');

assert(
  !canFailoverAfterDispatch({ outcome: 'failed', code: 'no_connection', retryable: true }),
  'Definitive print failure still must not fail over when route fallback is disabled.',
);
assert(
  canFailoverAfterDispatch({ outcome: 'failed', code: 'no_connection', retryable: true }, 'explicit'),
  'Explicit fallback may continue only after a definitive no-output failure.',
);
assert(
  !canFailoverAfterDispatch({ outcome: 'unknown', code: 'socket_closed_after_write' }, 'explicit'),
  'Unknown physical print outcome must never auto-fail over because output may already exist.',
);

console.log('printer-routing-tests: ok');
