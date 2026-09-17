import type { DatabasePort } from '../ports/databasePort.js';
import type {
  CareSignalRoutingPort,
  CareSignalTarget,
} from './careSignalRoutingPort.js';

export class CareSignalFanoutError extends Error {
  constructor(readonly maxTargets: number) {
    super(`Care signal routing exceeded the v1 fan-out limit of ${maxTargets}.`);
    this.name = 'CareSignalFanoutError';
  }
}

export class PostgresCareSignalRouting implements CareSignalRoutingPort {
  constructor(private readonly db: DatabasePort) {}

  async findTargetsForResource(input: {
    sourceCore: string;
    resourceType: string;
    resourceId: string;
    maxTargets: number;
  }): Promise<CareSignalTarget[]> {
    const maxTargets = Math.min(100, Math.max(1, Math.trunc(input.maxTargets)));
    const result = await this.db.query(
      `select distinct l.care_track_id
         from care_resource_link l
         join care_track c on c.id = l.care_track_id
        where l.source_core = $1
          and l.resource_type = $2
          and l.resource_id = $3
          and c.state <> 'cancelled'
        order by l.care_track_id
        limit $4`,
      [input.sourceCore, input.resourceType, input.resourceId, maxTargets + 1],
    );

    if (result.rows.length > maxTargets) {
      throw new CareSignalFanoutError(maxTargets);
    }

    return result.rows.map((row) => ({
      careTrackId: String(row.care_track_id),
    }));
  }
}
