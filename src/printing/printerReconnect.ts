import type { PrinterIdentity } from './printCore.js';
import type { DiscoveredPrinterCandidate } from './printerOnboarding.js';

export type PrinterReconnectDecision =
  | { kind: 'exact_match'; printer: PrinterIdentity }
  | { kind: 'same_model_needs_confirmation'; possiblePrinters: PrinterIdentity[] }
  | { kind: 'new_device' };

function sameDeviceFamily(printer: PrinterIdentity, candidate: DiscoveredPrinterCandidate): boolean {
  const manufacturer = candidate.fingerprint.manufacturer?.trim().toLowerCase();
  const model = candidate.fingerprint.model?.trim().toLowerCase();
  if (!manufacturer || !model || !printer.manufacturer || !printer.model) return false;
  return (
    printer.manufacturer.trim().toLowerCase() === manufacturer &&
    printer.model.trim().toLowerCase() === model
  );
}

/**
 * Reconnect is automatic only on an exact hashed device identity match.
 * Model-family similarity is advisory only because stores may own several identical printers.
 */
export function decidePrinterReconnect(input: {
  businessId: string;
  candidate: DiscoveredPrinterCandidate;
  configuredPrinters: readonly PrinterIdentity[];
}): PrinterReconnectDecision {
  const scoped = input.configuredPrinters.filter((printer) => printer.businessId === input.businessId);

  const exact = scoped.filter(
    (printer) =>
      printer.connectionFingerprintHash !== undefined &&
      printer.connectionFingerprintHash === input.candidate.fingerprint.connectionFingerprintHash,
  );
  if (exact.length > 1) {
    throw new Error('Corrupt printer configuration: duplicate connection fingerprints within one business.');
  }
  if (exact.length === 1) return { kind: 'exact_match', printer: exact[0]! };

  const sameModel = scoped.filter((printer) => sameDeviceFamily(printer, input.candidate));
  if (sameModel.length > 0) {
    return { kind: 'same_model_needs_confirmation', possiblePrinters: sameModel };
  }

  return { kind: 'new_device' };
}
