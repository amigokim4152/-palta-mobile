-- PALTA COMMUNITY OUTBOX DELIVERY HARDENING
-- Mirrors the proven Commerce outbox operating shape so Community events can be
-- claimed, retried and dead-lettered without duplicate worker races.

alter table public.community_outbox
  add column if not exists status text not null default 'pending',
  add column if not exists attempts integer not null default 0,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists claimed_by text,
  add column if not exists processing_started_at timestamptz,
  add column if not exists lease_expires_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.community_outbox'::regclass
      and conname = 'community_outbox_status_check'
  ) then
    alter table public.community_outbox
      add constraint community_outbox_status_check
      check (status in ('pending','processing','published','retryable_error','dead_letter'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.community_outbox'::regclass
      and conname = 'community_outbox_attempts_check'
  ) then
    alter table public.community_outbox
      add constraint community_outbox_attempts_check
      check (attempts >= 0);
  end if;
end $$;

create index if not exists community_outbox_dispatch_idx
  on public.community_outbox(status, next_attempt_at, created_at)
  where status in ('pending','retryable_error');

create index if not exists community_outbox_claim_idx
  on public.community_outbox(status, next_attempt_at, lease_expires_at, created_at)
  where status in ('pending','retryable_error','processing');
