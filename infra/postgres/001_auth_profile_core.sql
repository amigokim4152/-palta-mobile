begin;

create schema if not exists palta_private;
revoke all on schema palta_private from public;
alter default privileges in schema palta_private revoke all on tables from public;

create table if not exists palta_private.accounts (
  palta_user_id text primary key,
  status text not null check (status in ('active', 'restricted', 'pending_deletion', 'deleted')),
  preferred_language text not null,
  timezone text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary_verified_email text null
);

create table if not exists palta_private.identities (
  identity_id text primary key,
  palta_user_id text not null references palta_private.accounts(palta_user_id),
  provider text not null check (provider in ('apple', 'google', 'email', 'phone')),
  provider_subject text not null,
  state text not null check (state in ('active', 'revoked')),
  linked_at timestamptz not null,
  verified_email text null,
  last_verified_at timestamptz null,
  unique (provider, provider_subject)
);

create index if not exists identities_by_user
  on palta_private.identities (palta_user_id, state);

create table if not exists palta_private.core_profiles (
  palta_user_id text primary key references palta_private.accounts(palta_user_id),
  preferred_language text not null,
  timezone text not null,
  updated_at timestamptz not null,
  preferred_name text null,
  profile_photo_ref text null,
  country_code text null
);

create table if not exists palta_private.consents (
  palta_user_id text not null references palta_private.accounts(palta_user_id),
  policy_key text not null,
  version text not null,
  accepted_at timestamptz not null,
  source text not null check (source in ('onboarding', 'settings', 'action')),
  primary key (palta_user_id, policy_key, version)
);

create table if not exists palta_private.life_areas (
  area_id text primary key,
  palta_user_id text not null references palta_private.accounts(palta_user_id),
  kind text not null check (kind in ('home', 'work', 'saved', 'exploring')),
  country_code text not null,
  region_code text null,
  commune_code text null,
  neighborhood_label text null
);

create index if not exists life_areas_by_user_kind
  on palta_private.life_areas (palta_user_id, kind);

create table if not exists palta_private.visible_profiles (
  palta_user_id text not null references palta_private.accounts(palta_user_id),
  scope_id text not null,
  display_name text not null,
  profile_photo_ref text null,
  primary key (palta_user_id, scope_id)
);

revoke all on all tables in schema palta_private from public;

comment on schema palta_private is
  'Server-only Palta canonical identity/profile data. Do not expose directly to public clients or general analytics.';
comment on table palta_private.identities is
  'Provider identities are login bindings; provider identifiers are not canonical Palta user IDs.';
comment on table palta_private.core_profiles is
  'Lightweight locale/presentation profile only. Household, organization, health and finance remain separate domain data.';

commit;
