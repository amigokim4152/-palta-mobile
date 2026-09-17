export type CommerceLineKind = 'product' | 'service' | 'custom';

export type CommerceLine = {
  id: string;
  kind: CommerceLineKind;
  title: string;
  quantity: number;
  unitAmountMinor: number;
  lineAmountMinor: number;
  productId?: string;
  variantId?: string;
  serviceId?: string;
};

export type CommerceTransactionState =
  | 'draft'
  | 'ready_for_payment'
  | 'payment_pending'
  | 'payment_confirmed'
  | 'completed'
  | 'cancelled'
  | 'refund_pending'
  | 'refunded';

export type CommerceTransaction = {
  id: string;
  businessId: string;
  idempotencyKey: string;
  state: CommerceTransactionState;
  currency: string;
  totalAmountMinor: number;
  lines: CommerceLine[];
  paymentIntentIds: string[];
  fiscalRequestIds: string[];
  inventoryReservationIds: string[];
  createdAt: string;
  updatedAt: string;
  outletId?: string;
  tradingSessionId?: string;
  operatorId?: string;
  customerId?: string;
};

const ALLOWED_TRANSITIONS: Record<CommerceTransactionState, readonly CommerceTransactionState[]> = {
  draft: ['ready_for_payment', 'cancelled'],
  ready_for_payment: ['payment_pending', 'payment_confirmed', 'cancelled'],
  payment_pending: ['payment_confirmed', 'ready_for_payment', 'cancelled'],
  payment_confirmed: ['completed', 'refund_pending'],
  completed: ['refund_pending'],
  cancelled: [],
  refund_pending: ['refunded', 'completed'],
  refunded: [],
};

export function assertMinorAmount(value: number, field = 'amount'): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative safe integer in minor units.`);
  }
}

export function calculateLineAmountMinor(quantity: number, unitAmountMinor: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('quantity must be greater than zero.');
  }
  assertMinorAmount(unitAmountMinor, 'unitAmountMinor');
  const amount = quantity * unitAmountMinor;
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error('lineAmountMinor must be a non-negative safe integer.');
  }
  return amount;
}

export function createCommerceTransaction(input: {
  id: string;
  businessId: string;
  idempotencyKey: string;
  currency?: string;
  lines: CommerceLine[];
  createdAt: string;
  outletId?: string;
  tradingSessionId?: string;
  operatorId?: string;
  customerId?: string;
}): CommerceTransaction {
  if (!input.id.trim() || !input.businessId.trim() || !input.idempotencyKey.trim()) {
    throw new Error('id, businessId and idempotencyKey are required.');
  }
  if (input.lines.length === 0) throw new Error('At least one commerce line is required.');

  let totalAmountMinor = 0;
  for (const line of input.lines) {
    const expected = calculateLineAmountMinor(line.quantity, line.unitAmountMinor);
    if (line.lineAmountMinor !== expected) {
      throw new Error(`Line ${line.id} amount does not match quantity × unit amount.`);
    }
    totalAmountMinor += line.lineAmountMinor;
  }
  assertMinorAmount(totalAmountMinor, 'totalAmountMinor');

  const transaction: CommerceTransaction = {
    id: input.id,
    businessId: input.businessId,
    idempotencyKey: input.idempotencyKey,
    state: 'draft',
    currency: input.currency ?? 'CLP',
    totalAmountMinor,
    lines: input.lines.map((line) => ({ ...line })),
    paymentIntentIds: [],
    fiscalRequestIds: [],
    inventoryReservationIds: [],
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };

  if (input.outletId !== undefined) transaction.outletId = input.outletId;
  if (input.tradingSessionId !== undefined) transaction.tradingSessionId = input.tradingSessionId;
  if (input.operatorId !== undefined) transaction.operatorId = input.operatorId;
  if (input.customerId !== undefined) transaction.customerId = input.customerId;

  return transaction;
}

export function transitionCommerceTransaction(
  transaction: CommerceTransaction,
  next: CommerceTransactionState,
  occurredAt: string,
): CommerceTransaction {
  if (!ALLOWED_TRANSITIONS[transaction.state].includes(next)) {
    throw new Error(`Invalid commerce transaction transition: ${transaction.state} -> ${next}`);
  }
  return { ...transaction, state: next, updatedAt: occurredAt };
}

export function attachPaymentIntent(
  transaction: CommerceTransaction,
  paymentIntentId: string,
  occurredAt: string,
): CommerceTransaction {
  if (transaction.paymentIntentIds.includes(paymentIntentId)) return transaction;
  return {
    ...transaction,
    paymentIntentIds: [...transaction.paymentIntentIds, paymentIntentId],
    updatedAt: occurredAt,
  };
}

export function attachFiscalRequest(
  transaction: CommerceTransaction,
  fiscalRequestId: string,
  occurredAt: string,
): CommerceTransaction {
  if (transaction.fiscalRequestIds.includes(fiscalRequestId)) return transaction;
  return {
    ...transaction,
    fiscalRequestIds: [...transaction.fiscalRequestIds, fiscalRequestId],
    updatedAt: occurredAt,
  };
}
