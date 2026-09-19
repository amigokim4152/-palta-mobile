import type { SQLiteDatabase } from 'expo-sqlite';
import type { OfflineMutation } from '../../../../src/mobile/offlineMutationQueue';
import type { MutationQueueStore } from '../../../../src/mobile/mutationSyncEngine';
import {
  decodeMutationRow,
  encodeMutationRow,
  type MutationQueueSqlRow,
} from '../../../../src/mobile/sqliteMutationCodec';

const CREATE_QUEUE_SQL = `
CREATE TABLE IF NOT EXISTS offline_mutation_queue (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS offline_mutation_queue_created_idx
  ON offline_mutation_queue(created_at);
`;

export async function initializePaltaSQLite(
  db: SQLiteDatabase,
): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync(CREATE_QUEUE_SQL);
}

export class ExpoSQLiteMutationQueueStore implements MutationQueueStore {
  constructor(private readonly db: SQLiteDatabase) {}

  async list(): Promise<OfflineMutation[]> {
    const rows = await this.db.getAllAsync<MutationQueueSqlRow>(
      `SELECT
         id, kind, payload_json, created_at, updated_at,
         attempts, state, last_error
       FROM offline_mutation_queue
       ORDER BY created_at ASC`,
    );
    return rows.map(decodeMutationRow);
  }

  async put(mutation: OfflineMutation): Promise<void> {
    const row = encodeMutationRow(mutation);

    await this.db.runAsync(
      `INSERT INTO offline_mutation_queue (
         id, kind, payload_json, created_at, updated_at,
         attempts, state, last_error
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         kind = excluded.kind,
         payload_json = excluded.payload_json,
         updated_at = excluded.updated_at,
         attempts = excluded.attempts,
         state = excluded.state,
         last_error = excluded.last_error`,
      [
        row.id,
        row.kind,
        row.payload_json,
        row.created_at,
        row.updated_at,
        row.attempts,
        row.state,
        row.last_error,
      ],
    );
  }

  async remove(id: string): Promise<void> {
    await this.db.runAsync(
      'DELETE FROM offline_mutation_queue WHERE id = ?',
      [id],
    );
  }
}
