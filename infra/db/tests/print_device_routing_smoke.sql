\set ON_ERROR_STOP on

-- Verifies printer configuration persistence, tenant isolation and the invariant
-- that a route cannot reference a printer owned by another business.
do $$
begin
  if to_regclass('public.printer_device') is null then
    raise exception 'printer_device table is missing';
  end if;
  if to_regclass('public.printer_route') is null then
    raise exception 'printer_route table is missing';
  end if;
  if to_regclass('public.printer_route_candidate') is null then
    raise exception 'printer_route_candidate table is missing';
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'printer_device' and c.relrowsecurity
  ) then
    raise exception 'printer_device RLS is not enabled';
  end if;
end $$;

insert into public.printer_device (
  id, business_id, outlet_key, display_name, manufacturer, model,
  connection_fingerprint_hash, transport, protocol, support_tier,
  adapter_key, paper_width_mm, health
) values
  (
    'f1010101-1010-4010-8010-101010101010',
    '11111111-1111-4111-8111-111111111111',
    'main', 'Receipt A', 'Epson', 'TM-T20IV-SP', repeat('a',64),
    'network', 'epson_epos', 'compatible', 'epson-epos', 80, 'ready'
  ),
  (
    'f2020202-2020-4020-8020-202020202020',
    '22222222-2222-4222-8222-222222222222',
    'main', 'Receipt B', 'Generic', 'ESC POS', repeat('b',64),
    'usb', 'esc_pos', 'compatible', 'generic-esc-pos', 80, 'ready'
  );

insert into public.printer_route (
  id, business_id, outlet_key, role
) values (
  'f3030303-3030-4030-8030-303030303030',
  '11111111-1111-4111-8111-111111111111',
  'main', 'receipt'
);

insert into public.printer_route_candidate (
  route_id, business_id, printer_id, priority, is_primary
) values (
  'f3030303-3030-4030-8030-303030303030',
  '11111111-1111-4111-8111-111111111111',
  'f1010101-1010-4010-8010-101010101010',
  0, true
);

-- A route from business A must never be able to point at business B's printer.
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.printer_route_candidate (
      route_id, business_id, printer_id, priority, is_primary
    ) values (
      'f3030303-3030-4030-8030-303030303030',
      '11111111-1111-4111-8111-111111111111',
      'f2020202-2020-4020-8020-202020202020',
      1, false
    );
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then
    raise exception 'cross-business printer route FK was not blocked';
  end if;
end $$;

set role palta_commerce_api;
do $$
declare
  device_count integer;
  route_count integer;
  candidate_count integer;
  blocked boolean := false;
begin
  perform set_config('app.current_business_id','11111111-1111-4111-8111-111111111111',true);
  select count(*) into device_count from public.printer_device;
  select count(*) into route_count from public.printer_route;
  select count(*) into candidate_count from public.printer_route_candidate;
  if device_count <> 1 then raise exception 'commerce API exposed % printer devices', device_count; end if;
  if route_count <> 1 then raise exception 'commerce API exposed % printer routes', route_count; end if;
  if candidate_count <> 1 then raise exception 'commerce API exposed % printer route candidates', candidate_count; end if;

  begin
    insert into public.printer_device (
      id, business_id, outlet_key, display_name, connection_fingerprint_hash,
      transport, protocol, support_tier, adapter_key, health
    ) values (
      'f4040404-4040-4040-8040-404040404040',
      '22222222-2222-4222-8222-222222222222',
      'main', 'Blocked cross tenant', repeat('c',64),
      'usb', 'esc_pos', 'unknown', 'generic-esc-pos', 'unknown'
    );
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then
    raise exception 'commerce API cross-business printer insert was not blocked';
  end if;
end $$;
reset role;

select 'PASS: real Postgres printer device/routing RLS smoke test' as result;
