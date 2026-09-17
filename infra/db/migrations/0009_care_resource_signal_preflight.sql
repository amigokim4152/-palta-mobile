-- PALTA CARE RESOURCE / SIGNAL PREFLIGHT
-- STATUS: DRAFT / NOT APPLIED
-- Date: 2026-09-17
--
-- Care does not infer lifecycle meaning from arbitrary canonical.changed events.
-- An owning domain emits an explicit care.signal only after it has mapped the
-- domain transition into a Care semantic event. These tables contain stable
-- resource references only; domain payload and customer PII remain in the owning core.

create table if not exists care_resource_link (
  care_track_id uuid not null references care_track(id) on delete cascade,
  source_core text not null check (length(trim(source_core)) between 1 and 120),
  resource_type text not null check (length(trim(resource_type)) between 1 and 120),
  resource_id text not null check (length(trim(resource_id)) between 1 and 240),
  relation text not null default 'subject' check (length(trim(relation)) between 1 and 80),
  linked_at timestamptz not null default now(),
  primary key (care_track_id, source_core, resource_type, resource_id, relation)
);

create index if not exists care_resource_link_lookup_idx
  on care_resource_link(source_core, resource_type, resource_id, care_track_id);

-- Receipt must be written in the same transaction as the future Care state
-- mutation. A redelivered signal can then be acknowledged without applying the
-- transition twice. signal_event_id is the immutable Event Core event ID.
create table if not exists care_signal_receipt (
  care_track_id uuid not null references care_track(id) on delete cascade,
  source_core text not null check (length(trim(source_core)) between 1 and 120),
  signal_event_id text not null check (length(trim(signal_event_id)) between 1 and 240),
  care_event text not null check (length(trim(care_event)) between 1 and 80),
  applied_at timestamptz not null default now(),
  primary key (care_track_id, source_core, signal_event_id)
);

create index if not exists care_signal_receipt_applied_idx
  on care_signal_receipt(care_track_id, applied_at desc);

-- No public grants are added here. These are internal orchestration tables.
-- Home and Notification consume care.updated; they do not read these tables
-- directly and they do not receive domain payload through this linkage.
