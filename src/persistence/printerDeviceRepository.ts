import type { PrinterIdentity } from '../printing/printCore.js';

export type PrinterDeviceLookup = {
  businessId: string;
  printerId: string;
};

export type PersistedPrinterDevice = {
  printer: PrinterIdentity;
  enabled: boolean;
};

/**
 * Canonical printer-device read port backed by the existing printer_device table.
 * Runtime bridge/driver handles are deliberately not persisted through this port.
 * Disabled devices remain readable so already-submitted jobs can reconcile safely.
 */
export interface PrinterDeviceRepository {
  findPrinter(lookup: PrinterDeviceLookup): Promise<PersistedPrinterDevice | null>;
}
