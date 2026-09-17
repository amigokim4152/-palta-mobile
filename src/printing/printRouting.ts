import type {
  PrintContent,
  PrintDispatchResult,
  PrintDocumentKind,
  PrinterIdentity,
} from './printCore.js';

export type PrinterRole = 'receipt' | 'label' | 'a4' | 'kitchen' | 'packing';
export type PrinterFailoverMode = 'disabled' | 'explicit';

export type PrinterRoute = {
  businessId: string;
  outletId?: string;
  /** Optional POS/register binding. When present this route wins over outlet/default routes. */
  registerId?: string;
  role: PrinterRole;
  primaryPrinterId: string;
  fallbackPrinterIds: string[];
  /** Disabled by default. A different physical printer is never chosen silently. */
  failoverMode?: PrinterFailoverMode;
};

export type PrinterRouteContext = {
  businessId: string;
  role: PrinterRole;
  outletId?: string;
  registerId?: string;
};

function assertRouteIdentity(input: {
  businessId: string;
  role: PrinterRole;
  primaryPrinterId: string;
  outletId?: string;
  registerId?: string;
}): void {
  if (!input.businessId.trim() || !input.primaryPrinterId.trim()) {
    throw new Error('Printer route requires business and primary printer IDs.');
  }
  if (input.outletId !== undefined && !input.outletId.trim()) {
    throw new Error('Printer route outletId cannot be blank.');
  }
  if (input.registerId !== undefined && !input.registerId.trim()) {
    throw new Error('Printer route registerId cannot be blank.');
  }
}

/**
 * Normal setup path used by UI: pin one role/context to exactly one printer.
 * No fallback exists unless an authorized user later enables it explicitly.
 */
export function createFixedPrinterRoute(input: {
  businessId: string;
  role: PrinterRole;
  primaryPrinterId: string;
  outletId?: string;
  registerId?: string;
}): PrinterRoute {
  assertRouteIdentity(input);
  const route: PrinterRoute = {
    businessId: input.businessId,
    role: input.role,
    primaryPrinterId: input.primaryPrinterId,
    fallbackPrinterIds: [],
    failoverMode: 'disabled',
  };
  if (input.outletId !== undefined) route.outletId = input.outletId;
  if (input.registerId !== undefined) route.registerId = input.registerId;
  return route;
}

/**
 * Separate advanced action. Fallback IDs must be explicit, unique and different
 * from the primary printer. This prevents settings UIs from silently enabling it.
 */
export function enableExplicitPrinterFallback(
  route: PrinterRoute,
  fallbackPrinterIds: readonly string[],
): PrinterRoute {
  const normalized = fallbackPrinterIds.map((id) => id.trim());
  if (normalized.some((id) => !id)) throw new Error('Fallback printer ID cannot be blank.');
  if (normalized.includes(route.primaryPrinterId)) {
    throw new Error('Primary printer cannot also be configured as a fallback.');
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new Error('Fallback printer IDs must be unique.');
  }
  if (normalized.length === 0) {
    throw new Error('Explicit printer fallback requires at least one fallback printer.');
  }
  return {
    ...route,
    fallbackPrinterIds: normalized,
    failoverMode: 'explicit',
  };
}

export function disablePrinterFallback(route: PrinterRoute): PrinterRoute {
  return {
    ...route,
    fallbackPrinterIds: [],
    failoverMode: 'disabled',
  };
}

export function roleForDocument(kind: PrintDocumentKind): PrinterRole {
  if (kind === 'receipt') return 'receipt';
  if (kind === 'label') return 'label';
  if (kind === 'a4_document') return 'a4';
  if (kind === 'kitchen_ticket') return 'kitchen';
  return 'packing';
}

function routeRank(route: PrinterRoute, context: PrinterRouteContext): number {
  if (route.businessId !== context.businessId || route.role !== context.role) return -1;

  if (route.registerId !== undefined) {
    if (context.registerId === undefined || route.registerId !== context.registerId) return -1;
    if (route.outletId !== undefined && route.outletId !== context.outletId) return -1;
    return route.outletId !== undefined ? 30 : 25;
  }

  if (route.outletId !== undefined) {
    if (route.outletId !== context.outletId) return -1;
    return 20;
  }

  return 10;
}

/**
 * Route precedence is deterministic: register+outlet -> register -> outlet -> business default.
 * This prevents a multi-printer store from depending on array/order accidents.
 */
export function resolvePrinterRoute(
  routes: readonly PrinterRoute[],
  context: PrinterRouteContext,
): PrinterRoute {
  let selected: PrinterRoute | undefined;
  let selectedRank = -1;
  for (const route of routes) {
    const rank = routeRank(route, context);
    if (rank < 0) continue;
    if (rank > selectedRank) {
      selected = route;
      selectedRank = rank;
      continue;
    }
    if (rank === selectedRank) {
      throw new Error('Ambiguous printer configuration: more than one route matches the same scope.');
    }
  }
  if (!selected) throw new Error('No printer route is configured for this POS context.');
  return selected;
}

function readyCompatiblePrinter(input: {
  printerId: string;
  route: PrinterRoute;
  printers: readonly PrinterIdentity[];
  content: PrintContent;
  supports: (printer: PrinterIdentity, content: PrintContent) => boolean;
}): PrinterIdentity | undefined {
  const printer = input.printers.find((candidate) => candidate.id === input.printerId);
  if (!printer) return undefined;
  if (printer.businessId !== input.route.businessId) return undefined;
  if (input.route.outletId !== undefined && printer.outletId !== input.route.outletId) return undefined;
  if (printer.health !== 'ready') return undefined;
  if (!input.supports(printer, input.content)) return undefined;
  return printer;
}

export function selectReadyPrinter(input: {
  route: PrinterRoute;
  printers: readonly PrinterIdentity[];
  content: PrintContent;
  supports: (printer: PrinterIdentity, content: PrintContent) => boolean;
}): PrinterIdentity {
  const primary = readyCompatiblePrinter({
    printerId: input.route.primaryPrinterId,
    route: input.route,
    printers: input.printers,
    content: input.content,
    supports: input.supports,
  });
  if (primary) return primary;

  if ((input.route.failoverMode ?? 'disabled') !== 'explicit') {
    throw new Error('Assigned printer is unavailable. Automatic printer switching is disabled.');
  }

  for (const printerId of input.route.fallbackPrinterIds) {
    const fallback = readyCompatiblePrinter({
      printerId,
      route: input.route,
      printers: input.printers,
      content: input.content,
      supports: input.supports,
    });
    if (fallback) return fallback;
  }
  throw new Error('No ready compatible printer is available for this explicit-fallback route.');
}

/**
 * Automatic printer failover is allowed only when the business explicitly enabled
 * it AND the previous dispatch definitively failed before producing output.
 * Unknown outcome may already have printed and therefore never auto-fails over.
 */
export function canFailoverAfterDispatch(
  result: PrintDispatchResult,
  failoverMode: PrinterFailoverMode = 'disabled',
): boolean {
  return failoverMode === 'explicit' && result.outcome === 'failed' && result.retryable;
}

export type CompatibilityManifestEntry = {
  manufacturer: string;
  modelPattern: string;
  protocol: PrinterIdentity['protocol'];
  transports: PrinterIdentity['transport'][];
  adapterKey: string;
  supportTier: PrinterIdentity['supportTier'];
  paperWidthsMm?: number[];
};

export type PrinterCompatibilityManifest = {
  schemaVersion: 1;
  revision: string;
  generatedAt: string;
  entries: CompatibilityManifestEntry[];
};

/**
 * Compatibility manifests are data only. Executable adapter code is shipped
 * through the signed Palta app/device-bridge release channel, never downloaded
 * and executed from a remote manifest.
 */
export function matchCompatibilityEntry(
  manifest: PrinterCompatibilityManifest,
  manufacturer: string,
  model: string,
): CompatibilityManifestEntry | undefined {
  const normalizedManufacturer = manufacturer.trim().toLowerCase();
  for (const entry of manifest.entries) {
    if (entry.manufacturer.trim().toLowerCase() !== normalizedManufacturer) continue;
    let expression: RegExp;
    try {
      expression = new RegExp(entry.modelPattern, 'i');
    } catch {
      continue;
    }
    if (expression.test(model)) return entry;
  }
  return undefined;
}
