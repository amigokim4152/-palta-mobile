import type { PrinterIdentity } from '../printing/printCore.js';

export type PrinterDeviceLookup = {
  businessId: string;
  printerId: string;
};

/**
 * Canonical printer-device read port backed by the existing printer_device table.
 * Runtime bridge/driver handles are deliberately not persisted through this port.
 */
export interface PrinterDeviceRepository {
  findEnabledPrinter(lookup: PrinterDeviceLookup): Promise<PrinterIdentity | null>;
}
