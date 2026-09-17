import { assertMinorAmount } from './transaction.js';

export type PaymentProvider =
  | 'manual_terminal'
  | 'mercadopago'
  | 'transbank'
  | 'sumup'
  | 'getnet'
  | 'other';

export type PaymentIntentStatus =
  | 'created'
  | 'pending_terminal'
  | 'processing'
  | 'approved'
  | 'declined'
  | 'cancelled'
  | 'unknown'
  | 'refund_pending'
  | 'refunded'
  | 'failed';

export type PaymentIntent = {
  id: string;
  businessId: string;
  transactionId: string;
  provider: PaymentProvider;
  idempotencyKey: string;
  amountMinor: number;
  currency: string;
  status: PaymentIntentStatus;
  requestedAt: string;
  updatedAt: string;
  terminalId?: string;
  providerPaymentId?: string;
  providerReference?: string;
  authorizationCode?: string;
  cardBrand?: string;
  cardLast4?: string;
  errorCode?: string;
  errorMessage?: string;
};

export type PaymentProviderResult = {
  status: Exclude<PaymentIntentStatus, 'created' | 'refund_pending' | 'refunded'>;
  observedAt: string;
  providerPaymentId?: string;
  providerReference?: string;
  authorizationCode?: string;
  cardBrand?: string;
  cardLast4?: string;
  errorCode?: string;
  errorMessage?: string;
};

export type PaymentInitiationRequest = {
  paymentIntentId: string;
  businessId: string;
  transactionId: string;
  idempotencyKey: string;
  amountMinor: number;
  currency: string;
  terminalId?: string;
};

export interface PaymentAdapter {
  readonly provider: PaymentProvider;
  initiate(request: PaymentInitiationRequest): Promise<PaymentProviderResult>;
  reconcile(intent: PaymentIntent): Promise<PaymentProviderResult>;
  refund(intent: PaymentIntent, amountMinor: number, idempotencyKey: string): Promise<PaymentProviderResult>;
}

export function createPaymentIntent(input: {
  id: string;
  businessId: string;
  transactionId: string;
  provider: PaymentProvider;
  idempotencyKey: string;
  amountMinor: number;
  currency?: string;
  requestedAt: string;
  terminalId?: string;
}): PaymentIntent {
  assertMinorAmount(input.amountMinor, 'payment amount');
  if (!input.id.trim() || !input.businessId.trim() || !input.transactionId.trim() || !input.idempotencyKey.trim()) {
    throw new Error('Payment intent identity fields are required.');
  }

  const intent: PaymentIntent = {
    id: input.id,
    businessId: input.businessId,
    transactionId: input.transactionId,
    provider: input.provider,
    idempotencyKey: input.idempotencyKey,
    amountMinor: input.amountMinor,
    currency: input.currency ?? 'CLP',
    status: 'created',
    requestedAt: input.requestedAt,
    updatedAt: input.requestedAt,
  };
  if (input.terminalId !== undefined) intent.terminalId = input.terminalId;
  return intent;
}

export function applyPaymentProviderResult(
  intent: PaymentIntent,
  result: PaymentProviderResult,
): PaymentIntent {
  if (intent.status === 'approved' && result.status !== 'approved') {
    throw new Error('Approved payment cannot be downgraded by a later provider observation.');
  }
  if (intent.status === 'refunded') {
    throw new Error('Refunded payment is terminal.');
  }

  const next: PaymentIntent = {
    ...intent,
    status: result.status,
    updatedAt: result.observedAt,
  };

  const optional: Array<keyof Pick<
    PaymentIntent,
    'providerPaymentId' | 'providerReference' | 'authorizationCode' | 'cardBrand' | 'cardLast4' | 'errorCode' | 'errorMessage'
  >> = [
    'providerPaymentId',
    'providerReference',
    'authorizationCode',
    'cardBrand',
    'cardLast4',
    'errorCode',
    'errorMessage',
  ];

  for (const key of optional) {
    const value = result[key];
    if (value !== undefined) next[key] = value;
  }

  return next;
}

export function paymentIsAuthoritativelyApproved(intent: PaymentIntent): boolean {
  return intent.status === 'approved';
}

export function paymentRequiresReconciliation(intent: PaymentIntent): boolean {
  return intent.status === 'unknown' || intent.status === 'processing' || intent.status === 'pending_terminal';
}

export function canCreateReplacementPayment(intent: PaymentIntent): boolean {
  return intent.status === 'declined' || intent.status === 'cancelled' || intent.status === 'failed';
}

export function beginRefund(intent: PaymentIntent, occurredAt: string): PaymentIntent {
  if (intent.status !== 'approved') throw new Error('Only an approved payment can enter refund_pending.');
  return { ...intent, status: 'refund_pending', updatedAt: occurredAt };
}

export function completeRefund(intent: PaymentIntent, occurredAt: string): PaymentIntent {
  if (intent.status !== 'refund_pending') throw new Error('Refund must be pending before it can complete.');
  return { ...intent, status: 'refunded', updatedAt: occurredAt };
}
