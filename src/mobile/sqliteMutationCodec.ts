import type { OfflineMutation, OfflineMutationState } from './offlineMutationQueue.js';

export type MutationQueueSqlRow = {
  id: string;
  kind: string;
  payload_json: string;
  created_at: string;
  updated_at: string;
  attempts: number;
  state: string;
  last_error: string | null;
};

const validStates = new Set<OfflineMutationState>([
  'pending',
  'syncing',
  'failed_retryable',
  'failed_terminal',
]);

export function encodeMutationRow(
  mutation: OfflineMutation,
): MutationQueueSqlRow {
  return {
    id: mutation.id,
    kind: mutation.kind,
    payload_json: JSON.stringify(mutation.payload),
    created_at: mutation.createdAt,
    updated_at: mutation.updatedAt,
    attempts: mutation.attempts,
    state: mutation.state,
    last_error: mutation.lastError ?? null,
  };
}

export function decodeMutationRow(
  row: MutationQueueSqlRow,
): OfflineMutation {
  if (!validStates.has(row.state as OfflineMutationState)) {
    throw new Error(`Invalid offline mutation state: ${row.state}`);
  }

  let payload: Record<string, unknown>;
  try {
    const decoded = JSON.parse(row.payload_json) as unknown;
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
      throw new Error('payload_not_object');
    }
    payload = decoded as Record<string, unknown>;
  } catch {
    throw new Error(`Invalid offline mutation payload for ${row.id}`);
  }

  return {
    id: row.id,
    kind: row.kind,
    payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attempts: row.attempts,
    state: row.state as OfflineMutationState,
    ...(row.last_error ? { lastError: row.last_error } : {}),
  };
}
