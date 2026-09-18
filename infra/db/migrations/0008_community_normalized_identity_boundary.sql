-- PALTA COMMUNITY NORMALIZED IDENTITY BOUNDARY
-- STATUS: READY FOR palta-dev
-- Normalized v1 canonical identity: public.palta_account.user_id = auth.users.id.
-- The legacy palta_private.identities preflight is not part of the palta-dev runtime path.

-- Community history is retained against a soft-closed Palta account. Hard account
-- deletion must therefore pass through a future retention/anonymization workflow
-- rather than silently cascading Community authorship or membership history.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'community_space_created_by_user_fk') then
    alter table public.community_space
      add constraint community_space_created_by_user_fk
      foreign key (created_by_user_id) references public.palta_account(user_id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'community_membership_user_fk') then
    alter table public.community_membership
      add constraint community_membership_user_fk
      foreign key (user_id) references public.palta_account(user_id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'community_membership_decided_by_user_fk') then
    alter table public.community_membership
      add constraint community_membership_decided_by_user_fk
      foreign key (decided_by_user_id) references public.palta_account(user_id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'community_post_author_user_fk') then
    alter table public.community_post
      add constraint community_post_author_user_fk
      foreign key (author_user_id) references public.palta_account(user_id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'community_school_item_recipient_user_fk') then
    alter table public.community_school_item
      add constraint community_school_item_recipient_user_fk
      foreign key (recipient_user_id) references public.palta_account(user_id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'community_school_item_created_by_user_fk') then
    alter table public.community_school_item
      add constraint community_school_item_created_by_user_fk
      foreign key (created_by_user_id) references public.palta_account(user_id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'community_comment_author_user_fk') then
    alter table public.community_comment
      add constraint community_comment_author_user_fk
      foreign key (author_user_id) references public.palta_account(user_id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'community_reaction_actor_user_fk') then
    alter table public.community_reaction
      add constraint community_reaction_actor_user_fk
      foreign key (actor_user_id) references public.palta_account(user_id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'community_mutation_receipt_user_fk') then
    alter table public.community_mutation_receipt
      add constraint community_mutation_receipt_user_fk
      foreign key (user_id) references public.palta_account(user_id) on delete restrict;
  end if;
end $$;

-- Cover user-reference foreign keys that are not already leading columns of an
-- existing primary/unique/index path. These support account retention checks and
-- prevent avoidable sequential scans during relationship maintenance.
create index if not exists community_space_created_by_user_idx
  on public.community_space(created_by_user_id);
create index if not exists community_membership_decided_by_user_idx
  on public.community_membership(decided_by_user_id)
  where decided_by_user_id is not null;
create index if not exists community_post_author_user_idx
  on public.community_post(author_user_id);
create index if not exists community_school_item_recipient_user_idx
  on public.community_school_item(recipient_user_id)
  where recipient_user_id is not null;
create index if not exists community_school_item_created_by_user_idx
  on public.community_school_item(created_by_user_id);
create index if not exists community_comment_author_user_idx
  on public.community_comment(author_user_id);

comment on constraint community_membership_user_fk on public.community_membership is
  'Normalized v1 Community identity: membership user is a canonical public.palta_account user_id.';
comment on constraint community_school_item_recipient_user_fk on public.community_school_item is
  'Recipient-scoped school content may reference only a canonical Palta account.';
