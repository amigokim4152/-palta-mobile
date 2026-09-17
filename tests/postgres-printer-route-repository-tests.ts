import { PostgresPrinterRouteRepository } from '../src/persistence/postgresPrinterRouteRepository.js';
import type { SqlDatabase, SqlExecutor, SqlQueryResult } from '../src/persistence/sqlDatabase.js';

type Row = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

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

const rows = [
  {
    route_id: 'route-default',
    business_id: 'biz-1',
    outlet_key: 'default',
    register_key: '*',
    role: 'receipt',
    failover_mode: 'disabled',
    printer_id: 'printer-default',
    priority: 0,
    is_primary: true,
  },
  {
    route_id: 'route-caja-1',
    business_id: 'biz-1',
    outlet_key: 'main',
    register_key: 'caja-1',
    role: 'receipt',
    failover_mode: 'explicit',
    printer_id: 'printer-primary',
    priority: 0,
    is_primary: true,
  },
  {
    route_id: 'route-caja-1',
    business_id: 'biz-1',
    outlet_key: 'main',
    register_key: 'caja-1',
    role: 'receipt',
    failover_mode: 'explicit',
    printer_id: 'printer-fallback-2',
    priority: 2,
    is_primary: false,
  },
  {
    route_id: 'route-caja-1',
    business_id: 'biz-1',
    outlet_key: 'main',
    register_key: 'caja-1',
    role: 'receipt',
    failover_mode: 'explicit',
    printer_id: 'printer-fallback-1',
    priority: 1,
    is_primary: false,
  },
];

const db = new ScriptDb([{ rows, rowCount: rows.length }]);
const routes = await new PostgresPrinterRouteRepository(db).listRoutes({
  businessId: 'biz-1',
  role: 'receipt',
});
assertEqual(routes.length, 2, 'Rows must group into two canonical printer routes.');
const defaultRoute = routes.find((route) => route.primaryPrinterId === 'printer-default');
assert(defaultRoute, 'Business/default route must be projected.');
assertEqual(defaultRoute.outletId, undefined, 'Reserved default outlet sentinel must map to business scope.');
assertEqual(defaultRoute.registerId, undefined, 'Wildcard register sentinel must map to no register pin.');

const registerRoute = routes.find((route) => route.primaryPrinterId === 'printer-primary');
assert(registerRoute, 'Register route must be projected.');
assertEqual(registerRoute.outletId, 'main', 'Register route must retain outlet scope.');
assertEqual(registerRoute.registerId, 'caja-1', 'Register route must retain POS/register scope.');
assertEqual(registerRoute.failoverMode, 'explicit', 'Explicit failover configuration must survive persistence projection.');
assertEqual(registerRoute.fallbackPrinterIds.join(','), 'printer-fallback-1,printer-fallback-2', 'Fallbacks must be ordered by configured priority.');
assert(
  db.calls[0]?.sql.includes('r.business_id = $1') &&
    db.calls[0]?.sql.includes('r.role = $2') &&
    db.calls[0]?.sql.includes('r.enabled = true'),
  'Runtime route projection must stay business/role scoped and ignore disabled routes.',
);

console.log('postgres-printer-route-repository-tests: ok');
