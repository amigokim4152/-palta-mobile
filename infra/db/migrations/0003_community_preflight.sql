-- PALTA COMMUNITY DB PREFLIGHT
-- STATUS: APPLIED + VERIFIED ON palta-dev (2026-09-18)
-- Primary v1 target: Supabase Postgres.
-- Community mutations enter through the Palta API; mobile clients do not write these tables directly.

create table if not exists community_space (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  space_type text not null check (space_type in ('organization','geo','interest','activity')),
  visibility text not null,
  join_policy text not null default 'approval_required'
    check (join_policy in ('open','approval_required','invite_only')),
  created_by_user_id uuid not null,
  organization_id text,
  academic_period_id text,
  class_group_id text,
  geo_scope_id text,
  interest_key text,
  activity_ref_id text,
  default_audience jsonb not null default '{}'::jsonb,
  source_type text,
  source_id text,
  effective_from timestamptz,
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (space_type = 'organization' and organization_id is not null) or
    (space_type = 'geo' and geo_scope_id is not null) or
    (space_type = 'interest' and interest_key is not null) or
    (space_type = 'activity' and activity_ref_id is not null)
  )
);

create table if not exists community_membership (
  id uuid primary key default gen_random_uuid(),
  community_space_id uuid not null references community_space(id) on delete cascade,
  user_id uuid not null,
  state text not null check (state in ('invited','pending','active','suspended','left','removed','rejected')),
  role_key text not null default 'member'
    check (role_key in ('member','guardian','student','teacher','staff','leader','admin')),
  eligibility jsonb not null default '{}'::jsonb,
  requested_at timestamptz,
  decided_at timestamptz,
  decided_by_user_id uuid,
  ended_at timestamptz,
  end_reason text,
  effective_from timestamptz,
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_space_id, user_id)
);
create index if not exists community_membership_user_state_idx
  on community_membership(user_id, state, community_space_id);
create index if not exists community_membership_space_state_idx
  on community_membership(community_space_id, state, requested_at);

create table if not exists community_post (
  id uuid primary key default gen_random_uuid(),
  community_space_id uuid not null references community_space(id) on delete cascade,
  author_user_id uuid not null,
  body text not null,
  audience jsonb not null default '{}'::jsonb,
  pinned boolean not null default false,
  announcement boolean not null default false,
  content_state text not null,
  moderation_state text not null,
  source_type text,
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_post_feed_idx
  on community_post(community_space_id, created_at desc);

create table if not exists community_school_item (
  id uuid primary key default gen_random_uuid(),
  community_space_id uuid not null references community_space(id) on delete cascade,
  post_id uuid not null references community_post(id) on delete cascade,
  stage text not null check (stage in ('announcement','schedule','supplies','child_notice')),
  title text not null,
  detail text not null,
  action_required boolean not null default false,
  sensitive boolean not null default false,
  recipient_user_id uuid,
  due_at timestamptz,
  created_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not sensitive or recipient_user_id is not null),
  check (stage <> 'child_notice' or (sensitive and recipient_user_id is not null))
);
create index if not exists community_school_item_space_due_idx
  on community_school_item(community_space_id, due_at, stage);
create unique index if not exists community_school_item_dedupe_idx
  on community_school_item(
    community_space_id,
    post_id,
    stage,
    coalesce(recipient_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table if not exists community_comment (
  id uuid primary key default gen_random_uuid(),
  community_space_id uuid not null references community_space(id) on delete cascade,
  post_id uuid not null references community_post(id) on delete cascade,
  author_user_id uuid not null,
  body text not null,
  parent_comment_id uuid references community_comment(id),
  content_state text not null,
  moderation_state text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_comment_thread_idx
  on community_comment(post_id, created_at);

create table if not exists community_reaction (
  id uuid primary key default gen_random_uuid(),
  community_space_id uuid not null references community_space(id) on delete cascade,
  actor_user_id uuid not null,
  target_type text not null check (target_type in ('post','comment')),
  target_id uuid not null,
  reaction_key text not null,
  created_at timestamptz not null default now(),
  unique (actor_user_id, target_type, target_id, reaction_key)
);

create table if not exists community_mutation_receipt (
  user_id uuid not null,
  idempotency_key text not null,
  operation_key text not null,
  resource_id uuid,
  created_at timestamptz not null default now(),
  primary key (user_id, idempotency_key)
);

create table if not exists community_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists community_outbox_unpublished_idx
  on community_outbox(created_at) where published_at is null;

-- Identity FK strategy remains deliberately aligned with the existing DB preflight:
-- user IDs are UUIDs resolved by the authenticated API/session boundary. A hard FK to
-- auth.users is deferred until the canonical auth/profile migration is reconciled.
