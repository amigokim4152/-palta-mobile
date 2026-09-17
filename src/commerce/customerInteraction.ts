import { assertMinorAmount } from './transaction.js';

export type CustomerInteractionCapability =
  | 'qr_menu'
  | 'self_order'
  | 'self_pay'
  | 'group_order'
  | 'split_payment'
  | 'receipt_share';

export type CustomerInteractionConfig = {
  businessId: string;
  outletId: string;
  capabilities: ReadonlySet<CustomerInteractionCapability>;
  guestAccessAllowed: boolean;
  requireStaffAcceptance: boolean;
};

export type CustomerEntryContext = {
  id: string;
  businessId: string;
  outletId: string;
  tradingSessionId?: string;
  tableId?: string;
  opaqueEntryToken: string;
  status: 'active' | 'expired' | 'revoked';
  expiresAt?: string;
};

export type SharedOrderParticipant = {
  id: string;
  displayName?: string;
  customerId?: string;
  joinedAt: string;
  status: 'active' | 'left';
};

export type SharedOrderItem = {
  id: string;
  productOrServiceId: string;
  label: string;
  quantity: number;
  unitAmountMinor: number;
  totalAmountMinor: number;
  addedByParticipantId?: string;
};

export type SharedOrderStatus =
  | 'open'
  | 'submitted'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'payment_open'
  | 'paid'
  | 'closed'
  | 'cancelled';

export type SharedOrder = {
  id: string;
  businessId: string;
  outletId: string;
  entryContextId: string;
  currency: string;
  status: SharedOrderStatus;
  revision: number;
  participants: SharedOrderParticipant[];
  items: SharedOrderItem[];
};

export type SplitMethod = 'equal' | 'by_item' | 'custom_amount';
export type PaymentShareStatus = 'reserved' | 'paid' | 'released';

export type PaymentShare = {
  id: string;
  sharedOrderId: string;
  participantId: string;
  method: SplitMethod;
  amountMinor: number;
  itemIds: string[];
  status: PaymentShareStatus;
  paymentIntentId?: string;
};

export type FiscalGrouping =
  | 'single_sale_document'
  | 'separate_commerce_transactions';

export function assertCustomerInteractionEnabled(
  config: CustomerInteractionConfig,
  capability: CustomerInteractionCapability,
): void {
  if (!config.capabilities.has(capability)) {
    throw new Error(`Customer interaction capability ${capability} is disabled.`);
  }
}

export function createCustomerEntryContext(input: {
  id: string;
  businessId: string;
  outletId: string;
  opaqueEntryToken: string;
  tradingSessionId?: string;
  tableId?: string;
  expiresAt?: string;
}): CustomerEntryContext {
  if (!input.id.trim() || !input.businessId.trim() || !input.outletId.trim()) {
    throw new Error('Entry context id, businessId and outletId are required.');
  }
  if (input.opaqueEntryToken.trim().length < 16) {
    throw new Error('QR/customer entry token must be opaque and sufficiently long.');
  }
  const result: CustomerEntryContext = {
    id: input.id,
    businessId: input.businessId,
    outletId: input.outletId,
    opaqueEntryToken: input.opaqueEntryToken,
    status: 'active',
  };
  if (input.tradingSessionId !== undefined) result.tradingSessionId = input.tradingSessionId;
  if (input.tableId !== undefined) result.tableId = input.tableId;
  if (input.expiresAt !== undefined) result.expiresAt = input.expiresAt;
  return result;
}

export function orderTotalMinor(order: SharedOrder): number {
  const total = order.items.reduce((sum, item) => sum + item.totalAmountMinor, 0);
  assertMinorAmount(total, 'shared order total');
  return total;
}

export function unpaidAmountMinor(order: SharedOrder, shares: readonly PaymentShare[]): number {
  const committed = shares
    .filter((share) => share.status === 'reserved' || share.status === 'paid')
    .reduce((sum, share) => sum + share.amountMinor, 0);
  const remaining = orderTotalMinor(order) - committed;
  if (!Number.isSafeInteger(remaining) || remaining < 0) {
    throw new Error('Payment shares exceed the shared order total.');
  }
  return remaining;
}

function assertActiveParticipant(order: SharedOrder, participantId: string): void {
  const participant = order.participants.find((candidate) => candidate.id === participantId);
  if (!participant || participant.status !== 'active') {
    throw new Error('Payment share requires an active order participant.');
  }
}

function assertItemClaimsAvailable(
  order: SharedOrder,
  existingShares: readonly PaymentShare[],
  itemIds: readonly string[],
): number {
  if (itemIds.length === 0) throw new Error('Item split requires at least one item.');
  const uniqueIds = new Set(itemIds);
  if (uniqueIds.size !== itemIds.length) throw new Error('Item split contains duplicate item IDs.');

  const alreadyClaimed = new Set(
    existingShares
      .filter((share) => share.status === 'reserved' || share.status === 'paid')
      .flatMap((share) => share.itemIds),
  );

  let amountMinor = 0;
  for (const itemId of itemIds) {
    if (alreadyClaimed.has(itemId)) throw new Error('An order item is already reserved or paid.');
    const item = order.items.find((candidate) => candidate.id === itemId);
    if (!item) throw new Error('Payment share references an unknown order item.');
    amountMinor += item.totalAmountMinor;
  }
  assertMinorAmount(amountMinor, 'item payment share amount');
  return amountMinor;
}

export function reservePaymentShare(input: {
  id: string;
  order: SharedOrder;
  existingShares: readonly PaymentShare[];
  participantId: string;
  method: SplitMethod;
  amountMinor?: number;
  itemIds?: string[];
}): PaymentShare {
  if (input.order.status === 'paid' || input.order.status === 'closed' || input.order.status === 'cancelled') {
    throw new Error('Order is not open for new payment shares.');
  }
  assertActiveParticipant(input.order, input.participantId);
  const remaining = unpaidAmountMinor(input.order, input.existingShares);
  if (remaining <= 0) throw new Error('Order has no unpaid balance.');

  let amountMinor: number;
  let itemIds: string[] = [];

  if (input.method === 'by_item') {
    itemIds = input.itemIds ?? [];
    amountMinor = assertItemClaimsAvailable(input.order, input.existingShares, itemIds);
  } else {
    if (input.amountMinor === undefined) {
      throw new Error(`${input.method} split requires an explicit amount.`);
    }
    assertMinorAmount(input.amountMinor, 'payment share amount');
    if (input.amountMinor <= 0) throw new Error('Payment share amount must be greater than zero.');
    amountMinor = input.amountMinor;
  }

  if (amountMinor > remaining) throw new Error('Payment share exceeds the unpaid order balance.');

  return {
    id: input.id,
    sharedOrderId: input.order.id,
    participantId: input.participantId,
    method: input.method,
    amountMinor,
    itemIds,
    status: 'reserved',
  };
}

export function attachPaymentIntentToShare(
  share: PaymentShare,
  paymentIntentId: string,
): PaymentShare {
  if (share.status !== 'reserved') throw new Error('Only reserved payment shares can start payment.');
  if (!paymentIntentId.trim()) throw new Error('paymentIntentId is required.');
  return { ...share, paymentIntentId };
}

export function markPaymentSharePaid(share: PaymentShare): PaymentShare {
  if (share.status === 'paid') return share;
  if (share.status !== 'reserved' || !share.paymentIntentId) {
    throw new Error('Payment share requires a reserved payment intent before it can be paid.');
  }
  return { ...share, status: 'paid' };
}

export function releasePaymentShare(share: PaymentShare): PaymentShare {
  if (share.status === 'paid') throw new Error('Paid payment shares cannot be released.');
  if (share.status === 'released') return share;
  return { ...share, status: 'released' };
}

export function decideFiscalGrouping(input: {
  isSingleSharedSale: boolean;
  customersAreMakingIndependentPurchases: boolean;
}): FiscalGrouping {
  if (input.customersAreMakingIndependentPurchases) return 'separate_commerce_transactions';
  if (input.isSingleSharedSale) return 'single_sale_document';
  throw new Error('Fiscal grouping requires an explicit sale boundary.');
}
