-- PALTA SUPABASE DEV HARDENING
-- STATUS: APPLIED TO palta-dev / 2026-09-18
--
-- Adds covering indexes for structurally important foreign keys and performs the
-- first pass of business-context RLS optimization. Migration 0022 replaces the
-- direct current_setting expression with a private helper after advisor review.

-- First-pass RLS rewrite. Kept for migration-history fidelity; 0022 is the final
-- policy form used by the current DEV database.
do $$
declare
  p record;
  expr text := '(business_id = (select nullif(current_setting(''app.current_business_id'', true), '''')::uuid))';
begin
  for p in
    select schemaname, tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public'
      and roles = array['palta_commerce_api']::name[]
      and (
        (qual is not null and qual like '%app.current_business_id%')
        or (with_check is not null and with_check like '%app.current_business_id%')
      )
  loop
    if p.cmd = 'SELECT' or p.cmd = 'DELETE' then
      execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, expr);
    elsif p.cmd = 'INSERT' then
      execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, expr);
    elsif p.cmd = 'UPDATE' then
      execute format('alter policy %I on %I.%I using (%s) with check (%s)', p.policyname, p.schemaname, p.tablename, expr, expr);
    end if;
  end loop;
end $$;

-- Foreign-key coverage reported by the Supabase performance advisor.
create index if not exists business_primary_place_id_idx
  on public.business(primary_place_id) where primary_place_id is not null;
create index if not exists care_track_subject_entity_id_idx
  on public.care_track(subject_entity_id) where subject_entity_id is not null;
create index if not exists customer_delivery_artifact_fk_idx
  on public.customer_delivery(business_id, artifact_id);
create index if not exists fiscal_credential_envelope_identity_fk_idx
  on public.fiscal_credential_envelope(business_id, provider_connection_id, issuer_rut, provider_key);
create index if not exists fiscal_execution_provider_connection_fk_idx
  on public.fiscal_execution(business_id, provider_connection_id) where provider_connection_id is not null;
create index if not exists fiscal_folio_reservation_caf_range_idx
  on public.fiscal_folio_reservation(caf_range_id);
create index if not exists fiscal_request_caf_range_idx
  on public.fiscal_request(caf_range_id) where caf_range_id is not null;
create index if not exists fiscal_request_commerce_transaction_idx
  on public.fiscal_request(commerce_transaction_id);
create index if not exists home_candidate_care_track_idx
  on public.home_candidate(care_track_id) where care_track_id is not null;
create index if not exists home_candidate_related_entity_idx
  on public.home_candidate(related_entity_id) where related_entity_id is not null;
create index if not exists payment_event_business_idx
  on public.payment_event(business_id);
create index if not exists payment_intent_commerce_transaction_idx
  on public.payment_intent(commerce_transaction_id);
create index if not exists print_job_printer_fk_idx
  on public.print_job(business_id, printer_id);
create index if not exists print_job_reprint_fk_idx
  on public.print_job(business_id, reprint_of_job_id) where reprint_of_job_id is not null;
create index if not exists printer_route_candidate_printer_fk_idx
  on public.printer_route_candidate(business_id, printer_id);
create index if not exists printer_route_candidate_route_fk_idx
  on public.printer_route_candidate(business_id, route_id);

-- PostGIS was originally installed into public by migration 0001. These revokes
-- were attempted in DEV, but the extension-owned ACL is still reported by the
-- Supabase security advisor. Do not drop/reinstall PostGIS destructively after
-- dependent geography columns exist; fix the extension placement in the clean
-- STAGING/PROD baseline or through the supported Supabase migration path.
revoke execute on function public.st_estimatedextent(text, text)
  from public, anon, authenticated;
revoke execute on function public.st_estimatedextent(text, text, text)
  from public, anon, authenticated;
revoke execute on function public.st_estimatedextent(text, text, text, boolean)
  from public, anon, authenticated;
