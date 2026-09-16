import type { CommerceOrderStatus } from '../commerce/commerceModel.js';
import type { PaymentStatus } from './paymentModel.js';

export function orderStatusAfterPayment(
  current: CommerceOrderStatus,
  payment: PaymentStatus,
): CommerceOrderStatus {
  if (payment === 'paid' && current === 'awaiting_payment') return 'paid';
  if (
    payment === 'refunded' &&
    (current === 'refund_pending' ||
      current === 'cancelled' ||
      current === 'closed')
  ) {
    return 'refunded';
  }
  if (payment === 'refund_pending') return 'refund_pending';
  return current;
}

export function paymentRequiredForAdvance(
  orderStatus: CommerceOrderStatus,
): boolean {
  return orderStatus === 'awaiting_payment';
}
