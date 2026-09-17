\set ON_ERROR_STOP on

-- Verifies durable print execution state, tenant isolation and duplicate-output guards.
do $$
begin
  if to_regclass('public.print_job') is null then
    raise exception 'print_job table is missing';
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'print_job' and c.relrowsecurity
  ) then
    raise exception 'print_job RLS is not enabled';
  end if;
end $$;

insert into public.print_job (
  id, business_id, printer_id, document_kind, content_json, status,
  idempotency_key, revision, retry_authorized, created_at
) values (
  'f5050505-5050-4050-8050-505050505050',
  '11111111-1111-4111-8111-111111111111',
  'f1010101-1010-4010-8010-101010101010',
  'receipt',
  '{"kind":"receipt","lines":[{"text":"Venta OK"}]}'::jsonb,
  'queued',
  'print-sale-123',
  0,
  false,
  '2026-09-17T20:00:00Z'
);

-- Same business + same logical print operation must not create another physical job.
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.print_job (
      id, business_id, printer_id, document_kind, content_json, status,
      idempotency_key, revision, retry_authorized, created_at
    ) values (
      'f5151515-5151-4151-8151-515151515151',
      '11111111-1111-4111-8111-111111111111',
      'f1010101-1010-4010-8010-101010101010',
      'receipt',
      '{"kind":"receipt","lines":[{"text":"Duplicate"}]}'::jsonb,
      'queued',
      'print-sale-123',
      0,
      false,
      '2026-09-17T20:00:01Z'
    );
  exception when unique_violation then blocked := true;
  end;
  if not blocked then
    raise exception 'duplicate business print idempotency key was not blocked';
  end if;
end $$;

-- A print job may never route through another business's physical printer.
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.print_job (
      id, business_id, printer_id, document_kind, content_json, status,
      idempotency_key, revision, retry_authorized, created_at
    ) values (
      'f5252525-5252-4252-8252-525252525252',
      '11111111-1111-4111-8111-111111111111',
      'f2020202-2020-4020-8020-202020202020',
      'receipt',
      '{"kind":"receipt","lines":[{"text":"Wrong printer"}]}'::jsonb,
      'queued',
      'print-cross-printer',
      0,
      false,
      '2026-09-17T20:00:02Z'
    );
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then
    raise exception 'cross-business print printer FK was not blocked';
  end if;
end $$;

-- Retry authorization is valid only after a definitive failed output attempt.
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.print_job (
      id, business_id, printer_id, document_kind, content_json, status,
      idempotency_key, revision, retry_authorized, created_at, submitted_at
    ) values (
      'f5353535-5353-4353-8353-535353535353',
      '11111111-1111-4111-8111-111111111111',
      'f1010101-1010-4010-8010-101010101010',
      'kitchen_ticket',
      '{"kind":"kitchen_ticket","lines":[{"text":"Mesa 1"}]}'::jsonb,
      'submitted',
      'print-invalid-retry',
      2,
      true,
      '2026-09-17T20:00:03Z',
      '2026-09-17T20:00:04Z'
    );
  exception when check_violation then blocked := true;
  end;
  if not blocked then
    raise exception 'submitted print incorrectly accepted retry authorization';
  end if;
end $$;

set role palta_commerce_api;
do $$
declare
  job_count integer;
  blocked boolean := false;
begin
  perform set_config('app.current_business_id','11111111-1111-4111-8111-111111111111',true);
  select count(*) into job_count from public.print_job;
  if job_count <> 1 then
    raise exception 'commerce API exposed % print jobs instead of tenant-scoped 1', job_count;
  end if;

  begin
    insert into public.print_job (
      id, business_id, printer_id, document_kind, content_json, status,
      idempotency_key, revision, retry_authorized, created_at
    ) values (
      'f5454545-5454-4454-8454-545454545454',
      '22222222-2222-4222-8222-222222222222',
      'f2020202-2020-4020-8020-202020202020',
      'receipt',
      '{"kind":"receipt","lines":[{"text":"Blocked tenant"}]}'::jsonb,
      'queued',
      'print-other-business',
      0,
      false,
      '2026-09-17T20:00:05Z'
    );
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then
    raise exception 'commerce API cross-business print insert was not blocked';
  end if;
end $$;
reset role;

select 'PASS: real Postgres durable print job RLS/idempotency smoke test' as result;
