import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { syncPendingMutations } from '../../../src/mobile/mutationSyncEngine';
import { createMobileMutationExecutor } from '../services/mutationExecutor';
import { mobileRuntime } from '../services/paltaClient';
import { useMutationQueueStore } from '../services/useMutationQueueStore';

export function MutationSyncBootstrap() {
  const store = useMutationQueueStore();
  const running = useRef(false);

  const sync = useCallback(async () => {
    if (running.current || mobileRuntime.status !== 'ready') return;
    running.current = true;
    try {
      await syncPendingMutations({
        store,
        execute: createMobileMutationExecutor(mobileRuntime.client),
        now: () => new Date().toISOString(),
      });
    } finally {
      running.current = false;
    }
  }, [store]);

  useEffect(() => {
    void sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    return () => subscription.remove();
  }, [sync]);

  return null;
}
