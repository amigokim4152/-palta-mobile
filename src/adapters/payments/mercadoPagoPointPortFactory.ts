import type {
  PaymentPortFactory,
  PaymentPortFactoryInput,
} from '../../payment/businessScopedPaymentPortResolver.js';
import { PaymentProviderOperationError } from '../../payment/paymentIncident.js';
import type { PaymentSecretStore } from '../../ports/paymentSecretStore.js';
import {
  MercadoPagoPointAdapter,
  type JsonHttpClient,
} from './mercadoPagoPointAdapter.js';

/**
 * Business-scoped Mercado Pago Point adapter factory.
 *
 * The canonical connection contains only an opaque credentialRef. The token is
 * read lazily for each provider operation so secret rotation does not require
 * rewriting PaymentIntent or restarting the domain core.
 */
export class MercadoPagoPointPortFactory implements PaymentPortFactory {
  readonly providerKey = 'mercadopago_point';

  constructor(
    private readonly http: JsonHttpClient,
    private readonly secrets: PaymentSecretStore,
    private readonly baseUrl = 'https://api.mercadopago.com',
  ) {}

  async create(input: PaymentPortFactoryInput): Promise<MercadoPagoPointAdapter> {
    if (input.connection.providerKey !== this.providerKey) {
      throw new Error('Mercado Pago factory received another provider connection.');
    }
    const credentialRef = input.connection.credentialRef;
    if (!credentialRef) {
      throw new PaymentProviderOperationError({
        providerKey: this.providerKey,
        incidentKind: 'configuration_error',
        message: 'Mercado Pago credential reference is missing.',
      });
    }

    return new MercadoPagoPointAdapter(
      this.http,
      async () => {
        let token: string | null;
        try {
          token = await this.secrets.readSecret({
            credentialRef,
            key: 'access_token',
          });
        } catch {
          // No provider side effect has occurred yet, therefore retrying the same
          // canonical operation/idempotency key is safe after secret-store recovery.
          throw new PaymentProviderOperationError({
            providerKey: this.providerKey,
            incidentKind: 'transient_provider_error',
            message: 'Mercado Pago credential store is temporarily unavailable.',
          });
        }
        if (!token?.trim()) {
          throw new PaymentProviderOperationError({
            providerKey: this.providerKey,
            incidentKind: 'configuration_error',
            message: 'Mercado Pago access token is not configured for this business connection.',
          });
        }
        return token;
      },
      this.baseUrl,
    );
  }
}
