-- PALTA COMMUNITY ACCESS BOUNDARY PREFLIGHT
-- STATUS: APPLIED + VERIFIED ON palta-dev (2026-09-18)
-- Primary v1 target: Supabase Postgres.
-- Reads and mutations are mediated by the Palta API. No direct mobile writes.

alter table public.community_space enable row level security;
alter table public.community_membership enable row level security;
alter table public.community_post enable row level security;
alter table public.community_school_item enable row level security;
alter table public.community_comment enable row level security;
alter table public.community_reaction enable row level security;
alter table public.community_mutation_receipt enable row level security;
alter table public.community_outbox enable row level security;

-- Explicitly keep side-effecting Community tables server-only.
revoke all on table public.community_space from anon, authenticated;
revoke all on table public.community_membership from anon, authenticated;
revoke all on table public.community_post from anon, authenticated;
revoke all on table public.community_school_item from anon, authenticated;
revoke all on table public.community_comment from anon, authenticated;
revoke all on table public.community_reaction from anon, authenticated;
revoke all on table public.community_mutation_receipt from anon, authenticated;
revoke all on table public.community_outbox from anon, authenticated;

grant select, insert, update, delete on table public.community_space to service_role;
grant select, insert, update, delete on table public.community_membership to service_role;
grant select, insert, update, delete on table public.community_post to service_role;
grant select, insert, update, delete on table public.community_school_item to service_role;
grant select, insert, update, delete on table public.community_comment to service_role;
grant select, insert, update, delete on table public.community_reaction to service_role;
grant select, insert, update, delete on table public.community_mutation_receipt to service_role;
grant select, insert, update, delete on table public.community_outbox to service_role;

-- No anon/authenticated policies are intentionally created here. Even when RLS is
-- enabled, the app does not query Community tables directly. The Palta API resolves
-- auth.uid(), maps it to the canonical Palta identity boundary, and applies Community
-- membership + audience + moderation + block/mute + record-level authorization.
--
-- This avoids duplicating rich Community authorization rules in both SQL policies and
-- the Community Core. If a future read-only Data API surface is introduced, it must
-- receive a separate reviewed migration and may not weaken this server-only baseline.

comment on table public.community_school_item is
  'Structured school flow items; child notices remain recipient-scoped and server mediated.';
comment on table public.community_mutation_receipt is
  'Idempotency receipts for authenticated Palta API mutations; never client writable.';
comment on table public.community_outbox is
  'Transactional event bridge for Community -> Event/Notification/Home processing; server only.';
