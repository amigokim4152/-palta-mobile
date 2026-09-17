import type { PaymentProviderConnection } from './paymentProviderConnection.js';
import { paymentConnectionCanPerformExternalOperation } from './paymentProviderConnection.js';
import type {
  PaymentPortResolutionInput,
  PaymentPortResolver,
} from './paymentOutboxHandler.js';
import type { PaymentProviderConnectionRepository } from '../persistence/paymentProviderConnectionRepository.js';
import type { PaymentPort } from '../ports/paymentPort.js';

export type PaymentPortFactoryInput = {
  connection: PaymentProviderConnection;
  terminalId?: string;
};

/**
 * Provider-specific runtime factory. It owns secret resolution from the opaque
 * connection.credentialRef and must never write credential material back into
 * canonical models/logs.
 */
export interface PaymentPortFactory {
  readonly providerKey: string;
  create(input: PaymentPortFactoryInput): Promise<PaymentPort>;
}

export class BusinessScopedPaymentPortResolver implements PaymentPortResolver {
  private readonly factories = new Map<string, PaymentPortFactory>();

  constructor(
    private readonly connections: PaymentProviderConnectionRepository,
    factories: readonly PaymentPortFactory[],
  ) {
    for (const factory of factories) {
      if (this.factories.has(factory.providerKey)) {
        throw new Error(`Duplicate payment provider factory: ${factory.providerKey}`);
      }
      this.factories.set(factory.providerKey, factory);
    }
  }

  async resolve(input: PaymentPortResolutionInput): Promise<PaymentPort | null> {
    if (!input.providerConnectionId) return null;

    const connection = await this.connections.findConnection({
      businessId: input.businessId,
      connectionId: input.providerConnectionId,
      providerKey: input.providerKey,
    });
    if (!connection) return null;
    if (!paymentConnectionCanPerformExternalOperation(connection)) return null;

    const factory = this.factories.get(input.providerKey);
    if (!factory) return null;
    const port = await factory.create({
      connection,
      ...(input.terminalId === undefined ? {} : { terminalId: input.terminalId }),
    });
    if (port.providerKey !== connection.providerKey) {
      throw new Error('Payment provider factory returned an adapter for another provider.');
    }
    return port;
  }
}
