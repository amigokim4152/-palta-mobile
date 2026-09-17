-- PALTA HOME CANDIDATE PROJECTION PREFLIGHT
-- STATUS: DRAFT / NOT APPLIED
-- Date: 2026-09-17
--
-- Home candidates are projections, not canonical domain records. A Care update
-- must replace its current candidate instead of appending duplicate cards.

alter table home_candidate
  add column if not exists updated_at timestamptz not null default now();

-- One current projection per user + semantic dedupe key. Rows without a dedupe
-- key remain possible for legacy/non-repeatable content, but Care projections
-- always use one.
create unique index if not exists home_candidate_user_dedupe_uidx
  on home_candidate(user_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists home_candidate_care_track_idx
  on home_candidate(care_track_id)
  where care_track_id is not null;

-- The payload contains presentation data needed to render the Home card, not the
-- canonical order/shipment/health/etc. payload. Sensitive detail stays in the
-- owning domain and is fetched there under that domain's authorization.
