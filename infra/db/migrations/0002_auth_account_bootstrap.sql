-- Gate 01 canonical account bootstrap.
-- Mobile clients remain unable to INSERT public.palta_account.
-- Supabase owns auth.users; generic PostgreSQL preflight environments may not.

create schema if not exists palta_private;

create or replace function palta_private.bootstrap_palta_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.palta_account (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function palta_private.bootstrap_palta_account() from public;
revoke all on function palta_private.bootstrap_palta_account() from anon;
revoke all on function palta_private.bootstrap_palta_account() from authenticated;

do $bootstrap$
begin
  if to_regclass('auth.users') is not null then
    execute 'drop trigger if exists palta_account_bootstrap on auth.users';
    execute 'create trigger palta_account_bootstrap after insert on auth.users for each row execute function palta_private.bootstrap_palta_account()';
    execute $sql$
      insert into public.palta_account (user_id)
      select id
      from auth.users
      on conflict (user_id) do nothing
    $sql$;
  else
    raise notice 'auth.users is unavailable; skipping Supabase auth account trigger/backfill in this environment';
  end if;
end
$bootstrap$;

comment on function palta_private.bootstrap_palta_account() is
  'Canonical Palta account bootstrap. Runs after auth.users insert when Supabase Auth is present; mobile clients do not receive INSERT privilege on public.palta_account.';
