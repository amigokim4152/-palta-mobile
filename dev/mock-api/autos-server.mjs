import http from 'node:http';
import { randomUUID } from 'node:crypto';

const host = process.env.PALTA_AUTOS_MOCK_HOST ?? '127.0.0.1';
const port = Number(process.env.PALTA_AUTOS_MOCK_PORT ?? '8791');

const TRANSFER_RULES = {
  ruleSetId: 'cl-vehicle-transfer-2026-01',
  transferTaxRate: 0.015,
  civilOfficerProcedureFeeClp: 9_610,
  motorVehicleRegistryFeeClp: 39_240,
};

const demoDealers = [
  {
    businessId: 'demo-business-auto-providencia',
    name: 'Automotora Providencia · Demo',
    verified: true,
    acquisitionEnabled: true,
    serviceComunas: ['Providencia', 'Las Condes', 'Vitacura', 'Ñuñoa'],
  },
  {
    businessId: 'demo-business-auto-maipu',
    name: 'Automotora Maipú · Demo',
    verified: true,
    acquisitionEnabled: true,
    serviceComunas: ['Maipú', 'Estación Central', 'Pudahuel', 'Las Condes'],
  },
];

const acquisitionRequests = new Map();
const offersByRequest = new Map();

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function requireAuth(req, res) {
  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    json(res, 401, { error: 'authentication_required' });
    return false;
  }
  return true;
}

function positiveInteger(value) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function maskPlate(value) {
  if (typeof value !== 'string') return '••••••';
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized.length < 4) return '••••••';
  return `${normalized.slice(0, 2)}••${normalized.slice(-2)}`;
}

function transferEstimate({ salePriceClp, fiscalValueClp, costBearer }) {
  const salePrice = positiveInteger(salePriceClp);
  const fiscalValue = positiveInteger(fiscalValueClp ?? 0);
  const taxableBase = Math.max(salePrice, fiscalValue);
  const transferTax = positiveInteger(taxableBase * TRANSFER_RULES.transferTaxRate);
  const total = transferTax + TRANSFER_RULES.civilOfficerProcedureFeeClp + TRANSFER_RULES.motorVehicleRegistryFeeClp;
  const bearer = ['buyer', 'seller', 'split'].includes(costBearer) ? costBearer : 'buyer';
  const sellerCost = bearer === 'seller' ? total : bearer === 'split' ? Math.round(total / 2) : 0;
  const buyerCost = total - sellerCost;
  return {
    rule_set_id: TRANSFER_RULES.ruleSetId,
    sale_price_clp: salePrice,
    taxable_base_clp: taxableBase,
    transfer_tax_clp: transferTax,
    civil_officer_procedure_fee_clp: TRANSFER_RULES.civilOfficerProcedureFeeClp,
    motor_vehicle_registry_fee_clp: TRANSFER_RULES.motorVehicleRegistryFeeClp,
    total_transfer_costs_clp: total,
    buyer_estimated_outlay_clp: salePrice + buyerCost,
    seller_estimated_net_clp: Math.max(0, salePrice - sellerCost),
    cost_bearer: bearer,
  };
}

function eligibleDealers(comuna) {
  return demoDealers.filter(
    (dealer) => dealer.verified && dealer.acquisitionEnabled && dealer.serviceComunas.includes(comuna),
  );
}

function publicRequestProjection(request) {
  return {
    request_id: request.requestId,
    make: request.make,
    model: request.model,
    ...(request.version ? { version: request.version } : {}),
    manufacture_year: request.manufactureYear,
    mileage_km: request.mileageKm,
    comuna: request.comuna,
    photo_refs: [...request.photoRefs],
    ...(request.conditionNote ? { condition_note: request.conditionNote } : {}),
    closes_at: request.closesAt,
  };
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) return json(res, 400, { error: 'bad_request' });
    if (req.method === 'OPTIONS') return json(res, 204, {});

    const url = new URL(req.url, `http://${req.headers.host ?? `${host}:${port}`}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, service: 'palta-autos-mock-api', version: '1.0.0' });
    }

    if (!requireAuth(req, res)) return;

    if (req.method === 'POST' && url.pathname === '/v1/autos/sale-preparation') {
      const body = await readJson(req);
      if (!Number.isFinite(body.sale_price_clp) || body.sale_price_clp <= 0) {
        return json(res, 400, { error: 'sale_price_required' });
      }

      // The mock intentionally does not invent an SII value. A connected official snapshot
      // can later populate this without changing the API response shape.
      const fiscalValue = Number.isFinite(body.sii_fiscal_value_clp) && body.sii_fiscal_value_clp > 0
        ? positiveInteger(body.sii_fiscal_value_clp)
        : undefined;
      const transaction = transferEstimate({
        salePriceClp: body.sale_price_clp,
        fiscalValueClp: fiscalValue,
        costBearer: body.cost_bearer,
      });

      return json(res, 200, {
        vehicle: {
          plate_masked: maskPlate(body.plate),
          ...(typeof body.make === 'string' ? { make: body.make } : {}),
          ...(typeof body.model === 'string' ? { model: body.model } : {}),
          ...(typeof body.version === 'string' ? { version: body.version } : {}),
          ...(Number.isFinite(body.manufacture_year) ? { manufacture_year: positiveInteger(body.manufacture_year) } : {}),
        },
        fiscal_valuation: fiscalValue
          ? { state: 'verified', value_clp: fiscalValue, source_ref: 'mock:sii-connected' }
          : { state: 'not_resolved' },
        transaction_estimate: transaction,
        estimate_confidence: fiscalValue ? 'official_floor_applied' : 'minimum_without_fiscal_value',
        user_action_required_now: false,
      });
    }

    if (req.method === 'POST' && url.pathname === '/v1/autos/acquisition-requests') {
      const body = await readJson(req);
      const forbiddenFields = ['plate', 'phone', 'exact_location', 'address', 'rut'];
      const forbidden = forbiddenFields.find((field) => field in body);
      if (forbidden) return json(res, 400, { error: 'private_field_not_allowed', field: forbidden });

      if (
        typeof body.make !== 'string' || !body.make.trim() ||
        typeof body.model !== 'string' || !body.model.trim() ||
        !Number.isFinite(body.manufacture_year) ||
        !Number.isFinite(body.mileage_km) ||
        typeof body.comuna !== 'string' || !body.comuna.trim() ||
        !Array.isArray(body.photo_refs)
      ) {
        return json(res, 400, { error: 'invalid_acquisition_request' });
      }

      const requestId = `autos-request-${randomUUID()}`;
      const closesAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const routedDealerIds = eligibleDealers(body.comuna.trim()).map((dealer) => dealer.businessId);
      const request = {
        requestId,
        make: body.make.trim(),
        model: body.model.trim(),
        ...(typeof body.version === 'string' && body.version.trim() ? { version: body.version.trim() } : {}),
        manufactureYear: positiveInteger(body.manufacture_year),
        mileageKm: positiveInteger(body.mileage_km),
        comuna: body.comuna.trim(),
        photoRefs: body.photo_refs.filter((value) => typeof value === 'string'),
        ...(typeof body.condition_note === 'string' && body.condition_note.trim()
          ? { conditionNote: body.condition_note.trim() }
          : {}),
        routedDealerIds,
        closesAt,
        status: 'open_for_offers',
      };
      acquisitionRequests.set(requestId, request);
      offersByRequest.set(requestId, []);

      return json(res, 201, {
        request_id: requestId,
        status: request.status,
        routed_dealer_count: routedDealerIds.length,
        closes_at: closesAt,
      });
    }

    const offersMatch = req.method === 'GET'
      ? url.pathname.match(/^\/v1\/autos\/acquisition-requests\/([^/]+)\/offers$/)
      : null;
    if (offersMatch) {
      const requestId = decodeURIComponent(offersMatch[1]);
      if (!acquisitionRequests.has(requestId)) return json(res, 404, { error: 'request_not_found' });
      return json(res, 200, { request_id: requestId, items: offersByRequest.get(requestId) ?? [] });
    }

    const dealerQueueMatch = req.method === 'GET'
      ? url.pathname.match(/^\/v1\/business\/([^/]+)\/autos\/acquisition-requests$/)
      : null;
    if (dealerQueueMatch) {
      const businessId = decodeURIComponent(dealerQueueMatch[1]);
      const dealer = demoDealers.find((item) => item.businessId === businessId);
      if (!dealer || !dealer.verified || !dealer.acquisitionEnabled) {
        return json(res, 403, { error: 'vehicle_private_buy_bid_capability_required' });
      }
      const items = [...acquisitionRequests.values()]
        .filter((request) => request.routedDealerIds.includes(businessId))
        .map(publicRequestProjection);
      return json(res, 200, { business_id: businessId, items });
    }

    const dealerOfferMatch = req.method === 'POST'
      ? url.pathname.match(/^\/v1\/business\/([^/]+)\/autos\/acquisition-requests\/([^/]+)\/offers$/)
      : null;
    if (dealerOfferMatch) {
      const businessId = decodeURIComponent(dealerOfferMatch[1]);
      const requestId = decodeURIComponent(dealerOfferMatch[2]);
      const dealer = demoDealers.find((item) => item.businessId === businessId);
      const request = acquisitionRequests.get(requestId);
      if (!dealer || !dealer.verified || !dealer.acquisitionEnabled) {
        return json(res, 403, { error: 'vehicle_private_buy_bid_capability_required' });
      }
      if (!request) return json(res, 404, { error: 'request_not_found' });
      if (!request.routedDealerIds.includes(businessId)) {
        return json(res, 403, { error: 'dealer_not_routed_for_request' });
      }

      const body = await readJson(req);
      if (!Number.isFinite(body.amount_clp) || body.amount_clp <= 0) {
        return json(res, 400, { error: 'positive_offer_required' });
      }
      if (body.offer_kind !== 'preliminary' && body.offer_kind !== 'firm') {
        return json(res, 400, { error: 'invalid_offer_kind' });
      }
      if (typeof body.inspection_required !== 'boolean') {
        return json(res, 400, { error: 'inspection_required_boolean' });
      }

      const existing = (offersByRequest.get(requestId) ?? []).find((offer) => offer.business_id === businessId);
      const offer = {
        offer_id: existing?.offer_id ?? `autos-offer-${randomUUID()}`,
        request_id: requestId,
        business_id: businessId,
        amount_clp: positiveInteger(body.amount_clp),
        offer_kind: body.offer_kind,
        inspection_required: body.inspection_required,
        status: existing ? 'revised' : 'submitted',
        submitted_at: new Date().toISOString(),
        expires_at: request.closesAt,
        ...(typeof body.note === 'string' && body.note.trim() ? { note: body.note.trim() } : {}),
      };
      const current = offersByRequest.get(requestId) ?? [];
      offersByRequest.set(
        requestId,
        existing ? current.map((item) => item.business_id === businessId ? offer : item) : [...current, offer],
      );
      return json(res, existing ? 200 : 201, offer);
    }

    return json(res, 404, { error: 'not_found' });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'internal_error' });
  }
});

server.listen(port, host, () => {
  console.log(`Palta Autos mock API listening on http://${host}:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
