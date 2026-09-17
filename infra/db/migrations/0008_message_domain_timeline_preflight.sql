-- PALTA MESSAGE DOMAIN TIMELINE PREFLIGHT
-- STATUS: DRAFT / NOT APPLIED
-- Date: 2026-09-17
--
-- Human messages and domain state changes may appear in one UI timeline, but
-- they remain different canonical records. This table stores only a durable
-- reference to an authorized domain event/resource. Domain payload stays in the
-- owning core.

create table if not exists msg_timeline_domain_event (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references msg_conversation(id) on delete cascade,
  scope_id uuid not null,
  sequence bigint not null check (sequence > 0),
  source_core text not null check (length(trim(source_core)) between 1 and 120),
  domain_event_id text not null check (length(trim(domain_event_id)) between 1 and 240),
  event_type text not null check (length(trim(event_type)) between 1 and 160),
  resource_type text not null check (length(trim(resource_type)) between 1 and 120),
  resource_id text not null check (length(trim(resource_id)) between 1 and 240),
  occurred_at timestamptz not null,
  projected_at timestamptz not null default now(),
  unique (conversation_id, sequence),
  unique (conversation_id, source_core, domain_event_id),
  foreign key (conversation_id, scope_id)
    references msg_conversation_scope(conversation_id, id)
    on delete restrict
);

create index if not exists msg_timeline_domain_event_cursor_idx
  on msg_timeline_domain_event(conversation_id, sequence asc);

create index if not exists msg_timeline_domain_event_scope_idx
  on msg_timeline_domain_event(scope_id, sequence desc);

-- The same canonical sequence space is shared with msg_message through
-- msg_conversation.last_sequence. Writers therefore MUST lock msg_conversation
-- before allocating either a message or domain-event sequence.
--
-- Projection is allowed only when the target resource is already authorized and
-- linked in msg_scope_resource for this Scope. No order payload, shipment
-- address, fiscal document body, phone/email or bearer/share token is stored here.
