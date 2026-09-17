import type { DatabasePort } from '../ports/databasePort.js';
import type {
  HomeCandidateProjectionPort,
  HomeCandidateProjectionRecord,
} from './homeCandidateProjectionPort.js';

function presentationPayload(record: HomeCandidateProjectionRecord): Record<string, unknown> {
  const candidate = record.candidate;
  return {
    title: candidate.title,
    ...(candidate.summary !== undefined ? { summary: candidate.summary } : {}),
    ...(candidate.subjectRef !== undefined ? { subjectRef: candidate.subjectRef } : {}),
    ...(candidate.sourceRef !== undefined ? { sourceRef: candidate.sourceRef } : {}),
    ...(candidate.occurredAt !== undefined ? { occurredAt: candidate.occurredAt } : {}),
    waitingState: candidate.waitingState,
    confidence: candidate.confidence,
    freshness: candidate.freshness,
    ...(candidate.clusterKey !== undefined ? { clusterKey: candidate.clusterKey } : {}),
    ...(candidate.action !== undefined ? { action: candidate.action } : {}),
  };
}

export class PostgresHomeCandidateProjection implements HomeCandidateProjectionPort {
  constructor(private readonly db: DatabasePort) {}

  async upsert(record: HomeCandidateProjectionRecord): Promise<void> {
    const candidate = record.candidate;
    await this.db.query(
      `insert into home_candidate (
         user_id, candidate_type, source_domain, related_entity_id,
         care_track_id, relevance, importance, urgency,
         action_required, delivery_hint, dedupe_key,
         valid_from, valid_until, payload, created_at, updated_at
       ) values (
         $1, $2, $3, $4,
         $5, $6, $7, $8,
         $9, $10, $11,
         $12, $13, $14::jsonb, now(), now()
       )
       on conflict (user_id, dedupe_key) where dedupe_key is not null
       do update set
         candidate_type = excluded.candidate_type,
         source_domain = excluded.source_domain,
         related_entity_id = excluded.related_entity_id,
         care_track_id = excluded.care_track_id,
         relevance = excluded.relevance,
         importance = excluded.importance,
         urgency = excluded.urgency,
         action_required = excluded.action_required,
         delivery_hint = excluded.delivery_hint,
         valid_from = excluded.valid_from,
         valid_until = excluded.valid_until,
         payload = excluded.payload,
         updated_at = now()`,
      [
        record.userId,
        candidate.kind,
        candidate.domain,
        record.relatedEntityId ?? null,
        record.careTrackId ?? null,
        candidate.relevance,
        candidate.importance,
        candidate.urgency,
        candidate.actionRequired,
        candidate.deliveryHint ?? 'home',
        candidate.dedupeKey,
        candidate.validFrom ?? null,
        candidate.validUntil ?? null,
        JSON.stringify(presentationPayload(record)),
      ],
    );
  }

  async remove(input: {
    userId: string;
    dedupeKey: string;
  }): Promise<void> {
    await this.db.query(
      `delete from home_candidate
        where user_id = $1
          and dedupe_key = $2`,
      [input.userId, input.dedupeKey],
    );
  }
}
