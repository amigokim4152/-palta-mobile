-- PALTA MESSAGE SCOPE / ECOSYSTEM LINK PREFLIGHT
-- STATUS: DRAFT / NOT APPLIED
-- Date: 2026-09-17
--
-- Conversation = durable relationship.
-- Conversation Scope = one case/order/booking/shipment inside that relationship.
-- The owning domain keeps canonical state and any customer PII. Message Core
-- stores only stable resource references plus non-secret authorization evidence.

create table if not exists msg_conversation_scope (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references msg_conversation(id) on delete cascade,
  scope_type text not null check (length(trim(scope_type)) between 1 and 120),
  label text check (label is null or length(label) <= 240),
  scope_state text not null default 'active' check (scope_state in ('active', 'resolved', 'archived')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  archived_at timestamptz,
  unique (conversation_id, id),
  check (resolved_at is null or resolved_at >= created_at),
  check (archived_at is null or archived_at >= created_at)
);

create index if not exists msg_scope_conversation_state_idx
  on msg_conversation_scope(conversation_id, scope_state, created_at desc);

create table if not exists msg_scope_resource (
  scope_id uuid not null references msg_conversation_scope(id) on delete cascade,
  relation text not null check (length(trim(relation)) between 1 and 80),
  resource_type text not null check (length(trim(resource_type)) between 1 and 120),
  resource_id text not null check (length(trim(resource_id)) between 1 and 240),
  snapshot_version text,
  source_core text check (source_core is null or length(trim(source_core)) between 1 and 120),
  authorization_evidence_ref text check (
    authorization_evidence_ref is null or length(trim(authorization_evidence_ref)) between 1 and 240
  ),
  access_mode text check (access_mode is null or access_mode in ('view_status', 'participate', 'communicate')),
  attached_at timestamptz not null default now(),
  primary key (scope_id, relation, resource_type, resource_id)
);

create index if not exists msg_scope_resource_lookup_idx
  on msg_scope_resource(resource_type, resource_id, scope_id);

-- A message can be general to the relationship or attached to one scope.
-- The composite FK prevents accidentally attaching a message to a scope from a
-- different conversation. Scopes are audit-oriented and not physically deleted
-- while messages still reference them.
alter table msg_message
  add column if not exists scope_id uuid;

create index if not exists msg_message_scope_cursor_idx
  on msg_message(conversation_id, scope_id, sequence desc)
  where scope_id is not null;

do $$
begin
  alter table msg_message
    add constraint msg_message_scope_same_conversation_fk
    foreign key (conversation_id, scope_id)
    references msg_conversation_scope(conversation_id, id)
    on delete restrict;
exception when duplicate_object then null;
end $$;

-- Privacy boundary:
-- * customer phone/email/address stays in Commerce/Delivery/CRM when that domain
--   legitimately needs it.
-- * customer_share_link token plaintext never enters Message Core.
-- * authorization_evidence_ref is an opaque NON-SECRET record/capability result
--   identifier created after the owning domain has authorized the claim/link.
-- * Message Core may reference resources such as order, shipment,
--   customer_artifact or customer_delivery without copying their payload.
