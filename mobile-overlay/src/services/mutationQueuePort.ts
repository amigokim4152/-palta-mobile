import type {
  MutationQueueStore,
} from '../../../src/mobile/mutationSyncEngine';

/**
 * The real mobile implementation will use Expo SQLite.
 * This port prevents screens/workflows from depending on SQLite directly.
 */
export type MobileMutationQueueStore = MutationQueueStore;
