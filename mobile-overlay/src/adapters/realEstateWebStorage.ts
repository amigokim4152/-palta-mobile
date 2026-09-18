const PREFIX = 'palta.realEstate.';

function storage(): Storage | undefined {
  if (typeof window === 'undefined' || !window.localStorage) return undefined;
  return window.localStorage;
}

export function readWebJson<T>(key: string, fallback: T): T {
  const target = storage();
  if (!target) return fallback;
  try {
    const raw = target.getItem(`${PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeWebJson<T>(key: string, value: T): void {
  const target = storage();
  if (!target) return;
  try {
    target.setItem(`${PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // Persistence must never block browsing or form use in the PWA.
  }
}
