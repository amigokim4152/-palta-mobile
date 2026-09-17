export type PaymentRail =
  | 'card'
  | 'wallet'
  | 'account_to_account'
  | 'cash'
  | 'other';

export type PaymentStatus =
  | 'created'
  | 'pending'
  | 'processing'
  | 'requires_action'
  | 'authorized'
  | 'paid'
  | 'declined'
  | 'unknown'
  | 'failed'
  | 'cancelled'
  | 'refund_pending'
  | 'partially_refunded'
  | 'refunded';

export type SettlementStatus =
  | 'not_applicable'
  | 'pending'
  | 'settled'
  | 'failed';

export type Money = {
  currency: 'CLP' | string;
  amountMinor: number;
};

export type PaymentIntent = {
  id: string; // canonical Palta payment ID
  orderId: string; // compatibility: canonical order ID where an order exists
  commerceTransactionId?: string; // canonical commerce transaction for POS/service/other sales
  merchantId: string; // canonical Palta merchant/business ID
  amount: Money;
  rail: PaymentRail;
  status: PaymentStatus;
  providerKey?: string;
  providerReference?: string;
  providerPaymentId?: string;
  terminalId?: string;
  authorizationCode?: string;
  cardBrand?: string;
  cardLast4?: string;
  fee?: Money;
  settlementStatus: SettlementStatus;
  settlementReference?: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
};

export type PaymentEventType =
  | 'payment_created'
  | 'payment_pending'
  | 'payment_processing'
  | 'payment_authorized'
  | 'payment_paid'
  | 'payment_declined'
  | 'payment_unknown'
  | 'payment_failed'
  | 'payment_cancelled'
  | 'refund_requested'
  | 'refund_completed'
  | 'settlement_updated';

export type PaymentEvent = {
  id: string;
  paymentIntentId: string;
  type: PaymentEventType;
  occurredAt: string;
  providerKey?: string;
  providerReference?: string;
  metadata?: Record<string, string | number | boolean | null>;
};
