import type {
  PrinterHealth,
  PrinterIdentity,
  PrinterProtocol,
  PrinterSupportTier,
  PrinterTransport,
} from '../printing/printCore.js';
import type {
  PersistedPrinterDevice,
  PrinterDeviceLookup,
  PrinterDeviceRepository,
} from './printerDeviceRepository.js';
import type { SqlDatabase } from './sqlDatabase.js';

type PrinterDeviceRow = {
  id: string;
  business_id: string;
  outlet_key: string;
  display_name: string;
  manufacturer: string | null;
  model: string | null;
  firmware_version: string | null;
  serial_number_hash: string | null;
  connection_fingerprint_hash: string;
  transport: PrinterTransport;
  protocol: PrinterProtocol;
  support_tier: PrinterSupportTier;
  adapter_key: string;
  paper_width_mm: number | string | null;
  health: PrinterHealth;
  enabled: boolean;
};

function optionalText(value: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function paperWidth(value: number | string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Persisted printer paper_width_mm must be a positive number.');
  }
  return parsed;
}

function rowToPrinter(row: PrinterDeviceRow): PersistedPrinterDevice {
  const printer: PrinterIdentity = {
    id: row.id,
    businessId: row.business_id,
    outletId: row.outlet_key,
    displayName: row.display_name,
    connectionFingerprintHash: row.connection_fingerprint_hash,
    transport: row.transport,
    protocol: row.protocol,
    supportTier: row.support_tier,
    health: row.health,
    adapterKey: row.adapter_key,
  };

  const manufacturer = optionalText(row.manufacturer);
  const model = optionalText(row.model);
  const firmwareVersion = optionalText(row.firmware_version);
  const serialNumberHash = optionalText(row.serial_number_hash);
  const width = paperWidth(row.paper_width_mm);
  if (manufacturer !== undefined) printer.manufacturer = manufacturer;
  if (model !== undefined) printer.model = model;
  if (firmwareVersion !== undefined) printer.firmwareVersion = firmwareVersion;
  if (serialNumberHash !== undefined) printer.serialNumberHash = serialNumberHash;
  if (width !== undefined) printer.paperWidthMm = width;

  return { printer, enabled: row.enabled };
}

export class PostgresPrinterDeviceRepository implements PrinterDeviceRepository {
  constructor(private readonly db: SqlDatabase) {}

  async findPrinter(lookup: PrinterDeviceLookup): Promise<PersistedPrinterDevice | null> {
    if (!lookup.businessId.trim() || !lookup.printerId.trim()) {
      throw new Error('Printer device lookup requires businessId and printerId.');
    }

    const result = await this.db.query<PrinterDeviceRow>(
      `select
         id, business_id, outlet_key, display_name, manufacturer, model,
         firmware_version, serial_number_hash, connection_fingerprint_hash,
         transport, protocol, support_tier, adapter_key, paper_width_mm, health,
         enabled
       from printer_device
       where business_id = $1
         and id = $2
       limit 1`,
      [lookup.businessId, lookup.printerId],
    );
    const row = result.rows[0];
    return row ? rowToPrinter(row) : null;
  }
}
