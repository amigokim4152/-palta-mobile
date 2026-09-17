import type { CareEvent } from './careMachine.js';

export interface CareSignalApplyResult {
  careTrackId: string;
  changed: boolean;
  state?: string;
}

export interface CareSignalApplyPort {
  /**
   * The implementation must treat sourceSignalEventId as an idempotency key.
   * Any durable Care mutation and care_signal_receipt insert belong in the same
   * transaction. Domain payload is resolved by the owning core when needed;
   * this command carries references/semantic hints only.
   */
  applySignal(input: {
    careTrackId: string;
    sourceSignalEventId: string;
    sourceCore: string;
    careEvent: CareEvent;
    resourceType: string;
    resourceId: string;
    occurredAt: string;
    expectedAt?: string;
    waitingForKey?: string;
    resultRef?: string;
    outcomeRef?: string;
  }): Promise<CareSignalApplyResult>;
}
