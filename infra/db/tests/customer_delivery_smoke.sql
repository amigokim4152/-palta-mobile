\set ON_ERROR_STOP on

-- Verifies transactional customer delivery persistence, secure share-link
-- storage, tenant isolation and the invariant that relationship history never
-- grants future marketing permission.
do $$
begin
  if to_regclass('public.customer_artifact') is null then
    raise exception 'customer_artifact table is missing';
  end if;
  if to_regclass('public.customer_share_link') is null then
    raise exception 'customer_share_link table is missing';
  end if;
  if to_regclass('public.customer_delivery') is null then
    raise exception 'customer_delivery table is missing';
  end if;
  if to_regclass('public.customer_relationship_touchpoint') is null then
    raise exception 'customer_relationship_touchpoint table is missing';
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'customer_delivery' and c.relrowsecurity
  ) then
    raise exception 'customer_delivery RLS is not enabled';
  end if;
end $$;

insert into public.customer_artifact (
  id, business_id, kind, source_id, title, expires_at
) values
  (
    'a1010101-1010-4010-8010-101010101010',
    '11111111-1111-4111-8111-111111111111',
    'fiscal_document', 'fiscal-a-1', 'Boleta A', now() + interval '1 day'
  ),
  (
    'a2020202-2020-4020-8020-202020202020',
    '22222222-2222-4222-8222-222222222222',
    'receipt', 'receipt-b-1', 'Receipt B', now() + interval '1 day'
  );

-- A share link must not cross the business boundary even if the caller knows
-- another tenant's artifact UUID.
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.customer_share_link (
      id, business_id, artifact_id, token_hash, scope, expires_at
    ) values (
      'b1010101-1010-4010-8010-101010101010',
      '11111111-1111-4111-8111-111111111111',
      'a2020202-2020-4020-8020-202020202020',
      repeat('a',64), 'view_receipt', now() + interval '1 hour'
    );
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then
    raise exception 'cross-business customer artifact FK was not blocked';
  end if;
end $$;

insert into public.customer_share_link (
  id, business_id, artifact_id, token_hash, scope, expires_at, max_uses
) values (
  'b1111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'a1010101-1010-4010-8010-101010101010',
  repeat('1',64), 'view_fiscal_document', now() + interval '1 hour', 3
);

insert into public.customer_delivery (
  id, business_id, customer_id, artifact_id, purpose, channel, status,
  destination_hash, destination_masked, idempotency_key, revision
) values (
  'c1111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'd1111111-1111-4111-8111-111111111111',
  'a1010101-1010-4010-8010-101010101010',
  'transactional', 'whatsapp_handoff', 'handed_off',
  repeat('2',64), '+56 9 **** 5678', 'ci-customer-delivery-a', 1
);

insert into public.customer_relationship_touchpoint (
  id, business_id, customer_id, type, artifact_kind, source_id,
  delivery_id, occurred_at
) values (
  'e1111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  'd1111111-1111-4111-8111-111111111111',
  'transactional_delivery', 'fiscal_document', 'fiscal-a-1',
  'c1111111-1111-4111-8111-111111111111', now()
);

-- DB invariant: a relationship touchpoint can never be used to silently grant
-- future contact/marketing permission.
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.customer_relationship_touchpoint (
      id, business_id, customer_id, type, artifact_kind, source_id,
      delivery_id, occurred_at, grants_future_permission
    ) values (
      'e2222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
      'd1111111-1111-4111-8111-111111111111',
      'marketing_contact', 'fiscal_document', 'fiscal-a-1',
      'c1111111-1111-4111-8111-111111111111', now(), true
    );
  exception when check_violation then blocked := true;
  end;
  if not blocked then
    raise exception 'CRM touchpoint was able to grant future permission';
  end if;
end $$;

set role palta_commerce_api;
do $$
declare
  artifact_count integer;
  delivery_count integer;
  touchpoint_count integer;
  blocked boolean := false;
begin
  perform set_config('app.current_business_id','11111111-1111-4111-8111-111111111111',true);
  select count(*) into artifact_count from public.customer_artifact;
  select count(*) into delivery_count from public.customer_delivery;
  select count(*) into touchpoint_count from public.customer_relationship_touchpoint;
  if artifact_count <> 1 then raise exception 'commerce API exposed % customer artifacts', artifact_count; end if;
  if delivery_count <> 1 then raise exception 'commerce API exposed % customer deliveries', delivery_count; end if;
  if touchpoint_count <> 1 then raise exception 'commerce API exposed % customer touchpoints', touchpoint_count; end if;

  begin
    insert into public.customer_delivery (
      id, business_id, artifact_id, purpose, channel, status, idempotency_key
    ) values (
      'c2222222-2222-4222-8222-222222222222',
      '22222222-2222-4222-8222-222222222222',
      'a2020202-2020-4020-8020-202020202020',
      'transactional', 'system_share', 'prepared', 'blocked-cross-tenant'
    );
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then
    raise exception 'commerce API cross-business customer delivery insert was not blocked';
  end if;
end $$;
reset role;

set role palta_customer_delivery_worker;
do $$
declare
  link_count integer;
  artifact_count integer;
begin
  select count(*) into link_count from public.customer_share_link;
  select count(*) into artifact_count from public.customer_artifact;
  if link_count <> 1 or artifact_count <> 2 then
    raise exception 'customer delivery worker cannot resolve expected share artifact data';
  end if;
  if has_table_privilege(current_user,'public.customer_delivery','SELECT') then
    raise exception 'share resolver worker must not read customer delivery/contact history';
  end if;
  if has_table_privilege(current_user,'public.customer_relationship_touchpoint','SELECT') then
    raise exception 'share resolver worker must not read CRM relationship history';
  end if;
  if has_table_privilege(current_user,'public.customer_share_link','INSERT') then
    raise exception 'share resolver worker must not create arbitrary share links';
  end if;

  update public.customer_share_link
     set use_count = use_count + 1
   where token_hash = repeat('1',64)
     and revoked_at is null
     and expires_at > now()
     and (max_uses is null or use_count < max_uses);
  if not found then raise exception 'valid share-link use could not be recorded'; end if;
end $$;
reset role;

select 'PASS: real Postgres customer delivery/share-link/CRM RLS smoke test' as result;
