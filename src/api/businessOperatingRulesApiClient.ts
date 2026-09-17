import type { BusinessOperationalState } from '../business/businessOperationalState.js';
import type {
  BusinessLocalOpening,
  BusinessOperatingInterval,
  BusinessOperatingRules,
  BusinessWeeklySchedule,
} from '../business/businessOperatingRules.js';
import type { FetchLike } from './paltaApiClient.js';

export type BusinessOperatingRulesApiProjection = {
  operational_state: BusinessOperationalState;
  local_date: string;
  local_time: string;
  schedule_confirmed_at: string;
  next_open_local?: BusinessLocalOpening;
};

export type BusinessOperatingRulesApiResponse = {
  business_id: string;
  rules: BusinessOperatingRules;
  projection: BusinessOperatingRulesApiProjection;
};

export type BusinessWeeklyScheduleWriteInput = {
  timezone: string;
  weekly: BusinessWeeklySchedule;
};

export type BusinessSeasonalScheduleWriteInput = {
  startsOn: string;
  endsOn: string;
  weekly: BusinessWeeklySchedule;
};

export type BusinessSeasonalClosureWriteInput = {
  startsOn: string;
  endsOn: string;
};

export type BusinessOperatingQuickActionInput =
  | { action: 'close_today' }
  | { action: 'clear_today_exception' }
  | {
      action: 'set_today_hours';
      intervals: readonly BusinessOperatingInterval[];
    }
  | {
      action: 'close_temporarily';
      effectiveUntil: string;
    }
  | {
      action: 'clear_temporary_closure';
      closureId: string;
    };

export type BusinessOperatingRulesApiClientOptions = {
  baseUrl: string;
  fetch: FetchLike;
  getAccessToken?: () => Promise<string | null>;
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

function validateResponse(
  value: unknown,
  label: string,
): BusinessOperatingRulesApiResponse {
  const result = expectObject(value, label);
  if (
    typeof result.business_id !== 'string' ||
    !result.rules ||
    typeof result.rules !== 'object' ||
    !result.projection ||
    typeof result.projection !== 'object'
  ) {
    throw new Error(`${label} returned invalid operating rules`);
  }
  return result as BusinessOperatingRulesApiResponse;
}

export class BusinessOperatingRulesApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly getAccessToken: (() => Promise<string | null>) | undefined;

  constructor(options: BusinessOperatingRulesApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetch;
    this.getAccessToken = options.getAccessToken;
  }

  private async request(
    path: string,
    init?: { method?: string; body?: unknown },
  ): Promise<unknown> {
    const token = this.getAccessToken ? await this.getAccessToken() : null;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const requestInit: {
      method?: string;
      headers: Record<string, string>;
      body?: string;
    } = { headers };
    if (init?.method) requestInit.method = init.method;
    if (init?.body !== undefined) requestInit.body = JSON.stringify(init.body);
    const response = await this.fetchImpl(joinUrl(this.baseUrl, path), requestInit);
    if (!response.ok) {
      throw new Error(`Palta operating rules API request failed: ${response.status}`);
    }
    return response.json();
  }

  async get(businessId: string): Promise<BusinessOperatingRulesApiResponse> {
    return validateResponse(
      await this.request(
        `/v1/business/${encodeURIComponent(businessId)}/operating-rules`,
      ),
      'GET /v1/business/{id}/operating-rules',
    );
  }

  async replaceWeeklySchedule(
    businessId: string,
    input: BusinessWeeklyScheduleWriteInput,
  ): Promise<BusinessOperatingRulesApiResponse> {
    return validateResponse(
      await this.request(
        `/v1/business/${encodeURIComponent(businessId)}/operating-rules/weekly`,
        {
          method: 'PUT',
          body: {
            timezone: input.timezone,
            weekly: input.weekly,
          },
        },
      ),
      'PUT /v1/business/{id}/operating-rules/weekly',
    );
  }

  async upsertSeasonalSchedule(
    businessId: string,
    scheduleId: string,
    input: BusinessSeasonalScheduleWriteInput,
  ): Promise<BusinessOperatingRulesApiResponse> {
    return validateResponse(
      await this.request(
        `/v1/business/${encodeURIComponent(businessId)}/operating-rules/seasons/${encodeURIComponent(scheduleId)}`,
        {
          method: 'PUT',
          body: {
            starts_on: input.startsOn,
            ends_on: input.endsOn,
            weekly: input.weekly,
          },
        },
      ),
      'PUT /v1/business/{id}/operating-rules/seasons/{seasonId}',
    );
  }

  async removeSeasonalSchedule(
    businessId: string,
    scheduleId: string,
  ): Promise<BusinessOperatingRulesApiResponse> {
    return validateResponse(
      await this.request(
        `/v1/business/${encodeURIComponent(businessId)}/operating-rules/seasons/${encodeURIComponent(scheduleId)}`,
        { method: 'DELETE' },
      ),
      'DELETE /v1/business/{id}/operating-rules/seasons/{seasonId}',
    );
  }

  async upsertSeasonalClosure(
    businessId: string,
    closureId: string,
    input: BusinessSeasonalClosureWriteInput,
  ): Promise<BusinessOperatingRulesApiResponse> {
    return validateResponse(
      await this.request(
        `/v1/business/${encodeURIComponent(businessId)}/operating-rules/seasonal-closures/${encodeURIComponent(closureId)}`,
        {
          method: 'PUT',
          body: {
            starts_on: input.startsOn,
            ends_on: input.endsOn,
          },
        },
      ),
      'PUT /v1/business/{id}/operating-rules/seasonal-closures/{closureId}',
    );
  }

  async removeSeasonalClosure(
    businessId: string,
    closureId: string,
  ): Promise<BusinessOperatingRulesApiResponse> {
    return validateResponse(
      await this.request(
        `/v1/business/${encodeURIComponent(businessId)}/operating-rules/seasonal-closures/${encodeURIComponent(closureId)}`,
        { method: 'DELETE' },
      ),
      'DELETE /v1/business/{id}/operating-rules/seasonal-closures/{closureId}',
    );
  }

  async quickAction(
    businessId: string,
    input: BusinessOperatingQuickActionInput,
  ): Promise<BusinessOperatingRulesApiResponse> {
    const body: Record<string, unknown> = { action: input.action };
    if (input.action === 'set_today_hours') {
      body.intervals = input.intervals;
    } else if (input.action === 'close_temporarily') {
      body.effective_until = input.effectiveUntil;
    } else if (input.action === 'clear_temporary_closure') {
      body.closure_id = input.closureId;
    }

    return validateResponse(
      await this.request(
        `/v1/business/${encodeURIComponent(businessId)}/operating-rules/quick-action`,
        { method: 'POST', body },
      ),
      'POST /v1/business/{id}/operating-rules/quick-action',
    );
  }
}
