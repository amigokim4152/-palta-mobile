import type {
  MarketHttpRequest,
  MarketHttpResponse,
  MarketHttpTransport,
} from '../market/marketHttpAdapter.js';
import type { FetchLike } from './paltaApiClient.js';

export type MarketHttpTransportOptions = {
  baseUrl: string;
  fetch: FetchLike;
  getAccessToken?: () => Promise<string | null>;
};

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function withQuery(
  url: string,
  query: MarketHttpRequest['query'],
): string {
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(query)) {
    if (raw === undefined) continue;
    if (Array.isArray(raw)) {
      for (const value of raw) params.append(key, String(value));
    } else {
      params.set(key, String(raw));
    }
  }
  const suffix = params.toString();
  return suffix ? `${url}?${suffix}` : url;
}

/** Shared composition-owned transport for Mercado HTTP ports. */
export function createMarketHttpTransport(
  options: MarketHttpTransportOptions,
): MarketHttpTransport {
  return {
    async request(input): Promise<MarketHttpResponse> {
      const token = options.getAccessToken
        ? await options.getAccessToken()
        : null;

      if (input.auth === 'required' && !token) {
        return {
          status: 401,
          payload: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication is required for this Mercado action.',
            retryable: false,
          },
        };
      }

      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (input.body !== undefined) headers['Content-Type'] = 'application/json';
      if (token) headers.Authorization = `Bearer ${token}`;

      const init: {
        method: string;
        headers: Record<string, string>;
        body?: string;
      } = {
        method: input.method,
        headers,
      };
      if (input.body !== undefined) init.body = JSON.stringify(input.body);

      const response = await options.fetch(
        withQuery(joinUrl(options.baseUrl, input.path), input.query),
        init,
      );

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        payload = undefined;
      }

      return {
        status: response.status,
        ...(payload !== undefined ? { payload } : {}),
      };
    },
  };
}
