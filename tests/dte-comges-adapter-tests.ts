import {
  DteComgesAdapter,
  classifyDteComgesHttpFailure,
  type DteComgesHttpClient,
  type DteComgesHttpResponse,
} from '../src/adapters/fiscal/dteComgesAdapter.js';
import { FiscalProviderOperationError } from '../src/fiscal/chile/fiscalProviderIncident.js';
import type { ExternalFiscalIssueInput } from '../src/ports/chileExternalFiscalPort.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type Request = {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  body?: unknown;
};

class QueueHttpClient implements DteComgesHttpClient {
  readonly requests: Request[] = [];
  private readonly responses: Array<DteComgesHttpResponse<unknown>>;

  constructor(responses: Array<DteComgesHttpResponse<unknown>>) {
    this.responses = [...responses];
  }

  async request<T>(input: Request): Promise<DteComgesHttpResponse<T>> {
    this.requests.push(input);
    const response = this.responses.shift();
    if (!response) throw new Error('No queued DTE Comges response.');
    return response as DteComgesHttpResponse<T>;
  }
}

const boleta: ExternalFiscalIssueInput = {
  canonicalFiscalRequestId: '11111111-1111-4111-8111-111111111111',
  businessId: '22222222-2222-4222-8222-222222222222',
  issuerRut: '76123456-7',
  documentType: 'boleta_39',
  idempotencyKey: 'fiscal-sale-1',
  receiver: {
    rut: '66666666-6',
    name: 'Consumidor final',
  },
  lines: [
    {
      id: 'line-1',
      description: 'Jardinería',
      quantity: 1,
      unitCode: 'UN',
      unitNetAmountMinor: 37815,
      unitGrossAmountMinor: 45000,
      lineNetAmountMinor: 37815,
      lineExemptAmountMinor: 0,
      lineVatAmountMinor: 7185,
      lineTotalAmountMinor: 45000,
      exempt: false,
    },
  ],
  totals: {
    netAmountMinor: 37815,
    exemptAmountMinor: 0,
    vatAmountMinor: 7185,
    totalAmountMinor: 45000,
  },
};

assert(classifyDteComgesHttpFailure(400) === 'validation_error', '400 must be a request-validation incident.');
assert(classifyDteComgesHttpFailure(401) === 'authentication_error', '401 must be an API-key authentication incident.');
assert(classifyDteComgesHttpFailure(403) === 'configuration_error', '403 must route to issuer/plan/type configuration handling.');
assert(classifyDteComgesHttpFailure(429) === 'rate_limited', '429 must be backoff/retryable.');
assert(classifyDteComgesHttpFailure(503) === 'provider_unavailable', '5xx must not be treated as fiscal rejection.');

const createdHttp = new QueueHttpClient([
  {
    status: 201,
    body: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      tipoDte: 39,
      folio: 1048,
      ambiente: 'Certificacion',
      montoNeto: 37815,
      montoIva: 7185,
      montoTotal: 45000,
      estadoSii: 'Pendiente',
      trackId: null,
      ted: '<TED version="1.0">signed</TED>',
      xmlUrl: 'https://signed.example/xml',
      pdfUrl: 'https://signed.example/pdf',
    },
  },
]);
const adapter = new DteComgesAdapter(createdHttp, async () => 'pk_test_business_a');
const created = await adapter.issue(boleta);
assert(created.status === 'pending_authority', 'A created DTE with SII Pendiente must remain pending authority, not accepted.');
assert(created.providerReference === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Provider DTE ID must be retained for polling.');
assert(created.folio === 1048, 'Definitive provider folio must be persisted.');
assert(created.tedXml?.includes('TED'), 'One-shot TED evidence must be preserved from the issue response.');
assert(created.canonicalTotalsMatch === true, 'Provider-computed totals must be reconciled against canonical fiscal totals.');
const createRequest = createdHttp.requests[0];
assert(createRequest?.url.endsWith('/dte'), 'Initial national DTE issue must use POST /dte.');
assert(createRequest?.headers['X-Api-Key'] === 'pk_test_business_a', 'Fiscal API key may exist only in the backend request header.');
const body = createRequest?.body as {
  transactionId?: string;
  tipoDte?: number;
  receptor?: { rut?: string; razonSocial?: string };
  detalles?: Array<{ precioUnitario?: number; unidadMedida?: string }>;
};
assert(body.transactionId === boleta.canonicalFiscalRequestId, 'Provider transactionId must be the stable canonical FiscalRequest UUID.');
assert(body.tipoDte === 39, 'Boleta canonical type must map to SII/DTE code 39.');
assert(body.detalles?.[0]?.precioUnitario === 37815, 'DTE Comges boleta must receive the NET unit price, never customer gross price.');
assert(body.detalles?.[0]?.unidadMedida === 'UN', 'SII-compatible unit code must be forwarded.');

const queuedHttp = new QueueHttpClient([
  {
    status: 202,
    body: {
      ticketId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      estado: 'Pendiente',
      posicionEnCola: 1,
      documentoId: null,
      esErrorTerminal: false,
      mensaje: 'No hay folios disponibles; se solicitaron al SII.',
    },
  },
]);
const queuedAdapter = new DteComgesAdapter(queuedHttp, async () => 'pk_test_business_a');
const queued = await queuedAdapter.issue(boleta);
assert(queued.status === 'queued', 'HTTP 202 due to missing folio is a durable queued state, not a failure.');
assert(queued.queueTicketReference === 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '202 ticket ID must be retained for reconciliation.');
assert(queued.providerReference === undefined && queued.folio === undefined, 'Queued result must not fabricate document ID or folio.');

const reconcileHttp = new QueueHttpClient([
  {
    status: 200,
    body: {
      ticketId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      estado: 'Completado',
      documentoId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      esErrorTerminal: false,
    },
  },
  {
    status: 200,
    body: {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      tipoDte: 39,
      folio: 1049,
      montoNeto: 37815,
      montoIva: 7185,
      montoTotal: 45000,
      estadoSii: 'Aceptado',
      trackId: 'TRACK-1049',
      ted: null,
      xmlUrl: 'https://signed.example/xml-1049',
      pdfUrl: 'https://signed.example/pdf-1049',
    },
  },
]);
const reconcileAdapter = new DteComgesAdapter(reconcileHttp, async () => 'pk_test_business_a');
const reconciled = await reconcileAdapter.reconcile({
  queueTicketReference: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
});
assert(reconciled.status === 'accepted', 'Completed ticket must resolve to the authoritative document/SII state.');
assert(reconciled.providerReference === 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Completed queue must switch to permanent provider document ID.');
assert(reconcileHttp.requests[0]?.url.includes('/dte/pendientes/'), 'Queued reconciliation must query pending ticket first.');
assert(reconcileHttp.requests[1]?.url.endsWith('/dte/cccccccc-cccc-4ccc-8ccc-cccccccccccc'), 'Completed ticket must then query permanent DTE state.');

let replayCalls = 0;
const replayHttp: DteComgesHttpClient = {
  async request<T>(input: Request): Promise<DteComgesHttpResponse<T>> {
    replayCalls += 1;
    const replayBody = input.body as { transactionId?: string };
    assert(replayBody.transactionId === boleta.canonicalFiscalRequestId, 'Response-loss replay must reuse exactly the same provider transactionId.');
    return {
      status: 201,
      body: {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        tipoDte: 39,
        folio: 1050,
        montoNeto: 37815,
        montoIva: 7185,
        montoTotal: 45000,
        estadoSii: 'Pendiente',
      } as T,
    };
  },
};
const replayAdapter = new DteComgesAdapter(replayHttp, async () => 'pk_test_business_a');
const replayed = await replayAdapter.reconcile({ originalIssue: boleta });
assert(replayCalls === 1 && replayed.providerReference === 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Unknown POST outcome must recover only by exact idempotent replay, never a replacement issue.');

const factura: ExternalFiscalIssueInput = {
  ...boleta,
  canonicalFiscalRequestId: '33333333-3333-4333-8333-333333333333',
  documentType: 'factura_33',
  receiver: {
    rut: '96790240-3',
    name: 'Cliente Ejemplo S.A.',
    giro: 'Comercio al por mayor',
    address: 'Av. Providencia 1234',
    commune: 'Providencia',
  },
};
const facturaHttp = new QueueHttpClient([
  {
    status: 201,
    body: {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      tipoDte: 33,
      folio: 200,
      montoNeto: 37815,
      montoIva: 7185,
      montoTotal: 45000,
      estadoSii: 'Pendiente',
    },
  },
]);
await new DteComgesAdapter(facturaHttp, async () => 'pk_test_business_a').issue(factura);
const facturaBody = facturaHttp.requests[0]?.body as {
  tipoDte?: number;
  receptor?: { giro?: string; direccion?: string; comuna?: string };
};
assert(facturaBody.tipoDte === 33, 'Factura canonical type must map to DTE code 33.');
assert(
  facturaBody.receptor?.giro === factura.receiver.giro &&
    facturaBody.receptor?.direccion === factura.receiver.address &&
    facturaBody.receptor?.comuna === factura.receiver.commune,
  'Factura 33 must include required business receiver fields.',
);

let missingFacturaReceiverBlocked = false;
try {
  await new DteComgesAdapter(new QueueHttpClient([]), async () => 'pk_test_business_a').issue({
    ...factura,
    receiver: { rut: '96790240-3', name: 'Cliente sin giro' },
  });
} catch {
  missingFacturaReceiverBlocked = true;
}
assert(missingFacturaReceiverBlocked, 'Factura 33 missing giro/address/commune must fail before provider HTTP/folio consumption.');

const transportUnknown: DteComgesHttpClient = {
  async request() {
    throw new Error('response lost');
  },
};
let unknownClassified = false;
try {
  await new DteComgesAdapter(transportUnknown, async () => 'pk_test_business_a').issue(boleta);
} catch (error) {
  unknownClassified =
    error instanceof FiscalProviderOperationError &&
    error.incident.kind === 'outcome_unknown' &&
    error.incident.requiresReconciliation;
}
assert(unknownClassified, 'Lost issue response must become outcome_unknown and block replacement issuance.');

console.log('PASS: DTE Comges Boleta 39 / Factura 33 adapter reliability tests');
