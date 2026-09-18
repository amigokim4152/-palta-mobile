-- Shared Chile Country Layer registry. Local Business, Home, Community,
-- Public Data and future verticals must resolve the same official territorial
-- identity instead of maintaining module-specific comuna lists.

create table if not exists public.administrative_area (
  country_code text not null,
  code text not null,
  level text not null,
  name text not null,
  slug text not null,
  parent_code text,
  region_code text,
  province_code text,
  source_key text not null,
  source_version text not null,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (country_code, code),
  constraint administrative_area_level_check check (level in ('region','province','comuna')),
  constraint administrative_area_code_shape_check check (
    (level = 'region' and code ~ '^[0-9]{2}$') or
    (level = 'province' and code ~ '^[0-9]{3}$') or
    (level = 'comuna' and code ~ '^[0-9]{5}$')
  ),
  constraint administrative_area_parent_fk foreign key (country_code, parent_code)
    references public.administrative_area(country_code, code)
    deferrable initially deferred
);

create unique index if not exists administrative_area_country_level_slug_uq
  on public.administrative_area(country_code, level, slug);
create index if not exists administrative_area_country_level_name_idx
  on public.administrative_area(country_code, level, name);
create index if not exists administrative_area_parent_idx
  on public.administrative_area(country_code, parent_code)
  where parent_code is not null;

alter table public.administrative_area enable row level security;
drop policy if exists administrative_area_public_read on public.administrative_area;
create policy administrative_area_public_read
  on public.administrative_area
  for select
  to anon, authenticated
  using (active = true);

revoke insert, update, delete on public.administrative_area from anon, authenticated;

-- Región Metropolitana de Santiago: 1 region, 6 provinces, 52 comunas.
-- CUT source: SUBDERE / Decreto Exento N° 1.115 (2018), cross-checked
-- against INE's current territorial codebook.
insert into public.administrative_area
  (country_code, code, level, name, slug, parent_code, region_code, province_code, source_key, source_version)
values
  ('CL','13','region','Metropolitana de Santiago','metropolitana-de-santiago',null,'13',null,'SUBDERE_CUT','2018-09-06'),
  ('CL','131','province','Santiago','santiago','13','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','132','province','Cordillera','cordillera','13','13','132','SUBDERE_CUT','2018-09-06'),
  ('CL','133','province','Chacabuco','chacabuco','13','13','133','SUBDERE_CUT','2018-09-06'),
  ('CL','134','province','Maipo','maipo','13','13','134','SUBDERE_CUT','2018-09-06'),
  ('CL','135','province','Melipilla','melipilla','13','13','135','SUBDERE_CUT','2018-09-06'),
  ('CL','136','province','Talagante','talagante','13','13','136','SUBDERE_CUT','2018-09-06'),
  ('CL','13101','comuna','Santiago','santiago','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13102','comuna','Cerrillos','cerrillos','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13103','comuna','Cerro Navia','cerro-navia','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13104','comuna','Conchalí','conchali','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13105','comuna','El Bosque','el-bosque','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13106','comuna','Estación Central','estacion-central','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13107','comuna','Huechuraba','huechuraba','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13108','comuna','Independencia','independencia','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13109','comuna','La Cisterna','la-cisterna','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13110','comuna','La Florida','la-florida','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13111','comuna','La Granja','la-granja','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13112','comuna','La Pintana','la-pintana','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13113','comuna','La Reina','la-reina','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13114','comuna','Las Condes','las-condes','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13115','comuna','Lo Barnechea','lo-barnechea','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13116','comuna','Lo Espejo','lo-espejo','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13117','comuna','Lo Prado','lo-prado','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13118','comuna','Macul','macul','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13119','comuna','Maipú','maipu','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13120','comuna','Ñuñoa','nunoa','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13121','comuna','Pedro Aguirre Cerda','pedro-aguirre-cerda','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13122','comuna','Peñalolén','penalolen','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13123','comuna','Providencia','providencia','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13124','comuna','Pudahuel','pudahuel','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13125','comuna','Quilicura','quilicura','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13126','comuna','Quinta Normal','quinta-normal','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13127','comuna','Recoleta','recoleta','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13128','comuna','Renca','renca','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13129','comuna','San Joaquín','san-joaquin','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13130','comuna','San Miguel','san-miguel','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13131','comuna','San Ramón','san-ramon','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13132','comuna','Vitacura','vitacura','131','13','131','SUBDERE_CUT','2018-09-06'),
  ('CL','13201','comuna','Puente Alto','puente-alto','132','13','132','SUBDERE_CUT','2018-09-06'),
  ('CL','13202','comuna','Pirque','pirque','132','13','132','SUBDERE_CUT','2018-09-06'),
  ('CL','13203','comuna','San José de Maipo','san-jose-de-maipo','132','13','132','SUBDERE_CUT','2018-09-06'),
  ('CL','13301','comuna','Colina','colina','133','13','133','SUBDERE_CUT','2018-09-06'),
  ('CL','13302','comuna','Lampa','lampa','133','13','133','SUBDERE_CUT','2018-09-06'),
  ('CL','13303','comuna','Tiltil','tiltil','133','13','133','SUBDERE_CUT','2018-09-06'),
  ('CL','13401','comuna','San Bernardo','san-bernardo','134','13','134','SUBDERE_CUT','2018-09-06'),
  ('CL','13402','comuna','Buin','buin','134','13','134','SUBDERE_CUT','2018-09-06'),
  ('CL','13403','comuna','Calera de Tango','calera-de-tango','134','13','134','SUBDERE_CUT','2018-09-06'),
  ('CL','13404','comuna','Paine','paine','134','13','134','SUBDERE_CUT','2018-09-06'),
  ('CL','13501','comuna','Melipilla','melipilla','135','13','135','SUBDERE_CUT','2018-09-06'),
  ('CL','13502','comuna','Alhué','alhue','135','13','135','SUBDERE_CUT','2018-09-06'),
  ('CL','13503','comuna','Curacaví','curacavi','135','13','135','SUBDERE_CUT','2018-09-06'),
  ('CL','13504','comuna','María Pinto','maria-pinto','135','13','135','SUBDERE_CUT','2018-09-06'),
  ('CL','13505','comuna','San Pedro','san-pedro','135','13','135','SUBDERE_CUT','2018-09-06'),
  ('CL','13601','comuna','Talagante','talagante','136','13','136','SUBDERE_CUT','2018-09-06'),
  ('CL','13602','comuna','El Monte','el-monte','136','13','136','SUBDERE_CUT','2018-09-06'),
  ('CL','13603','comuna','Isla de Maipo','isla-de-maipo','136','13','136','SUBDERE_CUT','2018-09-06'),
  ('CL','13604','comuna','Padre Hurtado','padre-hurtado','136','13','136','SUBDERE_CUT','2018-09-06'),
  ('CL','13605','comuna','Peñaflor','penaflor','136','13','136','SUBDERE_CUT','2018-09-06')
on conflict (country_code, code) do update set
  level = excluded.level,
  name = excluded.name,
  slug = excluded.slug,
  parent_code = excluded.parent_code,
  region_code = excluded.region_code,
  province_code = excluded.province_code,
  source_key = excluded.source_key,
  source_version = excluded.source_version,
  active = true,
  updated_at = now();

create or replace function public.palta_resolve_cl_comunas(p_refs text[])
returns table(input_ref text, code text, name text, slug text)
language sql
stable
set search_path = public, pg_temp
as $$
  with requested as (
    select trim(ref) as input_ref, ord
    from unnest(coalesce(p_refs, '{}'::text[])) with ordinality as u(ref, ord)
    where nullif(trim(ref), '') is not null
  )
  select r.input_ref, a.code, a.name, a.slug
  from requested r
  join public.administrative_area a
    on a.country_code = 'CL'
   and a.level = 'comuna'
   and a.active = true
   and (
     a.code = r.input_ref
     or a.slug = lower(r.input_ref)
     or lower(a.name) = lower(r.input_ref)
   )
  order by r.ord;
$$;

revoke all on function public.palta_resolve_cl_comunas(text[]) from public, anon, authenticated;
grant execute on function public.palta_resolve_cl_comunas(text[]) to service_role;

create or replace function public.palta_validate_cl_comuna_codes(p_codes text[])
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select not exists (
    select 1
    from unnest(coalesce(p_codes, '{}'::text[])) as c(code)
    where nullif(trim(c.code), '') is not null
      and not exists (
        select 1
        from public.administrative_area a
        where a.country_code = 'CL'
          and a.level = 'comuna'
          and a.active = true
          and a.code = trim(c.code)
      )
  );
$$;

revoke all on function public.palta_validate_cl_comuna_codes(text[]) from public, anon, authenticated;
grant execute on function public.palta_validate_cl_comuna_codes(text[]) to service_role;

create or replace function public.palta_guard_business_area_codes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'place' then
    if new.comuna_code is not null
       and not public.palta_validate_cl_comuna_codes(array[new.comuna_code]) then
      raise exception 'invalid_comuna_code' using errcode = '22023';
    end if;
  else
    if not public.palta_validate_cl_comuna_codes(new.service_area_codes) then
      raise exception 'invalid_service_area_code' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.palta_guard_business_area_codes() from public, anon, authenticated;

drop trigger if exists place_validate_comuna_code on public.place;
create trigger place_validate_comuna_code
before insert or update of comuna_code on public.place
for each row execute function public.palta_guard_business_area_codes();

drop trigger if exists business_public_profile_validate_area_codes on public.business_public_profile;
create trigger business_public_profile_validate_area_codes
before insert or update of service_area_codes on public.business_public_profile
for each row execute function public.palta_guard_business_area_codes();

drop trigger if exists business_registration_intake_validate_area_codes on public.business_registration_intake;
create trigger business_registration_intake_validate_area_codes
before insert or update of service_area_codes on public.business_registration_intake
for each row execute function public.palta_guard_business_area_codes();
