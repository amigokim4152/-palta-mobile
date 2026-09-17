import type { DatabasePort } from '../ports/databasePort.js';
import {
  transitionCare,
  type CareEvent,
  type CareState,
  type CareTrack,
} from './careMachine.js';
import type {
  CareSignalApplyPort,
  CareSignalApplyResult,
} from './careSignalApplyPort.js';

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

export class CareSignalApplyError extends Error {
  constructor(
    readonly code:
      | 'CARE_TRACK_NOT_FOUND'
      | 'RESOURCE_NOT_LINKED'
      | 'INVALID_CARE_STATE'
      | 'INVALID_SIGNAL',
    message: string,
  ) {
    super(message);
    this.name = 'CareSignalApplyError';
  }
}

function optionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}

function optionalSequence(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseTime(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new CareSignalApplyError('INVALID_SIGNAL', `${label} must be a valid timestamp.`);
  }
  return parsed;
}

function mapTrack(row: Record<string, unknown>): CareTrack {
  const state = String(row.state) as CareState;
  if (!CARE_STATES.has(state)) {
    throw new CareSignalApplyError(
      'INVALID_CARE_STATE',
      `Care track contains unsupported internal state: ${String(row.state)}`,
    );
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

function clearsWaiting(event: CareEvent): boolean {
  return (
    event === 'start_action' ||
    event === 'begin' ||
    event === 'result_received' ||
    event === 'complete' ||
    event === 'record_outcome' ||
    event === 'resume' ||
    event === 'cancel'
  );
}

function nextTemporalState(input: {
  current: CareTrack;
  careEvent: CareEvent;
  waitingForKey?: string;
  expectedAt?: string;
}): {
  waitingFor?: string;
  expectedAt?: string;
  nextCheckAt?: string;
} {
  const clear = clearsWaiting(input.careEvent);
  const waitingFor = input.waitingForKey ?? (clear ? undefined : input.current.waitingFor);

  let expectedAt = clear ? undefined : input.current.expectedAt;
  let nextCheckAt = input.current.nextCheckAt;

  if (input.careEvent === 'require_follow_up') {
    expectedAt = undefined;
    nextCheckAt = input.expectedAt ?? nextCheckAt;
  } else if (input.expectedAt !== undefined) {
    expectedAt = input.expectedAt;
  }

  if (
    input.careEvent === 'start_action' ||
    input.careEvent === 'record_outcome' ||
    input.careEvent === 'cancel'
  ) {
    nextCheckAt = undefined;
  }

  return {
    ...(waitingFor !== undefined ? { waitingFor } : {}),
    ...(expectedAt !== undefined ? { expectedAt } : {}),
    ...(nextCheckAt !== undefined ? { nextCheckAt } : {}),
  };
}

export class PostgresCareSignalApply implements CareSignalApplyPort {
  constructor(private readonly db: DatabasePort) {}

  async applySignal(input: {
    careTrackId: string;
    sourceSignalEventId: string;
    sourceCore: string;
    careEvent: CareEvent;
    resourceType: string;
    resourceId: string;
    occurredAt: string;
    sourceSequence?: number;
    expectedAt?: string;
    waitingForKey?: string;
    resultRef?: string;
    outcomeRef?: string;
  }): Promise<CareSignalApplyResult> {
    const occurredAtMs = parseTime(input.occurredAt, 'occurredAt');
    if (input.expectedAt !== undefined) parseTime(input.expectedAt, 'expectedAt');
    if (
      input.sourceSequence !== undefined &&
      (!Number.isInteger(input.sourceSequence) || input.sourceSequence < 0)
    ) {
      throw new CareSignalApplyError(
        'INVALID_SIGNAL',
        'sourceSequence must be a non-negative integer.',
      );
    }

    return this.db.transaction(async (tx) => {
      const trackResult = await tx.query(
        `select id, state, waiting_for, expected_at, next_check_at
           from care_track
          where id = $1
          for update`,
        [input.careTrackId],
      );
      const trackRow = trackResult.rows[0];
      if (!trackRow) {
        throw new CareSignalApplyError(
          'CARE_TRACK_NOT_FOUND',
          'Care track does not exist.',
        );
      }
      const current = mapTrack(trackRow);

      const linkResult = await tx.query(
        `select relation, last_signal_sequence, last_signal_occurred_at
           from care_resource_link
          where care_track_id = $1
            and source_core = $2
            and resource_type = $3
            and resource_id = $4
          order by relation
          for update`,
        [
          input.careTrackId,
          input.sourceCore,
          input.resourceType,
          input.resourceId,
        ],
      );
      if (linkResult.rows.length === 0) {
        throw new CareSignalApplyError(
          'RESOURCE_NOT_LINKED',
          'Care signal resource is not linked to the target Care track.',
        );
      }

      const receipt = await tx.query(
        `select disposition
           from care_signal_receipt
          where care_track_id = $1
            and source_core = $2
            and signal_event_id = $3
          limit 1`,
        [input.careTrackId, input.sourceCore, input.sourceSignalEventId],
      );
      if (receipt.rows[0]) {
        return {
          careTrackId: input.careTrackId,
          changed: false,
          state: current.state,
          disposition: 'replayed' as const,
        };
      }

      const stale = linkResult.rows.some((row) => {
        const lastSequence = optionalSequence(row.last_signal_sequence);
        if (input.sourceSequence !== undefined && lastSequence !== undefined) {
          return input.sourceSequence <= lastSequence;
        }
        if (input.sourceSequence !== undefined) return false;
        const lastOccurredAt = optionalString(row.last_signal_occurred_at);
        return lastOccurredAt !== undefined && occurredAtMs < Date.parse(lastOccurredAt);
      });

      if (stale) {
        await tx.query(
          `insert into care_signal_receipt (
             care_track_id, source_core, signal_event_id, care_event,
             resource_type, resource_id, source_sequence,
             waiting_for_key, expected_at, result_ref, outcome_ref,
             disposition, applied_at
           ) values (
             $1, $2, $3, $4,
             $5, $6, $7,
             $8, $9, $10, $11,
             'ignored_stale', now()
           )`,
          [
            input.careTrackId,
            input.sourceCore,
            input.sourceSignalEventId,
            input.careEvent,
            input.resourceType,
            input.resourceId,
            input.sourceSequence ?? null,
            input.waitingForKey ?? null,
            input.expectedAt ?? null,
            input.resultRef ?? null,
            input.outcomeRef ?? null,
          ],
        );
        return {
          careTrackId: input.careTrackId,
          changed: false,
          state: current.state,
          disposition: 'ignored_stale',
        };
      }

      let transitioned: CareTrack;
      try {
        transitioned = transitionCare(current, input.careEvent);
      } catch (error) {
        throw new CareSignalApplyError(
          'INVALID_SIGNAL',
          error instanceof Error ? error.message : String(error),
        );
      }
      const temporal = nextTemporalState({
        current,
        careEvent: input.careEvent,
        ...(input.waitingForKey !== undefined
          ? { waitingForKey: input.waitingForKey }
          : {}),
        ...(input.expectedAt !== undefined ? { expectedAt: input.expectedAt } : {}),
      });

      await tx.query(
        `update care_track
            set state = $2,
                waiting_for = $3,
                expected_at = $4,
                next_check_at = $5,
                updated_at = greatest(updated_at, $6::timestamptz)
          where id = $1`,
        [
          input.careTrackId,
          transitioned.state,
          temporal.waitingFor ?? null,
          temporal.expectedAt ?? null,
          temporal.nextCheckAt ?? null,
          input.occurredAt,
        ],
      );

      await tx.query(
        `update care_resource_link
            set last_signal_sequence = case
                  when $5::bigint is null then last_signal_sequence
                  else greatest(coalesce(last_signal_sequence, -1), $5::bigint)
                end,
                last_signal_occurred_at = greatest(
                  coalesce(last_signal_occurred_at, $6::timestamptz),
                  $6::timestamptz
                )
          where care_track_id = $1
            and source_core = $2
            and resource_type = $3
            and resource_id = $4`,
        [
          input.careTrackId,
          input.sourceCore,
          input.resourceType,
          input.resourceId,
          input.sourceSequence ?? null,
          input.occurredAt,
        ],
      );

      await tx.query(
        `insert into care_signal_receipt (
           care_track_id, source_core, signal_event_id, care_event,
           resource_type, resource_id, source_sequence,
           waiting_for_key, expected_at, result_ref, outcome_ref,
           disposition, applied_at
         ) values (
           $1, $2, $3, $4,
           $5, $6, $7,
           $8, $9, $10, $11,
           'applied', now()
         )`,
        [
          input.careTrackId,
          input.sourceCore,
          input.sourceSignalEventId,
          input.careEvent,
          input.resourceType,
          input.resourceId,
          input.sourceSequence ?? null,
          input.waitingForKey ?? null,
          input.expectedAt ?? null,
          input.resultRef ?? null,
          input.outcomeRef ?? null,
        ],
      );

      return {
        careTrackId: input.careTrackId,
        changed: true,
        state: transitioned.state,
        disposition: 'applied',
      };
    });
  }
}
