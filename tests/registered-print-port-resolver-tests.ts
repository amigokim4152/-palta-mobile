import type { PrinterAdapter, PrinterIdentity } from '../src/printing/printCore.js';
import type { PrintReconciliationPort } from '../src/printing/printReconciliation.js';
import type {
  PersistedPrinterDevice,
  PrinterDeviceLookup,
  PrinterDeviceRepository,
} from '../src/persistence/printerDeviceRepository.js';
import {
  PrinterRuntimeRegistry,
  RegisteredPrintPortResolver,
} from '../src/runtime/registeredPrintPortResolver.js';

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

const printer: PrinterIdentity = {
  id: 'printer-1',
  businessId: 'biz-1',
  outletId: 'main',
  displayName: 'Caja 1',
  transport: 'network',
  protocol: 'esc_pos',
  supportTier: 'palta_certified',
  health: 'ready',
  adapterKey: 'escpos-network-v1',
};

class MemoryPrinterDeviceRepository implements PrinterDeviceRepository {
  constructor(public current: PersistedPrinterDevice | null) {}

  async findPrinter(lookup: PrinterDeviceLookup): Promise<PersistedPrinterDevice | null> {
    if (!this.current) return null;
    return this.current.printer.businessId === lookup.businessId &&
      this.current.printer.id === lookup.printerId
      ? this.current
      : null;
  }
}

const adapter: PrinterAdapter = {
  key: 'escpos-network-v1',
  supports: () => true,
  health: async () => 'ready',
  print: async () => ({ outcome: 'printed' }),
};

const reconciliation: PrintReconciliationPort = {
  lookup: async () => ({
    outcome: 'unknown',
    observedAt: '2026-09-17T21:30:00Z',
  }),
};

// Enabled canonical device joins to the exact live binding.
{
  const devices = new MemoryPrinterDeviceRepository({ printer, enabled: true });
  const runtime = new PrinterRuntimeRegistry();
  runtime.bind({
    businessId: 'biz-1',
    printerId: 'printer-1',
    adapter,
    reconciliation,
  });
  const resolver = new RegisteredPrintPortResolver(devices, runtime);

  const dispatch = await resolver.resolveDispatch({ businessId: 'biz-1', printerId: 'printer-1' });
  assert(dispatch, 'Enabled registered printer must resolve for dispatch.');
  assertEqual(dispatch.printer, printer, 'Resolver must return the canonical DB printer identity.');
  assertEqual(dispatch.adapter, adapter, 'Resolver must return the exact live adapter binding.');
  assertEqual(
    await resolver.resolveReconciliation({ businessId: 'biz-1', printerId: 'printer-1' }),
    reconciliation,
    'Resolver must expose the exact reconciliation port for unresolved jobs.',
  );
}

// Disabled device blocks new physical dispatch but remains available for old-job reconciliation.
{
  const devices = new MemoryPrinterDeviceRepository({ printer, enabled: false });
  const runtime = new PrinterRuntimeRegistry();
  runtime.bind({
    businessId: 'biz-1',
    printerId: 'printer-1',
    adapter,
    reconciliation,
  });
  const resolver = new RegisteredPrintPortResolver(devices, runtime);

  assertEqual(
    await resolver.resolveDispatch({ businessId: 'biz-1', printerId: 'printer-1' }),
    null,
    'Disabled printer must not accept a new physical dispatch.',
  );
  assertEqual(
    await resolver.resolveReconciliation({ businessId: 'biz-1', printerId: 'printer-1' }),
    reconciliation,
    'Disabled printer must still reconcile an earlier unresolved physical attempt.',
  );
}

// Stale executable binding after adapter reconfiguration fails closed.
{
  const changedPrinter: PrinterIdentity = { ...printer, adapterKey: 'new-adapter-v2' };
  const devices = new MemoryPrinterDeviceRepository({ printer: changedPrinter, enabled: true });
  const runtime = new PrinterRuntimeRegistry();
  runtime.bind({
    businessId: 'biz-1',
    printerId: 'printer-1',
    adapter,
    reconciliation,
  });
  const resolver = new RegisteredPrintPortResolver(devices, runtime);

  await assertRejects(
    () => resolver.resolveDispatch({ businessId: 'biz-1', printerId: 'printer-1' }),
    'Adapter-key configuration drift must fail closed before physical dispatch.',
  );
  assertEqual(
    await resolver.resolveReconciliation({ businessId: 'biz-1', printerId: 'printer-1' }),
    null,
    'Stale binding must not reconcile through a newly configured execution channel.',
  );
}

// Exact business/printer key prevents cross-tenant or cross-device binding reuse.
{
  const devices = new MemoryPrinterDeviceRepository({ printer, enabled: true });
  const runtime = new PrinterRuntimeRegistry();
  runtime.bind({ businessId: 'biz-1', printerId: 'printer-2', adapter });
  const resolver = new RegisteredPrintPortResolver(devices, runtime);

  assertEqual(
    await resolver.resolveDispatch({ businessId: 'biz-1', printerId: 'printer-1' }),
    null,
    'Binding for another physical printer must not be reused.',
  );
  assertEqual(
    await resolver.resolveDispatch({ businessId: 'biz-2', printerId: 'printer-1' }),
    null,
    'Another business must never resolve this printer binding.',
  );
}

// Runtime reconnect can explicitly replace and remove executable bindings without mutating DB identity.
{
  const runtime = new PrinterRuntimeRegistry();
  runtime.bind({ businessId: 'biz-1', printerId: 'printer-1', adapter });
  assert(runtime.get({ businessId: 'biz-1', printerId: 'printer-1' }), 'Binding must be present after bind.');
  runtime.unbind({ businessId: 'biz-1', printerId: 'printer-1' });
  assertEqual(runtime.get({ businessId: 'biz-1', printerId: 'printer-1' }), null, 'Binding must be removable on disconnect.');
}

console.log('registered-print-port-resolver-tests: ok');
