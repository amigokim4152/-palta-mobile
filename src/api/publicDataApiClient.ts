import type { FetchLike } from './paltaApiClient.js';
import type {
  PublicDataHomeRecord,
  PublicDataHomeResponse,
} from './publicDataApiContract.js';

export type PublicDataApiClientOptions = {
  baseUrl: string;
  fetch: FetchLike;
};

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function expectObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} returned a non-object payload`);
  }
  return value as Record<string, unknown>;
}

function validateRecord(value: unknown): PublicDataHomeRecord {
  const item = expectObject(value, 'Public Data Home item');
  if (
    typeof item.record_id !== 'string' ||
    typeof item.title !== 'string' ||
    typeof item.record_type !== 'string' ||
    typeof item.canonical_version !== 'number'
  ) {
    throw new Error('Public Data Home item is missing canonical identity fields');
  }
  expectObject(item.jurisdiction, 'Public Data Home item jurisdiction');

  if (item.resolved_action !== undefined) {
    const action = expectObject(item.resolved_action, 'Public Data Home item resolved_action');
    if (
      typeof action.action_id !== 'string' ||
      typeof action.action_type !== 'string' ||
      typeof action.url !== 'string' ||
      !/^https?:\/\//i.test(action.url)
    ) {
      throw new Error('Public Data Home resolved_action is invalid');
    }
  }

  if (item.relevance_facts !== undefined) {
    expectObject(item.relevance_facts, 'Public Data Home item relevance_facts');
  }
  return item as PublicDataHomeRecord;
}

export class PublicDataApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: PublicDataApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetch;
  }

  async getHome(input: {
    comunaCode: string;
    category?: string;
    lifeEvent?: string;
    limit?: number;
  }): Promise<PublicDataHomeResponse> {
    if (!input.comunaCode.trim()) throw new Error('comunaCode is required');

    const params = new URLSearchParams({ comuna_code: input.comunaCode.trim() });
    if (input.category) params.set('category', input.category);
    if (input.lifeEvent) params.set('life_event', input.lifeEvent);
    if (input.limit !== undefined) params.set('limit', String(input.limit));

    const response = await this.fetchImpl(
      joinUrl(this.baseUrl, `/v1/cl/public/home?${params.toString()}`),
      { headers: { Accept: 'application/json' } },
    );
    if (!response.ok) {
      throw new Error(`Public Data API request failed: ${response.status}`);
    }

    const payload = expectObject(await response.json(), 'GET /v1/cl/public/home');
    if (
      payload.api_version !== 'v1' ||
      typeof payload.projection_version !== 'string' ||
      typeof payload.generated_at !== 'string' ||
      typeof payload.comuna_code !== 'string' ||
      !Array.isArray(payload.items)
    ) {
      throw new Error('GET /v1/cl/public/home returned an invalid envelope');
    }

    return {
      api_version: 'v1',
      projection_version: payload.projection_version,
      generated_at: payload.generated_at,
      comuna_code: payload.comuna_code,
      items: payload.items.map(validateRecord),
    };
  }
}
