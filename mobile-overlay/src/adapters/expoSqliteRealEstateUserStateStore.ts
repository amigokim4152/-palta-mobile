import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  RealEstateUserStateStore,
  SavedRealEstateListing,
  SavedRealEstateSearch,
} from '../../../src/realEstate/realEstateUserState';
import type { RealEstateListingQuery } from '../../../src/realEstate/realEstateRepository';

export class ExpoSQLiteRealEstateUserStateStore implements RealEstateUserStateStore {
  constructor(private readonly db: SQLiteDatabase) {}

  async listSavedListings(): Promise<readonly SavedRealEstateListing[]> {
    const rows = await this.db.getAllAsync<{ listing_id: string; saved_at: string }>(
      'SELECT listing_id, saved_at FROM real_estate_saved_listing ORDER BY saved_at DESC',
    );
    return rows.map((row) => ({ listingId: row.listing_id, savedAt: row.saved_at }));
  }

  async isListingSaved(listingId: string): Promise<boolean> {
    const row = await this.db.getFirstAsync<{ listing_id: string }>(
      'SELECT listing_id FROM real_estate_saved_listing WHERE listing_id = ? LIMIT 1',
      [listingId],
    );
    return Boolean(row);
  }

  async saveListing(listingId: string, savedAt = new Date().toISOString()): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO real_estate_saved_listing (listing_id, saved_at)
       VALUES (?, ?)
       ON CONFLICT(listing_id) DO UPDATE SET saved_at = excluded.saved_at`,
      [listingId, savedAt],
    );
  }

  async removeSavedListing(listingId: string): Promise<void> {
    await this.db.runAsync(
      'DELETE FROM real_estate_saved_listing WHERE listing_id = ?',
      [listingId],
    );
  }

  async listSavedSearches(): Promise<readonly SavedRealEstateSearch[]> {
    const rows = await this.db.getAllAsync<{
      id: string;
      label: string;
      query_json: string;
      alert_enabled: number;
      saved_at: string;
    }>(
      `SELECT id, label, query_json, alert_enabled, saved_at
       FROM real_estate_saved_search
       ORDER BY saved_at DESC`,
    );

    return rows.flatMap((row) => {
      try {
        return [{
          id: row.id,
          label: row.label,
          query: JSON.parse(row.query_json) as RealEstateListingQuery,
          alertEnabled: row.alert_enabled === 1,
          savedAt: row.saved_at,
        }];
      } catch {
        return [];
      }
    });
  }

  async saveSearch(search: SavedRealEstateSearch): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO real_estate_saved_search (
         id, label, query_json, alert_enabled, saved_at
       ) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         label = excluded.label,
         query_json = excluded.query_json,
         alert_enabled = excluded.alert_enabled,
         saved_at = excluded.saved_at`,
      [
        search.id,
        search.label,
        JSON.stringify(search.query),
        search.alertEnabled ? 1 : 0,
        search.savedAt,
      ],
    );
  }

  async removeSavedSearch(searchId: string): Promise<void> {
    await this.db.runAsync(
      'DELETE FROM real_estate_saved_search WHERE id = ?',
      [searchId],
    );
  }
}
