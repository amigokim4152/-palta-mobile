import type { RealEstateListingQuery } from '../../../src/realEstate/realEstateRepository';
import type {
  RealEstateUserStateStore,
  SavedRealEstateListing,
  SavedRealEstateSearch,
} from '../../../src/realEstate/realEstateUserState';
import { readWebJson, writeWebJson } from './realEstateWebStorage';

const LISTINGS_KEY = 'savedListings.v1';
const SEARCHES_KEY = 'savedSearches.v1';

type StoredSearch = Omit<SavedRealEstateSearch, 'query'> & {
  query: RealEstateListingQuery;
};

function listings(): SavedRealEstateListing[] {
  return readWebJson<SavedRealEstateListing[]>(LISTINGS_KEY, []);
}

function searches(): StoredSearch[] {
  return readWebJson<StoredSearch[]>(SEARCHES_KEY, []);
}

export class ExpoSQLiteRealEstateUserStateStore implements RealEstateUserStateStore {
  constructor(_db: unknown) {}

  async listSavedListings(): Promise<readonly SavedRealEstateListing[]> {
    return [...listings()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  async isListingSaved(listingId: string): Promise<boolean> {
    return listings().some((item) => item.listingId === listingId);
  }

  async saveListing(listingId: string, savedAt = new Date().toISOString()): Promise<void> {
    const current = listings().filter((item) => item.listingId !== listingId);
    current.push({ listingId, savedAt });
    writeWebJson(LISTINGS_KEY, current);
  }

  async removeSavedListing(listingId: string): Promise<void> {
    writeWebJson(
      LISTINGS_KEY,
      listings().filter((item) => item.listingId !== listingId),
    );
  }

  async listSavedSearches(): Promise<readonly SavedRealEstateSearch[]> {
    return [...searches()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  async saveSearch(search: SavedRealEstateSearch): Promise<void> {
    const current = searches().filter((item) => item.id !== search.id);
    current.push(search);
    writeWebJson(SEARCHES_KEY, current);
  }

  async removeSavedSearch(searchId: string): Promise<void> {
    writeWebJson(
      SEARCHES_KEY,
      searches().filter((item) => item.id !== searchId),
    );
  }
}
