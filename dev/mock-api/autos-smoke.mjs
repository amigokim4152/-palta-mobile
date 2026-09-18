import { spawn } from 'node:child_process';
import process from 'node:process';

const port = Number(process.env.PALTA_AUTOS_SMOKE_PORT ?? '8792');
const baseUrl = `http://127.0.0.1:${port}`;
const authValue = `Bearer smoke-${process.pid}`;
const authHeaders = {
  Authorization: authValue,
  'Content-Type': 'application/json',
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForHealth() {
  let lastError;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError ?? new Error('Autos mock server did not become healthy');
}

async function jsonRequest(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json();
  return { response, body };
}

const child = spawn(process.execPath, ['dev/mock-api/autos-server.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PALTA_AUTOS_MOCK_HOST: '127.0.0.1',
    PALTA_AUTOS_MOCK_PORT: String(port),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stderr = '';
child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

try {
  await waitForHealth();

  const unauthorized = await jsonRequest('/v1/autos/acquisition-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert(unauthorized.response.status === 401, 'Autos routes must require authentication.');

  const preparation = await jsonRequest('/v1/autos/sale-preparation', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      plate: 'ABCD12',
      make: 'Toyota',
      model: 'RAV4',
      manufacture_year: 2021,
      sale_price_clp: 18_000_000,
      cost_bearer: 'buyer',
    }),
  });
  assert(preparation.response.status === 200, 'Sale preparation should succeed.');
  assert(preparation.body.vehicle.plate_masked === 'AB••12', 'Sale preparation should return a masked plate.');
  assert(preparation.body.fiscal_valuation.state === 'not_resolved', 'Mock should not invent an SII valuation.');
  assert(preparation.body.estimate_confidence === 'minimum_without_fiscal_value', 'Unresolved SII should be labeled as a minimum estimate.');

  const forbidden = await jsonRequest('/v1/autos/acquisition-requests', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      plate: 'ABCD12',
      make: 'Toyota',
      model: 'RAV4',
      manufacture_year: 2021,
      mileage_km: 48_200,
      comuna: 'Las Condes',
      photo_refs: ['photo-front'],
    }),
  });
  assert(forbidden.response.status === 400, 'Acquisition routing must reject private plate data.');
  assert(forbidden.body.error === 'private_field_not_allowed', 'Private-field rejection should be explicit.');

  const created = await jsonRequest('/v1/autos/acquisition-requests', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      make: 'Toyota',
      model: 'RAV4',
      manufacture_year: 2021,
      mileage_km: 48_200,
      comuna: 'Las Condes',
      photo_refs: ['photo-front', 'photo-rear', 'photo-side', 'photo-cabin', 'photo-odometer'],
      condition_note: 'Mantenciones al día',
    }),
  });
  assert(created.response.status === 201, 'Valid acquisition request should be created.');
  assert(created.body.routed_dealer_count === 2, 'Las Condes demo request should route only to two eligible dealers.');
  const requestId = created.body.request_id;

  const queue = await jsonRequest('/v1/business/demo-business-auto-providencia/autos/acquisition-requests', {
    headers: { Authorization: authValue },
  });
  assert(queue.response.status === 200 && queue.body.items.length === 1, 'Eligible dealer should receive the request.');
  const dealerView = queue.body.items[0];
  assert(!('plate' in dealerView), 'Dealer queue must not expose plate.');
  assert(!('phone' in dealerView), 'Dealer queue must not expose phone.');
  assert(!('exact_location' in dealerView), 'Dealer queue must not expose exact location.');
  assert(dealerView.comuna === 'Las Condes', 'Dealer queue may expose the minimum necessary comuna.');

  const deniedQueue = await jsonRequest('/v1/business/not-a-dealer/autos/acquisition-requests', {
    headers: { Authorization: authValue },
  });
  assert(deniedQueue.response.status === 403, 'Business without acquisition capability must be rejected.');

  const submitted = await jsonRequest(
    `/v1/business/demo-business-auto-providencia/autos/acquisition-requests/${encodeURIComponent(requestId)}/offers`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        amount_clp: 17_500_000,
        offer_kind: 'preliminary',
        inspection_required: true,
        note: 'Sujeta a inspección de lo declarado y fotografiado.',
      }),
    },
  );
  assert(submitted.response.status === 201, 'Eligible dealer should be able to submit an offer.');

  const losingOffer = await jsonRequest(
    `/v1/business/demo-business-auto-maipu/autos/acquisition-requests/${encodeURIComponent(requestId)}/offers`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        amount_clp: 17_350_000,
        offer_kind: 'preliminary',
        inspection_required: true,
      }),
    },
  );
  assert(losingOffer.response.status === 201, 'Second eligible dealer should be able to compete before selection.');

  const offers = await jsonRequest(`/v1/autos/acquisition-requests/${encodeURIComponent(requestId)}/offers`, {
    headers: { Authorization: authValue },
  });
  assert(offers.response.status === 200 && offers.body.items.length === 2, 'Seller should receive competing offers.');

  const selectionWithPrivateData = await jsonRequest(
    `/v1/autos/acquisition-requests/${encodeURIComponent(requestId)}/selection`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ offer_id: submitted.body.offer_id, phone: '+56911112222' }),
    },
  );
  assert(selectionWithPrivateData.response.status === 400, 'Offer selection must reject coordination data.');

  const selected = await jsonRequest(`/v1/autos/acquisition-requests/${encodeURIComponent(requestId)}/selection`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ offer_id: submitted.body.offer_id }),
  });
  assert(selected.response.status === 200, 'Seller should be able to select an offer.');
  assert(selected.body.selected_business_id === 'demo-business-auto-providencia', 'Selection must resolve the chosen Business.');
  assert(selected.body.contact_shared === false && selected.body.exact_location_shared === false, 'Selecting an offer must not reveal private coordination facts.');

  const privateCoordination = await jsonRequest(
    `/v1/business/demo-business-auto-providencia/autos/acquisition-requests/${encodeURIComponent(requestId)}/coordination`,
    { headers: { Authorization: authValue } },
  );
  assert(privateCoordination.response.status === 200, 'Selected dealer may inspect coordination state.');
  assert(!('phone' in privateCoordination.body), 'Contact remains private before explicit consent.');
  assert(!('exact_location' in privateCoordination.body), 'Exact location remains private before explicit consent.');

  const losingDealerCoordination = await jsonRequest(
    `/v1/business/demo-business-auto-maipu/autos/acquisition-requests/${encodeURIComponent(requestId)}/coordination`,
    { headers: { Authorization: authValue } },
  );
  assert(losingDealerCoordination.response.status === 403, 'Losing bidder must never access selected-dealer coordination.');

  const shared = await jsonRequest(`/v1/autos/acquisition-requests/${encodeURIComponent(requestId)}/coordination`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      contact_consent: 'share_selected_dealer',
      phone: '+56911112222',
      location_consent: 'share_selected_dealer',
      exact_location: {
        latitude: -33.401,
        longitude: -70.58,
        label: 'Lugar acordado',
      },
    }),
  });
  assert(shared.response.status === 200, 'Seller should explicitly share coordination details after selection.');
  assert(shared.body.contact_shared === true && shared.body.exact_location_shared === true, 'Server should confirm only the explicitly shared facts.');

  const selectedDealerCoordination = await jsonRequest(
    `/v1/business/demo-business-auto-providencia/autos/acquisition-requests/${encodeURIComponent(requestId)}/coordination`,
    { headers: { Authorization: authValue } },
  );
  assert(selectedDealerCoordination.body.phone === '+56911112222', 'Selected dealer should receive explicitly shared phone.');
  assert(selectedDealerCoordination.body.exact_location?.label === 'Lugar acordado', 'Selected dealer should receive explicitly shared visit location.');

  console.log('PASS: Autos HTTP sale preparation, fair routing, offer selection and selected-dealer coordination privacy');
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 1500);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
  if (stderr.trim()) process.stderr.write(stderr);
}
