import type { CommerceOutboxEvent } from '../commerce/outbox.js';
import {
  transitionCommerceTransaction,
  type CommerceTransaction,
  type CommerceTransactionState,
} from '../commerce/transaction.js';
import {
  calculatePaymentCoverage,
  canOpenSplitPaymentAttempt,
  projectCommercePaymentState,
} from '../payment/paymentCoverage.js';
import type {
  PaymentEvent,
  PaymentIntent,
  PaymentRail,
  PaymentStatus,
  SettlementStatus,
} from '../payment/paymentModel.js';
import {
  CommercePaymentAllocationError,
  type CommercePaymentAllocation,
  type CommercePaymentAllocationResult,
  type CommercePaymentCoordinatorRepository,
  type CommercePaymentProjectionRequest,
  type CommercePaymentProjectionResult,
} from './commercePaymentCoordinatorRepository.js';
import type { SqlDatabase, SqlExecutor } from './sqlDatabase.js';

type CommerceLockRow = {
  id: string;
  business_id: string;
  idempotency_key: string;
  state: CommerceTransactionState;
  currency: string;
  total_amount_minor: number | string;
  revision: number | string;
  created_at: string;
  updated_at: string;
};

type PaymentRow = {
  id: string;
  business_id: string;
  commerce_transaction_id: string;
  order_id: string | null;
  idempotency_key: string;
  amount_minor: number | string;
  processed_amount_minor: number | string | null;
  currency: string;
  rail: PaymentRail;
  status: PaymentStatus;
  provider_key: string | null;
  provider_connection_id: string | null;
  provider_reference: string | null;
  provider_payment_id: string | null;
  terminal_id: string | null;
  authorization_code: string | null;
  card_brand: string | null;
  card_last4: string | null;
  fee_minor: number | string | null;
  settlement_status: SettlementStatus;
  settlement_reference: string | null;
  revision: number | string;
  created_at: string;
  updated_at: string;
};

type IdRow = { id: string };

const COVERAGE_PAYMENT_COLUMNS = `
  id, business_id, commerce_transaction_id, order_id, idempotency_key,
  amount_minor, processed_amount_minor, currency, rail, status,
  provider_key, provider_connection_id, provider_reference, provider_payment_id,
  terminal_id, authorization_code, card_brand, card_last4, fee_minor,
  settlement_status, settlement_reference, revision, created_at, updated_at
`;

function safeInteger(value: number | string, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${field} is outside Palta safe-integer range.`);
  }
  return parsed;
}

function positiveInteger(value: number | string, field: string): number {
  const parsed = safeInteger(value, field);
  if (parsed <= 0) throw new Error(`${field} must be greater than zero.`);
  return parsed;
}

function rowToCommerce(row: CommerceLockRow): CommerceTransaction {
  return {
    id: row.id,
    businessId: row.business_id,
    idempotencyKey: row.idempotency_key,
    revision: safeInteger(row.revision, 'commerce revision'),
    state: row.state,
    currency: row.currency,
    totalAmountMinor: safeInteger(row.total_amount_minor, 'commerce total_amount_minor'),
    // Coverage/state projection never rewrites lines. They are intentionally not
    // loaded into this lock-focused repository.
    lines: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToPayment(row: PaymentRow): PaymentIntent {
  const intent: PaymentIntent = {
    id: row.id,
    commerceTransactionId: row.commerce_transaction_id,
    merchantId: row.business_id,
    amount: {
      currency: row.currency,
      amountMinor: positiveInteger(row.amount_minor, 'payment amount_minor'),
    },
    rail: row.rail,
    status: row.status,
    revision: safeInteger(row.revision, 'payment revision'),
    settlementStatus: row.settlement_status,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.processed_amount_minor !== null) {
    intent.processedAmount = {
      currency: row.currency,
      amountMinor: positiveInteger(row.processed_amount_minor, 'payment processed_amount_minor'),
    };
  }
  if (row.order_id !== null) intent.orderId = row.order_id;
  if (row.provider_key !== null) intent.providerKey = row.provider_key;
  if (row.provider_connection_id !== null) intent.providerConnectionId = row.provider_connection_id;
  if (row.provider_reference !== null) intent.providerReference = row.provider_reference;
  if (row.provider_payment_id !== null) intent.providerPaymentId = row.provider_payment_id;
  if (row.terminal_id !== null) intent.terminalId = row.terminal_id;
  if (row.authorization_code !== null) intent.authorizationCode = row.authorization_code;
  if (row.card_brand !== null) intent.cardBrand = row.card_brand;
  if (row.card_last4 !== null) intent.cardLast4 = row.card_last4;
  if (row.fee_minor !== null) {
    intent.fee = {
      currency: row.currency,
      amountMinor: safeInteger(row.fee_minor, 'payment fee_minor'),
    };
  }
  if (row.settlement_reference !== null) intent.settlementReference = row.settlement_reference;
  return intent;
}

async function lockCommerce(
  tx: SqlExecutor,
  businessId: string,
  transactionId: string,
): Promise<CommerceTransaction> {
  const result = await tx.query<CommerceLockRow>(
    `select id, business_id, idempotency_key, state, currency,
            total_amount_minor, revision, created_at, updated_at
       from commerce_transaction
      where business_id = $1 and id = $2
      for update`,
    [businessId, transactionId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new CommercePaymentAllocationError(
      'commerce_transaction_not_found',
      'CommerceTransaction was not found for payment coordination.',
    );
  }
  return rowToCommerce(row);
}

async function listPayments(
  tx: SqlExecutor,
  businessId: string,
  transactionId: string,
): Promise<PaymentIntent[]> {
  const result = await tx.query<PaymentRow>(
    `select ${COVERAGE_PAYMENT_COLUMNS}
       from payment_intent
      where business_id = $1 and commerce_transaction_id = $2
      order by created_at asc, id asc`,
    [businessId, transactionId],
  );
  return result.rows.map(rowToPayment);
}

function validateNewAllocation(allocation: CommercePaymentAllocation): void {
  const { intent, event, providerOutboxEvent } = allocation;
  if (intent.status !== 'created' || intent.revision !== 0 || intent.processedAmount !== undefined) {
    throw new Error('New coordinated PaymentIntent must be created at revision 0 without processed evidence.');
  }
  if (!intent.providerKey?.trim()) {
    throw new Error('Integrated PaymentIntent requires providerKey before durable allocation.');
  }
  if (!Number.isSafeInteger(intent.amount.amountMinor) || intent.amount.amountMinor <= 0) {
    throw new Error('Integrated PaymentIntent amount must be a positive safe integer.');
  }
  if (event.paymentIntentId !== intent.id || event.type !== 'payment_created') {
    throw new Error('Payment allocation event must be payment_created for the same PaymentIntent.');
  }
  if (
    providerOutboxEvent.businessId !== intent.merchantId ||
    providerOutboxEvent.aggregateType !== 'payment_intent' ||
    providerOutboxEvent.aggregateId !== intent.id ||
    providerOutboxEvent.eventType !== 'payment.create' ||
    providerOutboxEvent.status !== 'pending' ||
    providerOutboxEvent.attempts !== 0
  ) {
    throw new Error('Payment provider Outbox event does not match coordinated PaymentIntent creation.');
  }
}

function sameAllocation(existing: PaymentIntent, requested: PaymentIntent): boolean {
  return (
    existing.id === requested.id &&
    existing.merchantId === requested.merchantId &&
    existing.commerceTransactionId === requested.commerceTransactionId &&
    existing.idempotencyKey === requested.idempotencyKey &&
    existing.amount.currency === requested.amount.currency &&
    existing.amount.amountMinor === requested.amount.amountMinor &&
    existing.rail === requested.rail &&
    existing.providerKey === requested.providerKey &&
    existing.providerConnectionId === requested.providerConnectionId &&
    existing.terminalId === requested.terminalId
  );
}

async function findPaymentByIdempotency(
  tx: SqlExecutor,
  businessId: string,
  idempotencyKey: string,
): Promise<PaymentIntent | null> {
  const result = await tx.query<PaymentRow>(
    `select ${COVERAGE_PAYMENT_COLUMNS}
       from payment_intent
      where business_id = $1 and idempotency_key = $2
      for update`,
    [businessId, idempotencyKey],
  );
  return result.rows[0] ? rowToPayment(result.rows[0]) : null;
}

async function insertPayment(
  tx: SqlExecutor,
  intent: PaymentIntent,
): Promise<PaymentIntent> {
  const result = await tx.query<PaymentRow>(
    `insert into payment_intent (
       id, business_id, commerce_transaction_id, order_id, idempotency_key,
       amount_minor, processed_amount_minor, currency, rail, status,
       provider_key, provider_connection_id, provider_reference, provider_payment_id,
       terminal_id, authorization_code, card_brand, card_last4, fee_minor,
       settlement_status, settlement_reference, revision, created_at, updated_at
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
     ) returning ${COVERAGE_PAYMENT_COLUMNS}`,
    [
      intent.id,
      intent.merchantId,
      intent.commerceTransactionId,
      intent.orderId ?? null,
      intent.idempotencyKey,
      intent.amount.amountMinor,
      null,
      intent.amount.currency,
      intent.rail,
      intent.status,
      intent.providerKey ?? null,
      intent.providerConnectionId ?? null,
      null,
      null,
      intent.terminalId ?? null,
      null,
      null,
      null,
      null,
      intent.settlementStatus,
      null,
      intent.revision,
      intent.createdAt,
      intent.updatedAt,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Coordinated PaymentIntent insert did not return a row.');
  return rowToPayment(row);
}

async function insertPaymentEvent(
  tx: SqlExecutor,
  businessId: string,
  event: PaymentEvent,
): Promise<void> {
  await tx.query<IdRow>(
    `insert into payment_event (
       id, business_id, payment_intent_id, event_type, occurred_at,
       provider_key, provider_reference, metadata
     ) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
    [
      event.id,
      businessId,
      event.paymentIntentId,
      event.type,
      event.occurredAt,
      event.providerKey ?? null,
      event.providerReference ?? null,
      JSON.stringify(event.metadata ?? {}),
    ],
  );
}

async function insertOutbox(
  tx: SqlExecutor,
  event: CommerceOutboxEvent,
  allowReplay: boolean,
): Promise<boolean> {
  const conflictClause = allowReplay
    ? 'on conflict (business_id, idempotency_key) do nothing'
    : '';
  const result = await tx.query<IdRow>(
    `insert into commerce_outbox (
       id, business_id, aggregate_type, aggregate_id, event_type,
       idempotency_key, payload, status, attempts, next_attempt_at,
       last_error_code, created_at, updated_at
     ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13)
     ${conflictClause}
     returning id`,
    [
      event.id,
      event.businessId,
      event.aggregateType,
      event.aggregateId,
      event.eventType,
      event.idempotencyKey,
      JSON.stringify(event.payload),
      event.status,
      event.attempts,
      event.nextAttemptAt ?? null,
      event.lastError ?? null,
      event.createdAt,
      event.updatedAt,
    ],
  );
  return result.rowCount === 1;
}

async function persistCommerceState(
  tx: SqlExecutor,
  current: CommerceTransaction,
  nextState: CommerceTransactionState,
  occurredAt: string,
): Promise<CommerceTransaction> {
  if (current.state === nextState) return current;
  const next = transitionCommerceTransaction(current, nextState, occurredAt);
  const result = await tx.query<{ id: string }>(
    `update commerce_transaction
        set state = $4, revision = $5, updated_at = $6
      where business_id = $1 and id = $2 and revision = $3
      returning id`,
    [
      current.businessId,
      current.id,
      current.revision,
      next.state,
      next.revision,
      next.updatedAt,
    ],
  );
  if (result.rowCount !== 1) {
    throw new Error('Locked CommerceTransaction revision changed unexpectedly during payment coordination.');
  }
  return next;
}

function validateConfirmedOutbox(
  request: CommercePaymentProjectionRequest,
): void {
  const event = request.confirmedOutboxEvent;
  if (
    event.businessId !== request.businessId ||
    event.aggregateType !== 'commerce_transaction' ||
    event.aggregateId !== request.commerceTransactionId ||
    event.eventType !== 'commerce.payment_confirmed' ||
    event.status !== 'pending' ||
    event.attempts !== 0 ||
    !event.idempotencyKey.trim()
  ) {
    throw new Error('Commerce payment confirmation Outbox event does not match projection request.');
  }
}

export class PostgresCommercePaymentCoordinator
implements CommercePaymentCoordinatorRepository {
  constructor(private readonly db: SqlDatabase) {}

  async allocatePayment(
    allocation: CommercePaymentAllocation,
  ): Promise<CommercePaymentAllocationResult> {
    validateNewAllocation(allocation);
    const requested = allocation.intent;

    return this.db.transaction(async (tx) => {
      let commerce = await lockCommerce(
        tx,
        requested.merchantId,
        requested.commerceTransactionId,
      );

      const existing = await findPaymentByIdempotency(
        tx,
        requested.merchantId,
        requested.idempotencyKey,
      );
      if (existing) {
        if (!sameAllocation(existing, requested)) {
          throw new CommercePaymentAllocationError(
            'payment_idempotency_conflict',
            'Payment idempotency key is already bound to a different allocation.',
          );
        }
        const intents = await listPayments(tx, requested.merchantId, requested.commerceTransactionId);
        const coverage = calculatePaymentCoverage({ transaction: commerce, intents });
        return {
          intent: existing,
          coverage,
          commerceState: commerce.state,
          replayed: true,
        };
      }

      if (!['ready_for_payment', 'payment_pending', 'partially_paid'].includes(commerce.state)) {
        throw new CommercePaymentAllocationError(
          'commerce_state_not_payable',
          `CommerceTransaction state ${commerce.state} does not accept a new payment allocation.`,
        );
      }
      if (commerce.currency !== requested.amount.currency) {
        throw new Error('Payment allocation currency does not match CommerceTransaction.');
      }

      const beforeIntents = await listPayments(
        tx,
        requested.merchantId,
        requested.commerceTransactionId,
      );
      const beforeCoverage = calculatePaymentCoverage({
        transaction: commerce,
        intents: beforeIntents,
      });
      const decision = canOpenSplitPaymentAttempt({
        coverage: beforeCoverage,
        proposedAmountMinor: requested.amount.amountMinor,
      });
      if (!decision.allowed) {
        throw new CommercePaymentAllocationError(
          decision.reason === 'coverage_requires_review'
            ? 'payment_coverage_requires_review'
            : 'payment_allocation_exceeds_balance',
          `Payment allocation rejected: ${decision.reason}.`,
        );
      }

      const inserted = await insertPayment(tx, requested);
      await insertPaymentEvent(tx, inserted.merchantId, allocation.event);
      await insertOutbox(tx, allocation.providerOutboxEvent, false);

      const afterIntents = [...beforeIntents, inserted];
      const projection = projectCommercePaymentState({
        transaction: commerce,
        intents: afterIntents,
      });
      commerce = await persistCommerceState(
        tx,
        commerce,
        projection.state,
        inserted.updatedAt,
      );

      return {
        intent: inserted,
        coverage: projection.coverage,
        commerceState: commerce.state,
        replayed: false,
      };
    });
  }

  async projectCoverage(
    request: CommercePaymentProjectionRequest,
  ): Promise<CommercePaymentProjectionResult> {
    if (!request.businessId.trim() || !request.commerceTransactionId.trim()) {
      throw new Error('Commerce payment projection requires business and transaction IDs.');
    }
    if (Number.isNaN(Date.parse(request.occurredAt))) {
      throw new Error('Commerce payment projection occurredAt must be a valid timestamp.');
    }
    validateConfirmedOutbox(request);

    return this.db.transaction(async (tx) => {
      let commerce = await lockCommerce(
        tx,
        request.businessId,
        request.commerceTransactionId,
      );
      const intents = await listPayments(tx, request.businessId, request.commerceTransactionId);
      const projection = projectCommercePaymentState({ transaction: commerce, intents });

      if (commerce.state === 'completed' && projection.state === 'payment_confirmed') {
        return {
          commerceState: commerce.state,
          coverage: projection.coverage,
          changed: false,
          confirmationEventInserted: false,
        };
      }

      if (![
        'ready_for_payment',
        'payment_pending',
        'partially_paid',
        'payment_confirmed',
      ].includes(commerce.state)) {
        throw new CommercePaymentAllocationError(
          'commerce_state_not_payable',
          `CommerceTransaction state ${commerce.state} cannot be projected from payment coverage.`,
        );
      }

      const previousState = commerce.state;
      commerce = await persistCommerceState(
        tx,
        commerce,
        projection.state,
        request.occurredAt,
      );
      let confirmationEventInserted = false;
      if (previousState !== 'payment_confirmed' && commerce.state === 'payment_confirmed') {
        confirmationEventInserted = await insertOutbox(tx, request.confirmedOutboxEvent, true);
      }

      return {
        commerceState: commerce.state,
        coverage: projection.coverage,
        changed: previousState !== commerce.state,
        confirmationEventInserted,
      };
    });
  }
}
