import type {
  Money,
  PaymentRail,
  PaymentStatus,
} from '../payment/paymentModel.js';

export type CreatePaymentInput = {
  canonicalPaymentId: string;
  canonicalCommerceTransactionId: string;
  canonicalOrderId?: string;
  canonicalMerchantId: string;
  amount: Money;
  rail: PaymentRail;
  idempotencyKey: string;
  terminalId?: string;
  description?: string;
  returnUrl?: string;
  metadata?: Record<string, string>;
};

export type ProviderPaymentEvidence = {
  authorizationCode?: string;
  cardBrand?: string;
  cardLast4?: string;
};

export type CreatePaymentResult = ProviderPaymentEvidence & {
  providerKey: string;
  providerReference: string;
  status: PaymentStatus;
  providerPaymentId?: string;
  providerStatus?: string;
  providerStatusDetail?: string;
  checkoutUrl?: string;
  clientAction?: {
    kind: 'redirect' | 'qr' | 'native';
    value: string;
  };
};

export type ProviderPaymentStatus = ProviderPaymentEvidence & {
  providerKey: string;
  providerReference: string;
  status: PaymentStatus;
  providerPaymentId?: string;
  providerStatus?: string;
  providerStatusDetail?: string;
};

export type ReconcilePaymentInput = CreatePaymentInput & {
  /**
   * May be absent when the original create/sale response was lost before Palta
   * learned the provider reference. Adapters that expose reconcilePayment must
   * then use a provider-safe recovery mechanism, such as same-idempotency replay
   * or a terminal last-sale lookup.
   */
  providerReference?: string;
};

export type RefundInput = {
  providerReference: string;
  providerPaymentId?: string;
  amount?: Money;
  idempotencyKey: string;
};

export interface PaymentPort {
  providerKey: string;
  supportsRail(rail: PaymentRail): boolean;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  getStatus(providerReference: string): Promise<ProviderPaymentStatus>;
  /**
   * Optional capability. Not every payment provider has a safe way to recover
   * a create/sale whose response was lost before Palta learned the provider
   * reference. Orchestration must check capability presence before invoking it.
   */
  reconcilePayment?(input: ReconcilePaymentInput): Promise<ProviderPaymentStatus>;
  refund(input: RefundInput): Promise<ProviderPaymentStatus>;
}

export function supportsPaymentReconciliation(
  port: PaymentPort,
): port is PaymentPort & {
  reconcilePayment(input: ReconcilePaymentInput): Promise<ProviderPaymentStatus>;
} {
  return typeof port.reconcilePayment === 'function';
}
