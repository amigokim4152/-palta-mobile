import type { PrinterRole, PrinterRoute } from '../printing/printRouting.js';

export type PrinterRouteQuery = {
  businessId: string;
  role: PrinterRole;
};

/** Read-only runtime projection of existing printer_route configuration. */
export interface PrinterRouteRepository {
  listRoutes(query: PrinterRouteQuery): Promise<PrinterRoute[]>;
}
