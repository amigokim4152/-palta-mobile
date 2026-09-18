import type { ListingId } from './realEstateContracts';
import type { RealEstateListingQuery } from './realEstateRepository';

export type SavedRealEstateListing = {
  listingId: ListingId;
  savedAt: string;
};

export type SavedRealEstateSearch = {
  id: string;
  label: string;
  query: RealEstateListingQuery;
  alertEnabled: boolean;
  savedAt: string;
};

export interface RealEstateUserStateStore {
  listSavedListings(): Promise<readonly SavedRealEstateListing[]>;
  isListingSaved(listingId: ListingId): Promise<boolean>;
  saveListing(listingId: ListingId, savedAt?: string): Promise<void>;
  removeSavedListing(listingId: ListingId): Promise<void>;
  listSavedSearches(): Promise<readonly SavedRealEstateSearch[]>;
  saveSearch(search: SavedRealEstateSearch): Promise<void>;
  removeSavedSearch(searchId: string): Promise<void>;
}

export function createSavedSearch(input: {
  id: string;
  label: string;
  query: RealEstateListingQuery;
  alertEnabled?: boolean;
  savedAt?: string;
}): SavedRealEstateSearch {
  return {
    id: input.id,
    label: input.label.trim() || 'Búsqueda guardada',
    query: input.query,
    alertEnabled: input.alertEnabled ?? false,
    savedAt: input.savedAt ?? new Date().toISOString(),
  };
}
