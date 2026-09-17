import type { CareState, CareTrack } from './careMachine.js';

export type CareStartMode = 'discover' | 'confirmed_action';

export interface CareTrackStartRecord {
  userId: string;
  careTrackId: string;
  intentKey: string;
  subjectEntityId?: string;
  initialState: CareState;
  clientRequestId?: string;
  createdAt: string;
}

export interface CareTrackStartStore {
  openOrReuse(record: CareTrackStartRecord): Promise<{
    track: CareTrack;
    created: boolean;
  }>;
}

export interface CareTrackStartRuntime {
  nextCareTrackId(): string;
  now(): string;
}

export class CareTrackStartError extends Error {
  constructor(
    readonly code: 'INVALID_CARE_START',
    message: string,
  ) {
    super(message);
    this.name = 'CareTrackStartError';
  }
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new CareTrackStartError('INVALID_CARE_START', `${label} is required.`);
  }
  return normalized;
}

export function initialCareStateForMode(mode: CareStartMode): CareState {
  return mode === 'confirmed_action' ? 'action_started' : 'discovered';
}

export class CareTrackStartService {
  constructor(
    private readonly store: CareTrackStartStore,
    private readonly runtime: CareTrackStartRuntime,
  ) {}

  async start(input: {
    userId: string;
    intentKey: string;
    mode: CareStartMode;
    subjectEntityId?: string;
    clientRequestId?: string;
  }): Promise<{
    track: CareTrack;
    created: boolean;
  }> {
    const userId = required(input.userId, 'userId');
    const intentKey = required(input.intentKey, 'intentKey');
    const subjectEntityId = input.subjectEntityId === undefined
      ? undefined
      : required(input.subjectEntityId, 'subjectEntityId');
    const clientRequestId = input.clientRequestId === undefined
      ? undefined
      : required(input.clientRequestId, 'clientRequestId');

    return this.store.openOrReuse({
      userId,
      careTrackId: this.runtime.nextCareTrackId(),
      intentKey,
      ...(subjectEntityId !== undefined ? { subjectEntityId } : {}),
      initialState: initialCareStateForMode(input.mode),
      ...(clientRequestId !== undefined ? { clientRequestId } : {}),
      createdAt: this.runtime.now(),
    });
  }
}
