-- Community outbox claim/retry/publish smoke.
-- Runs inside a transaction and rolls back its fixture row.

begin;

insert into public.community_outbox(event_type, aggregate_type, aggregate_id, payload)
values (
  'community.school_item.changed',
  'community_school_item',
  '33333333-3333-4333-8333-333333333333'::uuid,
  '{"smoke":true}'::jsonb
);

with candidate as (
  select id
  from public.community_outbox
  where event_type = 'community.school_item.changed'
    and (
      (status in ('pending','retryable_error') and (next_attempt_at is null or next_attempt_at <= now()))
      or (status = 'processing' and lease_expires_at is not null and lease_expires_at <= now())
    )
  order by created_at
  for update skip locked
  limit 1
)
update public.community_outbox o
set status = 'processing',
    claimed_by = 'community-smoke-worker',
    processing_started_at = now(),
    lease_expires_at = now() + interval '2 minutes',
    updated_at = now()
from candidate c
where o.id = c.id;

do $$
declare
  v_processing int;
  v_reclaimable int;
begin
  select count(*) into v_processing
  from public.community_outbox
  where claimed_by = 'community-smoke-worker'
    and status = 'processing'
    and lease_expires_at > now();
  if v_processing <> 1 then
    raise exception 'COMMUNITY_OUTBOX_SMOKE_PROCESSING_EXPECTED_1_GOT_%', v_processing;
  end if;

  select count(*) into v_reclaimable
  from public.community_outbox
  where claimed_by = 'community-smoke-worker'
    and (
      (status in ('pending','retryable_error') and (next_attempt_at is null or next_attempt_at <= now()))
      or (status = 'processing' and lease_expires_at is not null and lease_expires_at <= now())
    );
  if v_reclaimable <> 0 then
    raise exception 'COMMUNITY_OUTBOX_SMOKE_LIVE_LEASE_MUST_NOT_RECLAIM';
  end if;
end $$;

update public.community_outbox
set status = 'retryable_error',
    attempts = 1,
    next_attempt_at = now() + interval '30 seconds',
    claimed_by = null,
    processing_started_at = null,
    lease_expires_at = null,
    last_error_code = 'SMOKE_RETRY',
    updated_at = now()
where claimed_by = 'community-smoke-worker';

do $$
declare v_due int;
begin
  select count(*) into v_due
  from public.community_outbox
  where last_error_code = 'SMOKE_RETRY'
    and status = 'retryable_error'
    and next_attempt_at <= now();
  if v_due <> 0 then
    raise exception 'COMMUNITY_OUTBOX_SMOKE_RETRY_MUST_WAIT';
  end if;
end $$;

update public.community_outbox
set next_attempt_at = now() - interval '1 second'
where last_error_code = 'SMOKE_RETRY';

with candidate as (
  select id
  from public.community_outbox
  where event_type = 'community.school_item.changed'
    and status in ('pending','retryable_error')
    and (next_attempt_at is null or next_attempt_at <= now())
  order by created_at
  for update skip locked
  limit 1
)
update public.community_outbox o
set status = 'processing',
    claimed_by = 'community-smoke-worker-2',
    processing_started_at = now(),
    lease_expires_at = now() + interval '2 minutes',
    updated_at = now()
from candidate c
where o.id = c.id;

do $$
declare v_claimed int;
begin
  select count(*) into v_claimed
  from public.community_outbox
  where claimed_by = 'community-smoke-worker-2' and status = 'processing';
  if v_claimed <> 1 then
    raise exception 'COMMUNITY_OUTBOX_SMOKE_RETRY_RECLAIM_EXPECTED_1_GOT_%', v_claimed;
  end if;
end $$;

update public.community_outbox
set status = 'published',
    published_at = now(),
    claimed_by = null,
    processing_started_at = null,
    lease_expires_at = null,
    next_attempt_at = null,
    last_error_code = null,
    updated_at = now()
where claimed_by = 'community-smoke-worker-2';

do $$
declare v_published int;
begin
  select count(*) into v_published
  from public.community_outbox
  where payload @> '{"smoke":true}'::jsonb
    and status = 'published'
    and published_at is not null;
  if v_published <> 1 then
    raise exception 'COMMUNITY_OUTBOX_SMOKE_PUBLISHED_EXPECTED_1_GOT_%', v_published;
  end if;
end $$;

rollback;
