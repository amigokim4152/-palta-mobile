import { DteComgesPortFactory } from '../src/adapters/fiscal/dteComgesPortFactory.js';
import type { DteComgesHttpClient, DteComgesHttpResponse } from '../src/adapters/fiscal/dteComgesAdapter.js';
import { BusinessScopedFiscalPortResolver } from '../src/fiscal/chile/businessScopedFiscalPortResolver.js';
import type { FiscalProviderConnection } from '../src/fiscal/chile/fiscalProviderConnection.js';
import type {
  FiscalProviderConnectionLookup,
  FiscalProviderConnectionRepository,
} from '../src/persistence/fiscalProviderConnectionRepository.js';
import type { FiscalSecretLookup, FiscalSecretStore } from '../src/ports/fiscalSecretStore.js';
import type { ExternalFiscalIssueInput } from '../src/ports/chileExternalFiscalPort.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class ConnectionRepo implements FiscalProviderConnectionRepository {
  constructor(public connection: FiscalProviderConnection) {}
  async findConnection(lookup: FiscalProviderConnectionLookup) {
    const c = this.connection;
    return lookup.businessId === c.businessId &&
      lookup.issuerRut === c.issuerRut &&
      lookup.providerKey === c.providerKey &&
      lookup.connectionId === c.id
      ? { ...c, enabledDocumentTypes: [...c.enabledDocumentTypes], safeConfiguration: { ...c.safeConfiguration } }
      : null;
  }
}

class Secrets implements FiscalSecretStore {
  lastLookup?: FiscalSecretLookup;
  async readSecret(lookup: FiscalSecretLookup) {
    this.lastLookup = lookup;
    return 'DTE-COMGES-TEST-KEY';
  }
}

class Http implements DteComgesHttpClient {
  last?: { method: 'GET' | 'POST'; url: string; headers: Record<string, string>; body?: unknown };
  async request<T>(input: { method: 'GET' | 'POST'; url: string; headers: Record<string, string>; body?: unknown }): Promise<DteComgesHttpResponse<T>> {
    this.last = input;
    return {
      status: 201,
      body: {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tipoDte: 39,
        folio: 1200,
        montoNeto: 37815,
        montoIva: 7185,
        montoTotal: 45000,
        estadoSii: 'Pendiente',
      } as T,
    };
  }
}

const connection: FiscalProviderConnection = {
  id: '11111111-1111-4111-8111-111111111111',
  businessId: '22222222-2222-4222-8222-222222222222',
  issuerRut: '76123456-7',
  providerKey: 'dte_comges',
  environment: 'certification',
  status: 'ready_for_test',
  credentialRef: 'credential://fiscal/business-a/comges/1',
  enabledDocumentTypes: ['boleta_39', 'factura_33'],
  safeConfiguration: {},
  revision: 1,
  createdAt: '2026-09-17T19:20:00.000Z',
  updatedAt: '2026-09-17T19:20:00.000Z',
};
const connections = new ConnectionRepo(connection);
const secrets = new Secrets();
const http = new Http();
const factory = new DteComgesPortFactory(http, secrets, {
  certification: 'https://certification.example/api/public/v1',
  production: 'https://production.example/api/public/v1',
});
const resolver = new BusinessScopedFiscalPortResolver(connections, [factory]);

const port = await resolver.resolve({
  businessId: connection.businessId,
  issuerRut: connection.issuerRut,
  providerKey: connection.providerKey,
  providerConnectionId: connection.id,
  environment: 'certification',
  documentType: 'boleta_39',
});
assert(port !== null, 'Certification ready_for_test connection should resolve for enabled Boleta 39.');

const issue: ExternalFiscalIssueInput = {
  canonicalFiscalRequestId: '33333333-3333-4333-8333-333333333333',
  businessId: connection.businessId,
  issuerRut: connection.issuerRut,
  documentType: 'boleta_39',
  idempotencyKey: 'fiscal-provider-resolution-1',
  receiver: { rut: '66666666-6', name: 'Consumidor final' },
  lines: [{
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
  }],
  totals: { netAmountMinor: 37815, exemptAmountMinor: 0, vatAmountMinor: 7185, totalAmountMinor: 45000 },
};
await port.issue(issue);
assert(http.last?.url.startsWith('https://certification.example/'), 'Certification connection must use certification endpoint only.');
assert(http.last?.headers['X-Api-Key'] === 'DTE-COMGES-TEST-KEY', 'Provider API key must be injected only in backend HTTP header.');
assert(
  secrets.lastLookup?.businessId === connection.businessId &&
    secrets.lastLookup?.issuerRut === connection.issuerRut &&
    secrets.lastLookup?.providerConnectionId === connection.id,
  'Secret resolution must bind exact business + issuer RUT + provider connection.',
);

const wrongEnvironment = await resolver.resolve({
  businessId: connection.businessId,
  issuerRut: connection.issuerRut,
  providerKey: connection.providerKey,
  providerConnectionId: connection.id,
  environment: 'production',
  documentType: 'boleta_39',
});
assert(wrongEnvironment === null, 'Certification connection must never satisfy production runtime resolution.');

connections.connection = {
  ...connection,
  environment: 'production',
  status: 'ready_for_test',
};
const unconnectedProduction = await resolver.resolve({
  businessId: connection.businessId,
  issuerRut: connection.issuerRut,
  providerKey: connection.providerKey,
  providerConnectionId: connection.id,
  environment: 'production',
  documentType: 'boleta_39',
});
assert(unconnectedProduction === null, 'Production fiscal execution must require connected provider status.');

connections.connection = {
  ...connection,
  environment: 'production',
  status: 'connected',
  enabledDocumentTypes: ['boleta_39'],
};
const disabledFactura = await resolver.resolve({
  businessId: connection.businessId,
  issuerRut: connection.issuerRut,
  providerKey: connection.providerKey,
  providerConnectionId: connection.id,
  environment: 'production',
  documentType: 'factura_33',
});
assert(disabledFactura === null, 'Provider connection must not issue a DTE type that is not explicitly enabled.');

console.log('PASS: business/RUT/environment-scoped fiscal provider resolution tests');
