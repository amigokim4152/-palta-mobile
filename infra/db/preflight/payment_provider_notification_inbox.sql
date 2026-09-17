-- PALTA PAYMENT PROVIDER NOTIFICATION INBOX PREFLIGHT
-- STATUS: REVIEW ARTIFACT / NOT APPLIED
-- Purpose: durable, idempotent intake for verified payment provider callbacks.
-- This is intentionally outside migration history until the development database,
-- authorization model and RLS are reviewed.

create table if not exists payment_provider_notification_inbox (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  provider_event_id text not null,
  provider_resource_reference text not null,
  provider_event_type text,
  request_id text,
  payload_hash text not null,
  signature_verified boolean not null default false,
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
  processed_at timestamptz,
  next_attempt_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_key, provider_event_id)
);

create index if not exists payment_provider_notification_dispatch_idx
  on payment_provider_notification_inbox(status, next_attempt_at, received_at)
  where status in ('verified', 'retryable_error');

create index if not exists payment_provider_notification_resource_idx
  on payment_provider_notification_inbox(provider_key, provider_resource_reference, received_at desc);

-- Rules:
-- 1. Verify provider signature before status becomes verified.
-- 2. Duplicate provider_event_id returns the existing inbox item.
-- 3. HTTP callback handling should durably insert/dedupe quickly, then acknowledge.
-- 4. Inbox payload is a signal only. A worker fetches authoritative provider state
--    before changing canonical PaymentIntent.
-- 5. Do not store raw card data, secrets or full sensitive provider payloads here.
--    Store a cryptographic payload hash plus minimal routing metadata.
-- 6. Processing retries are idempotent and do not create replacement payments.
