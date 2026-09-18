do $$
begin
  if to_regclass('public.palta_account') is not null then
    execute 'alter table public.palta_account add column if not exists preferred_locale_explicit boolean not null default false';
    execute $comment$
      comment on column public.palta_account.preferred_locale_explicit is
      'False means preferred_locale is only the account default and device locale may be used. True means the user explicitly selected a Palta language and that choice wins across devices.'
    $comment$;
  else
    raise notice 'palta_account is unavailable; skipping locale preference column in this environment';
  end if;
end $$;
