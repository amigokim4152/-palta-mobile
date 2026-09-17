-- Chile SII consumer boleta / electronic-payment-voucher emission model.
--
-- The model is versioned by effective calendar month rather than stored as one
-- mutable business flag. This prevents a future model change from retroactively
-- changing the fiscal interpretation of an earlier sale.

create table if not exists public.chile_boleta_emission_model (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business(entity_id) on delete restrict,
  effective_month date not null,
  model text not null check (model in (
    'always_issue_boleta',
    'voucher_replaces_boleta_for_electronic_payment'
  )),
  source text not null check (source in ('merchant_declared', 'sii_verified')),
  recorded_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, effective_month),
  check (effective_month = date_trunc('month', effective_month)::date)
);

create index if not exists chile_boleta_emission_model_business_month_idx
  on public.chile_boleta_emission_model(business_id, effective_month desc);

alter table public.chile_boleta_emission_model enable row level security;

revoke all on table public.chile_boleta_emission_model from anon, authenticated;

grant select, insert, update on public.chile_boleta_emission_model to palta_commerce_api;
grant select on public.chile_boleta_emission_model to palta_fiscal_worker;

create policy chile_boleta_emission_model_api_select
  on public.chile_boleta_emission_model for select to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);

create policy chile_boleta_emission_model_api_insert
  on public.chile_boleta_emission_model for insert to palta_commerce_api
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);

create policy chile_boleta_emission_model_api_update
  on public.chile_boleta_emission_model for update to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid)
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);

create policy chile_boleta_emission_model_worker_select
  on public.chile_boleta_emission_model for select to palta_fiscal_worker
  using (true);

-- No DELETE policy. Corrections are auditable updates; historical month records
-- must not disappear after fiscal decisions may have depended on them.
