import type { HomeCandidate } from '../core/contracts.js';

export interface HomeCandidateProjectionRecord {
  userId: string;
  candidate: HomeCandidate;
  careTrackId?: string;
  relatedEntityId?: string;
}

export interface HomeCandidateProjectionPort {
  upsert(record: HomeCandidateProjectionRecord): Promise<void>;

  remove(input: {
    userId: string;
    dedupeKey: string;
  }): Promise<void>;
}
