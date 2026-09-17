import type {
  Money,
  PaymentRail,
  PaymentStatus,
} from '../payment/paymentModel.js';

export type CreatePaymentInput = {
  canonicalPaymentId: string;
  canonicalOrderId: string;
  canonicalMerchantId: string;
  amount: Money;
  rail: PaymentRail;
  idempotencyKey: string;
  terminalId?: string;
  description?: string;
  returnUrl?: string;
  metadata?: Record<string, string>;
};

export type CreatePaymentResult = {
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

export type ProviderPaymentStatus = {
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
   * learned the provider reference. Adapters must then use a provider-safe
   * recovery mechanism (for example same-idempotency replay or terminal last-sale lookup).
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
  reconcilePayment(input: ReconcilePaymentInput): Promise<ProviderPaymentStatus>;
  refund(input: RefundInput): Promise<ProviderPaymentStatus>;
}
