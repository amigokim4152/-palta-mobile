import type { FetchLike } from '../api/paltaApiClient.js';
import type {
  JourneyCoordinate,
  JourneyRequest,
  JourneyResponse,
} from './journeyContract.js';
import { parseJourneyResponse } from './journeyValidation.js';

export type JourneyClientOptions = {
  baseUrl: string;
  fetch: FetchLike;
  getAccessToken?: () => Promise<string | null>;
};

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

function validateCoordinate(value: JourneyCoordinate, label: string): void {
  if (
    !Number.isFinite(value.lat) ||
    !Number.isFinite(value.lon) ||
    value.lat < -90 ||
    value.lat > 90 ||
    value.lon < -180 ||
    value.lon > 180
  ) {
    throw new Error(`${label} must contain valid lat/lon coordinates`);
  }
}

function validateRequest(input: JourneyRequest): void {
  validateCoordinate(input.origin, 'origin');
  validateCoordinate(input.destination, 'destination');
  if (input.departure_time !== undefined) {
    const parsed = Date.parse(input.departure_time);
    if (!Number.isFinite(parsed)) {
      throw new Error('departure_time must be an ISO-8601 date-time');
    }
  }
}

export class JourneyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'JourneyApiError';
  }
}

export class JourneyClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly getAccessToken: (() => Promise<string | null>) | undefined;

  constructor(options: JourneyClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetchImpl = options.fetch;
    this.getAccessToken = options.getAccessToken;
  }

  async plan(input: JourneyRequest): Promise<JourneyResponse> {
    validateRequest(input);

    const token = this.getAccessToken ? await this.getAccessToken() : null;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await this.fetchImpl(joinUrl(this.baseUrl, '/v1/journey'), {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });

    const payload = await response.json();

    if (!response.ok) {
      let code: string | undefined;
      let detail: string | undefined;
      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const record = payload as Record<string, unknown>;
        if (typeof record.error === 'string') code = record.error;
        if (typeof record.detail === 'string') detail = record.detail;
      }
      throw new JourneyApiError(
        detail ?? code ?? `Journey API request failed: ${response.status}`,
        response.status,
        code,
      );
    }

    return parseJourneyResponse(payload);
  }
}
