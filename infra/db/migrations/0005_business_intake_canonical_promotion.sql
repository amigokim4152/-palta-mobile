-- PALTA BUSINESS REGISTRATION INTAKE -> CANONICAL BUSINESS
-- Final reproducible state for the owner 3-minute registration flow.
-- Trusted Palta backend only: mobile clients never receive service-role credentials.

create table if not exists public.business_registration_intake (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending_verification'
    check (status in ('pending_verification','matched_existing','approved','rejected','cancelled')),
  mode text not null default 'create_new'
    check (mode in ('create_new','claim_existing')),
  existing_business_id uuid references public.business(entity_id) on delete set null,
  business_name text not null
    check (char_length(trim(business_name)) between 2 and 160),
  normalized_name text generated always as (lower(trim(business_name))) stored,
  owner_description text not null
    check (char_length(trim(owner_description)) between 2 and 600),
  confirmed_service_ids text[] not null default '{}'
    check (
      coalesce(array_length(confirmed_service_ids,1),0) >= 1
      and coalesce(array_length(confirmed_service_ids,1),0) <= 5
    ),
  location geography(Point,4326),
  whatsapp text check (whatsapp is null or char_length(whatsapp) <= 40),
  phone text check (phone is null or char_length(phone) <= 40),
  source text not null default 'pwa_quick',
  idempotency_key text not null unique,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_elapsed_seconds integer
    check (client_elapsed_seconds is null or client_elapsed_seconds between 0 and 3600),
  presence_modes text[] not null default '{}',
  service_area_codes text[] not null default '{}',
  address_label text,
  public_location_precision text not null default 'unknown',
  promoted_business_id uuid references public.business(entity_id) on delete set null,
  approved_at timestamptz,
  constraint business_registration_intake_contact_check check (
    nullif(trim(coalesce(whatsapp,'')), '') is not null
    or nullif(trim(coalesce(phone,'')), '') is not null
  ),
  constraint business_registration_intake_public_precision_check check (
    public_location_precision in ('exact','area_only','hidden','unknown')
  ),
  constraint business_registration_intake_presence_modes_check check (
    coalesce(array_length(presence_modes,1),0) <= 10
  ),
  constraint business_registration_intake_service_area_codes_check check (
    coalesce(array_length(service_area_codes,1),0) <= 50
  ),
  constraint business_registration_intake_service_area_code_format_check check (
    coalesce(array_length(service_area_codes,1),0)=0
    or array_to_string(service_area_codes, ',') ~ '^[0-9]{5}(,[0-9]{5})*$'
  ),
  constraint business_registration_intake_idempotency_length_check check (
    char_length(idempotency_key) between 1 and 160
  ),
  constraint business_registration_intake_address_label_check check (
    address_label is null or char_length(address_label) <= 240
  )
);

-- Make this migration safe when an earlier operational migration created the table.
alter table public.business_registration_intake
  alter column location drop not null,
  add column if not exists presence_modes text[] not null default '{}',
  add column if not exists service_area_codes text[] not null default '{}',
  add column if not exists address_label text,
  add column if not exists public_location_precision text not null default 'unknown',
  add column if not exists promoted_business_id uuid references public.business(entity_id) on delete set null,
  add column if not exists approved_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.business_registration_intake'::regclass
      and conname='business_registration_intake_public_precision_check'
  ) then
    alter table public.business_registration_intake
      add constraint business_registration_intake_public_precision_check
      check (public_location_precision in ('exact','area_only','hidden','unknown'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.business_registration_intake'::regclass
      and conname='business_registration_intake_presence_modes_check'
  ) then
    alter table public.business_registration_intake
      add constraint business_registration_intake_presence_modes_check
      check (coalesce(array_length(presence_modes,1),0) <= 10);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.business_registration_intake'::regclass
      and conname='business_registration_intake_service_area_codes_check'
  ) then
    alter table public.business_registration_intake
      add constraint business_registration_intake_service_area_codes_check
      check (coalesce(array_length(service_area_codes,1),0) <= 50);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.business_registration_intake'::regclass
      and conname='business_registration_intake_service_area_code_format_check'
  ) then
    alter table public.business_registration_intake
      add constraint business_registration_intake_service_area_code_format_check
      check (
        coalesce(array_length(service_area_codes,1),0)=0
        or array_to_string(service_area_codes, ',') ~ '^[0-9]{5}(,[0-9]{5})*$'
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.business_registration_intake'::regclass
      and conname='business_registration_intake_idempotency_length_check'
  ) then
    alter table public.business_registration_intake
      add constraint business_registration_intake_idempotency_length_check
      check (char_length(idempotency_key) between 1 and 160);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.business_registration_intake'::regclass
      and conname='business_registration_intake_address_label_check'
  ) then
    alter table public.business_registration_intake
      add constraint business_registration_intake_address_label_check
      check (address_label is null or char_length(address_label) <= 240);
  end if;
end $$;

create index if not exists business_registration_intake_location_gix
  on public.business_registration_intake using gist(location);
create index if not exists business_registration_intake_normalized_name_idx
  on public.business_registration_intake(normalized_name);
create index if not exists business_registration_intake_status_submitted_idx
  on public.business_registration_intake(status, submitted_at desc);

alter table public.business_registration_intake enable row level security;
revoke all on table public.business_registration_intake from public, anon, authenticated;
grant select, insert, update, delete on table public.business_registration_intake to service_role;

create or replace function public.palta_create_business_intake_v2(
  p_mode text,
  p_existing_business_id uuid,
  p_business_name text,
  p_owner_description text,
  p_confirmed_service_ids text[],
  p_lat double precision,
  p_lng double precision,
  p_whatsapp text,
  p_phone text,
  p_source text,
  p_idempotency_key text,
  p_presence_modes text[],
  p_service_area_codes text[],
  p_address_label text,
  p_public_location_precision text
)
returns table(
  registration_id uuid,
  registration_status text,
  resolved_mode text,
  matched_business_id uuid
)
language plpgsql
set search_path = public, extensions, pg_temp
as $$
declare
  v_existing_business_id uuid := p_existing_business_id;
  v_mode text := p_mode;
  v_status text := 'pending_verification';
  v_location geography;
  v_presence_modes text[] := coalesce(p_presence_modes, '{}'::text[]);
  v_service_area_codes text[] := coalesce(p_service_area_codes, '{}'::text[]);
  v_precision text := coalesce(nullif(btrim(p_public_location_precision), ''), 'unknown');
  v_idempotency_key text := btrim(coalesce(p_idempotency_key,''));
  v_has_public_fixed boolean;
  v_has_private_home boolean;
  v_online_only boolean;
begin
  if v_mode not in ('create_new', 'claim_existing') then
    raise exception 'invalid_registration_mode' using errcode = '22023';
  end if;
  if v_precision not in ('exact','area_only','hidden','unknown') then
    raise exception 'invalid_public_location_precision' using errcode = '22023';
  end if;
  if char_length(v_idempotency_key) < 1 or char_length(v_idempotency_key) > 160 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;
  if coalesce(array_length(v_service_area_codes,1),0) > 0
     and array_to_string(v_service_area_codes, ',') !~ '^[0-9]{5}(,[0-9]{5})*$' then
    raise exception 'invalid_service_area_code' using errcode = '22023';
  end if;
  if (p_lat is null) <> (p_lng is null) then
    raise exception 'lat_lng_must_be_provided_together' using errcode = '22023';
  end if;
  if p_lat is not null then
    if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
      raise exception 'invalid_lat_lng' using errcode = '22023';
    end if;
    v_location := st_setsrid(st_makepoint(p_lng, p_lat),4326)::geography;
  end if;

  v_has_public_fixed := v_presence_modes && array['storefront','mixed','fixed_stand','fixed_location']::text[];
  v_has_private_home := v_presence_modes && array['private_home_base','home_base']::text[];
  v_online_only := 'online' = any(v_presence_modes)
    and not (v_presence_modes && array['storefront','mixed','customer_site','mobile_event','fixed_stand','fixed_location']::text[]);

  if v_precision = 'exact' and v_location is null then
    raise exception 'exact_location_requires_point' using errcode = '22023';
  end if;
  if v_precision = 'exact' and not v_has_public_fixed then
    raise exception 'exact_location_requires_public_fixed_presence' using errcode = '22023';
  end if;
  if v_precision = 'exact' and v_has_private_home and not v_has_public_fixed then
    raise exception 'private_home_exact_location_forbidden' using errcode = '22023';
  end if;
  if v_precision in ('area_only','hidden')
     and coalesce(array_length(v_service_area_codes,1),0)=0
     and v_location is null
     and not v_online_only then
    raise exception 'service_area_or_internal_location_required' using errcode = '22023';
  end if;

  if v_mode = 'claim_existing' and v_existing_business_id is null then
    raise exception 'existing_business_required' using errcode = '22023';
  end if;

  if v_mode = 'create_new' and v_existing_business_id is null and v_location is not null then
    select b.entity_id
      into v_existing_business_id
    from public.business b
    join public.canonical_entity ce on ce.id=b.entity_id
    join public.place pl on pl.entity_id=b.primary_place_id
    where ce.status='active'
      and b.verification_status <> 'suspended'
      and pl.geom is not null
      and st_dwithin(pl.geom, v_location, 150)
      and translate(lower(btrim(coalesce(ce.display_name,''))), 'áéíóúüñ', 'aeiouun')
          = translate(lower(btrim(p_business_name)), 'áéíóúüñ', 'aeiouun')
    order by st_distance(pl.geom, v_location)
    limit 1;

    if v_existing_business_id is not null then
      v_mode := 'claim_existing';
      v_status := 'matched_existing';
    end if;
  end if;

  insert into public.business_registration_intake (
    status, mode, existing_business_id, business_name,
    owner_description, confirmed_service_ids, location,
    whatsapp, phone, source, idempotency_key,
    presence_modes, service_area_codes, address_label, public_location_precision
  ) values (
    v_status, v_mode, v_existing_business_id, btrim(p_business_name),
    btrim(p_owner_description), coalesce(p_confirmed_service_ids,'{}'::text[]), v_location,
    nullif(btrim(coalesce(p_whatsapp,'')),''),
    nullif(btrim(coalesce(p_phone,'')),''),
    coalesce(nullif(btrim(p_source),''),'pwa_quick'), v_idempotency_key,
    v_presence_modes, v_service_area_codes, nullif(btrim(coalesce(p_address_label,'')),''), v_precision
  )
  on conflict (idempotency_key) do nothing;

  return query
  select i.id, i.status, i.mode, i.existing_business_id
  from public.business_registration_intake i
  where i.idempotency_key=v_idempotency_key
  limit 1;
end;
$$;

revoke all on function public.palta_create_business_intake_v2(text,uuid,text,text,text[],double precision,double precision,text,text,text,text,text[],text[],text,text)
  from public, anon, authenticated;
grant execute on function public.palta_create_business_intake_v2(text,uuid,text,text,text[],double precision,double precision,text,text,text,text,text[],text[],text,text)
  to service_role;

create or replace function public.palta_promote_business_intake(
  p_registration_id uuid,
  p_comuna_code text default null
)
returns table(
  business_id uuid,
  result_status text,
  created boolean
)
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
  i public.business_registration_intake%rowtype;
  v_business_id uuid;
  v_place_id uuid;
  v_duplicate_id uuid;
  v_geom geography;
  v_contact jsonb := '{}'::jsonb;
  v_comuna_code text := nullif(btrim(coalesce(p_comuna_code,'')), '');
  v_lock_name text;
begin
  if v_comuna_code is not null and v_comuna_code !~ '^[0-9]{5}$' then
    raise exception 'invalid_comuna_code' using errcode='22023';
  end if;

  select * into i
  from public.business_registration_intake
  where id=p_registration_id
  for update;

  if not found then
    raise exception 'business_intake_not_found' using errcode='P0002';
  end if;

  if i.status='approved' and i.promoted_business_id is not null then
    return query select i.promoted_business_id, 'already_approved'::text, false;
    return;
  end if;

  if i.mode='claim_existing' then
    return query select i.existing_business_id, 'claim_existing_requires_verification'::text, false;
    return;
  end if;

  if i.status in ('rejected','cancelled') then
    raise exception 'business_intake_not_promotable' using errcode='22023';
  end if;
  if i.public_location_precision='unknown' then
    raise exception 'public_location_precision_required' using errcode='22023';
  end if;
  if i.public_location_precision='exact' and i.location is null then
    raise exception 'exact_location_requires_point' using errcode='22023';
  end if;

  -- Serialize same-name creation. This closes the window where two concurrent
  -- approvals could both pass the 150m duplicate check before either commits.
  v_lock_name := translate(lower(btrim(i.business_name)), 'áéíóúüñ', 'aeiouun');
  perform pg_advisory_xact_lock(hashtext('palta-business:' || v_lock_name));

  if i.location is not null then
    select b.entity_id into v_duplicate_id
    from public.business b
    join public.canonical_entity ce on ce.id=b.entity_id
    join public.place pl on pl.entity_id=b.primary_place_id
    where ce.status='active'
      and b.verification_status <> 'suspended'
      and pl.geom is not null
      and st_dwithin(pl.geom, i.location, 150)
      and translate(lower(btrim(coalesce(ce.display_name,''))), 'áéíóúüñ', 'aeiouun') = v_lock_name
    order by st_distance(pl.geom, i.location)
    limit 1;
  end if;

  if v_duplicate_id is not null then
    update public.business_registration_intake
      set status='matched_existing', existing_business_id=v_duplicate_id, updated_at=now()
    where id=i.id;
    return query select v_duplicate_id, 'matched_existing'::text, false;
    return;
  end if;

  v_business_id := gen_random_uuid();
  insert into public.canonical_entity(id,entity_type,canonical_key,display_name,status)
  values(v_business_id,'business','business:intake:'||i.id::text,i.business_name,'active');

  if i.location is not null or v_comuna_code is not null or i.address_label is not null then
    v_place_id := gen_random_uuid();
    insert into public.canonical_entity(id,entity_type,canonical_key,display_name,status)
    values(v_place_id,'place','place:business:intake:'||i.id::text,i.business_name,'active');

    v_geom := case
      when i.public_location_precision in ('exact','hidden') then i.location
      else null
    end;

    insert into public.place(entity_id,geom,comuna_code,address_text,location_precision)
    values(v_place_id,v_geom,v_comuna_code,i.address_label,i.public_location_precision);
  end if;

  insert into public.business(
    entity_id,primary_place_id,category_key,verification_status,lifecycle_state,
    public_discovery_enabled,operational_state,service_ids
  ) values (
    v_business_id,v_place_id,i.confirmed_service_ids[1],'claimed','active',
    true,'unknown_or_stale',i.confirmed_service_ids
  );

  if i.whatsapp is not null then
    v_contact := v_contact || jsonb_build_object('whatsapp',i.whatsapp);
  end if;
  if i.phone is not null then
    v_contact := v_contact || jsonb_build_object('phone',i.phone);
  end if;

  insert into public.business_public_profile(
    business_id,description,service_area_codes,search_text,contact
  ) values (
    v_business_id,i.owner_description,i.service_area_codes,
    concat_ws(' ',i.business_name,i.owner_description,array_to_string(i.confirmed_service_ids,' ')),
    v_contact
  );

  update public.business_registration_intake
    set status='approved', promoted_business_id=v_business_id, approved_at=now(), updated_at=now()
  where id=i.id;

  return query select v_business_id, 'approved'::text, true;
end;
$$;

revoke all on function public.palta_promote_business_intake(uuid,text)
  from public, anon, authenticated;
grant execute on function public.palta_promote_business_intake(uuid,text)
  to service_role;
