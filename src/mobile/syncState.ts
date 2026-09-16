export type SyncState =
  | 'local_pending'
  | 'syncing'
  | 'confirmed'
  | 'failed_retryable'
  | 'failed_final';

export interface PendingAction<TPayload> {
  id: string;
  createdAt: string;
  state: SyncState;
  payload: TPayload;
  attempts: number;
  lastError?: string;
}

export function markSyncing<T>(action: PendingAction<T>): PendingAction<T> {
  if (action.state === 'confirmed' || action.state === 'failed_final') {
    throw new Error(`Cannot sync terminal action: ${action.state}`);
  }
  return { ...action, state: 'syncing', attempts: action.attempts + 1 };
}

export function resolveSync<T>(
  action: PendingAction<T>,
  outcome: 'confirmed' | 'retryable_error' | 'final_error',
  error?: string,
): PendingAction<T> {
  if (outcome === 'confirmed') {
    const { lastError: _lastError, ...rest } = action;
    return { ...rest, state: 'confirmed' };
  }
  return {
    ...action,
    state: outcome === 'retryable_error' ? 'failed_retryable' : 'failed_final',
    ...(error ? { lastError: error } : {}),
  };
}
