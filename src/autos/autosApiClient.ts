import type { FetchLike } from '../api/paltaApiClient.js';
import { PaltaApiError } from '../api/paltaApiClient.js';

export type AutosSalePreparationApiInput = {
  plate?: string;
  siiCode?: string;
  make?: string;
  model?: string;
  version?: string;
  manufactureYear?: number;
  salePriceClp: number;
  costBearer?: 'buyer' | 'seller' | 'split';
};

export type AutosSalePreparationApiResponse = {
  vehicle: {
    plate_masked: string;
    make?: string;
    model?: string;
    version?: string;
    manufacture_year?: number;
  };
  fiscal_valuation: {
    state: 'verified' | 'not_resolved';
    value_clp?: number;
    source_ref?: string;
  };
  transaction_estimate: {
    rule_set_id: string;
    sale_price_clp: number;
    taxable_base_clp: number;
    transfer_tax_clp: number;
    civil_officer_procedure_fee_clp: number;
    motor_vehicle_registry_fee_clp: number;
    total_transfer_costs_clp: number;
    buyer_estimated_outlay_clp: number;
    seller_estimated_net_clp: number;
    cost_bearer: 'buyer' | 'seller' | 'split';
  };
  estimate_confidence: 'official_floor_applied' | 'minimum_without_fiscal_value';
  user_action_required_now: boolean;
};

export type AutosAcquisitionRequestApiInput = {
  vehicleId?: string;
  make: string;
  model: string;
  version?: string;
  manufactureYear: number;
  mileageKm: number;
  comuna: string;
  photoRefs: readonly string[];
  conditionNote?: string;
};

export type AutosAcquisitionRequestApiResponse = {
  request_id: string;
  status: 'routing' | 'open_for_offers' | 'offer_selected' | 'closed' | 'cancelled';
  routed_dealer_count: number;
  closes_at?: string;
};

export type AutosDealerOfferApiItem = {
  offer_id: string;
  request_id: string;
  business_id: string;
  amount_clp: number;
  offer_kind: 'preliminary' | 'firm';
  inspection_required: boolean;
  status: 'submitted' | 'revised' | 'accepted' | 'declined' | 'expired' | 'withdrawn';
  submitted_at: string;
  expires_at?: string;
  note?: string;
  trust?: {
    offer_respect_rate_pct?: number;
    completed_deals?: number;
  };
};

export type AutosAcquisitionOffersApiResponse = {
  request_id: string;
  items: AutosDealerOfferApiItem[];
};

export type AutosDealerAcquisitionQueueItem = {
  request_id: string;
  make: string;
  model: string;
  version?: string;
  manufacture_year: number;
  mileage_km: number;
  comuna: string;
  photo_refs: string[];
  condition_note?: string;
  closes_at?: string;
};

export type AutosDealerAcquisitionQueueResponse = {
  business_id: string;
  items: AutosDealerAcquisitionQueueItem[];
};

export type AutosDealerOfferSubmitInput = {
  amountClp: number;
  offerKind: 'preliminary' | 'firm';
  inspectionRequired: boolean;
  note?: string;
};

export type AutosApiClientOptions = {
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

export class AutosApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly getAccessToken: (() => Promise<string | null>) | undefined;

  constructor(options: AutosApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetch;
    this.getAccessToken = options.getAccessToken;
  }

  private async request(path: string, init?: { method?: string; body?: unknown }): Promise<unknown> {
    const token = this.getAccessToken ? await this.getAccessToken() : null;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    const requestInit: { method?: string; headers: Record<string, string>; body?: string } = { headers };
    if (init?.method) requestInit.method = init.method;
    if (init?.body !== undefined) requestInit.body = JSON.stringify(init.body);

    const response = await this.fetchImpl(joinUrl(this.baseUrl, path), requestInit);
    if (!response.ok) throw new PaltaApiError(`Autos API request failed: ${response.status}`, response.status);
    return response.json();
  }

  async prepareSale(input: AutosSalePreparationApiInput): Promise<AutosSalePreparationApiResponse> {
    const payload = expectObject(
      await this.request('/v1/autos/sale-preparation', {
        method: 'POST',
        body: {
          ...(input.plate ? { plate: input.plate } : {}),
          ...(input.siiCode ? { sii_code: input.siiCode } : {}),
          ...(input.make ? { make: input.make } : {}),
          ...(input.model ? { model: input.model } : {}),
          ...(input.version ? { version: input.version } : {}),
          ...(input.manufactureYear !== undefined ? { manufacture_year: input.manufactureYear } : {}),
          sale_price_clp: input.salePriceClp,
          ...(input.costBearer ? { cost_bearer: input.costBearer } : {}),
        },
      }),
      'POST /v1/autos/sale-preparation',
    );

    const vehicle = expectObject(payload.vehicle, 'Autos sale preparation vehicle');
    const fiscal = expectObject(payload.fiscal_valuation, 'Autos sale preparation fiscal valuation');
    const transaction = expectObject(payload.transaction_estimate, 'Autos sale preparation transaction estimate');
    if (
      typeof vehicle.plate_masked !== 'string' ||
      (fiscal.state !== 'verified' && fiscal.state !== 'not_resolved') ||
      typeof transaction.total_transfer_costs_clp !== 'number'
    ) {
      throw new Error('POST /v1/autos/sale-preparation returned invalid payload');
    }
    return payload as unknown as AutosSalePreparationApiResponse;
  }

  async createAcquisitionRequest(
    input: AutosAcquisitionRequestApiInput,
  ): Promise<AutosAcquisitionRequestApiResponse> {
    const payload = expectObject(
      await this.request('/v1/autos/acquisition-requests', {
        method: 'POST',
        body: {
          ...(input.vehicleId ? { vehicle_id: input.vehicleId } : {}),
          make: input.make,
          model: input.model,
          ...(input.version ? { version: input.version } : {}),
          manufacture_year: input.manufactureYear,
          mileage_km: input.mileageKm,
          comuna: input.comuna,
          photo_refs: input.photoRefs,
          ...(input.conditionNote ? { condition_note: input.conditionNote } : {}),
        },
      }),
      'POST /v1/autos/acquisition-requests',
    );
    if (typeof payload.request_id !== 'string' || typeof payload.routed_dealer_count !== 'number') {
      throw new Error('POST /v1/autos/acquisition-requests returned invalid payload');
    }
    return payload as unknown as AutosAcquisitionRequestApiResponse;
  }

  async getAcquisitionOffers(requestId: string): Promise<AutosAcquisitionOffersApiResponse> {
    const payload = expectObject(
      await this.request(`/v1/autos/acquisition-requests/${encodeURIComponent(requestId)}/offers`),
      'GET /v1/autos/acquisition-requests/{id}/offers',
    );
    if (typeof payload.request_id !== 'string' || !Array.isArray(payload.items)) {
      throw new Error('GET /v1/autos/acquisition-requests/{id}/offers returned invalid payload');
    }
    return payload as unknown as AutosAcquisitionOffersApiResponse;
  }

  async getDealerAcquisitionQueue(businessId: string): Promise<AutosDealerAcquisitionQueueResponse> {
    const payload = expectObject(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/autos/acquisition-requests`),
      'GET /v1/business/{id}/autos/acquisition-requests',
    );
    if (payload.business_id !== businessId || !Array.isArray(payload.items)) {
      throw new Error('GET /v1/business/{id}/autos/acquisition-requests returned invalid payload');
    }
    return payload as unknown as AutosDealerAcquisitionQueueResponse;
  }

  async submitDealerOffer(
    businessId: string,
    requestId: string,
    input: AutosDealerOfferSubmitInput,
  ): Promise<AutosDealerOfferApiItem> {
    const payload = expectObject(
      await this.request(
        `/v1/business/${encodeURIComponent(businessId)}/autos/acquisition-requests/${encodeURIComponent(requestId)}/offers`,
        {
          method: 'POST',
          body: {
            amount_clp: input.amountClp,
            offer_kind: input.offerKind,
            inspection_required: input.inspectionRequired,
            ...(input.note ? { note: input.note } : {}),
          },
        },
      ),
      'POST /v1/business/{id}/autos/acquisition-requests/{requestId}/offers',
    );
    if (
      typeof payload.offer_id !== 'string' ||
      payload.business_id !== businessId ||
      payload.request_id !== requestId ||
      typeof payload.amount_clp !== 'number'
    ) {
      throw new Error('POST dealer Autos offer returned invalid payload');
    }
    return payload as unknown as AutosDealerOfferApiItem;
  }
}
