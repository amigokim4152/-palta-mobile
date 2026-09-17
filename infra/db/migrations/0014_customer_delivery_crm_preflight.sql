-- PALTA CUSTOMER DELIVERY / CRM PREFLIGHT
-- STATUS: PRE-DEPLOYMENT / VERIFIED BY CI
-- Date: 2026-09-17
--
-- Transactional delivery history is durable, but destination plaintext and
-- share-token plaintext are deliberately not duplicated into these tables.
-- A transaction/service touchpoint never creates future marketing permission.

do $$
begin
  create role palta_customer_delivery_worker nologin;
exception when duplicate_object then null;
end $$;

create table if not exists public.customer_artifact (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  kind text not null check (kind in (
    'receipt', 'fiscal_document', 'order_status', 'pickup_code',
    'quote_summary', 'service_summary'
  )),
  source_id text not null,
  title text not null check (length(title) between 1 and 240),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (business_id, kind, source_id),
  check (expires_at is null or expires_at > created_at)
);

create index if not exists customer_artifact_business_created_idx
  on public.customer_artifact(business_id, created_at desc);

create table if not exists public.customer_share_link (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  artifact_id uuid not null,
  token_hash char(64) not null check (token_hash ~ '^[0-9a-f]{64}$'),
  scope text not null check (scope in (
    'view_receipt', 'view_fiscal_document', 'view_order_status',
    'view_pickup_code', 'view_quote', 'view_service_summary'
  )),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  revoked_at timestamptz,
  unique (token_hash),
  foreign key (artifact_id) references public.customer_artifact(id) on delete restrict,
  check (expires_at > created_at),
  check (max_uses is null or use_count <= max_uses)
);

create index if not exists customer_share_link_artifact_idx
  on public.customer_share_link(business_id, artifact_id, expires_at desc);

create table if not exists public.customer_delivery (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  customer_id uuid,
  artifact_id uuid not null,
  purpose text not null check (purpose in ('transactional', 'service_follow_up', 'marketing')),
  channel text not null check (channel in (
    'palta_inbox', 'whatsapp_handoff', 'whatsapp_business',
    'system_share', 'sms', 'email', 'qr'
  )),
  status text not null check (status in (
    'prepared', 'handed_off', 'queued', 'sent', 'delivered', 'unknown', 'failed'
  )),
  destination_hash char(64) check (destination_hash is null or destination_hash ~ '^[0-9a-f]{64}$'),
  destination_masked text check (destination_masked is null or length(destination_masked) <= 160),
  idempotency_key text not null,
  provider_reference text,
  error_code text,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, idempotency_key),
  foreign key (artifact_id) references public.customer_artifact(id) on delete restrict
);

create index if not exists customer_delivery_business_customer_idx
  on public.customer_delivery(business_id, customer_id, created_at desc)
  where customer_id is not null;
create index if not exists customer_delivery_status_idx
  on public.customer_delivery(business_id, status, updated_at desc);

create table if not exists public.customer_relationship_touchpoint (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  customer_id uuid not null,
  type text not null check (type in (
    'transactional_delivery', 'service_follow_up', 'marketing_contact'
  )),
  artifact_kind text not null check (artifact_kind in (
    'receipt', 'fiscal_document', 'order_status', 'pickup_code',
    'quote_summary', 'service_summary'
  )),
  source_id text not null,
  delivery_id uuid not null,
  occurred_at timestamptz not null,
  grants_future_permission boolean not null default false check (grants_future_permission = false),
  unique (business_id, delivery_id),
  foreign key (delivery_id) references public.customer_delivery(id) on delete restrict
);

create index if not exists customer_relationship_touchpoint_customer_idx
  on public.customer_relationship_touchpoint(business_id, customer_id, occurred_at desc);

alter table public.customer_artifact enable row level security;
alter table public.customer_share_link enable row level security;
alter table public.customer_delivery enable row level security;
alter table public.customer_relationship_touchpoint enable row level security;

revoke all on table public.customer_artifact from anon, authenticated;
revoke all on table public.customer_share_link from anon, authenticated;
revoke all on table public.customer_delivery from anon, authenticated;
revoke all on table public.customer_relationship_touchpoint from anon, authenticated;

grant select, insert, update on public.customer_artifact to palta_commerce_api;
grant select, insert, update on public.customer_share_link to palta_commerce_api;
grant select, insert, update on public.customer_delivery to palta_commerce_api;
grant select, insert on public.customer_relationship_touchpoint to palta_commerce_api;

grant select on public.customer_artifact to palta_customer_delivery_worker;
grant select, update on public.customer_share_link to palta_customer_delivery_worker;

create policy customer_artifact_api_select
  on public.customer_artifact for select to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy customer_artifact_api_insert
  on public.customer_artifact for insert to palta_commerce_api
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy customer_artifact_api_update
  on public.customer_artifact for update to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid)
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);

create policy customer_share_link_api_select
  on public.customer_share_link for select to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy customer_share_link_api_insert
  on public.customer_share_link for insert to palta_commerce_api
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy customer_share_link_api_update
  on public.customer_share_link for update to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid)
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy customer_share_link_worker_select
  on public.customer_share_link for select to palta_customer_delivery_worker
  using (true);
create policy customer_share_link_worker_update
  on public.customer_share_link for update to palta_customer_delivery_worker
  using (true)
  with check (true);
create policy customer_artifact_worker_select
  on public.customer_artifact for select to palta_customer_delivery_worker
  using (true);

create policy customer_delivery_api_select
  on public.customer_delivery for select to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy customer_delivery_api_insert
  on public.customer_delivery for insert to palta_commerce_api
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy customer_delivery_api_update
  on public.customer_delivery for update to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid)
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);

create policy customer_relationship_touchpoint_api_select
  on public.customer_relationship_touchpoint for select to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy customer_relationship_touchpoint_api_insert
  on public.customer_relationship_touchpoint for insert to palta_commerce_api
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);

-- Deliberately no DELETE grants/policies. Delivery and relationship history are
-- append/audit oriented; retention/minimization can be implemented later under
-- an explicit lifecycle contract instead of ad-hoc application deletion.
