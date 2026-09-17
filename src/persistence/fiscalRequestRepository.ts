import type { FiscalRequest } from '../fiscal/chile/fiscalModel.js';

export type FiscalRequestLookup = {
  businessId: string;
  fiscalRequestId: string;
};

export interface FiscalRequestRepository {
  findRequest(lookup: FiscalRequestLookup): Promise<FiscalRequest | null>;
}
