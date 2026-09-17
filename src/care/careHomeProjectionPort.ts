import type { CareTrack } from './careMachine.js';
import type { CareHomePresentation } from './careHomeCandidatePolicy.js';

export interface CareHomeSnapshot {
  userId: string;
  track: CareTrack;
  intentKey: string;
  subjectEntityId?: string;
}

export interface CareHomeSnapshotPort {
  load(careTrackId: string): Promise<CareHomeSnapshot | null>;
}

export interface CareHomePresentationPort {
  /**
   * Domain adapter supplies user-facing text/action/urgency. Care Core does not
   * invent copy from internal state names and does not fetch arbitrary domain
   * payload by itself.
   */
  present(input: {
    snapshot: CareHomeSnapshot;
    sourceSignalEventId?: string;
    occurredAt: string;
  }): Promise<CareHomePresentation | null>;
}
