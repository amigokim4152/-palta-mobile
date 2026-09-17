import type {
  PrinterFailoverMode,
  PrinterRole,
  PrinterRoute,
} from '../printing/printRouting.js';
import type {
  PrinterRouteQuery,
  PrinterRouteRepository,
} from './printerRouteRepository.js';
import type { SqlDatabase } from './sqlDatabase.js';

type PrinterRouteRow = {
  route_id: string;
  business_id: string;
  outlet_key: string;
  register_key: string;
  role: PrinterRole;
  failover_mode: PrinterFailoverMode;
  printer_id: string;
  priority: number | string;
  is_primary: boolean;
};

function priority(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 99) {
    throw new Error('Persisted printer route priority must be an integer between 0 and 99.');
  }
  return parsed;
}

type MutableRoute = {
  businessId: string;
  outletId?: string;
  registerId?: string;
  role: PrinterRole;
  failoverMode: PrinterFailoverMode;
  primaryPrinterId?: string;
  candidates: Array<{ printerId: string; priority: number; isPrimary: boolean }>;
};

/**
 * DB convention from migration 0015:
 * - outlet_key = 'default' represents business/default scope;
 * - register_key = '*' represents no register pin.
 */
function routeScope(row: PrinterRouteRow): Pick<MutableRoute, 'businessId' | 'outletId' | 'registerId' | 'role' | 'failoverMode'> {
  const scope: Pick<MutableRoute, 'businessId' | 'outletId' | 'registerId' | 'role' | 'failoverMode'> = {
    businessId: row.business_id,
    role: row.role,
    failoverMode: row.failover_mode,
  };
  if (row.outlet_key !== 'default') scope.outletId = row.outlet_key;
  if (row.register_key !== '*') scope.registerId = row.register_key;
  return scope;
}

export class PostgresPrinterRouteRepository implements PrinterRouteRepository {
  constructor(private readonly db: SqlDatabase) {}

  async listRoutes(query: PrinterRouteQuery): Promise<PrinterRoute[]> {
    if (!query.businessId.trim()) throw new Error('Printer route query requires businessId.');

    const result = await this.db.query<PrinterRouteRow>(
      `select
         r.id as route_id,
         r.business_id,
         r.outlet_key,
         r.register_key,
         r.role,
         r.failover_mode,
         c.printer_id,
         c.priority,
         c.is_primary
       from printer_route r
       join printer_route_candidate c
         on c.business_id = r.business_id
        and c.route_id = r.id
       where r.business_id = $1
         and r.role = $2
         and r.enabled = true
       order by r.id asc, c.priority asc, c.printer_id asc`,
      [query.businessId, query.role],
    );

    const grouped = new Map<string, MutableRoute>();
    for (const row of result.rows) {
      let route = grouped.get(row.route_id);
      if (!route) {
        route = {
          ...routeScope(row),
          candidates: [],
        };
        grouped.set(row.route_id, route);
      } else {
        const scope = routeScope(row);
        if (
          route.businessId !== scope.businessId ||
          route.role !== scope.role ||
          route.failoverMode !== scope.failoverMode ||
          route.outletId !== scope.outletId ||
          route.registerId !== scope.registerId
        ) {
          throw new Error('Persisted printer route rows disagree on route scope.');
        }
      }

      const candidate = {
        printerId: row.printer_id,
        priority: priority(row.priority),
        isPrimary: row.is_primary,
      };
      if (route.candidates.some((item) => item.printerId === candidate.printerId)) {
        throw new Error('Persisted printer route contains a duplicate printer candidate.');
      }
      route.candidates.push(candidate);
      if (candidate.isPrimary) {
        if (route.primaryPrinterId !== undefined) {
          throw new Error('Persisted printer route contains more than one primary printer.');
        }
        route.primaryPrinterId = candidate.printerId;
      }
    }

    const routes: PrinterRoute[] = [];
    for (const route of grouped.values()) {
      if (route.primaryPrinterId === undefined) {
        throw new Error('Persisted printer route has no primary printer.');
      }
      const fallbacks = route.candidates
        .filter((candidate) => !candidate.isPrimary)
        .sort((a, b) => a.priority - b.priority || a.printerId.localeCompare(b.printerId))
        .map((candidate) => candidate.printerId);

      const projected: PrinterRoute = {
        businessId: route.businessId,
        role: route.role,
        primaryPrinterId: route.primaryPrinterId,
        fallbackPrinterIds: fallbacks,
        failoverMode: route.failoverMode,
      };
      if (route.outletId !== undefined) projected.outletId = route.outletId;
      if (route.registerId !== undefined) projected.registerId = route.registerId;
      routes.push(projected);
    }
    return routes;
  }
}
