import type {
  Money,
  PaymentEvent,
  PaymentIntent,
  PaymentRail,
  PaymentStatus,
  SettlementStatus,
} from '../payment/paymentModel.js';
import {
  PaymentConcurrencyError,
  PaymentIdempotencyConflictError,
  type PaymentAtomicCommit,
  type PaymentAtomicCommitResult,
  type PaymentIdempotencyLookup,
  type PaymentIntentLookup,
  type PaymentRepository,
} from './paymentRepository.js';
import type { SqlDatabase, SqlExecutor } from './sqlDatabase.js';

type PaymentIntentRow = {
  id: string;
  business_id: string;
  commerce_transaction_id: string;
  idempotency_key: string;
  amount_minor: number | string;
  currency: string;
  rail: PaymentRail;
  status: PaymentStatus;
  provider_key: string | null;
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

const PAYMENT_COLUMNS = `
  id,
  business_id,
  commerce_transaction_id,
  idempotency_key,
  amount_minor,
  currency,
  rail,
  status,
  provider_key,
  provider_reference,
  provider_payment_id,
  terminal_id,
  authorization_code,
  card_brand,
  card_last4,
  fee_minor,
  settlement_status,
  settlement_reference,
  revision,
  created_at,
  updated_at
`;

function safeInteger(value: number | string, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${field} is outside Palta safe-integer range.`);
  }
  return parsed;
}

function rowToIntent(row: PaymentIntentRow): PaymentIntent {
  const amount: Money = {
    currency: row.currency,
    amountMinor: safeInteger(row.amount_minor, 'payment amount_minor'),
  };
  const intent: PaymentIntent = {
    id: row.id,
    commerceTransactionId: row.commerce_transaction_id,
    merchantId: row.business_id,
    amount,
    rail: row.rail,
    status: row.status,
    revision: safeInteger(row.revision, 'payment revision'),
    settlementStatus: row.settlement_status,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.provider_key !== null) intent.providerKey = row.provider_key;
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
  if (row.settlement_reference !== null) {
    intent.settlementReference = row.settlement_reference;
  }
  return intent;
}

function assertCommitShape(commit: PaymentAtomicCommit): void {
  if (commit.event.paymentIntentId !== commit.intent.id) {
    throw new Error('Payment event belongs to another PaymentIntent.');
  }
  if (commit.expectedRevision === null) {
    if (commit.intent.revision !== 0) {
      throw new PaymentConcurrencyError('New PaymentIntent must start at revision 0.');
    }
  } else {
    if (!Number.isSafeInteger(commit.expectedRevision) || commit.expectedRevision < 0) {
      throw new PaymentConcurrencyError('expectedRevision must be a non-negative safe integer.');
    }
    if (commit.intent.revision !== commit.expectedRevision + 1) {
      throw new PaymentConcurrencyError(
        'Updated PaymentIntent revision must equal expectedRevision + 1.',
      );
    }
  }
}

async function insertPaymentEvent(
  tx: SqlExecutor,
  businessId: string,
  event: PaymentEvent,
): Promise<boolean> {
  const result = await tx.query<IdRow>(
    `insert into payment_event (
      id,
      business_id,
      payment_intent_id,
      event_type,
      occurred_at,
      provider_key,
      provider_reference,
      metadata
    ) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
    on conflict (id) do nothing
    returning id`,
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
  return result.rowCount === 1;
}

export class PostgresPaymentRepository implements PaymentRepository {
  constructor(private readonly db: SqlDatabase) {}

  async findIntent(lookup: PaymentIntentLookup): Promise<PaymentIntent | null> {
    const result = await this.db.query<PaymentIntentRow>(
      `select ${PAYMENT_COLUMNS}
       from payment_intent
       where business_id = $1 and id = $2
       limit 1`,
      [lookup.businessId, lookup.paymentIntentId],
    );
    return result.rows[0] ? rowToIntent(result.rows[0]) : null;
  }

  async findIntentByIdempotency(
    lookup: PaymentIdempotencyLookup,
  ): Promise<PaymentIntent | null> {
    const result = await this.db.query<PaymentIntentRow>(
      `select ${PAYMENT_COLUMNS}
       from payment_intent
       where business_id = $1 and idempotency_key = $2
       limit 1`,
      [lookup.businessId, lookup.idempotencyKey],
    );
    return result.rows[0] ? rowToIntent(result.rows[0]) : null;
  }

  async commitIntentAndEvent(
    commit: PaymentAtomicCommit,
  ): Promise<PaymentAtomicCommitResult> {
    assertCommitShape(commit);

    return this.db.transaction(async (tx) => {
      if (commit.expectedRevision === null) {
        const existing = await tx.query<PaymentIntentRow>(
          `select ${PAYMENT_COLUMNS}
           from payment_intent
           where business_id = $1 and idempotency_key = $2
           for update`,
          [commit.intent.merchantId, commit.intent.idempotencyKey],
        );
        const existingRow = existing.rows[0];
        if (existingRow) {
          if (existingRow.id !== commit.intent.id) {
            throw new PaymentIdempotencyConflictError();
          }
          const eventInserted = await insertPaymentEvent(
            tx,
            commit.intent.merchantId,
            commit.event,
          );
          return {
            intent: rowToIntent(existingRow),
            eventInserted,
            replayed: true,
          };
        }

        const inserted = await tx.query<PaymentIntentRow>(
          `insert into payment_intent (
            id,
            business_id,
            commerce_transaction_id,
            idempotency_key,
            amount_minor,
            currency,
            rail,
            status,
            provider_key,
            provider_reference,
            provider_payment_id,
            terminal_id,
            authorization_code,
            card_brand,
            card_last4,
            fee_minor,
            settlement_status,
            settlement_reference,
            revision,
            created_at,
            updated_at
          ) values (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
          )
          returning ${PAYMENT_COLUMNS}`,
          [
            commit.intent.id,
            commit.intent.merchantId,
            commit.intent.commerceTransactionId,
            commit.intent.idempotencyKey,
            commit.intent.amount.amountMinor,
            commit.intent.amount.currency,
            commit.intent.rail,
            commit.intent.status,
            commit.intent.providerKey ?? null,
            commit.intent.providerReference ?? null,
            commit.intent.providerPaymentId ?? null,
            commit.intent.terminalId ?? null,
            commit.intent.authorizationCode ?? null,
            commit.intent.cardBrand ?? null,
            commit.intent.cardLast4 ?? null,
            commit.intent.fee?.amountMinor ?? null,
            commit.intent.settlementStatus,
            commit.intent.settlementReference ?? null,
            commit.intent.revision,
            commit.intent.createdAt,
            commit.intent.updatedAt,
          ],
        );
        const row = inserted.rows[0];
        if (!row) throw new Error('PaymentIntent insert did not return a row.');
        const eventInserted = await insertPaymentEvent(
          tx,
          commit.intent.merchantId,
          commit.event,
        );
        return {
          intent: rowToIntent(row),
          eventInserted,
          replayed: false,
        };
      }

      const updated = await tx.query<PaymentIntentRow>(
        `update payment_intent set
          status = $4,
          provider_key = $5,
          provider_reference = $6,
          provider_payment_id = $7,
          terminal_id = $8,
          authorization_code = $9,
          card_brand = $10,
          card_last4 = $11,
          fee_minor = $12,
          settlement_status = $13,
          settlement_reference = $14,
          revision = $15,
          updated_at = $16
        where business_id = $1 and id = $2 and revision = $3
        returning ${PAYMENT_COLUMNS}`,
        [
          commit.intent.merchantId,
          commit.intent.id,
          commit.expectedRevision,
          commit.intent.status,
          commit.intent.providerKey ?? null,
          commit.intent.providerReference ?? null,
          commit.intent.providerPaymentId ?? null,
          commit.intent.terminalId ?? null,
          commit.intent.authorizationCode ?? null,
          commit.intent.cardBrand ?? null,
          commit.intent.cardLast4 ?? null,
          commit.intent.fee?.amountMinor ?? null,
          commit.intent.settlementStatus,
          commit.intent.settlementReference ?? null,
          commit.intent.revision,
          commit.intent.updatedAt,
        ],
      );
      const row = updated.rows[0];
      if (!row) throw new PaymentConcurrencyError();
      const eventInserted = await insertPaymentEvent(
        tx,
        commit.intent.merchantId,
        commit.event,
      );
      return {
        intent: rowToIntent(row),
        eventInserted,
        replayed: false,
      };
    });
  }
}
