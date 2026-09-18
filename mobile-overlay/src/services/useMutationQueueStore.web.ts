import { useMemo } from 'react';
import type { OfflineMutation } from '../../../src/mobile/offlineMutationQueue';
import type { MutationQueueStore } from '../../../src/mobile/mutationSyncEngine';

const STORAGE_KEY = 'palta:web:mutation-queue:v1';

class BrowserMutationQueueStore implements MutationQueueStore {
  private readonly fallback = new Map<string, OfflineMutation>();

  private read(): OfflineMutation[] {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [...this.fallback.values()];
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as OfflineMutation[]) : [];
    } catch {
      return [];
    }
  }

  private write(items: readonly OfflineMutation[]) {
    if (typeof window === 'undefined' || !window.localStorage) {
      this.fallback.clear();
      for (const item of items) this.fallback.set(item.id, item);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  async list(): Promise<OfflineMutation[]> {
    return this.read();
  }

  async put(mutation: OfflineMutation): Promise<void> {
    const next = new Map(this.read().map((item) => [item.id, item] as const));
    next.set(mutation.id, mutation);
    this.write([...next.values()]);
  }

  async remove(id: string): Promise<void> {
    this.write(this.read().filter((item) => item.id !== id));
  }
}

export function useMutationQueueStore() {
  return useMemo(() => new BrowserMutationQueueStore(), []);
}
