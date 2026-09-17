-- PALTA PRINT DEVICE / ROUTING PREFLIGHT
-- STATUS: PRE-DEPLOYMENT / VERIFIED BY CI
-- Date: 2026-09-17
--
-- Printer configuration is business-scoped infrastructure metadata.
-- Browsers/native clients do not receive raw DB access; Palta Commerce API owns writes.
-- Device Bridge never owns Sale/Payment/Fiscal state and does not connect directly to this DB.
--
-- Multi-printer rule:
-- A register/role is pinned to one primary printer. Automatic physical-printer
-- switching is disabled unless the owner explicitly enables fallback for that route.

create table if not exists public.printer_device (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  outlet_key text not null default 'default'
    check (length(outlet_key) between 1 and 160),
  display_name text not null check (length(display_name) between 1 and 160),
  manufacturer text check (manufacturer is null or length(manufacturer) <= 120),
  model text check (model is null or length(model) <= 160),
  firmware_version text check (firmware_version is null or length(firmware_version) <= 96),
  serial_number_hash char(64) check (
    serial_number_hash is null or serial_number_hash ~ '^[0-9a-f]{64}$'
  ),
  connection_fingerprint_hash char(64) not null
    check (connection_fingerprint_hash ~ '^[0-9a-f]{64}$'),
  transport text not null check (transport in (
    'usb', 'serial', 'bluetooth', 'network', 'ipp', 'os_spooler', 'vendor_sdk'
  )),
  protocol text not null check (protocol in (
    'esc_pos', 'epson_epos', 'star_prnt', 'zpl', 'epl', 'tspl',
    'brother_raster', 'ipp_pdf', 'os_spooler'
  )),
  support_tier text not null check (support_tier in (
    'palta_recommended', 'palta_certified', 'compatible', 'legacy_bridge', 'unknown'
  )),
  adapter_key text not null check (length(adapter_key) between 1 and 120),
  paper_width_mm numeric(6,2) check (paper_width_mm is null or paper_width_mm > 0),
  health text not null check (health in (
    'ready', 'offline', 'busy', 'paper_low', 'paper_out', 'cover_open',
    'cutter_error', 'permission_required', 'driver_required',
    'bridge_unreachable', 'network_unreachable', 'unknown'
  )),
  enabled boolean not null default true,
  revision bigint not null default 0 check (revision >= 0),
  last_seen_at timestamptz,
  last_tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, connection_fingerprint_hash)
);

create index if not exists printer_device_business_outlet_idx
  on public.printer_device(business_id, outlet_key, enabled, health);
create index if not exists printer_device_model_idx
  on public.printer_device(manufacturer, model)
  where manufacturer is not null and model is not null;

create table if not exists public.printer_route (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  outlet_key text not null default 'default'
    check (length(outlet_key) between 1 and 160),
  -- '*' means outlet/default route. A concrete register key pins this route to one POS/caja.
  register_key text not null default '*'
    check (length(register_key) between 1 and 160),
  role text not null check (role in ('receipt', 'label', 'a4', 'kitchen', 'packing')),
  failover_mode text not null default 'disabled'
    check (failover_mode in ('disabled', 'explicit')),
  enabled boolean not null default true,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, outlet_key, register_key, role)
);

create index if not exists printer_route_scope_idx
  on public.printer_route(business_id, outlet_key, register_key, role, enabled);

create table if not exists public.printer_route_candidate (
  route_id uuid not null,
  business_id uuid not null,
  printer_id uuid not null,
  priority integer not null check (priority between 0 and 99),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (route_id, printer_id),
  foreign key (business_id, route_id)
    references public.printer_route(business_id, id) on delete cascade,
  foreign key (business_id, printer_id)
    references public.printer_device(business_id, id) on delete restrict,
  unique (route_id, priority)
);

create unique index if not exists printer_route_one_primary_idx
  on public.printer_route_candidate(route_id)
  where is_primary;

alter table public.printer_device enable row level security;
alter table public.printer_route enable row level security;
alter table public.printer_route_candidate enable row level security;

revoke all on table public.printer_device from anon, authenticated;
revoke all on table public.printer_route from anon, authenticated;
revoke all on table public.printer_route_candidate from anon, authenticated;

grant select, insert, update on public.printer_device to palta_commerce_api;
grant select, insert, update on public.printer_route to palta_commerce_api;
grant select, insert, update, delete on public.printer_route_candidate to palta_commerce_api;

create policy printer_device_api_select
  on public.printer_device for select to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy printer_device_api_insert
  on public.printer_device for insert to palta_commerce_api
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy printer_device_api_update
  on public.printer_device for update to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid)
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);

create policy printer_route_api_select
  on public.printer_route for select to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy printer_route_api_insert
  on public.printer_route for insert to palta_commerce_api
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy printer_route_api_update
  on public.printer_route for update to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid)
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);

create policy printer_route_candidate_api_select
  on public.printer_route_candidate for select to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy printer_route_candidate_api_insert
  on public.printer_route_candidate for insert to palta_commerce_api
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy printer_route_candidate_api_update
  on public.printer_route_candidate for update to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid)
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy printer_route_candidate_api_delete
  on public.printer_route_candidate for delete to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);

-- Printer devices are disabled rather than casually deleted so routing/audit history
-- is not broken. Route candidates may be changed as part of normal setup.