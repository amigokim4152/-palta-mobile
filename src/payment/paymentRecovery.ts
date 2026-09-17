import type { PaymentIntent } from './paymentModel.js';
import {
  paymentRequiresOperatorAction,
  paymentRequiresReconciliation,
} from './paymentPolicy.js';
import {
  supportsPaymentReconciliation,
  type CreatePaymentInput,
  type PaymentPort,
  type ProviderPaymentStatus,
} from '../ports/paymentPort.js';

export type PaymentRecoveryMode =
  | 'none'
  | 'status_lookup'
  | 'provider_reconcile'
  | 'operator_action'
  | 'manual_review';

export type PaymentRecoveryPlan = {
  mode: PaymentRecoveryMode;
  replacementPaymentAllowed: boolean;
  automaticChargeRetryAllowed: false;
  userState:
    | 'payment_final'
    | 'payment_status_checking_do_not_retry'
    | 'check_terminal_for_final_status'
    | 'payment_manual_review_required';
};

/**
 * Determines how Palta should recover an in-flight payment without creating a
 * second charge. This function never authorizes an automatic replacement
 * payment. Replacement payment is a separate, explicit decision after the
 * previous attempt reaches an authoritative terminal state.
 */
export function planPaymentRecovery(
  intent: PaymentIntent,
  port: PaymentPort,
): PaymentRecoveryPlan {
  if (!paymentRequiresReconciliation(intent.status)) {
    return {
      mode: 'none',
      replacementPaymentAllowed:
        intent.status === 'declined' ||
        intent.status === 'failed' ||
        intent.status === 'cancelled',
      automaticChargeRetryAllowed: false,
      userState: 'payment_final',
    };
  }

  if (paymentRequiresOperatorAction(intent.status)) {
    return {
      mode: 'operator_action',
      replacementPaymentAllowed: false,
      automaticChargeRetryAllowed: false,
      userState: 'check_terminal_for_final_status',
    };
  }

  if (intent.providerReference) {
    return {
      mode: 'status_lookup',
      replacementPaymentAllowed: false,
      automaticChargeRetryAllowed: false,
      userState: 'payment_status_checking_do_not_retry',
    };
  }

  if (supportsPaymentReconciliation(port)) {
    return {
      mode: 'provider_reconcile',
      replacementPaymentAllowed: false,
      automaticChargeRetryAllowed: false,
      userState: 'payment_status_checking_do_not_retry',
    };
  }

  return {
    mode: 'manual_review',
    replacementPaymentAllowed: false,
    automaticChargeRetryAllowed: false,
    userState: 'payment_manual_review_required',
  };
}

export async function reconcilePaymentOutcome(input: {
  intent: PaymentIntent;
  port: PaymentPort;
  originalRequest: CreatePaymentInput;
}): Promise<ProviderPaymentStatus> {
  const plan = planPaymentRecovery(input.intent, input.port);

  if (plan.mode === 'status_lookup') {
    const reference = input.intent.providerReference;
    if (!reference) throw new Error('Payment recovery plan requires providerReference.');
    return input.port.getStatus(reference);
  }

  if (plan.mode === 'provider_reconcile') {
    if (!supportsPaymentReconciliation(input.port)) {
      throw new Error('Payment provider does not expose safe response-loss reconciliation.');
    }
    return input.port.reconcilePayment({
      ...input.originalRequest,
      ...(input.intent.providerReference
        ? { providerReference: input.intent.providerReference }
        : {}),
    });
  }

  if (plan.mode === 'operator_action') {
    throw new Error(
      'Payment requires operator/terminal action before automated reconciliation can continue.',
    );
  }

  if (plan.mode === 'manual_review') {
    throw new Error(
      'Payment outcome cannot be safely reconciled automatically; manual review is required.',
    );
  }

  throw new Error('Payment does not require reconciliation.');
}
