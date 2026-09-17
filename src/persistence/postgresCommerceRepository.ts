import type { CommerceOutboxEvent } from '../commerce/outbox.js';
import type {
  CommerceLine,
  CommerceTransaction,
  CommerceTransactionState,
} from '../commerce/transaction.js';
import {
  CommerceConcurrencyError,
  CommerceIdempotencyConflictError,
  type CommerceAtomicCommit,
  type CommerceAtomicCommitResult,
  type CommerceIdempotencyLookup,
  type CommerceRepository,
  type CommerceTransactionLookup,
} from './commerceRepository.js';
import type { SqlDatabase, SqlExecutor } from './sqlDatabase.js';

type CommerceTransactionRow = {
  id: string;
  business_id: string;
  idempotency_key: string;
  state: CommerceTransactionState;
  currency: string;
  total_amount_minor: number | string;
  lines: unknown;
  revision: number | string;
  outlet_id: string | null;
  trading_session_id: string | null;
  operator_id: string | null;
  customer_id: string | null;
  created_at: string;
  updated_at: string;
};

type IdRow = { id: string };

const TRANSACTION_COLUMNS = `
  id,
  business_id,
  idempotency_key,
  state,
  currency,
  total_amount_minor,
  lines,
  revision,
  outlet_id,
  trading_session_id,
  operator_id,
  customer_id,
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

function linesFromDatabase(value: unknown): CommerceLine[] {
  if (!Array.isArray(value)) throw new Error('Commerce transaction lines must be a JSON array.');
  return value.map((line) => {
    if (typeof line !== 'object' || line === null) {
      throw new Error('Commerce transaction line must be an object.');
    }
    const item = line as Record<string, unknown>;
    if (
      typeof item.id !== 'string' ||
      (item.kind !== 'product' && item.kind !== 'service' && item.kind !== 'custom') ||
      typeof item.title !== 'string' ||
      typeof item.quantity !== 'number' ||
      typeof item.unitAmountMinor !== 'number' ||
      typeof item.lineAmountMinor !== 'number'
    ) {
      throw new Error('Stored commerce line does not match canonical contract.');
    }
    const result: CommerceLine = {
      id: item.id,
      kind: item.kind,
      title: item.title,
      quantity: item.quantity,
      unitAmountMinor: item.unitAmountMinor,
      lineAmountMinor: item.lineAmountMinor,
    };
    if (typeof item.productId === 'string') result.productId = item.productId;
    if (typeof item.variantId === 'string') result.variantId = item.variantId;
    if (typeof item.serviceId === 'string') result.serviceId = item.serviceId;
    return result;
  });
}

function rowToTransaction(row: CommerceTransactionRow): CommerceTransaction {
  const transaction: CommerceTransaction = {
    id: row.id,
    businessId: row.business_id,
    idempotencyKey: row.idempotency_key,
    state: row.state,
    currency: row.currency,
    totalAmountMinor: safeInteger(row.total_amount_minor, 'total_amount_minor'),
    lines: linesFromDatabase(row.lines),
    revision: safeInteger(row.revision, 'revision'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.outlet_id !== null) transaction.outletId = row.outlet_id;
  if (row.trading_session_id !== null) transaction.tradingSessionId = row.trading_session_id;
  if (row.operator_id !== null) transaction.operatorId = row.operator_id;
  if (row.customer_id !== null) transaction.customerId = row.customer_id;
  return transaction;
}

function assertCommitShape(commit: CommerceAtomicCommit): void {
  if (commit.expectedRevision === null) {
    if (commit.transaction.revision !== 0) {
      throw new CommerceConcurrencyError('New commerce transaction must start at revision 0.');
    }
  } else {
    if (!Number.isSafeInteger(commit.expectedRevision) || commit.expectedRevision < 0) {
      throw new CommerceConcurrencyError('expectedRevision must be a non-negative safe integer.');
    }
    if (commit.transaction.revision !== commit.expectedRevision + 1) {
      throw new CommerceConcurrencyError(
        'Updated commerce transaction revision must equal expectedRevision + 1.',
      );
    }
  }

  for (const event of commit.outboxEvents) {
    if (event.businessId !== commit.transaction.businessId) {
      throw new Error('Commerce outbox event belongs to another business.');
    }
  }
}

async function insertOutboxEvents(
  tx: SqlExecutor,
  events: readonly CommerceOutboxEvent[],
): Promise<string[]> {
  const inserted: string[] = [];
  for (const event of events) {
    const result = await tx.query<IdRow>(
      `insert into commerce_outbox (
        id,
        business_id,
        aggregate_type,
        aggregate_id,
        event_type,
        idempotency_key,
        payload,
        status,
        attempts,
        next_attempt_at,
        last_error_code,
        created_at,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13)
      on conflict (business_id, idempotency_key) do nothing
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
    const row = result.rows[0];
    if (row) inserted.push(row.id);
  }
  return inserted;
}

export class PostgresCommerceRepository implements CommerceRepository {
  constructor(private readonly db: SqlDatabase) {}

  async findTransaction(
    lookup: CommerceTransactionLookup,
  ): Promise<CommerceTransaction | null> {
    const result = await this.db.query<CommerceTransactionRow>(
      `select ${TRANSACTION_COLUMNS}
       from commerce_transaction
       where business_id = $1 and id = $2
       limit 1`,
      [lookup.businessId, lookup.transactionId],
    );
    return result.rows[0] ? rowToTransaction(result.rows[0]) : null;
  }

  async findTransactionByIdempotency(
    lookup: CommerceIdempotencyLookup,
  ): Promise<CommerceTransaction | null> {
    const result = await this.db.query<CommerceTransactionRow>(
      `select ${TRANSACTION_COLUMNS}
       from commerce_transaction
       where business_id = $1 and idempotency_key = $2
       limit 1`,
      [lookup.businessId, lookup.idempotencyKey],
    );
    return result.rows[0] ? rowToTransaction(result.rows[0]) : null;
  }

  async commitTransactionAndOutbox(
    commit: CommerceAtomicCommit,
  ): Promise<CommerceAtomicCommitResult> {
    assertCommitShape(commit);

    return this.db.transaction(async (tx) => {
      if (commit.expectedRevision === null) {
        const existing = await tx.query<CommerceTransactionRow>(
          `select ${TRANSACTION_COLUMNS}
           from commerce_transaction
           where business_id = $1 and idempotency_key = $2
           for update`,
          [commit.transaction.businessId, commit.transaction.idempotencyKey],
        );
        const existingRow = existing.rows[0];
        if (existingRow) {
          if (existingRow.id !== commit.transaction.id) {
            throw new CommerceIdempotencyConflictError();
          }
          const insertedOutboxEventIds = await insertOutboxEvents(tx, commit.outboxEvents);
          return {
            transaction: rowToTransaction(existingRow),
            insertedOutboxEventIds,
            replayed: true,
          };
        }

        const inserted = await tx.query<CommerceTransactionRow>(
          `insert into commerce_transaction (
            id,
            business_id,
            idempotency_key,
            state,
            currency,
            total_amount_minor,
            lines,
            revision,
            outlet_id,
            trading_session_id,
            operator_id,
            customer_id,
            created_at,
            updated_at
          ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14)
          returning ${TRANSACTION_COLUMNS}`,
          [
            commit.transaction.id,
            commit.transaction.businessId,
            commit.transaction.idempotencyKey,
            commit.transaction.state,
            commit.transaction.currency,
            commit.transaction.totalAmountMinor,
            JSON.stringify(commit.transaction.lines),
            commit.transaction.revision,
            commit.transaction.outletId ?? null,
            commit.transaction.tradingSessionId ?? null,
            commit.transaction.operatorId ?? null,
            commit.transaction.customerId ?? null,
            commit.transaction.createdAt,
            commit.transaction.updatedAt,
          ],
        );
        const row = inserted.rows[0];
        if (!row) throw new Error('Commerce transaction insert did not return a row.');
        const insertedOutboxEventIds = await insertOutboxEvents(tx, commit.outboxEvents);
        return {
          transaction: rowToTransaction(row),
          insertedOutboxEventIds,
          replayed: false,
        };
      }

      const updated = await tx.query<CommerceTransactionRow>(
        `update commerce_transaction set
          state = $4,
          currency = $5,
          total_amount_minor = $6,
          lines = $7::jsonb,
          revision = $8,
          outlet_id = $9,
          trading_session_id = $10,
          operator_id = $11,
          customer_id = $12,
          updated_at = $13
        where business_id = $1 and id = $2 and revision = $3
        returning ${TRANSACTION_COLUMNS}`,
        [
          commit.transaction.businessId,
          commit.transaction.id,
          commit.expectedRevision,
          commit.transaction.state,
          commit.transaction.currency,
          commit.transaction.totalAmountMinor,
          JSON.stringify(commit.transaction.lines),
          commit.transaction.revision,
          commit.transaction.outletId ?? null,
          commit.transaction.tradingSessionId ?? null,
          commit.transaction.operatorId ?? null,
          commit.transaction.customerId ?? null,
          commit.transaction.updatedAt,
        ],
      );
      const row = updated.rows[0];
      if (!row) throw new CommerceConcurrencyError();
      const insertedOutboxEventIds = await insertOutboxEvents(tx, commit.outboxEvents);
      return {
        transaction: rowToTransaction(row),
        insertedOutboxEventIds,
        replayed: false,
      };
    });
  }
}
