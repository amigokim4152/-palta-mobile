import type { DatabasePort } from '../ports/databasePort.js';
import type { CareState, CareTrack } from './careMachine.js';
import type {
  CareHomeSnapshot,
  CareHomeSnapshotPort,
} from './careHomeProjectionPort.js';

function optionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : undefined;
}

export class PostgresCareHomeSnapshot implements CareHomeSnapshotPort {
  constructor(private readonly db: DatabasePort) {}

  async load(careTrackId: string): Promise<CareHomeSnapshot | null> {
    const result = await this.db.query(
      `select id, user_id, intent_key, subject_entity_id,
              state, waiting_for, expected_at, next_check_at
         from care_track
        where id = $1
        limit 1`,
      [careTrackId],
    );
    const row = result.rows[0];
    if (!row) return null;

    const waitingFor = optionalString(row.waiting_for);
    const expectedAt = optionalString(row.expected_at);
    const nextCheckAt = optionalString(row.next_check_at);
    const subjectEntityId = optionalString(row.subject_entity_id);
    const track: CareTrack = {
      id: String(row.id),
      state: String(row.state) as CareState,
      ...(waitingFor !== undefined ? { waitingFor } : {}),
      ...(expectedAt !== undefined ? { expectedAt } : {}),
      ...(nextCheckAt !== undefined ? { nextCheckAt } : {}),
    };

    return {
      userId: String(row.user_id),
      track,
      intentKey: String(row.intent_key),
      ...(subjectEntityId !== undefined ? { subjectEntityId } : {}),
    };
  }
}
