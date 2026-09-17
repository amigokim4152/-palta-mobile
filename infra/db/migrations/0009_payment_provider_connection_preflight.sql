-- PALTA PAYMENT PROVIDER CONNECTION PREFLIGHT
-- STATUS: DRAFT / NOT APPLIED
-- Date: 2026-09-17
--
-- One business may connect one or more payment-provider accounts. Credentials
-- never live in this table; credential_ref is an opaque pointer resolved only by
-- the Payment Worker secret boundary.

create table if not exists public.payment_provider_connection (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business(entity_id) on delete restrict,
  provider_key text not null,
  environment text not null default 'sandbox' check (environment in ('sandbox', 'production')),
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
  merchant_ref text,
  capabilities jsonb not null default '{}'::jsonb,
  safe_configuration jsonb not null default '{}'::jsonb,
  revision bigint not null default 0 check (revision >= 0),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);

create index if not exists payment_provider_connection_business_provider_idx
  on public.payment_provider_connection(business_id, provider_key, status, updated_at desc);

alter table public.payment_intent
  add column if not exists provider_connection_id uuid;

alter table public.payment_intent
  drop constraint if exists payment_intent_provider_connection_fk;

alter table public.payment_intent
  add constraint payment_intent_provider_connection_fk
  foreign key (business_id, provider_connection_id)
  references public.payment_provider_connection(business_id, id)
  on delete restrict;

create index if not exists payment_intent_provider_connection_idx
  on public.payment_intent(business_id, provider_connection_id, updated_at desc)
  where provider_connection_id is not null;

-- Runtime access boundary. Browser/mobile receives no direct table grant.
alter table public.payment_provider_connection enable row level security;
revoke all on table public.payment_provider_connection from anon, authenticated;

grant select, insert, update on public.payment_provider_connection to palta_commerce_api;
grant select on public.payment_provider_connection to palta_payment_worker;

create policy payment_provider_connection_api_select
  on public.payment_provider_connection for select to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy payment_provider_connection_api_insert
  on public.payment_provider_connection for insert to palta_commerce_api
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy payment_provider_connection_api_update
  on public.payment_provider_connection for update to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid)
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy payment_provider_connection_worker_select
  on public.payment_provider_connection for select to palta_payment_worker
  using (true);

-- Safety invariants:
-- 1. credential_ref is only an opaque reference. Never store access tokens,
--    API secrets, private keys, PAN, CVV or PIN in safe_configuration.
-- 2. Payment Worker resolves (business_id, provider_key, provider_connection_id)
--    before each external operation. A connection from another business must
--    never satisfy the FK or resolver lookup.
-- 3. Production adapters should require status='connected' and environment
--    matching the Worker/provider runtime before side effects.
-- 4. provider_connection_id remains nullable for cash/manual/offline migration
--    paths, but integrated provider payment creation should persist it first.
