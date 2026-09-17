-- PALTA COMMERCE RUNTIME DB PREFLIGHT
-- STATUS: DRAFT / NOT APPLIED
-- Date: 2026-09-17
-- Target: Postgres (Supabase first candidate; Neon-compatible where practical)
--
-- This migration establishes the durability/uniqueness boundaries required by
-- independent POS, Payment and Chile Fiscal. It must be reviewed with RLS and
-- authorization before being applied to any development project.

create table if not exists commerce_transaction (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(entity_id) on delete restrict,
  idempotency_key text not null,
  state text not null check (state in (
    'draft',
    'ready_for_payment',
    'payment_pending',
    'payment_confirmed',
    'completed',
    'cancelled',
    'refund_pending',
    'refunded'
  )),
  currency text not null default 'CLP',
  total_amount_minor bigint not null check (total_amount_minor >= 0),
  lines jsonb not null,
  revision bigint not null default 0 check (revision >= 0),
  outlet_id uuid,
  trading_session_id uuid,
  operator_id uuid,
  customer_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create index if not exists commerce_transaction_business_state_idx
  on commerce_transaction(business_id, state, updated_at desc);

create table if not exists pos_register (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(entity_id) on delete restrict,
  name text not null,
  cash_control text not null default 'none' check (cash_control in ('none', 'tracked')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pos_register_business_status_idx
  on pos_register(business_id, status);

create table if not exists pos_session (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(entity_id) on delete restrict,
  register_id uuid not null references pos_register(id) on delete restrict,
  operator_id uuid,
  status text not null check (status in ('open', 'closed')),
  cash_control text not null check (cash_control in ('none', 'tracked')),
  opening_cash_minor bigint,
  expected_cash_minor bigint,
  counted_cash_minor bigint,
  cash_difference_minor bigint,
  revision bigint not null default 0 check (revision >= 0),
  opened_at timestamptz not null,
  closed_at timestamptz,
  closed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (opening_cash_minor is null or opening_cash_minor >= 0),
  check (expected_cash_minor is null or expected_cash_minor >= 0),
  check (counted_cash_minor is null or counted_cash_minor >= 0)
);

create unique index if not exists pos_session_one_open_per_register_idx
  on pos_session(register_id)
  where status = 'open';

create index if not exists pos_session_business_status_idx
  on pos_session(business_id, status, opened_at desc);

create table if not exists pos_cash_entry (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(entity_id) on delete restrict,
  session_id uuid not null references pos_session(id) on delete restrict,
  entry_type text not null check (entry_type in (
    'cash_sale',
    'cash_refund',
    'cash_in',
    'cash_out',
    'adjustment'
  )),
  amount_minor bigint not null check (amount_minor >= 0),
  idempotency_key text not null,
  reference_id uuid,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create index if not exists pos_cash_entry_session_time_idx
  on pos_cash_entry(session_id, occurred_at);

create table if not exists payment_intent (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(entity_id) on delete restrict,
  commerce_transaction_id uuid not null references commerce_transaction(id) on delete restrict,
  idempotency_key text not null,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null default 'CLP',
  rail text not null check (rail in ('card', 'wallet', 'account_to_account', 'cash', 'other')),
  status text not null check (status in (
    'created',
    'pending',
    'processing',
    'requires_action',
    'authorized',
    'paid',
    'declined',
    'unknown',
    'failed',
    'cancelled',
    'refund_pending',
    'partially_refunded',
    'refunded'
  )),
  provider_key text,
  provider_reference text,
  provider_payment_id text,
  terminal_id text,
  authorization_code text,
  card_brand text,
  card_last4 text,
  fee_minor bigint check (fee_minor is null or fee_minor >= 0),
  settlement_status text not null default 'not_applicable' check (settlement_status in (
    'not_applicable', 'pending', 'settled', 'failed'
  )),
  settlement_reference text,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create unique index if not exists payment_intent_provider_reference_uidx
  on payment_intent(provider_key, provider_reference)
  where provider_key is not null and provider_reference is not null;

create index if not exists payment_intent_business_status_idx
  on payment_intent(business_id, status, updated_at desc);

create index if not exists payment_intent_unknown_reconcile_idx
  on payment_intent(status, updated_at)
  where status in ('pending', 'processing', 'unknown', 'requires_action', 'authorized');

create table if not exists payment_event (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(entity_id) on delete restrict,
  payment_intent_id uuid not null references payment_intent(id) on delete restrict,
  event_type text not null,
  occurred_at timestamptz not null,
  provider_key text,
  provider_event_id text,
  provider_reference text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists payment_event_provider_event_uidx
  on payment_event(provider_key, provider_event_id)
  where provider_key is not null and provider_event_id is not null;

create index if not exists payment_event_intent_time_idx
  on payment_event(payment_intent_id, occurred_at);

create table if not exists commerce_outbox (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(entity_id) on delete restrict,
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  idempotency_key text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in (
    'pending', 'processing', 'delivered', 'retryable_error', 'dead_letter'
  )),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create index if not exists commerce_outbox_dispatch_idx
  on commerce_outbox(status, next_attempt_at, created_at)
  where status in ('pending', 'retryable_error');

create table if not exists chile_caf_range (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(entity_id) on delete restrict,
  issuer_rut text not null,
  document_type integer not null,
  caf_ref text not null,
  first_folio bigint not null,
  last_folio bigint not null,
  next_folio bigint not null,
  revision bigint not null default 0 check (revision >= 0),
  status text not null default 'active' check (status in ('active', 'exhausted', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (first_folio > 0),
  check (last_folio >= first_folio),
  check (next_folio >= first_folio and next_folio <= last_folio + 1),
  unique (business_id, issuer_rut, document_type, caf_ref)
);

create index if not exists chile_caf_range_allocate_idx
  on chile_caf_range(business_id, issuer_rut, document_type, status, next_folio);

create table if not exists fiscal_request (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(entity_id) on delete restrict,
  commerce_transaction_id uuid not null references commerce_transaction(id) on delete restrict,
  issuer_rut text not null,
  document_type integer not null,
  idempotency_key text not null,
  status text not null check (status in (
    'pending',
    'validating',
    'ready_to_reserve_folio',
    'ready_to_sign',
    'signing',
    'ready_to_send',
    'sending',
    'accepted',
    'observed',
    'rejected',
    'failed',
    'cancelled'
  )),
  lines jsonb not null,
  totals jsonb not null,
  receiver jsonb,
  references_json jsonb,
  folio bigint,
  caf_range_id uuid references chile_caf_range(id) on delete restrict,
  sii_track_id text,
  sii_response_code text,
  sii_response_message text,
  ruleset_version text,
  revision bigint not null default 0 check (revision >= 0),
  requested_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, issuer_rut, document_type, idempotency_key)
);

create index if not exists fiscal_request_issuer_status_idx
  on fiscal_request(issuer_rut, document_type, status, updated_at);

create index if not exists fiscal_request_business_status_idx
  on fiscal_request(business_id, status, updated_at desc);

create table if not exists fiscal_folio_reservation (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(entity_id) on delete restrict,
  caf_range_id uuid not null references chile_caf_range(id) on delete restrict,
  fiscal_request_id uuid not null references fiscal_request(id) on delete restrict,
  issuer_rut text not null,
  document_type integer not null,
  folio bigint not null,
  idempotency_key text not null,
  reserved_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (fiscal_request_id),
  unique (business_id, issuer_rut, document_type, folio),
  unique (business_id, issuer_rut, document_type, idempotency_key)
);

create table if not exists fiscal_document (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(entity_id) on delete restrict,
  fiscal_request_id uuid not null references fiscal_request(id) on delete restrict,
  issuer_rut text not null,
  document_type integer not null,
  folio bigint not null,
  sii_status text not null,
  sii_track_id text,
  signed_xml_asset_ref text,
  pdf_asset_ref text,
  sii_response_asset_ref text,
  signed_xml_sha256 text,
  issued_at timestamptz,
  accepted_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fiscal_request_id),
  unique (business_id, issuer_rut, document_type, folio)
);

create index if not exists fiscal_document_business_issued_idx
  on fiscal_document(business_id, issued_at desc);

-- Atomicity requirements for the repository implementation:
-- 1. Commerce mutation + corresponding commerce_outbox insert commit together.
-- 2. Payment provider call happens only after canonical PaymentIntent is durably created.
-- 3. Folio allocation uses one DB transaction with row locking / optimistic revision
--    so one issuer+document folio can never be assigned to two FiscalRequests.
-- 4. Replaying the same idempotency key returns the original canonical object.
-- 5. Provider callbacks append payment_event before/with idempotent canonical state update.
--
-- Deliberately NOT included yet:
-- - RLS policies (next reviewed migration)
-- - actual Supabase-specific auth FKs
-- - partitioning/sharding
-- - provider SDK/database-specific triggers
-- - SII legal/rule assumptions beyond canonical DTE identifiers
