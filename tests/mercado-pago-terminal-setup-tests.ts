import {
  MercadoPagoPointAdapter,
  type JsonHttpClient,
  type JsonHttpResponse,
} from '../src/adapters/payments/mercadoPagoPointAdapter.js';
import { PaymentProviderOperationError } from '../src/payment/paymentIncident.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type Request = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  url: string;
  headers: Record<string, string>;
  body?: unknown;
};

class Http implements JsonHttpClient {
  requests: Request[] = [];
  constructor(private readonly responses: Array<JsonHttpResponse<unknown>>) {}
  async request<T>(input: Request): Promise<JsonHttpResponse<T>> {
    this.requests.push(input);
    const response = this.responses.shift();
    if (!response) throw new Error('No queued response.');
    return response as JsonHttpResponse<T>;
  }
}

const http = new Http([
  {
    status: 200,
    body: {
      data: {
        terminals: [
          {
            id: 'NEWLAND_N950__TEST0001',
            pos_id: 'POS-1',
            store_id: 'STORE-1',
            operating_mode: 'STANDALONE',
          },
          {
            id: 'NEWLAND_N950__TEST0002',
            pos_id: 'POS-2',
            store_id: 'STORE-1',
            operating_mode: 'PDV',
          },
        ],
      },
      paging: { total: 2, offset: 0, limit: 50 },
    },
  },
  {
    status: 200,
    body: {
      terminals: [
        {
          id: 'NEWLAND_N950__TEST0001',
          operating_mode: 'PDV',
        },
      ],
    },
  },
]);

const adapter = new MercadoPagoPointAdapter(http, async () => 'TOKEN-SETUP');
const terminals = await adapter.listTerminals({ storeId: 'STORE-1', posId: 'POS-1' });
assert(terminals.length === 2, 'Terminal discovery must return provider terminals.');
assert(terminals[0]?.operating_mode === 'STANDALONE', 'Terminal operating mode must be preserved.');
const listRequest = http.requests[0];
assert(listRequest?.method === 'GET', 'Terminal discovery must use GET.');
assert(listRequest?.url.includes('/terminals/v1/list?'), 'Terminal discovery must use the current terminals endpoint.');
assert(listRequest?.url.includes('store_id=STORE-1'), 'Store filter must be forwarded safely.');
assert(listRequest?.url.includes('pos_id=POS-1'), 'POS filter must be forwarded safely.');
assert(listRequest?.headers.Authorization === 'Bearer TOKEN-SETUP', 'Terminal discovery must use the business-scoped access token.');

const configured = await adapter.configureTerminalPdv('NEWLAND_N950__TEST0001');
assert(configured.operating_mode === 'PDV', 'PDV setup must require provider confirmation.');
const setupRequest = http.requests[1];
assert(setupRequest?.method === 'PATCH', 'PDV setup must use PATCH.');
assert(setupRequest?.url.endsWith('/terminals/v1/setup'), 'PDV setup must use the current setup endpoint.');
const setupBody = setupRequest?.body as { terminals?: Array<{ id?: string; operating_mode?: string }> };
assert(setupBody.terminals?.[0]?.id === 'NEWLAND_N950__TEST0001', 'PDV setup must target the selected terminal only.');
assert(setupBody.terminals?.[0]?.operating_mode === 'PDV', 'PDV setup must request PDV explicitly.');

let invalidLimitBlocked = false;
try {
  await adapter.listTerminals({ limit: 51 });
} catch {
  invalidLimitBlocked = true;
}
assert(invalidLimitBlocked, 'Terminal list must reject provider-invalid page limits before HTTP.');
assert(http.requests.length === 2, 'Invalid terminal query must not call provider.');

const unavailableHttp: JsonHttpClient = {
  async request() {
    throw new Error('network unavailable');
  },
};
const unavailable = new MercadoPagoPointAdapter(unavailableHttp, async () => 'TOKEN-SETUP');
let transientClassified = false;
try {
  await unavailable.listTerminals();
} catch (error) {
  transientClassified =
    error instanceof PaymentProviderOperationError &&
    error.incident.kind === 'transient_provider_error';
}
assert(transientClassified, 'Terminal discovery transport failure must be retryable without creating a payment.');

console.log('PASS: Mercado Pago terminal discovery / PDV setup tests');
