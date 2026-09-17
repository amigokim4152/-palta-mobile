import { PostgresPrinterDeviceRepository } from '../src/persistence/postgresPrinterDeviceRepository.js';
import type { SqlDatabase, SqlExecutor, SqlQueryResult } from '../src/persistence/sqlDatabase.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

type Row = Record<string, unknown>;

class ScriptDb implements SqlDatabase {
  readonly calls: Array<{ sql: string; params: readonly unknown[] }> = [];
  constructor(private responses: Array<SqlQueryResult<Row>>) {}

  async query<TRow extends Row>(sql: string, params: readonly unknown[] = []): Promise<SqlQueryResult<TRow>> {
    this.calls.push({ sql, params });
    const response = this.responses.shift();
    if (!response) throw new Error(`Unexpected SQL: ${sql}`);
    return response as unknown as SqlQueryResult<TRow>;
  }

  async transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    return work(this);
  }
}

const row = {
  id: '33333333-3333-4333-8333-333333333333',
  business_id: '22222222-2222-4222-8222-222222222222',
  outlet_key: 'vitacura-main',
  display_name: 'Caja 1 receipt',
  manufacturer: 'Epson',
  model: 'TM-T20IV',
  firmware_version: '10.02',
  serial_number_hash: 'a'.repeat(64),
  connection_fingerprint_hash: 'b'.repeat(64),
  transport: 'network',
  protocol: 'esc_pos',
  support_tier: 'palta_certified',
  adapter_key: 'epson-network-v1',
  paper_width_mm: '80.00',
  health: 'ready',
  enabled: false,
};

const db = new ScriptDb([{ rows: [row], rowCount: 1 }]);
const repository = new PostgresPrinterDeviceRepository(db);
const result = await repository.findPrinter({
  businessId: row.business_id,
  printerId: row.id,
});
assert(result, 'Existing canonical printer must be returned.');
assertEqual(result.enabled, false, 'Disabled state must remain visible for reconciliation decisions.');
assertEqual(result.printer.businessId, row.business_id, 'Printer must retain business scope.');
assertEqual(result.printer.outletId, 'vitacura-main', 'Printer must retain outlet scope.');
assertEqual(result.printer.paperWidthMm, 80, 'Numeric DB paper width must map to canonical number.');
assertEqual(result.printer.firmwareVersion, '10.02', 'Firmware must survive canonical mapping.');
assertEqual(result.printer.connectionFingerprintHash, 'b'.repeat(64), 'Only hashed connection fingerprint is persisted.');
assert(
  db.calls[0]?.sql.includes('business_id = $1') && db.calls[0]?.sql.includes('id = $2'),
  'Printer lookup must be business scoped and exact by printer id.',
);
assert(
  !db.calls[0]?.sql.includes('enabled = true'),
  'Repository must keep disabled devices readable for unresolved print reconciliation.',
);

const missingDb = new ScriptDb([{ rows: [], rowCount: 0 }]);
const missing = await new PostgresPrinterDeviceRepository(missingDb).findPrinter({
  businessId: row.business_id,
  printerId: '44444444-4444-4444-8444-444444444444',
});
assertEqual(missing, null, 'Missing printer must return null.');

console.log('postgres-printer-device-repository-tests: ok');
