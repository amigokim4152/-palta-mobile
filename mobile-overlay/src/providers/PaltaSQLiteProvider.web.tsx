import type { PropsWithChildren } from 'react';

/**
 * Web/PWA does not need Expo SQLite for the mutation queue.
 * Keeping this provider as a platform-specific pass-through prevents the web
 * bundle from pulling Expo SQLite's WASM worker while native continues to use
 * PaltaSQLiteProvider.tsx unchanged.
 */
export function PaltaSQLiteProvider({ children }: PropsWithChildren) {
  return children;
}
