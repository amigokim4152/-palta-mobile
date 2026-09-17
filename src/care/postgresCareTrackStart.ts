import type { DatabasePort } from '../ports/databasePort.js';
import type { CareState, CareTrack } from './careMachine.js';
import type {
  CareTrackStartRecord,
  CareTrackStartStore,
} from './careTrackStartService.js';

const CARE_STATES = new Set<CareState>([
  'discovered',
  'preparing',
  'action_started',
  'waiting',
  'upcoming',
  'in_progress',
  'result_available',
  'completed',
  'follow_up',
  'outcome_recorded',
  'blocked',
  'cancelled',
]);

function optionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}

function mapTrack(row: Record<string, unknown>): CareTrack {
  const state = String(row.state) as CareState;
  if (!CARE_STATES.has(state)) {
    throw new Error(`Unsupported Care state returned by database: ${String(row.state)}`);
  }
  const waitingFor = optionalString(row.waiting_for);
  const expectedAt = optionalString(row.expected_at);
  const nextCheckAt = optionalString(row.next_check_at);
  return {
    id: String(row.id),
    state,
    ...(waitingFor !== undefined ? { waitingFor } : {}),
    ...(expectedAt !== undefined ? { expectedAt } : {}),
    ...(nextCheckAt !== undefined ? { nextCheckAt } : {}),
  };
}

export class PostgresCareTrackStartStore implements CareTrackStartStore {
  constructor(private readonly db: DatabasePort) {}

  async openOrReuse(record: CareTrackStartRecord): Promise<{
    track: CareTrack;
    created: boolean;
  }> {
    return this.db.transaction(async (tx) => {
      if (record.clientRequestId !== undefined) {
        const existing = await tx.query(
          `select id, state, waiting_for, expected_at, next_check_at,
                  intent_key, subject_entity_id
             from care_track
            where user_id = $1
              and client_request_id = $2
            limit 1
            for update`,
          [record.userId, record.clientRequestId],
        );
        const row = existing.rows[0];
        if (row) {
          if (
            String(row.intent_key) !== record.intentKey ||
            optionalString(row.subject_entity_id) !== record.subjectEntityId
          ) {
            throw new Error(
              'Care clientRequestId was already used for a different Care intent or subject.',
            );
          }
          return { track: mapTrack(row), created: false };
        }
      }

      const inserted = await tx.query(
        `insert into care_track (
           id, user_id, subject_entity_id, intent_key, state,
           client_request_id, created_at, updated_at
         ) values ($1, $2, $3, $4, $5, $6, $7, $7)
         on conflict (user_id, client_request_id)
           where client_request_id is not null
         do nothing
         returning id, state, waiting_for, expected_at, next_check_at`,
        [
          record.careTrackId,
          record.userId,
          record.subjectEntityId ?? null,
          record.intentKey,
          record.initialState,
          record.clientRequestId ?? null,
          record.createdAt,
        ],
      );
      const insertedRow = inserted.rows[0];
      if (insertedRow) {
        return { track: mapTrack(insertedRow), created: true };
      }

      // Concurrent retry won the unique user/client_request_id race.
      if (record.clientRequestId === undefined) {
        throw new Error('Care track insert failed without an idempotency key.');
      }
      const concurrent = await tx.query(
        `select id, state, waiting_for, expected_at, next_check_at,
                intent_key, subject_entity_id
           from care_track
          where user_id = $1
            and client_request_id = $2
          limit 1`,
        [record.userId, record.clientRequestId],
      );
      const row = concurrent.rows[0];
      if (!row) throw new Error('Care idempotency conflict could not be resolved.');
      if (
        String(row.intent_key) !== record.intentKey ||
        optionalString(row.subject_entity_id) !== record.subjectEntityId
      ) {
        throw new Error(
          'Care clientRequestId was already used for a different Care intent or subject.',
        );
      }
      return { track: mapTrack(row), created: false };
    });
  }
}
