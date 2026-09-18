import type {
  RealEstateInquiryDraft,
  RealEstateInquiryDraftStore,
} from '../../../src/realEstate/realEstateInquiry';
import { readWebJson, writeWebJson } from './realEstateWebStorage';

const KEY = 'inquiryDrafts.v1';

function readDrafts(): RealEstateInquiryDraft[] {
  return readWebJson<RealEstateInquiryDraft[]>(KEY, []);
}

function writeDrafts(drafts: readonly RealEstateInquiryDraft[]): void {
  writeWebJson(KEY, drafts);
}

export class ExpoSQLiteRealEstateInquiryStore implements RealEstateInquiryDraftStore {
  constructor(_db: unknown) {}

  async listDrafts(): Promise<readonly RealEstateInquiryDraft[]> {
    return [...readDrafts()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveDraft(draft: RealEstateInquiryDraft): Promise<void> {
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
