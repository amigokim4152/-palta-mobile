-- PALTA COMMERCE RUNTIME HARDENING
-- STATUS: DRAFT / NOT APPLIED
-- Date: 2026-09-17
-- Applies after 0003_commerce_runtime_preflight.sql
--
-- Goals:
-- 1. Align POS cash persistence with canonical signed CashDrawerEntry.amountDeltaMinor.
-- 2. Add a durable, deduplicated provider-notification inbox before any callback
--    is allowed to mutate canonical PaymentIntent state.

alter table pos_cash_entry
  drop constraint if exists pos_cash_entry_amount_minor_check;

alter table pos_cash_entry
  rename column amount_minor to amount_delta_minor;

alter table pos_cash_entry
  add constraint pos_cash_entry_amount_delta_safe_check
  check (
    amount_delta_minor between -9007199254740991 and 9007199254740991
  );

comment on column pos_cash_entry.amount_delta_minor is
  'Signed CLP minor-unit delta: sale/cash-in positive; refund/cash-out negative.';

create table if not exists provider_notification_inbox (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  provider_event_id text not null,
  provider_resource_reference text not null,
  provider_event_type text,
  request_id text,
  payload_hash text not null,
  signature_verified boolean not null,
  status text not null check (status in (
    'received',
    'verified',
    'rejected',
    'processing',
    'processed',
    'retryable_error',
    'dead_letter'
  )),
  attempts integer not null default 0 check (attempts >= 0),
  received_at timestamptz not null,
  updated_at timestamptz not null,
  processed_at timestamptz,
  next_attempt_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  unique (provider_key, provider_event_id),
  check (length(trim(provider_key)) > 0),
  check (length(trim(provider_event_id)) > 0),
  check (length(trim(provider_resource_reference)) > 0),
  check (length(trim(payload_hash)) > 0)
);

create index if not exists provider_notification_inbox_work_idx
  on provider_notification_inbox(status, next_attempt_at, received_at)
  where status in ('verified', 'retryable_error');

create index if not exists provider_notification_inbox_resource_idx
  on provider_notification_inbox(provider_key, provider_resource_reference, received_at desc);

-- Security/processing invariants:
-- 1. HTTP callback handlers verify provider signatures before setting
--    signature_verified=true.
-- 2. Invalid signatures are durably recorded as rejected and never mutate
--    PaymentIntent.
-- 3. (provider_key, provider_event_id) is the callback dedupe boundary.
-- 4. Callback payload itself is not canonical payment truth. A worker reloads
--    authoritative provider status through PaymentPort before state transition.
-- 5. Raw provider payload is deliberately not persisted here by default to
--    minimize unnecessary sensitive-data retention. provider_event_id,
--    resource reference, request ID and payload hash are retained for audit.
