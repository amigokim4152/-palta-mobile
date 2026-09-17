import type {
  FiscalPortFactory,
  FiscalPortFactoryInput,
} from '../../fiscal/chile/businessScopedFiscalPortResolver.js';
import { FiscalProviderOperationError } from '../../fiscal/chile/fiscalProviderIncident.js';
import type { FiscalSecretStore } from '../../ports/fiscalSecretStore.js';
import {
  DteComgesAdapter,
  type DteComgesHttpClient,
} from './dteComgesAdapter.js';

export type DteComgesBaseUrls = {
  certification: string;
  production: string;
};

/**
 * Business/RUT-scoped DTE Comges factory. Canonical connection state contains
 * only an opaque credentialRef; the API key is read lazily inside the Worker.
 */
export class DteComgesPortFactory implements FiscalPortFactory {
  readonly providerKey = 'dte_comges';

  constructor(
    private readonly http: DteComgesHttpClient,
    private readonly secrets: FiscalSecretStore,
    private readonly baseUrls: DteComgesBaseUrls,
  ) {}

  async create(input: FiscalPortFactoryInput): Promise<DteComgesAdapter> {
    if (input.connection.providerKey !== this.providerKey) {
      throw new Error('DTE Comges factory received another provider connection.');
    }
    const credentialRef = input.connection.credentialRef;
    if (!credentialRef) {
      throw new FiscalProviderOperationError({
        providerKey: this.providerKey,
        incidentKind: 'configuration_error',
        message: 'DTE Comges credential reference is missing.',
      });
    }
    const baseUrl = this.baseUrls[input.connection.environment]?.trim();
    if (!baseUrl) {
      throw new FiscalProviderOperationError({
        providerKey: this.providerKey,
        incidentKind: 'configuration_error',
        message: `DTE Comges ${input.connection.environment} endpoint is not configured.`,
      });
    }

    return new DteComgesAdapter(
      this.http,
      async () => {
        let apiKey: string | null;
        try {
          apiKey = await this.secrets.readSecret({
            businessId: input.connection.businessId,
            issuerRut: input.connection.issuerRut,
            providerKey: input.connection.providerKey,
            providerConnectionId: input.connection.id,
            credentialRef,
            key: 'api_key',
          });
        } catch {
          throw new FiscalProviderOperationError({
            providerKey: this.providerKey,
            incidentKind: 'provider_unavailable',
            message: 'Fiscal credential store is temporarily unavailable.',
          });
        }
        if (!apiKey?.trim()) {
          throw new FiscalProviderOperationError({
            providerKey: this.providerKey,
            incidentKind: 'configuration_error',
            message: 'DTE Comges API key is not configured for this issuer connection.',
          });
        }
        return apiKey;
      },
      baseUrl.replace(/\/$/, ''),
    );
  }
}
