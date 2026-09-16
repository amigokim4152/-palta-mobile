export type DeepLinkTarget =
  | { kind: 'home' }
  | { kind: 'business'; id: string }
  | { kind: 'place'; id: string }
  | { kind: 'care'; id: string }
  | { kind: 'context'; id: string };

export function toAppPath(target: DeepLinkTarget): string {
  switch (target.kind) {
    case 'home':
      return '/';
    case 'business':
      return `/business/${encodeURIComponent(target.id)}`;
    case 'place':
      return `/place/${encodeURIComponent(target.id)}`;
    case 'care':
      return `/care/${encodeURIComponent(target.id)}`;
    case 'context':
      return `/context/${encodeURIComponent(target.id)}`;
  }
}

export function toPaltaDeepLink(target: DeepLinkTarget): string {
  const path = toAppPath(target);
  return `palta://${path === '/' ? '' : path.replace(/^\//, '')}`;
}

export function parsePaltaDeepLink(url: string): DeepLinkTarget | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'palta:') return null;

  const parts = [parsed.hostname, ...parsed.pathname.split('/').filter(Boolean)]
    .filter(Boolean)
    .map(decodeURIComponent);

  if (parts.length === 0) return { kind: 'home' };
  if (parts.length !== 2) return null;

  const kind = parts[0];
  const id = parts[1];
  if (!id) return null;

  if (
    kind === 'business' ||
    kind === 'place' ||
    kind === 'care' ||
    kind === 'context'
  ) {
    return { kind, id };
  }
  return null;
}
