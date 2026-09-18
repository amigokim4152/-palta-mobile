-- PALTA LOCAL BUSINESS PUBLIC DISCOVERY
-- Final desired state for canonical Business -> local search/map projection.
-- palta-dev live migration names:
--   local_business_public_discovery_v1
--   local_business_discovery_security_hardening_v1

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

alter table public.business
  add column if not exists lifecycle_state text not null default 'active',
  add column if not exists public_discovery_enabled boolean not null default true,
  add column if not exists operational_state text not null default 'unknown_or_stale',
  add column if not exists operational_confirmed_at timestamptz,
  add column if not exists service_ids text[] not null default '{}',
  add column if not exists offering_ids text[] not null default '{}',
  add column if not exists capability_ids text[] not null default '{}',
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.business'::regclass
      and conname = 'business_lifecycle_state_check'
  ) then
    alter table public.business
      add constraint business_lifecycle_state_check
      check (lifecycle_state in ('active','paused','closed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.business'::regclass
      and conname = 'business_operational_state_check'
  ) then
    alter table public.business
      add constraint business_operational_state_check
      check (operational_state in (
        'open_now','closed_now','closed_today','temporarily_closed',
        'seasonal_closed','paused','permanently_closed','unknown_or_stale'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.place'::regclass
      and conname = 'place_location_precision_check'
  ) then
    alter table public.place
      add constraint place_location_precision_check
      check (location_precision in ('exact','area_only','hidden','unknown'));
  end if;
end $$;

create table if not exists public.business_public_profile (
  business_id uuid primary key references public.business(entity_id) on delete cascade,
  description text,
  hours_summary text,
  service_labels text[] not null default '{}',
  service_area_labels text[] not null default '{}',
  service_area_codes text[] not null default '{}',
  photo_urls text[] not null default '{}',
  search_text text not null default '',
  contact jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  check (description is null or char_length(description) <= 2000),
  check (hours_summary is null or char_length(hours_summary) <= 500),
  check (coalesce(array_length(service_labels, 1), 0) <= 50),
  check (coalesce(array_length(service_area_labels, 1), 0) <= 50),
  check (coalesce(array_length(service_area_codes, 1), 0) <= 50),
  check (coalesce(array_length(photo_urls, 1), 0) <= 12),
  check (char_length(search_text) <= 5000),
  check (jsonb_typeof(contact) = 'object')
);

alter table public.business_public_profile enable row level security;
revoke all on table public.business_public_profile from public, anon, authenticated;
grant select, insert, update, delete on table public.business_public_profile to service_role;

-- place.geom can contain a private/home anchor. Public clients never read it directly.
drop policy if exists place_public_read on public.place;
revoke select on table public.place from anon, authenticated;

create index if not exists business_public_discovery_idx
  on public.business (public_discovery_enabled, lifecycle_state, verification_status, operational_state);
create index if not exists business_category_key_idx
  on public.business (category_key);
create index if not exists canonical_entity_display_name_trgm_idx
  on public.canonical_entity using gin (display_name extensions.gin_trgm_ops);
create index if not exists business_public_profile_search_text_trgm_idx
  on public.business_public_profile using gin (search_text extensions.gin_trgm_ops);
create index if not exists business_public_profile_service_area_codes_gin
  on public.business_public_profile using gin (service_area_codes);

create or replace function public.local_business_search(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 5000,
  p_query text default null,
  p_comuna_code text default null,
  p_limit integer default 100
)
returns table (
  entity_id uuid,
  entity_type text,
  name text,
  category_key text,
  distance_m integer,
  verification_status text,
  operational_state text,
  operational_confirmed_at timestamptz,
  location jsonb,
  preview jsonb
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_origin geography;
  v_query text := lower(nullif(btrim(p_query), ''));
  v_comuna text := nullif(btrim(p_comuna_code), '');
begin
  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'invalid_lat_lng' using errcode = '22023';
  end if;
  if p_radius_m is null or p_radius_m < 100 or p_radius_m > 100000 then
    raise exception 'invalid_radius_m' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'invalid_limit' using errcode = '22023';
  end if;

  v_origin := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;

  return query
  select
    b.entity_id,
    'business'::text,
    coalesce(ce.display_name, '')::text,
    b.category_key,
    case
      when pl.location_precision = 'exact' and pl.geom is not null
        then round(st_distance(v_origin, pl.geom))::integer
      else null
    end,
    b.verification_status,
    b.operational_state,
    b.operational_confirmed_at,
    case
      when pl.location_precision = 'exact' and pl.geom is not null then
        jsonb_build_object('lat', st_y(pl.geom::geometry), 'lng', st_x(pl.geom::geometry))
      else null
    end,
    jsonb_strip_nulls(jsonb_build_object(
      'image_url', case when coalesce(array_length(bp.photo_urls, 1), 0) > 0 then bp.photo_urls[1] else null end,
      'service_labels', coalesce(bp.service_labels, '{}'::text[])
    ))
  from public.business b
  join public.canonical_entity ce on ce.id = b.entity_id
  left join public.place pl on pl.entity_id = b.primary_place_id
  left join public.business_public_profile bp on bp.business_id = b.entity_id
  where ce.entity_type = 'business'
    and ce.status = 'active'
    and b.lifecycle_state = 'active'
    and b.public_discovery_enabled = true
    and b.verification_status <> 'suspended'
    and b.operational_state <> 'permanently_closed'
    and (
      (pl.location_precision = 'exact' and pl.geom is not null and st_dwithin(v_origin, pl.geom, p_radius_m))
      or (
        v_comuna is not null
        and (
          (pl.location_precision in ('area_only','hidden') and pl.comuna_code = v_comuna)
          or v_comuna = any(coalesce(bp.service_area_codes, '{}'::text[]))
        )
      )
    )
    and (
      v_query is null
      or position(v_query in lower(coalesce(ce.display_name, ''))) > 0
      or position(v_query in lower(coalesce(b.category_key, ''))) > 0
      or position(v_query in lower(coalesce(bp.search_text, ''))) > 0
      or exists (
        select 1 from unnest(coalesce(bp.service_labels, '{}'::text[])) label
        where position(v_query in lower(label)) > 0
      )
    )
  order by
    case b.operational_state
      when 'open_now' then 0
      when 'closed_now' then 1
      when 'closed_today' then 2
      when 'unknown_or_stale' then 3
      when 'temporarily_closed' then 4
      when 'seasonal_closed' then 5
      when 'paused' then 6
      else 7
    end,
    case when pl.location_precision = 'exact' and pl.geom is not null
      then st_distance(v_origin, pl.geom) else null end nulls last,
    ce.display_name asc nulls last
  limit p_limit;
end;
$$;

-- Only trusted Palta backend infrastructure may cross the raw-data boundary.
revoke all on function public.local_business_search(double precision,double precision,integer,text,text,integer) from public, anon, authenticated;
grant execute on function public.local_business_search(double precision,double precision,integer,text,text,integer) to service_role;

comment on function public.local_business_search(double precision,double precision,integer,text,text,integer)
is 'Privacy-safe canonical Local Business discovery. Exact storefronts may expose point/distance; area-only/hidden businesses never expose private coordinates or exact distance.';
