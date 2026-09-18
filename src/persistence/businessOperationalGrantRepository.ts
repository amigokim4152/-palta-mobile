import type { BusinessOperationalGrant } from '../access/businessOperationalAccess.js';

export type BusinessOperationalGrantLookup = {
  businessId: string;
  userId: string;
};

/**
 * Canonical lookup boundary for Palta business authorization.
 * Supabase Auth proves identity; this repository resolves Palta's own
 * business-role truth. Client-editable JWT metadata is never used as a grant.
 */
export interface BusinessOperationalGrantRepository {
  findGrant(
    lookup: BusinessOperationalGrantLookup,
  ): Promise<BusinessOperationalGrant | null>;
}
