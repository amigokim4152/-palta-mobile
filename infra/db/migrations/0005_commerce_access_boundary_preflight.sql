-- PALTA COMMERCE DATABASE ACCESS BOUNDARY PREFLIGHT
-- STATUS: DRAFT / NOT APPLIED
-- Date: 2026-09-17
--
-- Design:
-- - Mobile/browser clients do NOT receive direct grants on commerce/payment/fiscal tables.
-- - Palta API uses a non-login group role with business-scoped RLS context:
--     set_config('app.current_business_id', '<uuid>', true)
-- - Payment/Fiscal background workers use separate internal group roles with
--   explicit policies only on the tables they need. They do NOT use BYPASSRLS.
-- - Login credentials are environment-specific and must never be committed.

-- Group roles only. Environment-specific LOGIN principals may be granted these
-- roles later and their passwords live in secret storage / Hyperdrive config.
do $$
begin
  create role palta_commerce_api nologin;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create role palta_payment_worker nologin;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create role palta_fiscal_worker nologin;
exception
  when duplicate_object then null;
end $$;

-- All runtime tables live in public for the preflight, therefore enable RLS on
-- every table even though anon/authenticated get no grants.
alter table public.commerce_transaction enable row level security;
alter table public.pos_register enable row level security;
alter table public.pos_session enable row level security;
alter table public.pos_cash_entry enable row level security;
alter table public.payment_intent enable row level security;
alter table public.payment_event enable row level security;
alter table public.commerce_outbox enable row level security;
alter table public.chile_caf_range enable row level security;
alter table public.fiscal_request enable row level security;
alter table public.fiscal_folio_reservation enable row level security;
alter table public.fiscal_document enable row level security;
alter table public.provider_notification_inbox enable row level security;

revoke all on table
  public.commerce_transaction,
  public.pos_register,
  public.pos_session,
  public.pos_cash_entry,
  public.payment_intent,
  public.payment_event,
  public.commerce_outbox,
  public.chile_caf_range,
  public.fiscal_request,
  public.fiscal_folio_reservation,
  public.fiscal_document,
  public.provider_notification_inbox
from anon, authenticated;

grant usage on schema public to
  palta_commerce_api,
  palta_payment_worker,
  palta_fiscal_worker;

-- Business-facing API: no DELETE on financial/fiscal ledgers.
grant select, insert, update on public.commerce_transaction to palta_commerce_api;
grant select, insert, update on public.pos_register to palta_commerce_api;
grant select, insert, update on public.pos_session to palta_commerce_api;
grant select, insert on public.pos_cash_entry to palta_commerce_api;
grant select, insert, update on public.payment_intent to palta_commerce_api;
grant select, insert on public.payment_event to palta_commerce_api;
grant insert on public.commerce_outbox to palta_commerce_api;
grant select, insert on public.fiscal_request to palta_commerce_api;
grant select on public.fiscal_document to palta_commerce_api;

-- Payment worker: payment reconciliation/callback processing plus Outbox/Inbox.
grant select on public.commerce_transaction to palta_payment_worker;
grant select, update on public.payment_intent to palta_payment_worker;
grant select, insert on public.payment_event to palta_payment_worker;
grant select, update on public.commerce_outbox to palta_payment_worker;
grant select, insert, update on public.provider_notification_inbox to palta_payment_worker;

-- Fiscal worker: DTE/CAF/folio processing plus canonical transaction reads.
grant select on public.commerce_transaction to palta_fiscal_worker;
grant select on public.payment_intent to palta_fiscal_worker;
grant select, update on public.commerce_outbox to palta_fiscal_worker;
grant select, insert, update on public.chile_caf_range to palta_fiscal_worker;
grant select, insert, update on public.fiscal_request to palta_fiscal_worker;
grant select, insert on public.fiscal_folio_reservation to palta_fiscal_worker;
grant select, insert, update on public.fiscal_document to palta_fiscal_worker;

-- Helper expression is intentionally repeated instead of SECURITY DEFINER
-- functions. The API wrapper sets the value transaction-locally so pooled
-- connections cannot leak one tenant context into another.

-- commerce_transaction
create policy commerce_transaction_api_select
  on public.commerce_transaction for select to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy commerce_transaction_api_insert
  on public.commerce_transaction for insert to palta_commerce_api
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy commerce_transaction_api_update
  on public.commerce_transaction for update to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid)
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy commerce_transaction_payment_worker_read
  on public.commerce_transaction for select to palta_payment_worker using (true);
create policy commerce_transaction_fiscal_worker_read
  on public.commerce_transaction for select to palta_fiscal_worker using (true);

-- POS tables
create policy pos_register_api_select
  on public.pos_register for select to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy pos_register_api_insert
  on public.pos_register for insert to palta_commerce_api
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy pos_register_api_update
  on public.pos_register for update to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid)
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);

create policy pos_session_api_select
  on public.pos_session for select to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy pos_session_api_insert
  on public.pos_session for insert to palta_commerce_api
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy pos_session_api_update
  on public.pos_session for update to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid)
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);

create policy pos_cash_entry_api_select
  on public.pos_cash_entry for select to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy pos_cash_entry_api_insert
  on public.pos_cash_entry for insert to palta_commerce_api
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);

-- Payment tables
create policy payment_intent_api_select
  on public.payment_intent for select to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy payment_intent_api_insert
  on public.payment_intent for insert to palta_commerce_api
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy payment_intent_api_update
  on public.payment_intent for update to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid)
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy payment_intent_worker_select
  on public.payment_intent for select to palta_payment_worker using (true);
create policy payment_intent_worker_update
  on public.payment_intent for update to palta_payment_worker using (true) with check (true);
create policy payment_intent_fiscal_worker_read
  on public.payment_intent for select to palta_fiscal_worker using (true);

create policy payment_event_api_select
  on public.payment_event for select to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy payment_event_api_insert
  on public.payment_event for insert to palta_commerce_api
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy payment_event_worker_select
  on public.payment_event for select to palta_payment_worker using (true);
create policy payment_event_worker_insert
  on public.payment_event for insert to palta_payment_worker with check (true);

-- Outbox: API appends; workers consume/update.
create policy commerce_outbox_api_insert
  on public.commerce_outbox for insert to palta_commerce_api
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy commerce_outbox_payment_worker_select
  on public.commerce_outbox for select to palta_payment_worker using (true);
create policy commerce_outbox_payment_worker_update
  on public.commerce_outbox for update to palta_payment_worker using (true) with check (true);
create policy commerce_outbox_fiscal_worker_select
  on public.commerce_outbox for select to palta_fiscal_worker using (true);
create policy commerce_outbox_fiscal_worker_update
  on public.commerce_outbox for update to palta_fiscal_worker using (true) with check (true);

-- Provider callbacks are system-only. Client/API role has no grants or policy.
create policy provider_notification_worker_select
  on public.provider_notification_inbox for select to palta_payment_worker using (true);
create policy provider_notification_worker_insert
  on public.provider_notification_inbox for insert to palta_payment_worker with check (true);
create policy provider_notification_worker_update
  on public.provider_notification_inbox for update to palta_payment_worker using (true) with check (true);

-- Fiscal request: business API can create/read its own request, but only the
-- fiscal worker may progress CAF/folio/sign/send/SII states.
create policy fiscal_request_api_select
  on public.fiscal_request for select to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy fiscal_request_api_insert
  on public.fiscal_request for insert to palta_commerce_api
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy fiscal_request_worker_select
  on public.fiscal_request for select to palta_fiscal_worker using (true);
create policy fiscal_request_worker_insert
  on public.fiscal_request for insert to palta_fiscal_worker with check (true);
create policy fiscal_request_worker_update
  on public.fiscal_request for update to palta_fiscal_worker using (true) with check (true);

create policy chile_caf_range_worker_select
  on public.chile_caf_range for select to palta_fiscal_worker using (true);
create policy chile_caf_range_worker_insert
  on public.chile_caf_range for insert to palta_fiscal_worker with check (true);
create policy chile_caf_range_worker_update
  on public.chile_caf_range for update to palta_fiscal_worker using (true) with check (true);

create policy fiscal_folio_reservation_worker_select
  on public.fiscal_folio_reservation for select to palta_fiscal_worker using (true);
create policy fiscal_folio_reservation_worker_insert
  on public.fiscal_folio_reservation for insert to palta_fiscal_worker with check (true);

create policy fiscal_document_api_select
  on public.fiscal_document for select to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy fiscal_document_worker_select
  on public.fiscal_document for select to palta_fiscal_worker using (true);
create policy fiscal_document_worker_insert
  on public.fiscal_document for insert to palta_fiscal_worker with check (true);
create policy fiscal_document_worker_update
  on public.fiscal_document for update to palta_fiscal_worker using (true) with check (true);

-- No DELETE policies intentionally. Financial/fiscal history is corrected by
-- explicit void/refund/credit-note lifecycle, not destructive deletion.
