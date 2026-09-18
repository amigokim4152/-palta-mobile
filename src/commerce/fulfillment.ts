import type { CommerceOrder } from './commerceModel.js';

export type FulfillmentMethod =
  | 'pickup'
  | 'merchant_delivery'
  | 'external_delivery'
  | 'palta_delivery';

export type DeliveryFulfillmentMethod = Exclude<FulfillmentMethod, 'pickup'>;

export type FulfillmentQuoteSource =
  | 'merchant_rule'
  | 'merchant_quote'
  | 'external_provider_quote'
  | 'palta_rule';

export type FulfillmentDestination = Readonly<{
  lat: number;
  lng: number;
  addressLabel: string;
  instructions?: string;
}>;

export type FulfillmentQuote = Readonly<{
  id: string;
  businessId: string;
  outletId: string;
  method: FulfillmentMethod;
  serviceable: boolean;
  currency: string;
  feeAmountMinor: number;
  source: FulfillmentQuoteSource;
  estimatedMinutesMin?: number;
  estimatedMinutesMax?: number;
  expiresAt?: string;
  providerReference?: string;
}>;

export type FulfillmentStatus =
  | 'planned'
  | 'ready_for_handoff'
  | 'assigned'
  | 'in_transit'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type FulfillmentPlan = Readonly<{
  id: string;
  orderId: string;
  businessId: string;
  outletId: string;
  method: FulfillmentMethod;
  status: FulfillmentStatus;
  quoteId?: string;
  destination?: FulfillmentDestination;
  courierReference?: string;
  providerReference?: string;
  feeAmountMinor: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  failureCode?: string;
}>;

export type FulfillmentTransition =
  | 'mark_ready'
  | 'assign'
  | 'start_transit'
  | 'complete'
  | 'cancel'
  | 'fail';

export function isDeliveryFulfillmentMethod(
  method: FulfillmentMethod,
): method is DeliveryFulfillmentMethod {
  return method !== 'pickup';
}

export function validateFulfillmentQuote(quote: FulfillmentQuote, now?: string): void {
  if (!quote.id.trim() || !quote.businessId.trim() || !quote.outletId.trim()) {
    throw new Error('fulfillment_quote_identity_required');
  }
  if (!quote.currency.trim() || quote.feeAmountMinor < 0) {
    throw new Error('fulfillment_quote_money_invalid');
  }
  if (quote.estimatedMinutesMin !== undefined && quote.estimatedMinutesMin < 0) {
    throw new Error('fulfillment_quote_eta_invalid');
  }
  if (
    quote.estimatedMinutesMax !== undefined &&
    (quote.estimatedMinutesMin === undefined || quote.estimatedMinutesMax < quote.estimatedMinutesMin)
  ) {
    throw new Error('fulfillment_quote_eta_invalid');
  }
  if (now && quote.expiresAt && Date.parse(quote.expiresAt) <= Date.parse(now)) {
    throw new Error('fulfillment_quote_expired');
  }
}

export function createFulfillmentPlan(input: {
  id: string;
  order: CommerceOrder;
  method: FulfillmentMethod;
  createdAt: string;
  quote?: FulfillmentQuote;
  destination?: FulfillmentDestination;
}): FulfillmentPlan {
  if (!input.id.trim()) throw new Error('fulfillment_plan_id_required');
  if (input.quote) {
    validateFulfillmentQuote(input.quote, input.createdAt);
    if (!input.quote.serviceable) throw new Error('fulfillment_quote_not_serviceable');
    if (input.quote.businessId !== input.order.businessId || input.quote.outletId !== input.order.outletId) {
      throw new Error('fulfillment_quote_scope_mismatch');
    }
    if (input.quote.method !== input.method) throw new Error('fulfillment_quote_method_mismatch');
  }
  if (isDeliveryFulfillmentMethod(input.method) && !input.destination) {
    throw new Error('delivery_destination_required');
  }
  if (input.destination) validateDestination(input.destination);

  const currency = input.quote?.currency ?? input.order.currency;
  if (currency !== input.order.currency) throw new Error('fulfillment_currency_mismatch');

  const plan: FulfillmentPlan = {
    id: input.id,
    orderId: input.order.id,
    businessId: input.order.businessId,
    outletId: input.order.outletId,
    method: input.method,
    status: 'planned',
    feeAmountMinor: input.quote?.feeAmountMinor ?? 0,
    currency,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    ...(input.quote ? { quoteId: input.quote.id } : {}),
    ...(input.destination ? { destination: { ...input.destination } } : {}),
    ...(input.quote?.providerReference ? { providerReference: input.quote.providerReference } : {}),
  };
  return plan;
}

function validateDestination(destination: FulfillmentDestination): void {
  if (!Number.isFinite(destination.lat) || destination.lat < -90 || destination.lat > 90) {
    throw new Error('fulfillment_destination_lat_invalid');
  }
  if (!Number.isFinite(destination.lng) || destination.lng < -180 || destination.lng > 180) {
    throw new Error('fulfillment_destination_lng_invalid');
  }
  if (!destination.addressLabel.trim()) throw new Error('fulfillment_destination_label_required');
}

const ALLOWED_TRANSITIONS: Readonly<Record<FulfillmentStatus, readonly FulfillmentTransition[]>> = {
  planned: ['mark_ready', 'assign', 'cancel', 'fail'],
  ready_for_handoff: ['assign', 'start_transit', 'complete', 'cancel', 'fail'],
  assigned: ['mark_ready', 'start_transit', 'cancel', 'fail'],
  in_transit: ['complete', 'fail'],
  completed: [],
  cancelled: [],
  failed: [],
};

export function transitionFulfillment(
  plan: FulfillmentPlan,
  transition: FulfillmentTransition,
  input: {
    updatedAt: string;
    courierReference?: string;
    failureCode?: string;
  },
): FulfillmentPlan {
  if (!ALLOWED_TRANSITIONS[plan.status].includes(transition)) {
    throw new Error(`fulfillment_transition_not_allowed:${plan.status}:${transition}`);
  }

  if (transition === 'mark_ready') {
    return { ...plan, status: 'ready_for_handoff', updatedAt: input.updatedAt };
  }
  if (transition === 'assign') {
    if (plan.method === 'pickup') throw new Error('pickup_cannot_assign_courier');
    if (!input.courierReference?.trim()) throw new Error('courier_reference_required');
    return {
      ...plan,
      status: 'assigned',
      courierReference: input.courierReference,
      updatedAt: input.updatedAt,
    };
  }
  if (transition === 'start_transit') {
    if (plan.method === 'pickup') throw new Error('pickup_cannot_start_transit');
    return { ...plan, status: 'in_transit', updatedAt: input.updatedAt };
  }
  if (transition === 'complete') {
    return {
      ...plan,
      status: 'completed',
      updatedAt: input.updatedAt,
      completedAt: input.updatedAt,
    };
  }
  if (transition === 'cancel') {
    return { ...plan, status: 'cancelled', updatedAt: input.updatedAt };
  }
  if (!input.failureCode?.trim()) throw new Error('fulfillment_failure_code_required');
  return {
    ...plan,
    status: 'failed',
    failureCode: input.failureCode,
    updatedAt: input.updatedAt,
  };
}

export function fulfillmentCanCloseOrder(plan: FulfillmentPlan): boolean {
  return plan.status === 'completed';
}
