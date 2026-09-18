import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  RealEstateInquiryDraft,
  RealEstateInquiryDraftStore,
} from '../../../src/realEstate/realEstateInquiry';

export class ExpoSQLiteRealEstateInquiryStore implements RealEstateInquiryDraftStore {
  constructor(private readonly db: SQLiteDatabase) {}

  async listDrafts(): Promise<readonly RealEstateInquiryDraft[]> {
    const rows = await this.db.getAllAsync<{ payload_json: string }>(
      `SELECT payload_json
       FROM real_estate_inquiry_draft
       ORDER BY updated_at DESC`,
    );
    return rows.flatMap((row) => {
      try {
        return [JSON.parse(row.payload_json) as RealEstateInquiryDraft];
      } catch {
        return [];
      }
    });
  }

  async saveDraft(draft: RealEstateInquiryDraft): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO real_estate_inquiry_draft (
         id, listing_id, status, payload_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         payload_json = excluded.payload_json,
         updated_at = excluded.updated_at`,
      [draft.id, draft.listingId, draft.status, JSON.stringify(draft), draft.createdAt, draft.updatedAt],
    );
  }

  async removeDraft(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM real_estate_inquiry_draft WHERE id = ?', [id]);
  }
}
