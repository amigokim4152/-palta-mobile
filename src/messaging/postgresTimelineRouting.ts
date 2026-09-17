import type { DatabasePort } from '../ports/databasePort.js';
import type {
  TimelineProjectionTarget,
  TimelineRoutingPort,
} from './timelineRoutingPort.js';

export class TimelineRoutingFanoutError extends Error {
  constructor(readonly maxTargets: number) {
    super(`Timeline routing exceeded the v1 relationship fan-out limit of ${maxTargets}.`);
    this.name = 'TimelineRoutingFanoutError';
  }
}

export class PostgresTimelineRouting implements TimelineRoutingPort {
  constructor(private readonly db: DatabasePort) {}

  async findTargetsForResource(input: {
    sourceCore: string;
    resourceType: string;
    resourceId: string;
    maxTargets: number;
  }): Promise<TimelineProjectionTarget[]> {
    const maxTargets = Math.min(100, Math.max(1, Math.trunc(input.maxTargets)));
    const result = await this.db.query(
      `select distinct s.conversation_id, s.id as scope_id
         from msg_scope_resource r
         join msg_conversation_scope s on s.id = r.scope_id
        where r.source_core = $1
          and r.resource_type = $2
          and r.resource_id = $3
          and s.scope_state in ('active', 'resolved')
        order by s.conversation_id, s.id
        limit $4`,
      [input.sourceCore, input.resourceType, input.resourceId, maxTargets + 1],
    );

    if (result.rows.length > maxTargets) {
      throw new TimelineRoutingFanoutError(maxTargets);
    }

    return result.rows.map((row) => ({
      conversationId: String(row.conversation_id),
      scopeId: String(row.scope_id),
    }));
  }
}
