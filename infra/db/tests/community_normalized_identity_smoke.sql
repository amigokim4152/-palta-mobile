-- Community normalized identity + Golden School smoke for palta-dev.
-- This test deliberately rolls back every synthetic auth/account/community fixture.

begin;

insert into auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('00000000-0000-4000-8000-000000000101','authenticated','authenticated','community-admin@example.invalid','',
   '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
  ('00000000-0000-4000-8000-000000000102','authenticated','authenticated','community-guardian@example.invalid','',
   '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());

do $$
begin
  if (select count(*) from public.palta_account where user_id in (
    '00000000-0000-4000-8000-000000000101'::uuid,
    '00000000-0000-4000-8000-000000000102'::uuid
  )) <> 2 then
    raise exception 'PALTA_ACCOUNT_BOOTSTRAP_FAILED';
  end if;
end $$;

insert into public.community_space (
  id,name,space_type,visibility,join_policy,created_by_user_id,
  organization_id,academic_period_id,class_group_id,created_at,updated_at
) values (
  '00000000-0000-4000-8000-000000000201','Golden School','organization','private','approval_required',
  '00000000-0000-4000-8000-000000000101','golden-school','2026','4-basic-a',now(),now()
);

insert into public.community_membership (
  id,community_space_id,user_id,state,role_key,eligibility,
  effective_from,created_at,updated_at
) values (
  '00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000101','active','admin','{}',now(),now(),now()
);

insert into public.community_membership (
  id,community_space_id,user_id,state,role_key,eligibility,
  requested_at,created_at,updated_at
) values (
  '00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000102','pending','member',
  '{"requestedRoleKey":"guardian","displayLabel":"Familia Golden"}',now(),now(),now()
);

update public.community_membership
   set state='active', role_key='guardian', decided_at=now(),
       decided_by_user_id='00000000-0000-4000-8000-000000000101',
       effective_from=now(), updated_at=now()
 where id='00000000-0000-4000-8000-000000000302';

insert into public.community_post (
  id,community_space_id,author_user_id,body,audience,pinned,announcement,
  content_state,moderation_state,created_at,updated_at
) values (
  '00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000101','Traer cuaderno mañana','{}',false,true,
  'published','visible',now(),now()
);

insert into public.community_school_item (
  id,community_space_id,post_id,stage,title,detail,action_required,sensitive,
  recipient_user_id,due_at,created_by_user_id,created_at,updated_at
) values (
  '00000000-0000-4000-8000-000000000501','00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000401','child_notice','Preparar cuaderno',
  'Enviar cuaderno de ciencias mañana',true,true,
  '00000000-0000-4000-8000-000000000102',now()+interval '1 day',
  '00000000-0000-4000-8000-000000000101',now(),now()
);

insert into public.community_reaction (
  id,community_space_id,actor_user_id,target_type,target_id,reaction_key,created_at
) values (
  '00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000102','post','00000000-0000-4000-8000-000000000401',
  'acknowledged',now()
);

do $$
begin
  if not exists (
    select 1 from public.community_membership
     where id='00000000-0000-4000-8000-000000000302'
       and state='active' and role_key='guardian'
       and decided_by_user_id='00000000-0000-4000-8000-000000000101'
  ) then raise exception 'MEMBERSHIP_APPROVAL_FAILED'; end if;

  if not exists (
    select 1 from public.community_school_item
     where id='00000000-0000-4000-8000-000000000501'
       and recipient_user_id='00000000-0000-4000-8000-000000000102'
       and sensitive is true
  ) then raise exception 'PRIVATE_CHILD_NOTICE_FAILED'; end if;

  if not exists (
    select 1 from public.community_reaction
     where actor_user_id='00000000-0000-4000-8000-000000000102'
       and reaction_key='acknowledged'
  ) then raise exception 'ACKNOWLEDGEMENT_FAILED'; end if;
end $$;

rollback;
