export type PublicNewsResource =
  | { readonly kind: 'home' }
  | { readonly kind: 'comuna'; readonly slug: string }
  | { readonly kind: 'region'; readonly slug: string }
  | { readonly kind: 'story'; readonly slug: string }
  | { readonly kind: 'voices' };

export const PUBLIC_NEWS_API_PREFIX = '/v1/cl/news/';
export const PUBLIC_NEWS_OBJECT_PREFIX = 'public-news/v1/cl/news/';

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function safePublicNewsSlug(value: string): string {
  const slug = value.trim().toLowerCase();
  if (!SAFE_SLUG.test(slug)) throw new Error(`Invalid News route slug: ${value}`);
  return slug;
}

export function publicNewsPath(resource: PublicNewsResource): string {
  switch (resource.kind) {
    case 'home':
      return '/v1/cl/news/home';
    case 'comuna':
      return `/v1/cl/news/comunas/${safePublicNewsSlug(resource.slug)}`;
    case 'region':
      return `/v1/cl/news/regions/${safePublicNewsSlug(resource.slug)}`;
    case 'story':
      return `/v1/cl/news/stories/${safePublicNewsSlug(resource.slug)}`;
    case 'voices':
      return '/v1/cl/news/voices';
  }
}

export function publicNewsObjectKey(pathname: string): string | null {
  if (pathname === '/v1/cl/news/home') return `${PUBLIC_NEWS_OBJECT_PREFIX}home.json`;
  if (pathname === '/v1/cl/news/voices') return `${PUBLIC_NEWS_OBJECT_PREFIX}voices.json`;

  const match = pathname.match(/^\/v1\/cl\/news\/(comunas|regions|stories)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if (!match) return null;
  const [, collection, slug] = match;
  if (!collection || !slug || !SAFE_SLUG.test(slug)) return null;
  return `${PUBLIC_NEWS_OBJECT_PREFIX}${collection}/${slug}.json`;
}

export function isPublicNewsApiPath(pathname: string): boolean {
  return publicNewsObjectKey(pathname) !== null;
}
