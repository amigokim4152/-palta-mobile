import {
  fiscalConnectionCanPerformExternalOperation,
  type FiscalProviderConnection,
} from './fiscalProviderConnection.js';
import type {
  ExternalFiscalPortResolutionInput,
  ExternalFiscalPortResolver,
} from './fiscalOutboxHandler.js';
import type { FiscalProviderConnectionRepository } from '../../persistence/fiscalProviderConnectionRepository.js';
import type { ChileExternalFiscalPort } from '../../ports/chileExternalFiscalPort.js';

export type FiscalPortFactoryInput = {
  connection: FiscalProviderConnection;
};

export interface FiscalPortFactory {
  readonly providerKey: string;
  create(input: FiscalPortFactoryInput): Promise<ChileExternalFiscalPort>;
}

export class BusinessScopedFiscalPortResolver implements ExternalFiscalPortResolver {
  private readonly factories = new Map<string, FiscalPortFactory>();

  constructor(
    private readonly connections: FiscalProviderConnectionRepository,
    factories: readonly FiscalPortFactory[],
  ) {
    for (const factory of factories) {
      if (this.factories.has(factory.providerKey)) {
        throw new Error(`Duplicate fiscal provider factory: ${factory.providerKey}`);
      }
      this.factories.set(factory.providerKey, factory);
    }
  }

  async resolve(input: ExternalFiscalPortResolutionInput): Promise<ChileExternalFiscalPort | null> {
    const connection = await this.connections.findConnection({
      businessId: input.businessId,
      issuerRut: input.issuerRut,
      providerKey: input.providerKey,
      connectionId: input.providerConnectionId,
    });
    if (!connection) return null;
    if (
      !fiscalConnectionCanPerformExternalOperation(
        connection,
        input.environment,
        input.documentType,
      )
    ) {
      return null;
    }

    const factory = this.factories.get(input.providerKey);
    if (!factory) return null;
    const port = await factory.create({ connection });
    if (port.providerKey !== connection.providerKey) {
      throw new Error('Fiscal provider factory returned an adapter for another provider.');
    }
    return port;
  }
}
