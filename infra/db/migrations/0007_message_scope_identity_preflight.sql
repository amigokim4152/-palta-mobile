-- PALTA MESSAGE SCOPE IDENTITY PREFLIGHT
-- STATUS: DRAFT / NOT APPLIED
-- Date: 2026-09-17
--
-- A canonical primary domain resource (order/service_request/booking/etc.) should
-- resolve to one Scope inside one Conversation even if Commerce/Delivery retries
-- the integration event. This table is internal and stores no customer PII.

create table if not exists msg_scope_identity (
  conversation_id uuid not null references msg_conversation(id) on delete cascade,
  source_core text not null,
  resource_type text not null,
  resource_id text not null,
  scope_id uuid unique references msg_conversation_scope(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, source_core, resource_type, resource_id)
);

create index if not exists msg_scope_identity_resource_idx
  on msg_scope_identity(source_core, resource_type, resource_id, conversation_id);

-- Creation pattern mirrors one-to-one Conversation identity:
-- 1. INSERT identity ON CONFLICT DO NOTHING.
-- 2. SELECT identity FOR UPDATE.
-- 3. Existing scope_id -> reuse.
-- 4. No scope_id -> create scope + primary resource + fill identity in the same transaction.
--
-- The uniqueness is intentionally conversation-scoped rather than globally
-- resource-scoped. The owning-domain authorization adapter is responsible for
-- preventing an authorized resource from being linked to an unrelated
-- Conversation. This avoids baking domain-specific cardinality assumptions into
-- Message Core.
