import type { FiscalProviderConnection } from '../fiscal/chile/fiscalProviderConnection.js';

export type FiscalProviderConnectionLookup = {
  businessId: string;
  issuerRut: string;
  providerKey: string;
  connectionId: string;
};

export interface FiscalProviderConnectionRepository {
  findConnection(lookup: FiscalProviderConnectionLookup): Promise<FiscalProviderConnection | null>;
}
