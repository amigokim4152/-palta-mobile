import { useMemo } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { ExpoSQLiteMutationQueueStore } from '../adapters/expoSqliteMutationQueueStore';

export function useMutationQueueStore() {
  const db = useSQLiteContext();
  return useMemo(
    () => new ExpoSQLiteMutationQueueStore(db),
    [db],
  );
}
