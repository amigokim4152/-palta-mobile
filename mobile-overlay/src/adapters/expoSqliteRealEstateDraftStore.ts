import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  RealEstateDraftStore,
  RealEstateListingDraft,
} from '../../../src/realEstate/realEstatePublishing';

export class ExpoSQLiteRealEstateDraftStore implements RealEstateDraftStore {
  constructor(private readonly db: SQLiteDatabase) {}

  async listDrafts(): Promise<readonly RealEstateListingDraft[]> {
    const rows = await this.db.getAllAsync<{
      id: string;
      payload_json: string;
      updated_at: string;
    }>(
      `SELECT id, payload_json, updated_at
       FROM real_estate_listing_draft
       ORDER BY updated_at DESC`,
    );
    return rows.flatMap((row) => {
      try {
        return [JSON.parse(row.payload_json) as RealEstateListingDraft];
      } catch {
        return [];
      }
    });
  }

  async getDraft(id: string): Promise<RealEstateListingDraft | null> {
    const row = await this.db.getFirstAsync<{ payload_json: string }>(
      'SELECT payload_json FROM real_estate_listing_draft WHERE id = ? LIMIT 1',
      [id],
    );
    if (!row) return null;
    try {
      return JSON.parse(row.payload_json) as RealEstateListingDraft;
    } catch {
      return null;
    }
  }

  async saveDraft(draft: RealEstateListingDraft): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO real_estate_listing_draft (
         id, status, payload_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         payload_json = excluded.payload_json,
         updated_at = excluded.updated_at`,
      [draft.id, draft.status, JSON.stringify(draft), draft.createdAt, draft.updatedAt],
    );
  }

  async removeDraft(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM real_estate_listing_draft WHERE id = ?', [id]);
  }
}
