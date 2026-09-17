import type { DatabasePort } from '../ports/databasePort.js';
import type {
  CareResourceLinkPort,
  CareResourceLinkRecord,
} from './careResourceLinkPort.js';

function timestamp(value: unknown): string {
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : String(value);
}

function mapLink(row: Record<string, unknown>): CareResourceLinkRecord {
  return {
    careTrackId: String(row.care_track_id),
    sourceCore: String(row.source_core),
    resourceType: String(row.resource_type),
    resourceId: String(row.resource_id),
    relation: String(row.relation),
    linkedAt: timestamp(row.linked_at),
  };
}

export class PostgresCareResourceLink implements CareResourceLinkPort {
  constructor(private readonly db: DatabasePort) {}

  async findCareTrackOwner(careTrackId: string): Promise<string | null> {
    const result = await this.db.query(
      `select user_id
         from care_track
        where id = $1
        limit 1`,
      [careTrackId],
    );
    const row = result.rows[0];
    return row ? String(row.user_id) : null;
  }

  async attachIfAbsent(input: CareResourceLinkRecord): Promise<{
    link: CareResourceLinkRecord;
    created: boolean;
  }> {
    const inserted = await this.db.query(
      `insert into care_resource_link (
         care_track_id, source_core, resource_type, resource_id, relation, linked_at
       ) values ($1, $2, $3, $4, $5, $6)
       on conflict (care_track_id, source_core, resource_type, resource_id, relation)
       do nothing
       returning care_track_id, source_core, resource_type, resource_id, relation, linked_at`,
      [
        input.careTrackId,
        input.sourceCore,
        input.resourceType,
        input.resourceId,
        input.relation,
        input.linkedAt,
      ],
    );
    if (inserted.rows[0]) {
      return { link: mapLink(inserted.rows[0]), created: true };
    }

    const existing = await this.db.query(
      `select care_track_id, source_core, resource_type, resource_id, relation, linked_at
         from care_resource_link
        where care_track_id = $1
          and source_core = $2
          and resource_type = $3
          and resource_id = $4
          and relation = $5
        limit 1`,
      [
        input.careTrackId,
        input.sourceCore,
        input.resourceType,
        input.resourceId,
        input.relation,
      ],
    );
    const row = existing.rows[0];
    if (!row) {
      throw new Error('Care resource link conflict replay could not be resolved.');
    }
    return { link: mapLink(row), created: false };
  }
}
