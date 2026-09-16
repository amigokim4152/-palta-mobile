import type { PaymentRail } from './paymentModel.js';
import type { PaymentPort } from '../ports/paymentPort.js';

export type PaymentRoutingContext = {
  rail: PaymentRail;
  merchantProviderPreference?: string;
  allowedProviders?: readonly string[];
};

export class PaymentRouter {
  constructor(private readonly providers: readonly PaymentPort[]) {}

  select(context: PaymentRoutingContext): PaymentPort {
    const candidates = this.providers.filter((provider) => {
      if (!provider.supportsRail(context.rail)) return false;
      if (
        context.allowedProviders &&
        !context.allowedProviders.includes(provider.providerKey)
      ) {
        return false;
      }
      return true;
    });

    if (context.merchantProviderPreference) {
      const preferred = candidates.find(
        (provider) =>
          provider.providerKey === context.merchantProviderPreference,
      );
      if (preferred) return preferred;
    }

    const fallback = candidates[0];
    if (!fallback) {
      throw new Error(`No payment provider supports rail: ${context.rail}`);
    }
    return fallback;
  }
}
