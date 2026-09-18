import { AutosApiClient } from '../src/autos/autosApiClient.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type SeenRequest = {
  url: string;
  init?: { method?: string; headers?: Record<string, string>; body?: string };
};

const seen: SeenRequest[] = [];
const fakeFetch = async (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => {
  seen.push({ url, init });

  if (url.endsWith('/v1/autos/sale-preparation')) {
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          vehicle: { plate_masked: 'AB••12', make: 'Toyota', model: 'RAV4', manufacture_year: 2021 },
          fiscal_valuation: { state: 'verified', value_clp: 15_000_000, source_ref: 'sii:test' },
          transaction_estimate: {
            rule_set_id: 'cl-vehicle-transfer-2026-01',
            sale_price_clp: 18_000_000,
            taxable_base_clp: 18_000_000,
            transfer_tax_clp: 270_000,
            civil_officer_procedure_fee_clp: 9_610,
            motor_vehicle_registry_fee_clp: 39_240,
            total_transfer_costs_clp: 318_850,
            buyer_estimated_outlay_clp: 18_318_850,
            seller_estimated_net_clp: 18_000_000,
            cost_bearer: 'buyer',
          },
          estimate_confidence: 'official_floor_applied',
          user_action_required_now: false,
        };
      },
    };
  }

  if (url.endsWith('/v1/autos/acquisition-requests') && init?.method === 'POST') {
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          request_id: 'req-1',
          status: 'open_for_offers',
          routed_dealer_count: 8,
          closes_at: '2026-09-19T12:00:00.000Z',
        };
      },
    };
  }

  if (url.endsWith('/v1/autos/acquisition-requests/req-1/offers')) {
    return {
      ok: true,
      status: 200,
      async json() {
        return { request_id: 'req-1', items: [] };
      },
    };
  }

  if (url.includes('/v1/business/biz-1/autos/acquisition-requests/req-1/offers')) {
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          offer_id: 'offer-1',
          request_id: 'req-1',
          business_id: 'biz-1',
          amount_clp: 17_500_000,
          offer_kind: 'preliminary',
          inspection_required: true,
          status: 'submitted',
          submitted_at: '2026-09-18T12:00:00.000Z',
        };
      },
    };
  }

  if (url.endsWith('/v1/business/biz-1/autos/acquisition-requests')) {
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          business_id: 'biz-1',
          items: [
            {
              request_id: 'req-1',
              make: 'Toyota',
              model: 'RAV4',
              manufacture_year: 2021,
              mileage_km: 48_200,
              comuna: 'Las Condes',
              photo_refs: ['photo-1'],
            },
          ],
        };
      },
    };
  }

  return { ok: false, status: 404, async json() { return {}; } };
};

const api = new AutosApiClient({
  baseUrl: 'https://api.somospalta.cl/',
  fetch: fakeFetch,
  getAccessToken: async () => 'token-autos-123',
});

const preparation = await api.prepareSale({
  plate: 'ABCD12',
  manufactureYear: 2021,
  salePriceClp: 18_000_000,
  costBearer: 'buyer',
});
assert(preparation.vehicle.plate_masked === 'AB••12', 'Server response must expose only a masked plate to the UI projection.');
assert(preparation.fiscal_valuation.state === 'verified', 'Sale preparation should expose official valuation state.');

const created = await api.createAcquisitionRequest({
  make: 'Toyota',
  model: 'RAV4',
  manufactureYear: 2021,
  mileageKm: 48_200,
  comuna: 'Las Condes',
  photoRefs: ['photo-1', 'photo-2'],
  conditionNote: 'Mantenciones al día',
});
assert(created.request_id === 'req-1' && created.routed_dealer_count === 8, 'Acquisition request should return bounded routing state.');

await api.getAcquisitionOffers('req-1');
const queue = await api.getDealerAcquisitionQueue('biz-1');
assert(queue.items[0]?.comuna === 'Las Condes', 'Dealer queue may receive coarse comuna context.');

const submitted = await api.submitDealerOffer('biz-1', 'req-1', {
  amountClp: 17_500_000,
  offerKind: 'preliminary',
  inspectionRequired: true,
});
assert(submitted.offer_id === 'offer-1', 'Verified business flow should receive submitted offer projection.');

assert(
  seen.every((request) => request.init?.headers?.Authorization === 'Bearer token-autos-123'),
  'Every Autos API call must attach the current access token.',
);

const acquisitionCreate = seen.find(
  (request) => request.url.endsWith('/v1/autos/acquisition-requests') && request.init?.method === 'POST',
);
assert(Boolean(acquisitionCreate?.init?.body), 'Acquisition request should send a JSON body.');
const acquisitionBody = JSON.parse(acquisitionCreate!.init!.body!) as Record<string, unknown>;
assert(!('plate' in acquisitionBody), 'Dealer acquisition routing must not expose plate by default.');
assert(!('phone' in acquisitionBody), 'Dealer acquisition routing must not include phone by default.');
assert(!('exact_location' in acquisitionBody), 'Dealer acquisition routing must not include exact location by default.');
assert(acquisitionBody.comuna === 'Las Condes', 'Routing may use minimum necessary comuna context.');

const salePreparationRequest = seen.find((request) => request.url.endsWith('/v1/autos/sale-preparation'));
const salePreparationBody = JSON.parse(salePreparationRequest!.init!.body!) as Record<string, unknown>;
assert(salePreparationBody.plate === 'ABCD12', 'Plate may be sent only to the authenticated Palta preparation endpoint when the user initiates lookup.');

console.log('PASS: Autos API authentication, sale preparation and privacy boundary');
