-- PALTA MESSAGE CORE V1 DB PREFLIGHT
-- STATUS: DRAFT / NOT APPLIED
-- Provider-neutral PostgreSQL baseline. Keep portable across managed Postgres providers.
-- Realtime is delivery only; this schema is the canonical durable message state.

create extension if not exists pgcrypto;

create table if not exists msg_conversation (
  id uuid primary key default gen_random_uuid(),
  conversation_type text not null,
  last_sequence bigint not null default 0 check (last_sequence >= 0),
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists msg_participant (
  conversation_id uuid not null references msg_conversation(id) on delete cascade,
  actor_type text not null,
  actor_id text not null,
  principal_user_id text,
  participant_role text not null,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  last_delivered_sequence bigint not null default 0 check (last_delivered_sequence >= 0),
  last_read_sequence bigint not null default 0 check (last_read_sequence >= 0),
  muted boolean not null default false,
  archived boolean not null default false,
  primary key (conversation_id, actor_type, actor_id),
  check (last_read_sequence <= last_delivered_sequence)
);

create index if not exists msg_participant_actor_idx
  on msg_participant(actor_type, actor_id, archived, conversation_id);

create table if not exists msg_message (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references msg_conversation(id) on delete cascade,
  sequence bigint not null check (sequence > 0),
  client_message_id text not null,
  sender_actor_type text not null,
  sender_actor_id text not null,
  sender_principal_user_id text,
  message_type text not null,
  body text,
  reply_to_message_id uuid references msg_message(id),
  action_resource_type text,
  action_resource_id text,
  action_key text,
  action_contract_version text,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  unique (conversation_id, sequence),
  unique (conversation_id, sender_actor_type, sender_actor_id, client_message_id)
);

create index if not exists msg_message_cursor_idx
  on msg_message(conversation_id, sequence desc);

create table if not exists msg_attachment (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references msg_message(id) on delete cascade,
  media_id text not null,
  attachment_kind text not null,
  mime_type text not null,
  size_bytes bigint,
  duration_ms bigint,
  created_at timestamptz not null default now()
);

create table if not exists msg_conversation_context (
  conversation_id uuid not null references msg_conversation(id) on delete cascade,
  relation text not null,
  resource_type text not null,
  resource_id text not null,
  snapshot_version text,
  attached_at timestamptz not null default now(),
  primary key (conversation_id, relation, resource_type, resource_id)
);

create index if not exists msg_context_resource_idx
  on msg_conversation_context(resource_type, resource_id, conversation_id);

create table if not exists msg_ai_artifact (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references msg_message(id) on delete cascade,
  artifact_type text not null,
  provider text,
  model text,
  artifact_version text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists msg_outbox (
  id uuid primary key default gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id text not null,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists msg_outbox_unpublished_idx
  on msg_outbox(created_at) where published_at is null;

create table if not exists msg_block (
  blocker_actor_type text not null,
  blocker_actor_id text not null,
  blocked_actor_type text not null,
  blocked_actor_id text not null,
  created_at timestamptz not null default now(),
  primary key (blocker_actor_type, blocker_actor_id, blocked_actor_type, blocked_actor_id)
);

create table if not exists msg_report (
  id uuid primary key default gen_random_uuid(),
  reporter_actor_type text not null,
  reporter_actor_id text not null,
  conversation_id uuid references msg_conversation(id),
  message_id uuid references msg_message(id),
  reason text not null,
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Intentionally not frozen in v1 preflight:
-- Auth-provider foreign keys / RLS implementation.
-- Realtime provider tables (realtime stays behind an adapter).
-- Push provider tokens (Notification Core owns them).
-- Quote/reservation/order/POS domain payloads (Message Core stores references only).
-- AI provider-specific result schemas (artifacts stay versioned and optional).
-- E2EE key material and device-key lifecycle.
