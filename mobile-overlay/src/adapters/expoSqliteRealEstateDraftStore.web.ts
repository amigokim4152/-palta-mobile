import type {
  RealEstateDraftStore,
  RealEstateListingDraft,
} from '../../../src/realEstate/realEstatePublishing';
import { readWebJson, writeWebJson } from './realEstateWebStorage';

const KEY = 'listingDrafts.v1';

function readDrafts(): RealEstateListingDraft[] {
  return readWebJson<RealEstateListingDraft[]>(KEY, []);
}

function writeDrafts(drafts: readonly RealEstateListingDraft[]): void {
  writeWebJson(KEY, drafts);
}

export class ExpoSQLiteRealEstateDraftStore implements RealEstateDraftStore {
  constructor(_db: unknown) {}

  async listDrafts(): Promise<readonly RealEstateListingDraft[]> {
    return [...readDrafts()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getDraft(id: string): Promise<RealEstateListingDraft | null> {
    return readDrafts().find((draft) => draft.id === id) ?? null;
  }

  async saveDraft(draft: RealEstateListingDraft): Promise<void> {
    const drafts = readDrafts();
    const index = drafts.findIndex((item) => item.id === draft.id);
    if (index >= 0) drafts[index] = draft;
    else drafts.push(draft);
    writeDrafts(drafts);
  }

  async removeDraft(id: string): Promise<void> {
    writeDrafts(readDrafts().filter((draft) => draft.id !== id));
  }
}
