export type RuntimeHealth = 'healthy' | 'degraded' | 'unavailable';

export type CommerceRuntimeDependencies = {
  database: RuntimeHealth;
  asyncQueue: RuntimeHealth;
  paymentProvider: RuntimeHealth;
  sii: RuntimeHealth;
  objectStorage: RuntimeHealth;
  localJournal: RuntimeHealth;
};

export type CommerceRuntimePolicyInput = {
  dependencies: CommerceRuntimeDependencies;
  offlineManualSalesAllowed: boolean;
  fiscalDeferralAllowed: boolean;
};

export type CommerceOperation =
  | 'record_sale'
  | 'integrated_payment'
  | 'manual_payment_record'
  | 'fiscal_enqueue'
  | 'fiscal_send'
  | 'fiscal_archive'
  | 'refund'
  | 'close_session';

export type RuntimeDecision = 'allow' | 'allow_degraded' | 'block';

export type CommerceRuntimeDecision = {
  decision: RuntimeDecision;
  reason:
    | 'healthy'
    | 'queue_degraded_outbox_durable'
    | 'local_journal_only'
    | 'payment_provider_unavailable'
    | 'database_required'
    | 'sii_deferred'
    | 'sii_required'
    | 'archive_deferred'
    | 'archive_required';
  userState:
    | 'normal'
    | 'saved_locally_pending_sync'
    | 'payment_unavailable_choose_other_method'
    | 'service_temporarily_unavailable'
    | 'fiscal_pending'
    | 'fiscal_archive_pending';
};

function databaseIsUsable(health: RuntimeHealth): boolean {
  return health !== 'unavailable';
}

function queueDegradesButDoesNotBlock(
  input: CommerceRuntimePolicyInput,
): CommerceRuntimeDecision | null {
  if (input.dependencies.asyncQueue !== 'healthy') {
    return {
      decision: 'allow_degraded',
      reason: 'queue_degraded_outbox_durable',
      userState: 'normal',
    };
  }
  return null;
}

export function decideCommerceRuntimeOperation(
  operation: CommerceOperation,
  input: CommerceRuntimePolicyInput,
): CommerceRuntimeDecision {
  const { dependencies } = input;

  if (operation === 'integrated_payment') {
    if (!databaseIsUsable(dependencies.database)) {
      return {
        decision: 'block',
        reason: 'database_required',
        userState: 'service_temporarily_unavailable',
      };
    }
    if (dependencies.paymentProvider === 'unavailable') {
      return {
        decision: 'block',
        reason: 'payment_provider_unavailable',
        userState: 'payment_unavailable_choose_other_method',
      };
    }
    return queueDegradesButDoesNotBlock(input) ?? {
      decision: dependencies.paymentProvider === 'degraded' ? 'allow_degraded' : 'allow',
      reason: 'healthy',
      userState: 'normal',
    };
  }

  if (operation === 'refund') {
    if (!databaseIsUsable(dependencies.database)) {
      return {
        decision: 'block',
        reason: 'database_required',
        userState: 'service_temporarily_unavailable',
      };
    }
    if (dependencies.paymentProvider === 'unavailable') {
      return {
        decision: 'block',
        reason: 'payment_provider_unavailable',
        userState: 'service_temporarily_unavailable',
      };
    }
    return queueDegradesButDoesNotBlock(input) ?? {
      decision: dependencies.paymentProvider === 'degraded' ? 'allow_degraded' : 'allow',
      reason: 'healthy',
      userState: 'normal',
    };
  }

  if (operation === 'record_sale' || operation === 'manual_payment_record') {
    if (databaseIsUsable(dependencies.database)) {
      return queueDegradesButDoesNotBlock(input) ?? {
        decision: dependencies.database === 'degraded' ? 'allow_degraded' : 'allow',
        reason: 'healthy',
        userState: 'normal',
      };
    }

    if (
      input.offlineManualSalesAllowed &&
      dependencies.localJournal !== 'unavailable'
    ) {
      return {
        decision: 'allow_degraded',
        reason: 'local_journal_only',
        userState: 'saved_locally_pending_sync',
      };
    }

    return {
      decision: 'block',
      reason: 'database_required',
      userState: 'service_temporarily_unavailable',
    };
  }

  if (operation === 'fiscal_enqueue') {
    if (!databaseIsUsable(dependencies.database)) {
      return {
        decision: 'block',
        reason: 'database_required',
        userState: 'service_temporarily_unavailable',
      };
    }

    if (dependencies.sii === 'unavailable' && input.fiscalDeferralAllowed) {
      return {
        decision: 'allow_degraded',
        reason: 'sii_deferred',
        userState: 'fiscal_pending',
      };
    }

    if (dependencies.sii === 'unavailable' && !input.fiscalDeferralAllowed) {
      return {
        decision: 'block',
        reason: 'sii_required',
        userState: 'service_temporarily_unavailable',
      };
    }

    return queueDegradesButDoesNotBlock(input) ?? {
      decision: dependencies.sii === 'degraded' ? 'allow_degraded' : 'allow',
      reason: 'healthy',
      userState: 'normal',
    };
  }

  if (operation === 'fiscal_send') {
    if (!databaseIsUsable(dependencies.database)) {
      return {
        decision: 'block',
        reason: 'database_required',
        userState: 'service_temporarily_unavailable',
      };
    }

    if (dependencies.sii === 'unavailable') {
      return input.fiscalDeferralAllowed
        ? {
            decision: 'allow_degraded',
            reason: 'sii_deferred',
            userState: 'fiscal_pending',
          }
        : {
            decision: 'block',
            reason: 'sii_required',
            userState: 'service_temporarily_unavailable',
          };
    }

    return {
      decision: dependencies.sii === 'degraded' ? 'allow_degraded' : 'allow',
      reason: 'healthy',
      userState: dependencies.sii === 'degraded' ? 'fiscal_pending' : 'normal',
    };
  }

  if (operation === 'fiscal_archive') {
    if (!databaseIsUsable(dependencies.database)) {
      return {
        decision: 'block',
        reason: 'database_required',
        userState: 'service_temporarily_unavailable',
      };
    }
    if (dependencies.objectStorage === 'unavailable') {
      return {
        decision: 'allow_degraded',
        reason: 'archive_deferred',
        userState: 'fiscal_archive_pending',
      };
    }
    return {
      decision: dependencies.objectStorage === 'degraded' ? 'allow_degraded' : 'allow',
      reason: 'healthy',
      userState: dependencies.objectStorage === 'degraded' ? 'fiscal_archive_pending' : 'normal',
    };
  }

  if (operation === 'close_session') {
    if (!databaseIsUsable(dependencies.database)) {
      return {
        decision: 'block',
        reason: 'database_required',
        userState: 'service_temporarily_unavailable',
      };
    }
    return {
      decision: dependencies.database === 'degraded' ? 'allow_degraded' : 'allow',
      reason: 'healthy',
      userState: 'normal',
    };
  }

  return {
    decision: 'block',
    reason: 'database_required',
    userState: 'service_temporarily_unavailable',
  };
}
