-- PALTA PRINT JOB RUNTIME PREFLIGHT
-- STATUS: PRE-DEPLOYMENT / VERIFIED BY CI
-- Date: 2026-09-17
--
-- Physical print state is durable because app/bridge restarts must never turn
-- an ambiguous print into an automatic duplicate receipt, label or kitchen ticket.
-- Sale/Payment/Fiscal remain canonical; this table stores output execution only.

create table if not exists public.print_job (
  id uuid primary key,
  business_id uuid not null,
  printer_id uuid not null,
  document_kind text not null check (document_kind in (
    'receipt', 'label', 'a4_document', 'kitchen_ticket', 'packing_slip'
  )),
  -- Exact output snapshot or stable artifact reference required to reproduce the job.
  -- Raw payment credentials/card data must never be placed here.
  content_json jsonb not null check (jsonb_typeof(content_json) = 'object'),
  status text not null check (status in (
    'queued', 'dispatching', 'submitted', 'printed',
    'outcome_unknown', 'failed', 'cancelled'
  )),
  idempotency_key text not null check (length(idempotency_key) between 1 and 200),
  revision bigint not null default 0 check (revision >= 0),
  -- True only after a definitive failure known to have produced no physical output.
  retry_authorized boolean not null default false,
  provider_job_id text check (provider_job_id is null or length(provider_job_id) <= 240),
  error_code text check (error_code is null or length(error_code) <= 160),
  reprint_of_job_id uuid,
  created_at timestamptz not null,
  submitted_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, idempotency_key),
  foreign key (business_id, printer_id)
    references public.printer_device(business_id, id) on delete restrict,
  foreign key (business_id, reprint_of_job_id)
    references public.print_job(business_id, id) on delete restrict,
  check (reprint_of_job_id is null or reprint_of_job_id <> id),
  check (not retry_authorized or status = 'failed')
);

create index if not exists print_job_business_status_idx
  on public.print_job(business_id, status, created_at);

create index if not exists print_job_unresolved_idx
  on public.print_job(business_id, created_at)
  where status in ('dispatching', 'submitted', 'outcome_unknown');

create index if not exists print_job_retryable_idx
  on public.print_job(business_id, created_at)
  where status = 'failed' and retry_authorized;

alter table public.print_job enable row level security;
revoke all on table public.print_job from anon, authenticated;

grant select, insert, update on public.print_job to palta_commerce_api;

create policy print_job_api_select
  on public.print_job for select to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);

create policy print_job_api_insert
  on public.print_job for insert to palta_commerce_api
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);

create policy print_job_api_update
  on public.print_job for update to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid)
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);

comment on table public.print_job is
  'Durable physical print execution state. Never treat printed paper as fiscal issuance authority.';
