-- PALTA BUSINESS RLS CONTEXT HELPER
-- STATUS: APPLIED TO palta-dev / 2026-09-18
--
-- Keeps tenant context evaluation out of each row-level policy expression while
-- preserving transaction-local app.current_business_id semantics.

create schema if not exists palta_private;
revoke all on schema palta_private from public, anon, authenticated, service_role;
grant usage on schema palta_private to palta_commerce_api;

create or replace function palta_private.current_business_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select nullif(current_setting('app.current_business_id', true), '')::uuid
$$;

revoke all on function palta_private.current_business_id()
  from public, anon, authenticated, service_role;
grant execute on function palta_private.current_business_id()
  to palta_commerce_api;

-- Rewrite only business-facing API policies. System worker policies are not
-- tenant-filtered through this helper and remain unchanged.
do $$
declare
  p record;
  expr text := '(business_id = (select palta_private.current_business_id()))';
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
      execute format(
        'alter policy %I on %I.%I using (%s)',
        p.policyname, p.schemaname, p.tablename, expr
      );
    elsif p.cmd = 'INSERT' then
      execute format(
        'alter policy %I on %I.%I with check (%s)',
        p.policyname, p.schemaname, p.tablename, expr
      );
    elsif p.cmd = 'UPDATE' then
      execute format(
        'alter policy %I on %I.%I using (%s) with check (%s)',
        p.policyname, p.schemaname, p.tablename, expr, expr
      );
    end if;
  end loop;
end $$;

-- Supabase performance advisor was re-run after application: the prior
-- auth_rls_initplan and unindexed_foreign_keys findings were cleared. A new,
-- empty DEV database naturally reports indexes as unused until workloads exist.
