-- PALTA FISCAL CREDENTIAL ENVELOPE PREFLIGHT
-- STATUS: PRE-DEPLOYMENT / VERIFIED BY CI
-- Date: 2026-09-17
--
-- Fiscal provider credentials (API keys/tokens) are encrypted with one random
-- DEK per bundle. The DEK is wrapped by a platform KEK held outside Postgres.
-- Provider credential plaintext, SII passwords, certificate passwords/private
-- keys must never be stored in fiscal_provider_connection.safe_configuration.

alter table public.fiscal_provider_connection
  add constraint fiscal_provider_connection_envelope_identity_uidx
  unique (business_id, id, issuer_rut, provider_key);

create table if not exists public.fiscal_credential_envelope (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  provider_connection_id uuid not null,
  provider_key text not null,
  issuer_rut text not null,
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
  foreign key (business_id, provider_connection_id, issuer_rut, provider_key)
    references public.fiscal_provider_connection(business_id, id, issuer_rut, provider_key)
    on delete restrict
);

create index if not exists fiscal_credential_envelope_connection_idx
  on public.fiscal_credential_envelope(
    business_id,
    issuer_rut,
    provider_key,
    provider_connection_id,
    updated_at desc
  );

alter table public.fiscal_credential_envelope enable row level security;
revoke all on table public.fiscal_credential_envelope from anon, authenticated;

grant select, insert, update on public.fiscal_credential_envelope to palta_commerce_api;
grant select on public.fiscal_credential_envelope to palta_fiscal_worker;

create policy fiscal_credential_envelope_api_select
  on public.fiscal_credential_envelope for select to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy fiscal_credential_envelope_api_insert
  on public.fiscal_credential_envelope for insert to palta_commerce_api
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy fiscal_credential_envelope_api_update
  on public.fiscal_credential_envelope for update to palta_commerce_api
  using (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid)
  with check (business_id = nullif(current_setting('app.current_business_id', true), '')::uuid);
create policy fiscal_credential_envelope_worker_select
  on public.fiscal_credential_envelope for select to palta_fiscal_worker
  using (true);

-- Deliberately no DELETE policy. Rotation replaces ciphertext by optimistic
-- revision; historical DB backups remain ciphertext-only and cannot decrypt
-- without the external KEK.
