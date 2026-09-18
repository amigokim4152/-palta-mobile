import {
  assertPublicNewsProjectionSafe,
  type PublicNewsHome,
  type PublicNewsLocalPage,
  type PublicNewsStory,
  type PublicNewsVoicesPage,
} from './publicContracts.js';
import {
  PUBLIC_NEWS_API_PREFIX,
  publicNewsPath,
  type PublicNewsResource,
} from './publicNewsRoutes.js';

export interface PublicNewsTransport {
  getJson(path: string): Promise<unknown>;
}

export class FetchPublicNewsTransport implements PublicNewsTransport {
  constructor(private readonly baseUrl = '') {}

  async getJson(path: string): Promise<unknown> {
    if (!path.startsWith(PUBLIC_NEWS_API_PREFIX)) {
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
