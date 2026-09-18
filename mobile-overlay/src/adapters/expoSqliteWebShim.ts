import type { PropsWithChildren } from 'react';

const WEB_SQLITE_CONTEXT = Object.freeze({});

/**
 * PWA storage does not load Expo SQLite/WASM. Real-estate platform adapters use
 * localStorage on web while native keeps the real Expo SQLite context.
 */
export function useSQLiteContext(): object {
  return WEB_SQLITE_CONTEXT;
}

export function SQLiteProvider({ children }: PropsWithChildren) {
  return children ?? null;
}
