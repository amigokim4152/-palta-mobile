import type {
  PrintContent,
  PrintDispatchResult,
  PrintJob,
  PrinterAdapter,
  PrinterIdentity,
} from '../src/printing/printCore.js';
import type { PrinterRoute } from '../src/printing/printRouting.js';
import { createRoutedPrintJobService } from '../src/printing/routedPrintJob.js';
import {
  PrintJobConcurrencyError,
  type PrintJobRepository,
  type PrintJobWrite,
} from '../src/persistence/printJobRepository.js';
import type {
  PrinterRouteQuery,
  PrinterRouteRepository,
} from '../src/persistence/printerRouteRepository.js';
import type {
  PrintDispatchResolution,
  PrintPortResolutionInput,
  PrintPortResolver,
} from '../src/runtime/printWorker.js';

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

class MemoryRouteRepository implements PrinterRouteRepository {
  constructor(public routes: PrinterRoute[]) {}
  async listRoutes(query: PrinterRouteQuery): Promise<PrinterRoute[]> {
    return this.routes.filter((route) => route.businessId === query.businessId && route.role === query.role);
  }
}

class MemoryPrintJobRepository implements PrintJobRepository {
  readonly jobs = new Map<string, PrintJob>();
  saves = 0;

  async findJob(input: { businessId: string; printJobId: string }): Promise<PrintJob | null> {
    const job = this.jobs.get(input.printJobId);
    return job?.businessId === input.businessId ? job : null;
  }

  async findByIdempotency(input: { businessId: string; idempotencyKey: string }): Promise<PrintJob | null> {
    for (const job of this.jobs.values()) {
      if (job.businessId === input.businessId && job.idempotencyKey === input.idempotencyKey) return job;
    }
    return null;
  }

  async saveJob(write: PrintJobWrite): Promise<PrintJob> {
    if (write.expectedRevision !== null) throw new Error('Routed job test expects insert only.');
    const duplicate = await this.findByIdempotency({
      businessId: write.job.businessId,
      idempotencyKey: write.job.idempotencyKey,
    });
    if (duplicate) throw new PrintJobConcurrencyError('duplicate idempotency key');
    this.jobs.set(write.job.id, write.job);
    this.saves += 1;
    return write.job;
  }
}

function printer(id: string): PrinterIdentity {
  return {
    id,
    businessId: 'biz-1',
    outletId: 'main',
    displayName: id,
    transport: 'network',
    protocol: 'esc_pos',
    supportTier: 'palta_certified',
    health: 'ready',
    adapterKey: `adapter-${id}`,
  };
}

function adapterFor(input: {
  printer: PrinterIdentity;
  health: PrinterIdentity['health'];
  supports?: boolean;
}): PrinterAdapter {
  return {
    key: input.printer.adapterKey,
    supports: () => input.supports ?? true,
    health: async () => input.health,
    print: async (): Promise<PrintDispatchResult> => ({ outcome: 'printed' }),
  };
}

class MemoryPortResolver implements PrintPortResolver {
  readonly calls: PrintPortResolutionInput[] = [];
  readonly resolutions = new Map<string, PrintDispatchResolution>();

  async resolveDispatch(input: PrintPortResolutionInput): Promise<PrintDispatchResolution | null> {
    this.calls.push(input);
    return this.resolutions.get(input.printerId) ?? null;
  }

  async resolveReconciliation(): Promise<null> {
    return null;
  }
}

const receipt: PrintContent = {
  kind: 'receipt',
  lines: [{ text: 'Venta 1000' }],
  cutAfterPrint: true,
};

// Fixed route creates one durable job pinned to the configured physical printer.
{
  const routes = new MemoryRouteRepository([
    {
      businessId: 'biz-1',
      outletId: 'main',
      registerId: 'caja-1',
      role: 'receipt',
      primaryPrinterId: 'printer-a',
      fallbackPrinterIds: [],
      failoverMode: 'disabled',
    },
  ]);
  const jobs = new MemoryPrintJobRepository();
  const ports = new MemoryPortResolver();
  const primary = printer('printer-a');
  ports.resolutions.set(primary.id, {
    printer: primary,
    adapter: adapterFor({ printer: primary, health: 'ready' }),
  });
  const service = createRoutedPrintJobService({ routes, jobs, portResolver: ports });

  const first = await service.create({
    id: 'job-route-1',
    businessId: 'biz-1',
    outletId: 'main',
    registerId: 'caja-1',
    content: receipt,
    idempotencyKey: 'sale-1:receipt',
    createdAt: '2026-09-17T21:40:00Z',
  });
  assertEqual(first.printerId, 'printer-a', 'Fixed register route must persist configured printer ID.');
  assertEqual(first.status, 'queued', 'Routing must only create a queued job; physical I/O belongs to worker.');
  assertEqual(jobs.saves, 1, 'Initial routed output must create one durable job.');

  const replay = await service.create({
    id: 'ignored-new-id',
    businessId: 'biz-1',
    outletId: 'main',
    registerId: 'caja-1',
    content: { cutAfterPrint: true, lines: [{ text: 'Venta 1000' }], kind: 'receipt' },
    idempotencyKey: 'sale-1:receipt',
    createdAt: '2026-09-17T21:40:01Z',
  });
  assertEqual(replay.id, first.id, 'Same semantic output and idempotency key must return existing durable job.');
  assertEqual(jobs.saves, 1, 'Idempotent replay must not create a second physical job.');
}

// Default fixed behavior does not silently inspect or switch to configured fallback printers.
{
  const routes = new MemoryRouteRepository([
    {
      businessId: 'biz-1',
      outletId: 'main',
      registerId: 'caja-1',
      role: 'receipt',
      primaryPrinterId: 'printer-primary',
      fallbackPrinterIds: ['printer-fallback'],
      failoverMode: 'disabled',
    },
  ]);
  const jobs = new MemoryPrintJobRepository();
  const ports = new MemoryPortResolver();
  const primary = printer('printer-primary');
  const fallback = printer('printer-fallback');
  ports.resolutions.set(primary.id, {
    printer: primary,
    adapter: adapterFor({ printer: primary, health: 'offline' }),
  });
  ports.resolutions.set(fallback.id, {
    printer: fallback,
    adapter: adapterFor({ printer: fallback, health: 'ready' }),
  });

  await assertRejects(
    () =>
      createRoutedPrintJobService({ routes, jobs, portResolver: ports }).create({
        id: 'job-fixed-offline',
        businessId: 'biz-1',
        outletId: 'main',
        registerId: 'caja-1',
        content: receipt,
        idempotencyKey: 'fixed-offline',
        createdAt: '2026-09-17T21:41:00Z',
      }),
    'Fixed route must block instead of silently switching physical printers.',
  );
  assertEqual(jobs.saves, 0, 'Blocked fixed route must not create an ambiguously targeted job.');
  assertEqual(
    ports.calls.some((call) => call.printerId === 'printer-fallback'),
    false,
    'Disabled failover must not even probe a fallback execution path during routing.',
  );
}

// Explicit fallback may choose a ready secondary printer before any PrintJob dispatch begins.
{
  const routes = new MemoryRouteRepository([
    {
      businessId: 'biz-1',
      outletId: 'main',
      registerId: 'caja-1',
      role: 'receipt',
      primaryPrinterId: 'printer-primary',
      fallbackPrinterIds: ['printer-fallback'],
      failoverMode: 'explicit',
    },
  ]);
  const jobs = new MemoryPrintJobRepository();
  const ports = new MemoryPortResolver();
  const primary = printer('printer-primary');
  const fallback = printer('printer-fallback');
  ports.resolutions.set(primary.id, {
    printer: primary,
    adapter: adapterFor({ printer: primary, health: 'offline' }),
  });
  ports.resolutions.set(fallback.id, {
    printer: fallback,
    adapter: adapterFor({ printer: fallback, health: 'ready' }),
  });

  const job = await createRoutedPrintJobService({ routes, jobs, portResolver: ports }).create({
    id: 'job-explicit-fallback',
    businessId: 'biz-1',
    outletId: 'main',
    registerId: 'caja-1',
    content: receipt,
    idempotencyKey: 'explicit-fallback',
    createdAt: '2026-09-17T21:42:00Z',
  });
  assertEqual(job.printerId, 'printer-fallback', 'Explicit pre-dispatch fallback must persist selected fallback ID.');
  assertEqual(job.status, 'queued', 'Fallback selection still must not perform physical I/O.');
}

// Idempotency key cannot be reused for different output content.
{
  const routes = new MemoryRouteRepository([]);
  const jobs = new MemoryPrintJobRepository();
  jobs.jobs.set('existing', {
    id: 'existing',
    businessId: 'biz-1',
    printerId: 'printer-a',
    documentKind: 'receipt',
    content: receipt,
    status: 'queued',
    idempotencyKey: 'collision',
    revision: 0,
    retryAuthorized: false,
    createdAt: '2026-09-17T21:43:00Z',
  });

  await assertRejects(
    () =>
      createRoutedPrintJobService({
        routes,
        jobs,
        portResolver: new MemoryPortResolver(),
      }).create({
        id: 'different',
        businessId: 'biz-1',
        content: { kind: 'receipt', lines: [{ text: 'Different sale' }] },
        idempotencyKey: 'collision',
        createdAt: '2026-09-17T21:43:01Z',
      }),
    'Idempotency key collision with different physical content must fail closed.',
  );
}

console.log('routed-print-job-tests: ok');
