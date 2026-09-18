-- PALTA AUTH / PROFILE PREFLIGHT
-- STATUS: DRAFT / NOT APPLIED
-- Canonical v1 identity model for the shared Supabase Postgres database.
-- Reconciles infra/postgres/001_auth_profile_core.sql with the UUID user IDs
-- already used by Care, Home and Community. The infra/postgres file remains
-- staging/reference only and MUST NOT be applied in parallel.

create schema if not exists palta_private;
revoke all on schema palta_private from public, anon, authenticated;
alter default privileges in schema palta_private revoke all on tables from public, anon, authenticated;

create table if not exists palta_private.accounts (
  palta_user_id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('active', 'restricted', 'pending_deletion', 'deleted')),
  preferred_language text not null,
  timezone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary_verified_email text null
);

create table if not exists palta_private.identities (
  identity_id uuid primary key default gen_random_uuid(),
  palta_user_id uuid not null references palta_private.accounts(palta_user_id) on delete cascade,
  provider text not null check (provider in ('apple', 'google', 'email', 'phone')),
  provider_subject text not null,
  state text not null check (state in ('active', 'revoked')),
  linked_at timestamptz not null default now(),
  verified_email text null,
  last_verified_at timestamptz null,
  unique (provider, provider_subject)
);

create index if not exists identities_by_user
  on palta_private.identities (palta_user_id, state);

create table if not exists palta_private.core_profiles (
  palta_user_id uuid primary key references palta_private.accounts(palta_user_id) on delete cascade,
  preferred_language text not null,
  timezone text not null,
  updated_at timestamptz not null default now(),
  preferred_name text null,
  profile_photo_ref text null,
  country_code text null
);

create table if not exists palta_private.consents (
  palta_user_id uuid not null references palta_private.accounts(palta_user_id) on delete cascade,
  policy_key text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  source text not null check (source in ('onboarding', 'settings', 'action')),
  primary key (palta_user_id, policy_key, version)
);

create table if not exists palta_private.life_areas (
  area_id uuid primary key default gen_random_uuid(),
  palta_user_id uuid not null references palta_private.accounts(palta_user_id) on delete cascade,
  kind text not null check (kind in ('home', 'work', 'saved', 'exploring')),
  country_code text not null,
  region_code text null,
  commune_code text null,
  neighborhood_label text null
);

create index if not exists life_areas_by_user_kind
  on palta_private.life_areas (palta_user_id, kind);

create table if not exists palta_private.visible_profiles (
  palta_user_id uuid not null references palta_private.accounts(palta_user_id) on delete cascade,
  scope_id text not null,
  display_name text not null,
  profile_photo_ref text null,
  primary key (palta_user_id, scope_id)
);

-- Provider auth subjects are login bindings only. They never become Palta user IDs.
-- The Palta API verifies the bearer session, obtains the provider subject, then
-- resolves it through this table to one canonical palta_user_id UUID.

-- Once this migration is applied, private domain rows use the same UUID identity.
alter table care_track
  add constraint care_track_user_fk
  foreign key (user_id) references palta_private.accounts(palta_user_id);

alter table home_candidate
  add constraint home_candidate_user_fk
  foreign key (user_id) references palta_private.accounts(palta_user_id);

alter table community_membership
  add constraint community_membership_user_fk
  foreign key (user_id) references palta_private.accounts(palta_user_id);

alter table community_post
  add constraint community_post_author_fk
  foreign key (author_user_id) references palta_private.accounts(palta_user_id);

alter table community_comment
  add constraint community_comment_author_fk
  foreign key (author_user_id) references palta_private.accounts(palta_user_id);

alter table community_reaction
  add constraint community_reaction_actor_fk
  foreign key (actor_user_id) references palta_private.accounts(palta_user_id);

alter table community_mutation_receipt
  add constraint community_mutation_receipt_user_fk
  foreign key (user_id) references palta_private.accounts(palta_user_id);

revoke all on all tables in schema palta_private from public, anon, authenticated;
grant usage on schema palta_private to service_role;
grant select, insert, update, delete on all tables in schema palta_private to service_role;

comment on schema palta_private is
  'Server-only Palta canonical identity/profile data. Never expose directly to mobile clients or general analytics.';
comment on table palta_private.identities is
  'Provider identities are login bindings. provider_subject is not a canonical Palta user ID.';
comment on column palta_private.accounts.palta_user_id is
  'Canonical Palta UUID shared by private domain persistence. Serialized as a string at TypeScript/API boundaries.';
