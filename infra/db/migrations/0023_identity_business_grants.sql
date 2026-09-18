-- PALTA IDENTITY + BUSINESS OPERATIONAL GRANTS
-- STATUS: APPLIED TO palta-dev / 2026-09-18
--
-- Supabase Auth proves identity. This schema stores Palta's minimal account link
-- and canonical business-role authorization truth. Client-editable auth metadata
-- must never become business authorization truth.

create table if not exists public.palta_account (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active','suspended','closed')),
  display_name text
    check (display_name is null or length(display_name) between 1 and 120),
  preferred_locale text not null default 'es-CL'
    check (length(preferred_locale) between 2 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.palta_account enable row level security;
revoke all on table public.palta_account from anon, authenticated;
grant select on table public.palta_account to authenticated;
grant update (display_name, preferred_locale, updated_at)
  on table public.palta_account to authenticated;
grant select, insert, update on table public.palta_account to palta_commerce_api;

create policy palta_account_owner_read
  on public.palta_account
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy palta_account_owner_update
  on public.palta_account
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.business_operational_grant (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business(entity_id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  role text not null
    check (role in ('owner','manager','cashier','accountant','viewer')),
  status text not null default 'active'
    check (status in ('active','suspended','revoked')),
  granted_by_user_id uuid not null references auth.users(id) on delete restrict,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id),
  check (expires_at is null or expires_at > granted_at),
  check ((status = 'revoked' and revoked_at is not null) or status <> 'revoked')
);

create index if not exists business_operational_grant_user_status_idx
  on public.business_operational_grant(user_id, status, business_id);
create index if not exists business_operational_grant_business_role_idx
  on public.business_operational_grant(business_id, status, role, user_id);
create index if not exists business_operational_grant_granted_by_idx
  on public.business_operational_grant(granted_by_user_id);

alter table public.business_operational_grant enable row level security;
revoke all on table public.business_operational_grant from anon, authenticated;
grant select, insert, update on table public.business_operational_grant
  to palta_commerce_api;

create policy business_operational_grant_api_select
  on public.business_operational_grant
  for select
  to palta_commerce_api
  using (business_id = (select palta_private.current_business_id()));

create policy business_operational_grant_api_insert
  on public.business_operational_grant
  for insert
  to palta_commerce_api
  with check (business_id = (select palta_private.current_business_id()));

create policy business_operational_grant_api_update
  on public.business_operational_grant
  for update
  to palta_commerce_api
  using (business_id = (select palta_private.current_business_id()))
  with check (business_id = (select palta_private.current_business_id()));

comment on table public.business_operational_grant is
  'Canonical Palta business-role authorization truth. Role capabilities are enforced by trusted Palta API policy code; client-editable auth metadata is not authorization truth.';
