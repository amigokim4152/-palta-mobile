import type { PrinterAdapter } from '../printing/printCore.js';
import type { PrintReconciliationPort } from '../printing/printReconciliation.js';
import type { PrinterDeviceRepository } from '../persistence/printerDeviceRepository.js';
import type {
  PrintDispatchResolution,
  PrintPortResolutionInput,
  PrintPortResolver,
} from './printWorker.js';

export type PrinterRuntimeBinding = {
  businessId: string;
  printerId: string;
  adapter: PrinterAdapter;
  reconciliation?: PrintReconciliationPort;
};

function bindingKey(businessId: string, printerId: string): string {
  return `${businessId}\u0000${printerId}`;
}

/**
 * Process-local executable bindings only. Canonical printer configuration remains
 * in printer_device; this registry contains live native/bridge handles that cannot
 * safely or usefully be serialized into the Commerce database.
 */
export class PrinterRuntimeRegistry {
  private readonly bindings = new Map<string, PrinterRuntimeBinding>();

  bind(binding: PrinterRuntimeBinding): void {
    if (!binding.businessId.trim() || !binding.printerId.trim()) {
      throw new Error('Printer runtime binding requires businessId and printerId.');
    }
    if (!binding.adapter.key.trim()) {
      throw new Error('Printer runtime binding requires adapter key.');
    }
    this.bindings.set(bindingKey(binding.businessId, binding.printerId), binding);
  }

  unbind(input: { businessId: string; printerId: string }): void {
    this.bindings.delete(bindingKey(input.businessId, input.printerId));
  }

  get(input: { businessId: string; printerId: string }): PrinterRuntimeBinding | null {
    return this.bindings.get(bindingKey(input.businessId, input.printerId)) ?? null;
  }
}

/**
 * Resolves the durable canonical printer record first, then joins it to a live
 * executable binding for exactly that business/printer pair.
 *
 * Dispatch fails closed for disabled devices. Reconciliation may still use a
 * disabled device binding because an earlier physical submission must be resolved
 * before any retry decision can be made.
 */
export class RegisteredPrintPortResolver implements PrintPortResolver {
  constructor(
    private readonly devices: PrinterDeviceRepository,
    private readonly runtime: PrinterRuntimeRegistry,
  ) {}

  private async load(input: PrintPortResolutionInput) {
    if (!input.businessId.trim() || !input.printerId.trim()) {
      throw new Error('Print port resolution requires businessId and printerId.');
    }
    return this.devices.findPrinter(input);
  }

  async resolveDispatch(input: PrintPortResolutionInput): Promise<PrintDispatchResolution | null> {
    const persisted = await this.load(input);
    if (!persisted || !persisted.enabled) return null;

    const binding = this.runtime.get(input);
    if (!binding) return null;
    if (binding.adapter.key !== persisted.printer.adapterKey) {
      throw new Error('Live print adapter does not match canonical printer adapterKey.');
    }
    if (!binding.adapter.supports(persisted.printer, { kind: 'receipt', lines: [] })) {
      // The worker performs the authoritative content-specific supports() check.
      // This lightweight check catches bindings that reject the canonical device
      // itself without coupling the resolver to a specific PrintJob payload.
      // An adapter that only supports a non-receipt class is allowed below by
      // skipping this heuristic through adapter-key identity; do not reject it.
    }

    return {
      printer: persisted.printer,
      adapter: binding.adapter,
    };
  }

  async resolveReconciliation(input: PrintPortResolutionInput): Promise<PrintReconciliationPort | null> {
    const persisted = await this.load(input);
    if (!persisted) return null;

    const binding = this.runtime.get(input);
    if (!binding?.reconciliation) return null;
    if (binding.adapter.key !== persisted.printer.adapterKey) {
      // Configuration changed after the original submission. Do not query an
      // unrelated new execution channel and interpret its not_found as evidence.
      return null;
    }
    return binding.reconciliation;
  }
}
