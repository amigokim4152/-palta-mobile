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
  commerceTransactionId: string; // canonical commercial action being paid
  orderId?: string; // optional order context when the transaction came from an order
  merchantId: string; // canonical Palta merchant/business ID
  /** Requested amount. Never rewrite this after a provider partially approves a payment. */
  amount: Money;
  /**
   * Provider-confirmed amount actually processed/authorized for this intent when
   * the provider reports it. This is separate from the requested amount so
   * partial approvals cannot make Commerce believe the full request was paid.
   */
  processedAmount?: Money;
  rail: PaymentRail;
  status: PaymentStatus;
  /** Optimistic concurrency revision for provider callbacks/reconciliation races. */
  revision: number;
  providerKey?: string;
  /**
   * Business-scoped provider connection reference. The secret itself never lives
   * on PaymentIntent; runtime resolves this ID to credentials through a secret
   * boundary. Optional during manual/cash flows and migration, but integrated
   * provider runtimes should persist it before the external side effect.
   */
  providerConnectionId?: string;
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
  | 'payment_requires_action'
  | 'payment_authorized'
  | 'payment_paid'
  | 'payment_declined'
  | 'payment_unknown'
  | 'payment_failed'
  | 'payment_cancelled'
  | 'refund_requested'
  | 'refund_partially_completed'
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

const ALLOWED_PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  created: [
    'pending',
    'processing',
    'requires_action',
    'authorized',
    'paid',
    'declined',
    'unknown',
    'failed',
    'cancelled',
  ],
  pending: [
    'processing',
    'requires_action',
    'authorized',
    'paid',
    'declined',
    'unknown',
    'failed',
    'cancelled',
  ],
  processing: [
    'requires_action',
    'authorized',
    'paid',
    'declined',
    'unknown',
    'failed',
    'cancelled',
  ],
  requires_action: [
    'processing',
    'authorized',
    'paid',
    'declined',
    'unknown',
    'failed',
    'cancelled',
  ],
  authorized: ['paid', 'unknown', 'failed', 'cancelled'],
  paid: ['refund_pending', 'partially_refunded', 'refunded'],
  declined: [],
  unknown: [
    'pending',
    'processing',
    'requires_action',
    'authorized',
    'paid',
    'declined',
    'failed',
    'cancelled',
  ],
  failed: [],
  cancelled: [],
  refund_pending: ['paid', 'partially_refunded', 'refunded', 'unknown', 'failed'],
  partially_refunded: ['refund_pending', 'refunded'],
  refunded: [],
};

function assertRevision(revision: number): void {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error('Payment revision must be a non-negative safe integer.');
  }
}

/**
 * Applies an authoritative provider/reconciliation status without allowing a
 * stale callback to regress canonical payment state (for example paid -> processing).
 */
export function transitionPaymentIntent(
  intent: PaymentIntent,
  next: PaymentStatus,
  occurredAt: string,
): PaymentIntent {
  assertRevision(intent.revision);
  if (intent.status === next) return intent;
  if (!ALLOWED_PAYMENT_TRANSITIONS[intent.status].includes(next)) {
    throw new Error(`Invalid payment transition: ${intent.status} -> ${next}`);
  }
  return {
    ...intent,
    status: next,
    revision: intent.revision + 1,
    updatedAt: occurredAt,
  };
}

export function paymentTransitionAllowed(
  current: PaymentStatus,
  next: PaymentStatus,
): boolean {
  return current === next || ALLOWED_PAYMENT_TRANSITIONS[current].includes(next);
}
