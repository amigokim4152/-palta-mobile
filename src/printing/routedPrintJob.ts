import {
  createPrintJob,
  type PrintContent,
  type PrintJob,
  type PrinterIdentity,
} from './printCore.js';
import {
  resolvePrinterRoute,
  roleForDocument,
  selectReadyPrinter,
  type PrinterRouteContext,
} from './printRouting.js';
import {
  PrintJobConcurrencyError,
  type PrintJobRepository,
} from '../persistence/printJobRepository.js';
import type { PrinterRouteRepository } from '../persistence/printerRouteRepository.js';
import type {
  PrintDispatchResolution,
  PrintPortResolver,
} from '../runtime/printWorker.js';

export type RoutedPrintJobRequest = {
  id: string;
  businessId: string;
  outletId?: string;
  registerId?: string;
  content: PrintContent;
  idempotencyKey: string;
  createdAt: string;
};

function stableJson(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(',')}}`;
}

function sameOriginalPrintRequest(existing: PrintJob, request: RoutedPrintJobRequest): boolean {
  return (
    existing.businessId === request.businessId &&
    existing.reprintOfJobId === undefined &&
    existing.documentKind === request.content.kind &&
    stableJson(existing.content) === stableJson(request.content)
  );
}

function assertRequest(request: RoutedPrintJobRequest): void {
  if (!request.id.trim() || !request.businessId.trim() || !request.idempotencyKey.trim()) {
    throw new Error('Routed print job requires id, businessId and idempotencyKey.');
  }
  if (request.outletId !== undefined && !request.outletId.trim()) {
    throw new Error('Routed print outletId cannot be blank.');
  }
  if (request.registerId !== undefined && !request.registerId.trim()) {
    throw new Error('Routed print registerId cannot be blank.');
  }
  if (!Number.isFinite(Date.parse(request.createdAt))) {
    throw new Error('Routed print createdAt must be a valid timestamp.');
  }
}

async function liveCandidates(input: {
  routePrinterIds: readonly string[];
  businessId: string;
  portResolver: PrintPortResolver;
}): Promise<{
  printers: PrinterIdentity[];
  resolutions: Map<string, PrintDispatchResolution>;
}> {
  const printers: PrinterIdentity[] = [];
  const resolutions = new Map<string, PrintDispatchResolution>();
  for (const printerId of [...new Set(input.routePrinterIds)]) {
    const resolution = await input.portResolver.resolveDispatch({
      businessId: input.businessId,
      printerId,
    });
    if (!resolution) continue;

    let health: PrinterIdentity['health'];
    try {
      health = await resolution.adapter.health(resolution.printer);
    } catch {
      health = 'unknown';
    }
    const printer: PrinterIdentity = {
      ...resolution.printer,
      health,
    };
    printers.push(printer);
    resolutions.set(printerId, {
      printer,
      adapter: resolution.adapter,
    });
  }
  return { printers, resolutions };
}

/**
 * Resolves the configured POS/output route before creating a durable PrintJob.
 * Explicit fallback may choose another printer only before any physical dispatch.
 * Once created, the selected printerId is frozen on the PrintJob and the worker
 * will never silently switch it.
 */
export function createRoutedPrintJobService(input: {
  routes: PrinterRouteRepository;
  jobs: PrintJobRepository;
  portResolver: PrintPortResolver;
}) {
  return {
    async create(request: RoutedPrintJobRequest): Promise<PrintJob> {
      assertRequest(request);

      const existing = await input.jobs.findByIdempotency({
        businessId: request.businessId,
        idempotencyKey: request.idempotencyKey,
      });
      if (existing) {
        if (!sameOriginalPrintRequest(existing, request)) {
          throw new Error('Print idempotency key is already bound to a different output request.');
        }
        return existing;
      }

      const role = roleForDocument(request.content.kind);
      const routes = await input.routes.listRoutes({
        businessId: request.businessId,
        role,
      });
      const context: PrinterRouteContext = {
        businessId: request.businessId,
        role,
      };
      if (request.outletId !== undefined) context.outletId = request.outletId;
      if (request.registerId !== undefined) context.registerId = request.registerId;
      const route = resolvePrinterRoute(routes, context);

      const routePrinterIds = [
        route.primaryPrinterId,
        ...((route.failoverMode ?? 'disabled') === 'explicit' ? route.fallbackPrinterIds : []),
      ];
      const live = await liveCandidates({
        routePrinterIds,
        businessId: request.businessId,
        portResolver: input.portResolver,
      });
      const selected = selectReadyPrinter({
        route,
        printers: live.printers,
        content: request.content,
        supports: (printer, content) =>
          live.resolutions.get(printer.id)?.adapter.supports(printer, content) ?? false,
      });

      const job = createPrintJob({
        id: request.id,
        businessId: request.businessId,
        printerId: selected.id,
        content: request.content,
        idempotencyKey: request.idempotencyKey,
        createdAt: request.createdAt,
      });

      try {
        return await input.jobs.saveJob({ job, expectedRevision: null });
      } catch (error) {
        if (!(error instanceof PrintJobConcurrencyError)) throw error;
        const raced = await input.jobs.findByIdempotency({
          businessId: request.businessId,
          idempotencyKey: request.idempotencyKey,
        });
        if (raced && sameOriginalPrintRequest(raced, request)) return raced;
        throw error;
      }
    },
  };
}
