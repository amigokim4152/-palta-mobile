-- CI portability shim for Supabase Auth references.
--
-- Supabase already provides auth.users. A plain PostgreSQL CI container does not.
-- This migration creates the minimum auth.users identity table only when the
-- relation is absent so later migrations can verify FK integrity in CI.
-- On Supabase this is a no-op.

create schema if not exists auth;

do $$
begin
  if to_regclass('auth.users') is null then
    execute 'create table auth.users (id uuid primary key)';
    comment on table auth.users is
      'CI-only compatibility stub. Real Supabase environments use Supabase Auth auth.users.';
  end if;
end
$$;
