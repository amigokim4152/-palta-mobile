-- Align database search semantics with Local Business domain discovery.
-- - token/synonym query matching (shortcut phrases are OR-like expansions)
-- - accent-tolerant Spanish search
-- - identical operational-state ordering to businessOperationalSortRank()

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
  v_query text := nullif(
    btrim(translate(lower(coalesce(p_query, '')), 'áéíóúüñ', 'aeiouun')),
    ''
  );
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
        jsonb_build_object(
          'lat', st_y(pl.geom::geometry),
          'lng', st_x(pl.geom::geometry)
        )
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
      (
        pl.location_precision = 'exact'
        and pl.geom is not null
        and st_dwithin(v_origin, pl.geom, p_radius_m)
      )
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
      or exists (
        select 1
        from regexp_split_to_table(v_query, E'\\s+') term
        where char_length(term) >= 2
          and (
            position(term in translate(lower(coalesce(ce.display_name, '')), 'áéíóúüñ', 'aeiouun')) > 0
            or position(term in translate(lower(coalesce(b.category_key, '')), 'áéíóúüñ', 'aeiouun')) > 0
            or position(term in translate(lower(coalesce(bp.search_text, '')), 'áéíóúüñ', 'aeiouun')) > 0
            or exists (
              select 1
              from unnest(coalesce(bp.service_labels, '{}'::text[])) label
              where position(term in translate(lower(label), 'áéíóúüñ', 'aeiouun')) > 0
            )
          )
      )
    )
  order by
    case b.operational_state
      when 'open_now' then 0
      when 'unknown_or_stale' then 1
      when 'closed_now' then 2
      when 'closed_today' then 3
      when 'temporarily_closed' then 4
      when 'seasonal_closed' then 5
      when 'paused' then 6
      when 'permanently_closed' then 7
      else 1
    end,
    case
      when pl.location_precision = 'exact' and pl.geom is not null
        then st_distance(v_origin, pl.geom)
      else null
    end nulls last,
    ce.display_name asc nulls last
  limit p_limit;
end;
$$;

revoke all on function public.local_business_search(double precision,double precision,integer,text,text,integer)
  from public, anon, authenticated;
grant execute on function public.local_business_search(double precision,double precision,integer,text,text,integer)
  to service_role;
