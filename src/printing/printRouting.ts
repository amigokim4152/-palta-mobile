import type {
  PrintContent,
  PrintDispatchResult,
  PrintDocumentKind,
  PrinterIdentity,
} from './printCore.js';

export type PrinterRole = 'receipt' | 'label' | 'a4' | 'kitchen' | 'packing';

export type PrinterRoute = {
  businessId: string;
  outletId?: string;
  role: PrinterRole;
  primaryPrinterId: string;
  fallbackPrinterIds: string[];
};

export function roleForDocument(kind: PrintDocumentKind): PrinterRole {
  if (kind === 'receipt') return 'receipt';
  if (kind === 'label') return 'label';
  if (kind === 'a4_document') return 'a4';
  if (kind === 'kitchen_ticket') return 'kitchen';
  return 'packing';
}

export function selectReadyPrinter(input: {
  route: PrinterRoute;
  printers: readonly PrinterIdentity[];
  content: PrintContent;
  supports: (printer: PrinterIdentity, content: PrintContent) => boolean;
}): PrinterIdentity {
  const orderedIds = [input.route.primaryPrinterId, ...input.route.fallbackPrinterIds];
  for (const printerId of orderedIds) {
    const printer = input.printers.find((candidate) => candidate.id === printerId);
    if (!printer) continue;
    if (printer.businessId !== input.route.businessId) continue;
    if (input.route.outletId !== undefined && printer.outletId !== input.route.outletId) continue;
    if (printer.health !== 'ready') continue;
    if (!input.supports(printer, input.content)) continue;
    return printer;
  }
  throw new Error('No ready compatible printer is available for this print route.');
}

/**
 * Automatic printer failover is allowed only after a definitive failure that
 * proves the original adapter did not produce an output. An unknown outcome
 * may already have printed and therefore must never auto-failover/reprint.
 */
export function canFailoverAfterDispatch(result: PrintDispatchResult): boolean {
  return result.outcome === 'failed' && result.retryable;
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
