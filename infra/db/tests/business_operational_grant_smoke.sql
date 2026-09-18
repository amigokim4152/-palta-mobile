\set ON_ERROR_STOP on

-- Ephemeral CI-only smoke for the canonical business authorization table.
do $$
begin
  if to_regclass('public.business_operational_grant') is null then
    raise exception 'business_operational_grant table is missing';
  end if;
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'business_operational_grant'
      and c.relrowsecurity
  ) then
    raise exception 'business_operational_grant RLS is not enabled';
  end if;
end $$;

insert into auth.users (id) values
  ('31111111-1111-4111-8111-111111111111'),
  ('32222222-2222-4222-8222-222222222222')
on conflict (id) do nothing;

insert into public.canonical_entity (
  id, entity_type, canonical_key, display_name, status
) values
  ('33333333-3333-4333-8333-333333333333', 'business', 'ci-grant-business-a', 'CI Grant Business A', 'active'),
  ('34444444-4444-4444-8444-444444444444', 'business', 'ci-grant-business-b', 'CI Grant Business B', 'active')
on conflict (id) do nothing;

insert into public.business (entity_id, verification_status) values
  ('33333333-3333-4333-8333-333333333333', 'verified'),
  ('34444444-4444-4444-8444-444444444444', 'verified')
on conflict (entity_id) do nothing;

insert into public.business_operational_grant (
  id,
  business_id,
  user_id,
  role,
  status,
  granted_by_user_id
) values
  (
    '35555555-5555-4555-8555-555555555555',
    '33333333-3333-4333-8333-333333333333',
    '31111111-1111-4111-8111-111111111111',
    'cashier',
    'active',
    '31111111-1111-4111-8111-111111111111'
  ),
  (
    '36666666-6666-4666-8666-666666666666',
    '34444444-4444-4444-8444-444444444444',
    '32222222-2222-4222-8222-222222222222',
    'owner',
    'active',
    '32222222-2222-4222-8222-222222222222'
  );

-- Browser/client roles must never read the business authorization truth directly.
do $$
begin
  if has_table_privilege('authenticated', 'public.business_operational_grant', 'SELECT') then
    raise exception 'authenticated role must not read business_operational_grant directly';
  end if;
  if has_table_privilege('anon', 'public.business_operational_grant', 'SELECT') then
    raise exception 'anon role must not read business_operational_grant directly';
  end if;
end $$;

-- Commerce API role must see only the selected tenant and RLS WITH CHECK must
-- reject a grant write for another tenant.
set role palta_commerce_api;
do $$
declare
  visible_count integer;
  visible_user uuid;
  blocked boolean := false;
begin
  perform set_config(
    'app.current_business_id',
    '33333333-3333-4333-8333-333333333333',
    true
  );

  select count(*)
    into visible_count
  from public.business_operational_grant;

  select user_id
    into visible_user
  from public.business_operational_grant
  limit 1;

  if visible_count <> 1 then
    raise exception 'business grant RLS exposed % rows, expected 1', visible_count;
  end if;
  if visible_user <> '31111111-1111-4111-8111-111111111111'::uuid then
    raise exception 'business grant RLS exposed the wrong user';
  end if;

  begin
    insert into public.business_operational_grant (
      id,
      business_id,
      user_id,
      role,
      status,
      granted_by_user_id
    ) values (
      '37777777-7777-4777-8777-777777777777',
      '34444444-4444-4444-8444-444444444444',
      '31111111-1111-4111-8111-111111111111',
      'viewer',
      'active',
      '31111111-1111-4111-8111-111111111111'
    );
  exception
    when insufficient_privilege then
      blocked := true;
  end;

  if not blocked then
    raise exception 'cross-business operational grant insert was not blocked by RLS';
  end if;
end $$;
reset role;

select 'PASS: business operational grant RLS smoke test' as result;
