-- PALTA PAYMENT CREDENTIAL ENVELOPE PREFLIGHT
-- STATUS: DRAFT / NOT APPLIED
-- Date: 2026-09-17
--
-- Long-term provider-neutral credential storage:
-- - one random DEK per credential bundle
-- - credential JSON encrypted with AES-256-GCM under the DEK
-- - DEK wrapped with a small-number platform KEK held outside Postgres
-- - only ciphertext / IV / wrapped DEK / key ID are persisted here
-- - business/provider/connection identity is authenticated as AES-GCM AAD
--
-- No plaintext access token, refresh token, API secret, private key, PAN, CVV or
-- PIN may ever be written to this table.

create table if not exists public.payment_credential_envelope (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  provider_connection_id uuid not null,
  provider_key text not null,
  credential_ref text not null,
  algorithm text not null default 'AES-256-GCM' check (algorithm = 'AES-256-GCM'),
  ciphertext bytea not null,
  data_iv bytea not null,
  wrapped_data_key bytea not null,
  wrap_iv bytea not null,
  kek_id text not null,
  aad_version integer not null default 1 check (aad_version > 0),
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (octet_length(data_iv) = 12),
  check (octet_length(wrap_iv) = 12),
  check (octet_length(ciphertext) >= 16),
  check (octet_length(wrapped_data_key) >= 16),
  unique (business_id, provider_connection_id, credential_ref),
  foreign key (business_id, provider_connection_id)
    references public.payment_provider_connection(business_id, id)
    on delete restrict
);

create index if not exists payment_credential_envelope_connection_idx
  on public.payment_credential_envelope(
    business_id,
    provider_connection_id,
    provider_key,
    updated_at desc
  );

alter table public.payment_credential_envelope enable row level security;
revoke all on table public.payment_credential_envelope from anon, authenticated;

-- The business-facing API may create/rotate ciphertext during explicit provider
-- onboarding, but browser/mobile still has no table access. Payment worker reads
-- ciphertext for the exact business connection and decrypts only in runtime.
grant select, insert, update on public.payment_credential_envelope to palta_commerce_api;
grant select on public.payment_credential_envelope to palta_payment_worker;

create policy payment_credential_envelope_api_select
  on public.payment_credential_envelope for select to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy payment_credential_envelope_api_insert
  on public.payment_credential_envelope for insert to palta_commerce_api
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy payment_credential_envelope_api_update
  on public.payment_credential_envelope for update to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid)
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy payment_credential_envelope_worker_select
  on public.payment_credential_envelope for select to palta_payment_worker
  using (true);

-- Rotation rules:
-- - rotate/replace via optimistic revision; never overwrite silently
-- - key rotation may re-wrap DEKs under a new KEK without decrypting/re-encrypting
--   provider credential payloads if the runtime performs unwrap+rewrap securely
-- - keep old KEKs available only for the migration window, then retire after all
--   envelopes have been rewrapped and verified
-- - database backups contain ciphertext and wrapped keys, not the external KEK
