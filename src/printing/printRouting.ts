import type {
  PrintContent,
  PrintDispatchResult,
  PrintDocumentKind,
  PrinterIdentity,
} from './printCore.js';

export type PrinterRole = 'receipt' | 'label' | 'a4' | 'kitchen' | 'packing';
export type PrinterFailoverMode = 'disabled' | 'explicit';
export type PrinterCompatibilityPlatform =
  | 'windows'
  | 'android'
  | 'ios'
  | 'macos'
  | 'linux_bridge';

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

export type PrinterRuntimeRequirements = {
  /** Minimum Palta app/shell version required by this compatibility profile. */
  minAppVersion?: string;
  /** Minimum local Print Bridge version when the selected path uses a bridge. */
  minBridgeVersion?: string;
  /** Minimum Bridge protocol version; independent from bridge software version. */
  minBridgeProtocolVersion?: number;
  /** Minimum executable adapter version shipped in the app/bridge. */
  minAdapterVersion?: string;
};

export type CompatibilityManifestEntry = {
  manufacturer: string;
  modelPattern: string;
  protocol: PrinterIdentity['protocol'];
  transports: PrinterIdentity['transport'][];
  adapterKey: string;
  supportTier: PrinterIdentity['supportTier'];
  paperWidthsMm?: number[];
  /** Exact host platforms covered by this certification-derived entry. */
  platforms?: PrinterCompatibilityPlatform[];
  /** Exact firmware versions covered when certification recorded firmware. */
  firmwareVersions?: string[];
  runtimeRequirements?: PrinterRuntimeRequirements;
};

export type PrinterCompatibilityManifest = {
  schemaVersion: 1;
  revision: string;
  generatedAt: string;
  entries: CompatibilityManifestEntry[];
};

export type PrinterCompatibilityMatchContext = {
  platform?: PrinterCompatibilityPlatform;
  firmwareVersion?: string;
  transports?: readonly PrinterIdentity['transport'][];
};

function matchesCompatibilityScope(
  entry: CompatibilityManifestEntry,
  context: PrinterCompatibilityMatchContext | undefined,
): boolean {
  if (entry.platforms !== undefined && entry.platforms.length > 0) {
    if (context?.platform === undefined || !entry.platforms.includes(context.platform)) return false;
  }

  if (entry.firmwareVersions !== undefined && entry.firmwareVersions.length > 0) {
    const firmwareVersion = context?.firmwareVersion?.trim();
    if (!firmwareVersion || !entry.firmwareVersions.some((value) => value.trim() === firmwareVersion)) {
      return false;
    }
  }

  const transports = context?.transports;
  if (
    transports !== undefined &&
    transports.length > 0 &&
    !entry.transports.some((transport) => transports.includes(transport))
  ) {
    return false;
  }

  return true;
}

/**
 * Compatibility manifests are data only. Executable adapter code is shipped
 * through the signed Palta app/device-bridge release channel, never downloaded
 * and executed from a remote manifest.
 *
 * Certification-derived scope is fail-closed: when an entry names platform or
 * firmware constraints, Palta only returns it when the current environment proves
 * those same constraints. This prevents a certification from leaking across an
 * untested OS/firmware combination.
 */
export function matchCompatibilityEntry(
  manifest: PrinterCompatibilityManifest,
  manufacturer: string,
  model: string,
  context?: PrinterCompatibilityMatchContext,
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
    if (!expression.test(model)) continue;
    if (!matchesCompatibilityScope(entry, context)) continue;
    return entry;
  }
  return undefined;
}
