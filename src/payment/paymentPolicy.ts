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

export function paymentIsAuthoritativelyPaid(status: PaymentStatus): boolean {
  return status === 'paid';
}

export function paymentRequiresReconciliation(status: PaymentStatus): boolean {
  return (
    status === 'pending' ||
    status === 'processing' ||
    status === 'authorized' ||
    status === 'unknown'
  );
}

export function canCreateReplacementPayment(status: PaymentStatus): boolean {
  return status === 'declined' || status === 'failed' || status === 'cancelled';
}

export function assertSafeReplacementPayment(status: PaymentStatus): void {
  if (paymentRequiresReconciliation(status)) {
    throw new Error(
      `Payment status ${status} must be reconciled before creating a replacement payment.`,
    );
  }
  if (!canCreateReplacementPayment(status)) {
    throw new Error(`Payment status ${status} does not allow a replacement payment.`);
  }
}
