-- PALTA MESSAGE RELATIONSHIP / INBOX PREFLIGHT
-- STATUS: DRAFT / NOT APPLIED
-- Date: 2026-09-17
--
-- One durable Conversation is reused for the same one-to-one actor pair.
-- Orders, repairs, bookings and shipments are Conversation Scopes, not new chats.

create table if not exists msg_one_to_one_identity (
  actor_a_type text not null,
  actor_a_id text not null,
  actor_b_type text not null,
  actor_b_id text not null,
  conversation_id uuid unique references msg_conversation(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (actor_a_type, actor_a_id, actor_b_type, actor_b_id),
  check (
    actor_a_type <> actor_b_type
    or actor_a_id <> actor_b_id
  )
);

-- actor_a / actor_b are canonicalized server-side by actor_type + actor_id so
-- (user U, business B) and (business B, user U) cannot create two identities.
-- The nullable conversation_id is intentional: ensureOneToOne first inserts or
-- locks the identity row, then creates the conversation and fills this value in
-- the SAME transaction. Competing creators serialize on the identity row.

create index if not exists msg_conversation_inbox_activity_idx
  on msg_conversation(last_activity_at desc, id desc);

create index if not exists msg_participant_inbox_idx
  on msg_participant(actor_type, actor_id, left_at, archived, conversation_id);
