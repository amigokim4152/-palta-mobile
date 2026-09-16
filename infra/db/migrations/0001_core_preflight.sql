-- PALTA CORE DB PREFLIGHT
-- STATUS: DRAFT / NOT APPLIED
-- Primary v1 target: Supabase Postgres/PostGIS.
-- Kept Postgres-standard enough to remain portable to Neon fallback.

create extension if not exists pgcrypto;
create extension if not exists postgis;

create table if not exists canonical_entity (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  canonical_key text not null,
  display_name text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(entity_type, canonical_key)
);

create table if not exists place (
  entity_id uuid primary key references canonical_entity(id) on delete cascade,
  geom geography(point, 4326),
  comuna_code text,
  address_text text,
  location_precision text not null default 'unknown'
);

create index if not exists place_geom_gix on place using gist (geom);

create table if not exists business (
  entity_id uuid primary key references canonical_entity(id) on delete cascade,
  primary_place_id uuid references place(entity_id),
  category_key text,
  verification_status text not null default 'unverified'
);

create table if not exists care_track (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  subject_entity_id uuid references canonical_entity(id),
  intent_key text not null,
  state text not null,
  waiting_for text,
  expected_at timestamptz,
  next_check_at timestamptz,
  next_action jsonb,
  result jsonb,
  outcome jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists care_track_user_state_idx
  on care_track(user_id, state);

create table if not exists home_candidate (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  candidate_type text not null,
  source_domain text not null,
  related_entity_id uuid references canonical_entity(id),
  care_track_id uuid references care_track(id),
  relevance numeric,
  importance numeric,
  urgency numeric,
  action_required boolean not null default false,
  delivery_hint text not null default 'home',
  dedupe_key text,
  valid_from timestamptz,
  valid_until timestamptz,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists home_candidate_user_valid_idx
  on home_candidate(user_id, valid_until);

-- Intentionally not frozen here:
-- Supabase auth.user FK strategy
-- RLS policies
-- family/legal authority
-- payment/messaging/review tables
-- domain-specific listing schemas
