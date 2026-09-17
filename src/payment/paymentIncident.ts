export type PaymentIncidentKind =
  | 'definitive_decline'
  | 'outcome_unknown'
  | 'provider_unavailable'
  | 'transient_provider_error'
  | 'rate_limited'
  | 'terminal_busy'
  | 'terminal_action_required'
  | 'configuration_error'
  | 'validation_error'
  | 'idempotency_conflict'
  | 'cancel_conflict'
  | 'refund_unknown'
  | 'provider_error';

export type PaymentRecoveryAction =
  | 'allow_new_payment'
  | 'reconcile_first'
  | 'retry_same_operation_same_key'
  | 'wait_and_retry_same_operation_same_key'
  | 'operator_check_terminal'
  | 'fix_configuration'
  | 'fix_request'
  | 'manual_review';

export type PaymentUserState =
  | 'payment_declined_choose_other_method'
  | 'payment_status_checking_do_not_retry'
  | 'payment_service_temporarily_unavailable'
  | 'payment_wait_then_retry'
  | 'terminal_busy_finish_previous_payment'
  | 'check_terminal_for_final_status'
  | 'payment_configuration_attention'
  | 'payment_request_problem'
  | 'payment_manual_review_required'
  | 'refund_status_checking';

export type PaymentIncident = {
  kind: PaymentIncidentKind;
  recovery: PaymentRecoveryAction;
  userState: PaymentUserState;
  replacementPaymentAllowed: boolean;
  automaticRetryAllowed: boolean;
  requiresReconciliation: boolean;
};

const INCIDENTS: Record<PaymentIncidentKind, PaymentIncident> = {
  definitive_decline: {
    kind: 'definitive_decline',
    recovery: 'allow_new_payment',
    userState: 'payment_declined_choose_other_method',
    replacementPaymentAllowed: true,
    automaticRetryAllowed: false,
    requiresReconciliation: false,
  },
  outcome_unknown: {
    kind: 'outcome_unknown',
    recovery: 'reconcile_first',
    userState: 'payment_status_checking_do_not_retry',
    replacementPaymentAllowed: false,
    automaticRetryAllowed: false,
    requiresReconciliation: true,
  },
  provider_unavailable: {
    kind: 'provider_unavailable',
    recovery: 'reconcile_first',
    userState: 'payment_status_checking_do_not_retry',
    replacementPaymentAllowed: false,
    automaticRetryAllowed: false,
    requiresReconciliation: true,
  },
  transient_provider_error: {
    kind: 'transient_provider_error',
    recovery: 'retry_same_operation_same_key',
    userState: 'payment_wait_then_retry',
    replacementPaymentAllowed: false,
    automaticRetryAllowed: true,
    requiresReconciliation: false,
  },
  rate_limited: {
    kind: 'rate_limited',
    recovery: 'wait_and_retry_same_operation_same_key',
    userState: 'payment_wait_then_retry',
    replacementPaymentAllowed: false,
    automaticRetryAllowed: true,
    requiresReconciliation: false,
  },
  terminal_busy: {
    kind: 'terminal_busy',
    recovery: 'operator_check_terminal',
    userState: 'terminal_busy_finish_previous_payment',
    replacementPaymentAllowed: false,
    automaticRetryAllowed: false,
    requiresReconciliation: true,
  },
  terminal_action_required: {
    kind: 'terminal_action_required',
    recovery: 'operator_check_terminal',
    userState: 'check_terminal_for_final_status',
    replacementPaymentAllowed: false,
    automaticRetryAllowed: false,
    requiresReconciliation: true,
  },
  configuration_error: {
    kind: 'configuration_error',
    recovery: 'fix_configuration',
    userState: 'payment_configuration_attention',
    replacementPaymentAllowed: false,
    automaticRetryAllowed: false,
    requiresReconciliation: false,
  },
  validation_error: {
    kind: 'validation_error',
    recovery: 'fix_request',
    userState: 'payment_request_problem',
    replacementPaymentAllowed: false,
    automaticRetryAllowed: false,
    requiresReconciliation: false,
  },
  idempotency_conflict: {
    kind: 'idempotency_conflict',
    recovery: 'manual_review',
    userState: 'payment_manual_review_required',
    replacementPaymentAllowed: false,
    automaticRetryAllowed: false,
    requiresReconciliation: true,
  },
  cancel_conflict: {
    kind: 'cancel_conflict',
    recovery: 'operator_check_terminal',
    userState: 'check_terminal_for_final_status',
    replacementPaymentAllowed: false,
    automaticRetryAllowed: false,
    requiresReconciliation: true,
  },
  refund_unknown: {
    kind: 'refund_unknown',
    recovery: 'reconcile_first',
    userState: 'refund_status_checking',
    replacementPaymentAllowed: false,
    automaticRetryAllowed: false,
    requiresReconciliation: true,
  },
  provider_error: {
    kind: 'provider_error',
    recovery: 'manual_review',
    userState: 'payment_service_temporarily_unavailable',
    replacementPaymentAllowed: false,
    automaticRetryAllowed: false,
    requiresReconciliation: true,
  },
};

export function paymentIncident(kind: PaymentIncidentKind): PaymentIncident {
  return { ...INCIDENTS[kind] };
}

export class PaymentProviderOperationError extends Error {
  readonly incident: PaymentIncident;
  readonly providerKey: string;
  readonly providerCode?: string;
  readonly httpStatus?: number;

  constructor(input: {
    providerKey: string;
    incidentKind: PaymentIncidentKind;
    message: string;
    providerCode?: string;
    httpStatus?: number;
  }) {
    super(input.message);
    this.name = 'PaymentProviderOperationError';
    this.providerKey = input.providerKey;
    this.incident = paymentIncident(input.incidentKind);
    if (input.providerCode !== undefined) this.providerCode = input.providerCode;
    if (input.httpStatus !== undefined) this.httpStatus = input.httpStatus;
  }
}
