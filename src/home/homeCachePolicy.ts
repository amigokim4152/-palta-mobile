import type {
  HomeFunctionalPayload,
  HomeGlanceSignal,
} from './homeFunctionalContract.js';

export type HomeConnectivity = 'online' | 'offline';

export type HomeSnapshot = {
  payload: HomeFunctionalPayload;
  storedAt: string;
  refreshAfter: string;
};

export type HomeStartupDecision = {
  payload: HomeFunctionalPayload | null;
  cacheState: 'none' | 'fresh' | 'stale';
  shouldRefresh: boolean;
  offline: boolean;
};

function timestamp(value: string): number | null {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Home is cache-first. A stale snapshot remains readable while the app refreshes
 * or while offline; individual realtime signals must still enforce their own
 * expiry and must not be shown as current merely because the snapshot exists.
 */
export function decideHomeStartup(input: {
  snapshot?: HomeSnapshot;
  connectivity: HomeConnectivity;
  now?: Date;
}): HomeStartupDecision {
  const offline = input.connectivity === 'offline';
  const now = (input.now ?? new Date()).getTime();
  const snapshot = input.snapshot;

  if (!snapshot) {
    return {
      payload: null,
      cacheState: 'none',
      shouldRefresh: !offline,
      offline,
    };
  }

  const storedAt = timestamp(snapshot.storedAt);
  const refreshAfter = timestamp(snapshot.refreshAfter);
  if (storedAt === null || refreshAfter === null || refreshAfter < storedAt) {
    return {
      payload: null,
      cacheState: 'none',
      shouldRefresh: !offline,
      offline,
    };
  }

  const stale = now > refreshAfter;
  return {
    payload: snapshot.payload,
    cacheState: stale ? 'stale' : 'fresh',
    shouldRefresh: stale && !offline,
    offline,
  };
}

export function canRenderGlanceSignal(
  signal: HomeGlanceSignal,
  now = new Date(),
): boolean {
  if (signal.source.mode === 'unavailable') return false;
  if (!signal.source.expiresAt) return true;
  const expiresAt = timestamp(signal.source.expiresAt);
  if (expiresAt === null) return false;
  return expiresAt >= now.getTime();
}

export function renderableGlanceSignals(
  payload: HomeFunctionalPayload,
  now = new Date(),
): HomeGlanceSignal[] {
  return payload.glance.filter((signal) => canRenderGlanceSignal(signal, now));
}
