\set ON_ERROR_STOP on

-- Runs after commerce_migration_smoke.sql in the same ephemeral CI database.
-- Verifies provider-neutral FiscalExecution persistence, encrypted credentials,
-- tenant/RUT isolation and least-privilege runtime roles.
do $$
begin
  if to_regclass('public.fiscal_provider_connection') is null then
    raise exception 'fiscal_provider_connection table is missing';
  end if;
  if to_regclass('public.fiscal_execution') is null then
    raise exception 'fiscal_execution table is missing';
  end if;
  if to_regclass('public.fiscal_credential_envelope') is null then
    raise exception 'fiscal_credential_envelope table is missing';
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'fiscal_execution' and c.relrowsecurity
  ) then
    raise exception 'fiscal_execution RLS is not enabled';
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'fiscal_credential_envelope' and c.relrowsecurity
  ) then
    raise exception 'fiscal_credential_envelope RLS is not enabled';
  end if;
end $$;

insert into public.fiscal_provider_connection (
  id, business_id, issuer_rut, provider_key, environment, status,
  credential_ref, enabled_document_types, safe_configuration
) values
  (
    '10101010-1010-4010-8010-101010101010',
    '11111111-1111-4111-8111-111111111111',
    '76123456-7', 'dte_comges', 'certification', 'ready_for_test',
    'credential://ci/business-a/dte-comges/1',
    '["boleta_39","factura_33"]'::jsonb,
    '{"adapter":"dte_comges"}'::jsonb
  ),
  (
    '20202020-2020-4020-8020-202020202020',
    '22222222-2222-4222-8222-222222222222',
    '76999999-9', 'dte_comges', 'certification', 'ready_for_test',
    'credential://ci/business-b/dte-comges/1',
    '["boleta_39","factura_33"]'::jsonb,
    '{"adapter":"dte_comges"}'::jsonb
  );

insert into public.fiscal_credential_envelope (
  id, business_id, provider_connection_id, provider_key, issuer_rut,
  credential_ref, ciphertext, data_iv, wrapped_data_key, wrap_iv, kek_id
) values
  (
    '70707070-7070-4070-8070-707070707070',
    '11111111-1111-4111-8111-111111111111',
    '10101010-1010-4010-8010-101010101010',
    'dte_comges', '76123456-7',
    'credential://ci/business-a/dte-comges/1',
    decode(repeat('11', 32), 'hex'), decode(repeat('12', 12), 'hex'),
    decode(repeat('13', 48), 'hex'), decode(repeat('14', 12), 'hex'), 'ci-kek-v1'
  ),
  (
    '80808080-8080-4080-8080-808080808080',
    '22222222-2222-4222-8222-222222222222',
    '20202020-2020-4020-8020-202020202020',
    'dte_comges', '76999999-9',
    'credential://ci/business-b/dte-comges/1',
    decode(repeat('21', 32), 'hex'), decode(repeat('22', 12), 'hex'),
    decode(repeat('23', 48), 'hex'), decode(repeat('24', 12), 'hex'), 'ci-kek-v1'
  );

-- The composite FK must also bind issuer RUT/provider identity, not merely the
-- provider-connection UUID.
do $$
declare
  blocked boolean := false;
begin
  begin
    insert into public.fiscal_credential_envelope (
      id, business_id, provider_connection_id, provider_key, issuer_rut,
      credential_ref, ciphertext, data_iv, wrapped_data_key, wrap_iv, kek_id
    ) values (
      '90909090-9090-4090-8090-909090909090',
      '11111111-1111-4111-8111-111111111111',
      '10101010-1010-4010-8010-101010101010',
      'dte_comges', '76999999-9',
      'credential://ci/wrong-rut',
      decode(repeat('31', 32), 'hex'), decode(repeat('32', 12), 'hex'),
      decode(repeat('33', 48), 'hex'), decode(repeat('34', 12), 'hex'), 'ci-kek-v1'
    );
  exception when foreign_key_violation then
    blocked := true;
  end;
  if not blocked then
    raise exception 'cross-RUT fiscal credential envelope FK was not blocked';
  end if;
end $$;

insert into public.fiscal_request (
  id, business_id, commerce_transaction_id, issuer_rut, document_type,
  idempotency_key, status, lines, totals, receiver, revision, requested_at
) values (
  '30303030-3030-4030-8030-303030303030',
  '11111111-1111-4111-8111-111111111111',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  '76123456-7', 39, 'ci-fiscal-request-a', 'pending',
  '[{"id":"line-1","description":"Jardineria","quantity":1,"unitAmountMinor":12000,"lineAmountMinor":12000,"exempt":false,"unitNetAmountMinor":10084,"unitGrossAmountMinor":12000,"lineNetAmountMinor":10084,"lineExemptAmountMinor":0,"lineVatAmountMinor":1916,"lineTotalAmountMinor":12000,"unitCode":"UN"}]'::jsonb,
  '{"netAmountMinor":10084,"exemptAmountMinor":0,"vatAmountMinor":1916,"totalAmountMinor":12000}'::jsonb,
  '{"rut":"66666666-6","name":"Consumidor final"}'::jsonb,
  0, now()
);

-- Fiscal execution owned by Business A may never reference Business B's DTE
-- provider connection, even if provider_key happens to be identical.
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.fiscal_execution (
      id, business_id, fiscal_request_id, issuer_rut, document_type, mode,
      environment, status, idempotency_key, provider_key, provider_connection_id
    ) values (
      '40404040-4040-4040-8040-404040404040',
      '11111111-1111-4111-8111-111111111111',
      '30303030-3030-4030-8030-303030303030',
      '76123456-7', 39, 'external_provider', 'certification', 'created',
      'ci-fiscal-execution-cross-business', 'dte_comges',
      '20202020-2020-4020-8020-202020202020'
    );
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then
    raise exception 'cross-business fiscal provider connection FK was not blocked';
  end if;
end $$;

insert into public.fiscal_execution (
  id, business_id, fiscal_request_id, issuer_rut, document_type, mode,
  environment, status, idempotency_key, provider_key, provider_connection_id,
  provider_ticket_reference, revision
) values (
  '50505050-5050-4050-8050-505050505050',
  '11111111-1111-4111-8111-111111111111',
  '30303030-3030-4030-8030-303030303030',
  '76123456-7', 39, 'external_provider', 'certification', 'queued',
  'ci-fiscal-execution-a', 'dte_comges',
  '10101010-1010-4010-8010-101010101010', 'ticket-ci-a', 1
);

set role palta_commerce_api;
do $$
declare
  connection_count integer;
  execution_count integer;
  credential_count integer;
  blocked boolean := false;
begin
  perform set_config('app.current_business_id','11111111-1111-4111-8111-111111111111',true);
  select count(*) into connection_count from public.fiscal_provider_connection;
  select count(*) into execution_count from public.fiscal_execution;
  select count(*) into credential_count from public.fiscal_credential_envelope;
  if connection_count <> 1 then raise exception 'commerce API exposed % fiscal provider connections', connection_count; end if;
  if execution_count <> 1 then raise exception 'commerce API exposed % fiscal executions', execution_count; end if;
  if credential_count <> 1 then raise exception 'commerce API exposed % fiscal credential envelopes', credential_count; end if;

  begin
    insert into public.fiscal_provider_connection (
      id, business_id, issuer_rut, provider_key, environment, enabled_document_types
    ) values (
      '60606060-6060-4060-8060-606060606060',
      '22222222-2222-4222-8222-222222222222',
      '76999999-9', 'blocked_provider', 'certification', '["boleta_39"]'::jsonb
    );
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'commerce API cross-business fiscal provider insert was not blocked by RLS'; end if;
end $$;
reset role;

set role palta_fiscal_worker;
do $$
declare
  connection_count integer;
  execution_count integer;
  credential_count integer;
begin
  select count(*) into connection_count from public.fiscal_provider_connection;
  select count(*) into execution_count from public.fiscal_execution;
  select count(*) into credential_count from public.fiscal_credential_envelope;
  if connection_count <> 2 or execution_count <> 1 or credential_count <> 2 then
    raise exception 'fiscal worker cannot resolve expected system fiscal data';
  end if;
  if has_table_privilege(current_user,'public.fiscal_provider_connection','UPDATE') then
    raise exception 'fiscal worker must not mutate fiscal provider connection configuration';
  end if;
  if has_table_privilege(current_user,'public.fiscal_credential_envelope','INSERT')
     or has_table_privilege(current_user,'public.fiscal_credential_envelope','UPDATE') then
    raise exception 'fiscal worker must not mutate encrypted fiscal credential envelopes';
  end if;
end $$;
reset role;

select 'PASS: real Postgres fiscal execution/provider/credential RLS smoke test' as result;
