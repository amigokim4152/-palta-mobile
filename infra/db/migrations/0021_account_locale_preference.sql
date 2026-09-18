alter table public.palta_account
  add column if not exists preferred_locale_explicit boolean not null default false;

comment on column public.palta_account.preferred_locale_explicit is
  'False means preferred_locale is only the account default and device locale may be used. True means the user explicitly selected a Palta language and that choice wins across devices.';
