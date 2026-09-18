import type { CommerceOrder } from '../../commerce/commerceModel.js';
import type {
  HomeDataMode,
  HomeFunctionalItem,
} from '../homeFunctionalContract.js';

export type CommerceOrderFunctionalInput = {
  order: CommerceOrder;
  viewerCustomerId: string;
  dataMode: HomeDataMode;
  observedAt: string;
  expiresAt?: string;
  businessLabel?: string;
  actionTarget?: string;
};

function baseItem(
  input: CommerceOrderFunctionalInput,
  surface: HomeFunctionalItem['surface'],
  kind: HomeFunctionalItem['kind'],
  title: string,
  body?: string,
): HomeFunctionalItem {
  const item: HomeFunctionalItem = {
    id: `commerce-order-${input.order.id}`,
    surface,
    kind,
    title,
    personalized: true,
    subject: {
      kind: 'other',
      id: input.order.id,
      ...(input.businessLabel ? { label: input.businessLabel } : {}),
    },
    corrections: ['not_relevant', 'already_done', 'incorrect_information'],
    source: {
      domain: 'commerce',
      mode: input.dataMode,
      observedAt: input.observedAt,
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    },
    ...(body ? { body } : {}),
  };

  if (input.actionTarget) {
    item.action = {
      label: kind === 'action' ? 'Continuar' : 'Ver pedido',
      kind: 'internal',
      target: input.actionTarget,
    };
  }

  return item;
}

function orderLabel(input: CommerceOrderFunctionalInput): string {
  return input.businessLabel?.trim() || 'Tu pedido';
}

/**
 * Projects only the authenticated customer's canonical CommerceOrder into Home.
 * Anonymous or mismatched orders are never exposed through Personal Home.
 */
export function commerceOrderToFunctionalHome(
  input: CommerceOrderFunctionalInput,
): HomeFunctionalItem | null {
  if (input.dataMode === 'unavailable') return null;
  if (!input.viewerCustomerId.trim()) return null;
  if (!input.order.customerId || input.order.customerId !== input.viewerCustomerId) {
    return null;
  }

  const label = orderLabel(input);
  switch (input.order.status) {
    case 'created':
      // A created order can still be an abandoned/incomplete draft. Do not add
      // clutter until the commerce flow reaches a meaningful user state.
      return null;

    case 'awaiting_payment':
      return baseItem(
        input,
        'now',
        input.actionTarget ? 'action' : 'alert',
        `${label}: falta el pago`,
        'El pedido está esperando el pago para continuar.',
      );

    case 'paid':
      return baseItem(input, 'in_progress', 'status', `${label}: pago confirmado`);

    case 'accepted':
      return baseItem(input, 'in_progress', 'status', `${label}: pedido aceptado`);

    case 'preparing':
      return baseItem(input, 'in_progress', 'status', `${label}: en preparación`);

    case 'ready':
      return baseItem(
        input,
        'now',
        input.actionTarget ? 'action' : 'alert',
        `${label}: listo para retirar`,
        input.order.pickupCode
          ? `Código de retiro: ${input.order.pickupCode}`
          : 'Tu pedido ya está listo.',
      );

    case 'refund_pending':
      return baseItem(
        input,
        'in_progress',
        'status',
        `${label}: reembolso en proceso`,
      );

    case 'picked_up':
    case 'closed':
    case 'cancelled':
    case 'refunded':
      return null;
  }
}
