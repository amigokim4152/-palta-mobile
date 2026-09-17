import type { CommerceOutboxEvent } from '../src/commerce/outbox.js';
import type { PaymentEvent, PaymentIntent } from '../src/payment/paymentModel.js';
import {
  CommercePaymentAllocationError,
} from '../src/persistence/commercePaymentCoordinatorRepository.js';
import { PostgresCommercePaymentCoordinator } from '../src/persistence/postgresCommercePaymentCoordinator.js';
import type {
  SqlDatabase,
  SqlExecutor,
  SqlQueryResult,
} from '../src/persistence/sqlDatabase.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type Row = Record<string, unknown>;

const businessId = '22222222-2222-4222-8222-222222222222';
const transactionId = '11111111-1111-4111-8111-111111111111';
const now = '2026-09-17T22:00:00.000Z';

type StoredPayment = {
  intent: PaymentIntent;
};

class CoordinatorDb implements SqlDatabase {
  commerceState = 'ready_for_payment';
  commerceRevision = 0;
  payments: StoredPayment[] = [];
  outboxKeys = new Set<string>();
  queries: string[] = [];

  async query<TRow extends Row>(): Promise<SqlQueryResult<TRow>> {
    throw new Error('Coordinator writes/locked reads must never use root executor.');
  }

  async transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    const tx: SqlExecutor = {
      query: async <TRow extends Row>(
        sql: string,
        params: readonly unknown[] = [],
      ): Promise<SqlQueryResult<TRow>> => {
        this.queries.push(sql);

        if (sql.includes('from commerce_transaction') && sql.includes('for update')) {
          return {
            rows: [{
              id: transactionId,
              business_id: businessId,
              idempotency_key: 'checkout-1',
              state: this.commerceState,
              currency: 'CLP',
              total_amount_minor: 10000,
              revision: this.commerceRevision,
              created_at: now,
              updated_at: now,
            } as TRow],
            rowCount: 1,
          };
        }

        if (
          sql.includes('from payment_intent') &&
          sql.includes('idempotency_key = $2') &&
          sql.includes('for update')
        ) {
          const key = String(params[1]);
          const match = this.payments.find((entry) => entry.intent.idempotencyKey === key);
          return {
            rows: match ? [paymentRow(match.intent) as TRow] : [],
            rowCount: match ? 1 : 0,
          };
        }

        if (
          sql.includes('from payment_intent') &&
          sql.includes('commerce_transaction_id = $2')
        ) {
          return {
            rows: this.payments.map((entry) => paymentRow(entry.intent) as TRow),
            rowCount: this.payments.length,
          };
        }

        if (sql.includes('insert into payment_intent')) {
          const intent: PaymentIntent = {
            id: String(params[0]),
            merchantId: String(params[1]),
            commerceTransactionId: String(params[2]),
            idempotencyKey: String(params[4]),
            amount: { currency: String(params[7]), amountMinor: Number(params[5]) },
            rail: params[8] as PaymentIntent['rail'],
            status: params[9] as PaymentIntent['status'],
            revision: Number(params[21]),
            settlementStatus: params[19] as PaymentIntent['settlementStatus'],
            createdAt: String(params[22]),
            updatedAt: String(params[23]),
          };
          if (params[3] !== null) intent.orderId = String(params[3]);
          if (params[10] !== null) intent.providerKey = String(params[10]);
          if (params[11] !== null) intent.providerConnectionId = String(params[11]);
          if (params[14] !== null) intent.terminalId = String(params[14]);
          this.payments.push({ intent });
          return { rows: [paymentRow(intent) as TRow], rowCount: 1 };
        }

        if (sql.includes('insert into payment_event')) {
          return { rows: [{ id: String(params[0]) } as TRow], rowCount: 1 };
        }

        if (sql.includes('insert into commerce_outbox')) {
          const key = String(params[5]);
          if (this.outboxKeys.has(key)) return { rows: [], rowCount: 0 };
          this.outboxKeys.add(key);
          return { rows: [{ id: String(params[0]) } as TRow], rowCount: 1 };
        }

        if (sql.includes('update commerce_transaction')) {
          const expectedRevision = Number(params[2]);
          if (expectedRevision !== this.commerceRevision) {
            return { rows: [], rowCount: 0 };
          }
          this.commerceState = String(params[3]);
          this.commerceRevision = Number(params[4]);
          return { rows: [{ id: transactionId } as TRow], rowCount: 1 };
        }

        throw new Error(`Unexpected coordinator SQL: ${sql}`);
      },
    };
    return work(tx);
  }
}

function paymentRow(intent: PaymentIntent): Row {
  return {
    id: intent.id,
    business_id: intent.merchantId,
    commerce_transaction_id: intent.commerceTransactionId,
    order_id: intent.orderId ?? null,
    idempotency_key: intent.idempotencyKey,
    amount_minor: intent.amount.amountMinor,
    processed_amount_minor: intent.processedAmount?.amountMinor ?? null,
    currency: intent.amount.currency,
    rail: intent.rail,
    status: intent.status,
    provider_key: intent.providerKey ?? null,
    provider_connection_id: intent.providerConnectionId ?? null,
    provider_reference: intent.providerReference ?? null,
    provider_payment_id: intent.providerPaymentId ?? null,
    terminal_id: intent.terminalId ?? null,
    authorization_code: intent.authorizationCode ?? null,
    card_brand: intent.cardBrand ?? null,
    card_last4: intent.cardLast4 ?? null,
    fee_minor: intent.fee?.amountMinor ?? null,
    settlement_status: intent.settlementStatus,
    settlement_reference: intent.settlementReference ?? null,
    revision: intent.revision,
    created_at: intent.createdAt,
    updated_at: intent.updatedAt,
  };
}

function allocation(amount: number, suffix: string) {
  const intent: PaymentIntent = {
    id: `55555555-5555-4555-8555-${suffix.padStart(12, '0')}`,
    commerceTransactionId: transactionId,
    merchantId: businessId,
    amount: { currency: 'CLP', amountMinor: amount },
    rail: 'card',
    status: 'created',
    revision: 0,
    providerKey: 'provider-test',
    providerConnectionId: 'connection-1',
    settlementStatus: 'not_applicable',
    idempotencyKey: `payment-${suffix}`,
    createdAt: now,
    updatedAt: now,
  };
  const event: PaymentEvent = {
    id: `66666666-6666-4666-8666-${suffix.padStart(12, '0')}`,
    paymentIntentId: intent.id,
    type: 'payment_created',
    occurredAt: now,
    providerKey: intent.providerKey,
  };
  const providerOutboxEvent: CommerceOutboxEvent = {
    id: `77777777-7777-4777-8777-${suffix.padStart(12, '0')}`,
    businessId,
    aggregateType: 'payment_intent',
    aggregateId: intent.id,
    eventType: 'payment.create',
    idempotencyKey: `outbox-payment-${suffix}`,
    payload: { paymentIntentId: intent.id },
    status: 'pending',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
  return { intent, event, providerOutboxEvent };
}

const db = new CoordinatorDb();
const coordinator = new PostgresCommercePaymentCoordinator(db);
const first = await coordinator.allocatePayment(allocation(6000, '1'));
assert(
  first.commerceState === 'payment_pending' &&
    first.coverage.unresolvedAmountMinor === 6000 &&
    first.coverage.unallocatedAmountMinor === 4000,
  'First split payer must reserve only its requested exposure and move Commerce to payment_pending.',
);
assert(
  db.queries[0]?.includes('commerce_transaction') && db.queries[0]?.includes('for update'),
  'CommerceTransaction row lock must be the first database operation in payment allocation.',
);
const firstInsertIndex = db.queries.findIndex((sql) => sql.includes('insert into payment_intent'));
const firstLockIndex = db.queries.findIndex(
  (sql) => sql.includes('commerce_transaction') && sql.includes('for update'),
);
assert(
  firstLockIndex >= 0 && firstInsertIndex > firstLockIndex,
  'PaymentIntent must never be inserted before the canonical CommerceTransaction lock is held.',
);

let overAllocationBlocked = false;
try {
  await coordinator.allocatePayment(allocation(5000, '2'));
} catch (error) {
  overAllocationBlocked =
    error instanceof CommercePaymentAllocationError &&
    error.code === 'payment_allocation_exceeds_balance';
}
assert(
  overAllocationBlocked && db.payments.length === 1,
  'Concurrent split allocation above the remaining 4000 CLP balance must fail before PaymentIntent insert.',
);

const second = await coordinator.allocatePayment(allocation(4000, '3'));
assert(
  second.coverage.potentialExposureMinor === 10000 &&
    second.coverage.unallocatedAmountMinor === 0 &&
    db.payments.length === 2,
  'Exact remaining split allocation should reserve the final balance without exceeding transaction total.',
);

const replay = await coordinator.allocatePayment(allocation(4000, '3'));
assert(
  replay.replayed && db.payments.length === 2,
  'Exact payment allocation replay must return the canonical PaymentIntent without a duplicate insert.',
);

// Simulate provider reconciliation completing both charges. The projection path
// must re-read both payments only after acquiring the same Commerce row lock.
db.payments[0]!.intent = {
  ...db.payments[0]!.intent,
  status: 'paid',
  processedAmount: { currency: 'CLP', amountMinor: 6000 },
  revision: 1,
};
db.payments[1]!.intent = {
  ...db.payments[1]!.intent,
  status: 'paid',
  processedAmount: { currency: 'CLP', amountMinor: 4000 },
  revision: 1,
};
const projectionQueryStart = db.queries.length;
const confirmedOutboxEvent: CommerceOutboxEvent = {
  id: '88888888-8888-4888-8888-888888888888',
  businessId,
  aggregateType: 'commerce_transaction',
  aggregateId: transactionId,
  eventType: 'commerce.payment_confirmed',
  idempotencyKey: `commerce-payment-confirmed:${transactionId}`,
  payload: { commerceTransactionId: transactionId },
  status: 'pending',
  attempts: 0,
  createdAt: now,
  updatedAt: now,
};
const projected = await coordinator.projectCoverage({
  businessId,
  commerceTransactionId: transactionId,
  occurredAt: '2026-09-17T22:01:00.000Z',
  confirmedOutboxEvent,
});
assert(
  projected.commerceState === 'payment_confirmed' &&
    projected.coverage.paidAmountMinor === 10000 &&
    projected.confirmationEventInserted,
  'Exact authoritative split-payment coverage must confirm Commerce once and emit the durable confirmation event.',
);
const projectionQueries = db.queries.slice(projectionQueryStart);
assert(
  projectionQueries[0]?.includes('commerce_transaction') &&
    projectionQueries[0]?.includes('for update') &&
    projectionQueries[1]?.includes('payment_intent'),
  'Coverage projection must lock Commerce before reading PaymentIntents so a new QR allocation cannot slip in.',
);

let postConfirmationBlocked = false;
try {
  await coordinator.allocatePayment(allocation(1, '4'));
} catch (error) {
  postConfirmationBlocked =
    error instanceof CommercePaymentAllocationError &&
    error.code === 'commerce_state_not_payable';
}
assert(
  postConfirmationBlocked && db.payments.length === 2,
  'A new payment allocation must be blocked after Commerce is payment_confirmed.',
);

console.log('PASS: atomic Commerce/payment split allocation and projection tests');
