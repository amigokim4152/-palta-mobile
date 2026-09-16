import type {
  OfflineMutation,
} from './offlineMutationQueue.js';
import {
  failMutation,
  pendingMutationsInOrder,
  shouldRetryMutation,
  startMutation,
} from './offlineMutationQueue.js';

export interface MutationQueueStore {
  list(): Promise<OfflineMutation[]>;
  put(mutation: OfflineMutation): Promise<void>;
  remove(id: string): Promise<void>;
}

export type MutationExecutorResult =
  | { ok: true }
  | { ok: false; retryable: boolean; error: string };

export type MutationExecutor = (
  mutation: OfflineMutation,
) => Promise<MutationExecutorResult>;

export type SyncReport = {
  attempted: number;
  succeeded: number;
  retryableFailures: number;
  terminalFailures: number;
};

export async function syncPendingMutations(input: {
  store: MutationQueueStore;
  execute: MutationExecutor;
  now: () => string;
  maxAttempts?: number;
}): Promise<SyncReport> {
  const all = await input.store.list();
  const pending = pendingMutationsInOrder(all);
  const report: SyncReport = {
    attempted: 0,
    succeeded: 0,
    retryableFailures: 0,
    terminalFailures: 0,
  };

  for (const mutation of pending) {
    if (
      mutation.state === 'failed_retryable' &&
      !shouldRetryMutation(mutation, input.maxAttempts ?? 5)
    ) {
      const terminal = failMutation(mutation, {
        retryable: false,
        error: mutation.lastError ?? 'retry_limit_reached',
        now: input.now(),
      });
      await input.store.put(terminal);
      report.terminalFailures += 1;
      continue;
    }

    const syncing = startMutation(mutation, input.now());
    await input.store.put(syncing);
    report.attempted += 1;

    let result: MutationExecutorResult;
    try {
      result = await input.execute(syncing);
    } catch (error) {
      result = {
        ok: false,
        retryable: true,
        error: error instanceof Error ? error.message : 'executor_error',
      };
    }

    if (result.ok) {
      await input.store.remove(syncing.id);
      report.succeeded += 1;
      continue;
    }

    const failed = failMutation(syncing, {
      retryable: result.retryable,
      error: result.error,
      now: input.now(),
    });
    await input.store.put(failed);

    if (result.retryable) {
      report.retryableFailures += 1;
    } else {
      report.terminalFailures += 1;
    }
  }

  return report;
}

export class InMemoryMutationQueueStore implements MutationQueueStore {
  private readonly items = new Map<string, OfflineMutation>();

  async list(): Promise<OfflineMutation[]> {
    return [...this.items.values()];
  }

  async put(mutation: OfflineMutation): Promise<void> {
    this.items.set(mutation.id, mutation);
  }

  async remove(id: string): Promise<void> {
    this.items.delete(id);
  }
}
