-- PALTA FISCAL EXECUTION / EXTERNAL PROVIDER PREFLIGHT
-- STATUS: PRE-DEPLOYMENT / VERIFIED BY CI AFTER MERGE
-- Date: 2026-09-17
--
-- Separates canonical FiscalRequest (what must be issued) from FiscalExecution
-- (how/where it is issued). SII Direct and external providers therefore do not
-- pretend to share CAF/sign/send internals.

create table if not exists public.fiscal_provider_connection (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business(entity_id) on delete restrict,
  issuer_rut text not null,
  provider_key text not null,
  environment text not null check (environment in ('certification', 'production')),
  status text not null default 'draft' check (status in (
    'draft',
    'pending_credentials',
    'ready_for_test',
    'testing',
    'connected',
    'error',
    'paused'
  )),
  credential_ref text,
  enabled_document_types jsonb not null default '[]'::jsonb,
  safe_configuration jsonb not null default '{}'::jsonb,
  revision bigint not null default 0 check (revision >= 0),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, issuer_rut, provider_key, environment),
  check (jsonb_typeof(enabled_document_types) = 'array'),
  check (jsonb_typeof(safe_configuration) = 'object')
);

create index if not exists fiscal_provider_connection_business_idx
  on public.fiscal_provider_connection(business_id, issuer_rut, provider_key, environment, status);

create table if not exists public.fiscal_execution (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business(entity_id) on delete restrict,
  fiscal_request_id uuid not null references public.fiscal_request(id) on delete restrict,
  issuer_rut text not null,
  document_type integer not null,
  mode text not null check (mode in ('sii_direct', 'external_provider')),
  environment text not null check (environment in ('certification', 'production')),
  status text not null default 'created' check (status in (
    'created',
    'submitting',
    'queued',
    'issued',
    'pending_authority',
    'accepted',
    'observed',
    'rejected',
    'failed',
    'unknown',
    'cancelled'
  )),
  idempotency_key text not null,
  provider_key text,
  provider_connection_id uuid,
  provider_reference text,
  provider_ticket_reference text,
  folio bigint,
  authority_track_id text,
  authority_status text,
  authority_message text,
  xml_asset_ref text,
  pdf_asset_ref text,
  provider_totals jsonb,
  canonical_totals_match boolean,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fiscal_request_id),
  unique (business_id, idempotency_key),
  foreign key (business_id, provider_connection_id)
    references public.fiscal_provider_connection(business_id, id)
    on delete restrict,
  check (
    (mode = 'sii_direct' and provider_key is null and provider_connection_id is null)
    or
    (mode = 'external_provider' and provider_key is not null and provider_connection_id is not null)
  ),
  check (folio is null or folio > 0),
  check (provider_totals is null or jsonb_typeof(provider_totals) = 'object')
);

create index if not exists fiscal_execution_business_status_idx
  on public.fiscal_execution(business_id, status, updated_at desc);

create index if not exists fiscal_execution_provider_reconcile_idx
  on public.fiscal_execution(provider_key, status, updated_at)
  where mode = 'external_provider'
    and status in ('submitting', 'queued', 'issued', 'pending_authority', 'unknown');

-- Browser/mobile still receive no direct grants. API is server-side business
-- scoped; fiscal worker is a system runtime role without BYPASSRLS.
alter table public.fiscal_provider_connection enable row level security;
alter table public.fiscal_execution enable row level security;

revoke all on table
  public.fiscal_provider_connection,
  public.fiscal_execution
from anon, authenticated;

grant select, insert, update on public.fiscal_provider_connection to palta_commerce_api;
grant select, insert on public.fiscal_execution to palta_commerce_api;

grant select on public.fiscal_provider_connection to palta_fiscal_worker;
grant select, insert, update on public.fiscal_execution to palta_fiscal_worker;

create policy fiscal_provider_connection_api_select
  on public.fiscal_provider_connection for select to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy fiscal_provider_connection_api_insert
  on public.fiscal_provider_connection for insert to palta_commerce_api
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy fiscal_provider_connection_api_update
  on public.fiscal_provider_connection for update to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid)
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy fiscal_provider_connection_worker_select
  on public.fiscal_provider_connection for select to palta_fiscal_worker
  using (true);

create policy fiscal_execution_api_select
  on public.fiscal_execution for select to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy fiscal_execution_api_insert
  on public.fiscal_execution for insert to palta_commerce_api
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy fiscal_execution_worker_select
  on public.fiscal_execution for select to palta_fiscal_worker using (true);
create policy fiscal_execution_worker_insert
  on public.fiscal_execution for insert to palta_fiscal_worker with check (true);
create policy fiscal_execution_worker_update
  on public.fiscal_execution for update to palta_fiscal_worker using (true) with check (true);

-- No DELETE policies. Once a fiscal execution may have reached a provider/SII,
-- history is append/correct/reconcile, never destructive deletion.
