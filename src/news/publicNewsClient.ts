import {
  assertPublicNewsProjectionSafe,
  type PublicNewsHome,
  type PublicNewsLocalPage,
  type PublicNewsStory,
  type PublicNewsVoicesPage,
} from './publicContracts.js';

export type PublicNewsResource =
  | { readonly kind: 'home' }
  | { readonly kind: 'comuna'; readonly slug: string }
  | { readonly kind: 'region'; readonly slug: string }
  | { readonly kind: 'story'; readonly slug: string }
  | { readonly kind: 'voices' };

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function safeSlug(value: string): string {
  const slug = value.trim().toLowerCase();
  if (!SAFE_SLUG.test(slug)) throw new Error(`Invalid News route slug: ${value}`);
  return slug;
}

export function publicNewsPath(resource: PublicNewsResource): string {
  switch (resource.kind) {
    case 'home':
      return '/v1/cl/news/home';
    case 'comuna':
      return `/v1/cl/news/comunas/${safeSlug(resource.slug)}`;
    case 'region':
      return `/v1/cl/news/regions/${safeSlug(resource.slug)}`;
    case 'story':
      return `/v1/cl/news/stories/${safeSlug(resource.slug)}`;
    case 'voices':
      return '/v1/cl/news/voices';
  }
}

export interface PublicNewsTransport {
  getJson(path: string): Promise<unknown>;
}

export class FetchPublicNewsTransport implements PublicNewsTransport {
  constructor(private readonly baseUrl = '') {}

  async getJson(path: string): Promise<unknown> {
    if (!path.startsWith('/v1/cl/news/')) {
      throw new Error('News Web may only call the public News API namespace.');
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
    });
    if (!response.ok) throw new Error(`Public News request failed: ${response.status}`);
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) {
      throw new Error('Public News API returned a non-JSON response.');
    }
    return response.json();
  }
}

export class PublicNewsClient {
  constructor(private readonly transport: PublicNewsTransport) {}

  private async read<T>(resource: PublicNewsResource): Promise<T> {
    const payload = await this.transport.getJson(publicNewsPath(resource));
    assertPublicNewsProjectionSafe(payload);
    return payload as T;
  }

  home(): Promise<PublicNewsHome> {
    return this.read<PublicNewsHome>({ kind: 'home' });
  }

  comuna(slug: string): Promise<PublicNewsLocalPage> {
    return this.read<PublicNewsLocalPage>({ kind: 'comuna', slug });
  }

  region(slug: string): Promise<PublicNewsLocalPage> {
    return this.read<PublicNewsLocalPage>({ kind: 'region', slug });
  }

  story(slug: string): Promise<PublicNewsStory> {
    return this.read<PublicNewsStory>({ kind: 'story', slug });
  }

  voices(): Promise<PublicNewsVoicesPage> {
    return this.read<PublicNewsVoicesPage>({ kind: 'voices' });
  }
}
