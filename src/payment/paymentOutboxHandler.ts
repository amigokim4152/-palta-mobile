import type { CommerceOutboxEvent } from '../commerce/outbox.js';
import type { PaymentRepository } from '../persistence/paymentRepository.js';
import type {
  CreatePaymentInput,
  PaymentPort,
  ProviderPaymentStatus,
} from '../ports/paymentPort.js';
import type {
  OutboxEventHandler,
  OutboxHandlerResult,
} from '../runtime/outboxConsumer.js';
import { PaymentProviderOperationError } from './paymentIncident.js';
import {
  transitionPaymentIntent,
  type Money,
  type PaymentEvent,
  type PaymentEventType,
  type PaymentIntent,
  type PaymentStatus,
} from './paymentModel.js';
import {
  paymentRequiresOperatorAction,
  paymentRequiresReconciliation,
} from './paymentPolicy.js';
import { reconcilePaymentOutcome } from './paymentRecovery.js';

export type PaymentPortResolutionInput = {
  businessId: string;
  providerKey: string;
  providerConnectionId?: string;
  terminalId?: string;
};

export interface PaymentPortResolver {
  /**
   * Resolve the provider adapter for this exact business connection. Production
   * implementations may load connection metadata and secret references from DB
   * / secret storage, so resolution is intentionally asynchronous.
   */
  resolve(input: PaymentPortResolutionInput): Promise<PaymentPort | null>;
}

/**
 * Test/local resolver only. Production multi-merchant runtimes should use a
 * business-scoped resolver instead of sharing one credentialed adapter globally.
 */
export class StaticPaymentPortResolver implements PaymentPortResolver {
  private readonly byKey = new Map<string, PaymentPort>();

  constructor(ports: readonly PaymentPort[]) {
    for (const port of ports) {
      if (this.byKey.has(port.providerKey)) {
        throw new Error(`Duplicate payment provider key: ${port.providerKey}`);
      }
      this.byKey.set(port.providerKey, port);
    }
  }

  async resolve(input: PaymentPortResolutionInput): Promise<PaymentPort | null> {
    return this.byKey.get(input.providerKey) ?? null;
  }
}

export type PaymentWorkerIdFactory = {
  paymentEventId(): string;
};

const RETRY_SECONDS = [2, 5, 15, 30, 60, 120, 300] as const;

function retryAt(now: string, attempts: number): string {
  const parsed = Date.parse(now);
  if (Number.isNaN(parsed)) throw new Error('Payment worker now must be a valid timestamp.');
  const index = Math.min(Math.max(attempts - 1, 0), RETRY_SECONDS.length - 1);
  const seconds = RETRY_SECONDS[index] ?? 300;
  return new Date(parsed + seconds * 1000).toISOString();
}

function retryable(
  event: CommerceOutboxEvent,
  now: string,
  errorCode: string,
): OutboxHandlerResult {
  return {
    kind: 'retryable',
    nextAttemptAt: retryAt(now, event.attempts),
    errorCode,
  };
}

function paymentIntentId(event: CommerceOutboxEvent): string {
  if (event.aggregateType !== 'payment_intent') {
    throw new Error('Payment worker received a non-payment Outbox aggregate.');
  }
  const payloadId = event.payload.paymentIntentId;
  if (payloadId !== undefined && payloadId !== event.aggregateId) {
    throw new Error('Payment Outbox payload identity does not match aggregate ID.');
  }
  return event.aggregateId;
}

function createInput(intent: PaymentIntent): CreatePaymentInput {
  const input: CreatePaymentInput = {
    canonicalPaymentId: intent.id,
    canonicalCommerceTransactionId: intent.commerceTransactionId,
    canonicalMerchantId: intent.merchantId,
    amount: { ...intent.amount },
    rail: intent.rail,
    idempotencyKey: intent.idempotencyKey,
  };
  if (intent.orderId !== undefined) input.canonicalOrderId = intent.orderId;
  if (intent.terminalId !== undefined) input.terminalId = intent.terminalId;
  return input;
}

function eventTypeForStatus(status: PaymentStatus): PaymentEventType {
  switch (status) {
    case 'created':
      return 'payment_created';
    case 'pending':
      return 'payment_pending';
    case 'processing':
      return 'payment_processing';
    case 'requires_action':
      return 'payment_requires_action';
    case 'authorized':
      return 'payment_authorized';
    case 'paid':
      return 'payment_paid';
    case 'declined':
      return 'payment_declined';
    case 'unknown':
      return 'payment_unknown';
    case 'failed':
      return 'payment_failed';
    case 'cancelled':
      return 'payment_cancelled';
    case 'refund_pending':
      return 'refund_requested';
    case 'partially_refunded':
      return 'refund_partially_completed';
    case 'refunded':
      return 'refund_completed';
  }
}

function sameMoney(left: Money | undefined, right: Money | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.currency === right.currency && left.amountMinor === right.amountMinor;
}

function validatedProcessedAmount(
  intent: PaymentIntent,
  result: ProviderPaymentStatus,
): Money | undefined {
  const amount = result.processedAmount;
  if (amount === undefined) return undefined;
  if (amount.currency !== intent.amount.currency) {
    throw new Error('Provider processed amount currency does not match requested payment currency.');
  }
  if (!Number.isSafeInteger(amount.amountMinor) || amount.amountMinor <= 0) {
    throw new Error('Provider processed amount must be a positive safe integer in minor units.');
  }
  return { ...amount };
}

function evidenceChanged(
  intent: PaymentIntent,
  result: ProviderPaymentStatus,
): boolean {
  return (
    intent.providerKey !== result.providerKey ||
    intent.providerReference !== result.providerReference ||
    intent.providerPaymentId !== result.providerPaymentId ||
    intent.authorizationCode !== result.authorizationCode ||
    intent.cardBrand !== result.cardBrand ||
    intent.cardLast4 !== result.cardLast4 ||
    (result.processedAmount !== undefined && !sameMoney(intent.processedAmount, result.processedAmount))
  );
}

function applyProviderResult(
  intent: PaymentIntent,
  result: ProviderPaymentStatus,
  occurredAt: string,
): PaymentIntent {
  if (intent.providerKey !== undefined && intent.providerKey !== result.providerKey) {
    throw new Error('Provider response belongs to a different configured payment provider.');
  }
  if (!result.providerReference.trim()) {
    throw new Error('Provider payment result requires providerReference.');
  }

  const processedAmount = validatedProcessedAmount(intent, result);
  const statusChanged = intent.status !== result.status;
  const changedEvidence = evidenceChanged(intent, result);
  if (!statusChanged && !changedEvidence) return intent;

  const transitioned = statusChanged
    ? transitionPaymentIntent(intent, result.status, occurredAt)
    : {
        ...intent,
        revision: intent.revision + 1,
        updatedAt: occurredAt,
      };

  const updated: PaymentIntent = {
    ...transitioned,
    providerKey: result.providerKey,
    providerReference: result.providerReference,
  };
  if (result.providerPaymentId !== undefined) updated.providerPaymentId = result.providerPaymentId;
  if (result.authorizationCode !== undefined) updated.authorizationCode = result.authorizationCode;
  if (result.cardBrand !== undefined) updated.cardBrand = result.cardBrand;
  if (result.cardLast4 !== undefined) updated.cardLast4 = result.cardLast4;
  if (processedAmount !== undefined) updated.processedAmount = processedAmount;
  return updated;
}

function syntheticStatus(
  intent: PaymentIntent,
  status: PaymentStatus,
  occurredAt: string,
): PaymentIntent {
  if (intent.status === status) return intent;
  return transitionPaymentIntent(intent, status, occurredAt);
}

function paymentEvent(input: {
  id: string;
  intent: PaymentIntent;
  result?: ProviderPaymentStatus;
  occurredAt: string;
  errorCode?: string;
}): PaymentEvent {
  const metadata: NonNullable<PaymentEvent['metadata']> = {};
  if (input.result?.providerStatus !== undefined) {
    metadata.providerStatus = input.result.providerStatus;
  }
  if (input.result?.providerStatusDetail !== undefined) {
    metadata.providerStatusDetail = input.result.providerStatusDetail;
  }
  if (input.result?.processedAmount !== undefined) {
    metadata.processedAmountMinor = input.result.processedAmount.amountMinor;
    metadata.processedAmountCurrency = input.result.processedAmount.currency;
  }
  if (input.errorCode !== undefined) metadata.errorCode = input.errorCode;

  const event: PaymentEvent = {
    id: input.id,
    paymentIntentId: input.intent.id,
    type: eventTypeForStatus(input.intent.status),
    occurredAt: input.occurredAt,
  };
  if (input.intent.providerKey !== undefined) event.providerKey = input.intent.providerKey;
  if (input.intent.providerReference !== undefined) {
    event.providerReference = input.intent.providerReference;
  }
  if (Object.keys(metadata).length > 0) event.metadata = metadata;
  return event;
}

export class PaymentOutboxHandler implements OutboxEventHandler {
  constructor(
    private readonly payments: PaymentRepository,
    private readonly providers: PaymentPortResolver,
    private readonly ids: PaymentWorkerIdFactory,
    private readonly now: () => string,
  ) {}

  async handle(event: CommerceOutboxEvent): Promise<OutboxHandlerResult> {
    if (!event.eventType.startsWith('payment.')) {
      return { kind: 'dead_letter', errorCode: 'unsupported_payment_event_type' };
    }

    const id = paymentIntentId(event);
    const intent = await this.payments.findIntent({
      businessId: event.businessId,
      paymentIntentId: id,
    });
    if (!intent) return { kind: 'dead_letter', errorCode: 'payment_intent_not_found' };
    if (intent.merchantId !== event.businessId) {
      return { kind: 'dead_letter', errorCode: 'payment_business_mismatch' };
    }
    if (!intent.providerKey) {
      return { kind: 'dead_letter', errorCode: 'payment_provider_not_selected' };
    }
    const port = await this.providers.resolve({
      businessId: intent.merchantId,
      providerKey: intent.providerKey,
      ...(intent.providerConnectionId === undefined
        ? {}
        : { providerConnectionId: intent.providerConnectionId }),
      ...(intent.terminalId === undefined ? {} : { terminalId: intent.terminalId }),
    });
    if (!port) return { kind: 'dead_letter', errorCode: 'payment_provider_adapter_missing' };
    if (port.providerKey !== intent.providerKey) {
      return { kind: 'dead_letter', errorCode: 'payment_provider_resolution_mismatch' };
    }

    if (!paymentRequiresReconciliation(intent.status) && intent.status !== 'created') {
      return { kind: 'delivered' };
    }
    if (paymentRequiresOperatorAction(intent.status)) {
      return { kind: 'dead_letter', errorCode: 'payment_operator_action_required' };
    }

    const occurredAt = this.now();
    try {
      const providerResult = intent.status === 'created'
        ? await port.createPayment(createInput(intent))
        : await reconcilePaymentOutcome({
            intent,
            port,
            originalRequest: createInput(intent),
          });

      const updated = applyProviderResult(intent, providerResult, occurredAt);
      if (updated !== intent) {
        await this.payments.commitIntentAndEvent({
          intent: updated,
          expectedRevision: intent.revision,
          event: paymentEvent({
            id: this.ids.paymentEventId(),
            intent: updated,
            result: providerResult,
            occurredAt,
          }),
        });
      }

      if (paymentRequiresOperatorAction(updated.status)) {
        return { kind: 'dead_letter', errorCode: 'payment_operator_action_required' };
      }
      if (paymentRequiresReconciliation(updated.status)) {
        return retryable(event, occurredAt, 'payment_status_not_final');
      }
      return { kind: 'delivered' };
    } catch (error) {
      if (!(error instanceof PaymentProviderOperationError)) throw error;
      return this.handleProviderError({ event, intent, error, occurredAt });
    }
  }

  private async handleProviderError(input: {
    event: CommerceOutboxEvent;
    intent: PaymentIntent;
    error: PaymentProviderOperationError;
    occurredAt: string;
  }): Promise<OutboxHandlerResult> {
    const { recovery } = input.error.incident;
    const code = input.error.incident.kind;

    if (
      recovery === 'retry_same_operation_same_key' ||
      recovery === 'wait_and_retry_same_operation_same_key'
    ) {
      return retryable(input.event, input.occurredAt, code);
    }

    let targetStatus: PaymentStatus;
    let outcome: OutboxHandlerResult;

    if (recovery === 'operator_check_terminal') {
      targetStatus = 'requires_action';
      outcome = { kind: 'dead_letter', errorCode: code };
    } else if (recovery === 'fix_configuration' || recovery === 'fix_request') {
      targetStatus = 'failed';
      outcome = { kind: 'dead_letter', errorCode: code };
    } else if (recovery === 'allow_new_payment') {
      targetStatus = 'declined';
      outcome = { kind: 'delivered' };
    } else if (recovery === 'manual_review') {
      targetStatus = 'unknown';
      outcome = { kind: 'dead_letter', errorCode: code };
    } else {
      targetStatus = 'unknown';
      outcome = retryable(input.event, input.occurredAt, code);
    }

    const updated = syntheticStatus(input.intent, targetStatus, input.occurredAt);
    if (updated !== input.intent) {
      await this.payments.commitIntentAndEvent({
        intent: updated,
        expectedRevision: input.intent.revision,
        event: paymentEvent({
          id: this.ids.paymentEventId(),
          intent: updated,
          occurredAt: input.occurredAt,
          errorCode: code,
        }),
      });
    }

    return outcome;
  }
}
