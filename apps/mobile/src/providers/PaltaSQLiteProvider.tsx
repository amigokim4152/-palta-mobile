import type { PropsWithChildren } from 'react';
import { SQLiteProvider } from 'expo-sqlite';
import { initializePaltaSQLite } from '../adapters/expoSqliteMutationQueueStore';

export function PaltaSQLiteProvider({ children }: PropsWithChildren) {
  return (
    <SQLiteProvider
      databaseName="palta-local.db"
      onInit={initializePaltaSQLite}
    >
      {children}
    </SQLiteProvider>
  );
}
