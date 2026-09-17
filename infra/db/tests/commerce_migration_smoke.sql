\set ON_ERROR_STOP on

-- This file runs only against an ephemeral CI database. It verifies that the
-- preflight migrations are executable by real Postgres/PostGIS and that the
-- most important tenant/payment credential boundaries behave as designed.

do $$
begin
  if to_regclass('public.payment_provider_connection') is null then
    raise exception 'payment_provider_connection table is missing';
  end if;
  if to_regclass('public.payment_credential_envelope') is null then
    raise exception 'payment_credential_envelope table is missing';
  end if;
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'payment_provider_connection'
      and c.relrowsecurity
  ) then
    raise exception 'payment_provider_connection RLS is not enabled';
  end if;
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'payment_credential_envelope'
      and c.relrowsecurity
  ) then
    raise exception 'payment_credential_envelope RLS is not enabled';
  end if;
end $$;

insert into public.canonical_entity (
  id, entity_type, canonical_key, display_name, status
) values
  ('11111111-1111-4111-8111-111111111111', 'business', 'ci-business-a', 'CI Business A', 'active'),
  ('22222222-2222-4222-8222-222222222222', 'business', 'ci-business-b', 'CI Business B', 'active');

insert into public.business (entity_id, verification_status) values
  ('11111111-1111-4111-8111-111111111111', 'verified'),
  ('22222222-2222-4222-8222-222222222222', 'verified');

insert into public.payment_provider_connection (
  id,
  business_id,
  provider_key,
  environment,
  status,
  credential_ref,
  capabilities,
  safe_configuration
) values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'mercadopago_point',
    'sandbox',
    'ready_for_test',
    'credential://ci/business-a/mp/1',
    '{"card":true}'::jsonb,
    '{"country":"CL"}'::jsonb
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    'mercadopago_point',
    'sandbox',
    'ready_for_test',
    'credential://ci/business-b/mp/1',
    '{"card":true}'::jsonb,
    '{"country":"CL"}'::jsonb
  );

insert into public.payment_credential_envelope (
  id,
  business_id,
  provider_connection_id,
  provider_key,
  credential_ref,
  ciphertext,
  data_iv,
  wrapped_data_key,
  wrap_iv,
  kek_id
) values
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'mercadopago_point',
    'credential://ci/business-a/mp/1',
    decode(repeat('aa', 32), 'hex'),
    decode(repeat('01', 12), 'hex'),
    decode(repeat('bb', 48), 'hex'),
    decode(repeat('02', 12), 'hex'),
    'ci-kek-v1'
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'mercadopago_point',
    'credential://ci/business-b/mp/1',
    decode(repeat('cc', 32), 'hex'),
    decode(repeat('03', 12), 'hex'),
    decode(repeat('dd', 48), 'hex'),
    decode(repeat('04', 12), 'hex'),
    'ci-kek-v1'
  );

-- Composite FK must make it impossible for a PaymentIntent owned by Business A
-- to point at Business B's provider connection.
insert into public.commerce_transaction (
  id,
  business_id,
  idempotency_key,
  state,
  total_amount_minor,
  lines
) values (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  '11111111-1111-4111-8111-111111111111',
  'ci-transaction-a',
  'ready_for_payment',
  12000,
  '[]'::jsonb
);

do $$
declare
  blocked boolean := false;
begin
  begin
    insert into public.payment_intent (
      id,
      business_id,
      commerce_transaction_id,
      idempotency_key,
      amount_minor,
      rail,
      status,
      provider_key,
      provider_connection_id
    ) values (
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      '11111111-1111-4111-8111-111111111111',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'ci-cross-business-payment',
      12000,
      'card',
      'created',
      'mercadopago_point',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    );
  exception
    when foreign_key_violation then
      blocked := true;
  end;

  if not blocked then
    raise exception 'cross-business payment provider connection FK was not blocked';
  end if;
end $$;

insert into public.payment_intent (
  id,
  business_id,
  commerce_transaction_id,
  idempotency_key,
  amount_minor,
  rail,
  status,
  provider_key,
  provider_connection_id
) values (
  '99999999-9999-4999-8999-999999999999',
  '11111111-1111-4111-8111-111111111111',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'ci-valid-payment',
  12000,
  'card',
  'created',
  'mercadopago_point',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

-- Server API role must see only the tenant selected in transaction-local RLS
-- context, and RLS WITH CHECK must reject a write for another tenant.
set role palta_commerce_api;
do $$
declare
  connection_count integer;
  credential_count integer;
  blocked boolean := false;
begin
  perform set_config(
    'app.current_business_id',
    '11111111-1111-4111-8111-111111111111',
    true
  );

  select count(*) into connection_count
  from public.payment_provider_connection;
  if connection_count <> 1 then
    raise exception 'commerce API RLS exposed % provider connections, expected 1', connection_count;
  end if;

  select count(*) into credential_count
  from public.payment_credential_envelope;
  if credential_count <> 1 then
    raise exception 'commerce API RLS exposed % credential envelopes, expected 1', credential_count;
  end if;

  begin
    insert into public.payment_provider_connection (
      id, business_id, provider_key
    ) values (
      'abababab-abab-4bab-8bab-abababababab',
      '22222222-2222-4222-8222-222222222222',
      'should_be_blocked'
    );
  exception
    when insufficient_privilege then
      blocked := true;
  end;

  if not blocked then
    raise exception 'commerce API cross-business provider connection insert was not blocked by RLS';
  end if;
end $$;
reset role;

-- Payment worker is a system runtime role. It may resolve both tenants, but it
-- receives no INSERT/UPDATE grant on credential ciphertext.
set role palta_payment_worker;
do $$
declare
  connection_count integer;
  credential_count integer;
begin
  select count(*) into connection_count
  from public.payment_provider_connection;
  select count(*) into credential_count
  from public.payment_credential_envelope;

  if connection_count <> 2 or credential_count <> 2 then
    raise exception 'payment worker cannot resolve expected system payment data';
  end if;

  if has_table_privilege(
    current_user,
    'public.payment_credential_envelope',
    'INSERT'
  ) or has_table_privilege(
    current_user,
    'public.payment_credential_envelope',
    'UPDATE'
  ) then
    raise exception 'payment worker must not mutate encrypted credential envelopes';
  end if;
end $$;
reset role;

select 'PASS: real Postgres commerce migration + RLS smoke test' as result;
