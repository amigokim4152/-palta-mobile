-- Community DB smoke test for palta-dev or disposable Supabase databases.
-- Runs entirely inside a transaction and leaves no fixture rows behind.

begin;

do $$
declare
  v_space uuid := '11111111-1111-4111-8111-111111111111';
  v_admin uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_guardian uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  v_post uuid := '22222222-2222-4222-8222-222222222222';
  v_rls_count int;
  v_active_count int;
  v_visible_school_items int;
  v_ack_count int;
  v_caught boolean;
begin
  select count(*) into v_rls_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'community_space','community_membership','community_post','community_school_item',
      'community_comment','community_reaction','community_mutation_receipt','community_outbox'
    )
    and c.relrowsecurity;
  if v_rls_count <> 8 then
    raise exception 'COMMUNITY_SMOKE_RLS_EXPECTED_8_GOT_%', v_rls_count;
  end if;

  if has_table_privilege('anon', 'public.community_school_item', 'select') then
    raise exception 'COMMUNITY_SMOKE_ANON_SCHOOL_ITEM_SELECT_SHOULD_BE_REVOKED';
  end if;
  if has_table_privilege('authenticated', 'public.community_school_item', 'select') then
    raise exception 'COMMUNITY_SMOKE_AUTHENTICATED_SCHOOL_ITEM_SELECT_SHOULD_BE_REVOKED';
  end if;
  if not has_table_privilege('service_role', 'public.community_school_item', 'select') then
    raise exception 'COMMUNITY_SMOKE_SERVICE_ROLE_SCHOOL_ITEM_SELECT_REQUIRED';
  end if;

  insert into public.community_space (
    id, name, space_type, visibility, join_policy, created_by_user_id,
    organization_id, academic_period_id, class_group_id
  ) values (
    v_space, 'Palta Golden School', 'organization', 'private', 'approval_required', v_admin,
    'golden-school', '2026', '4b'
  );

  insert into public.community_membership (
    community_space_id, user_id, state, role_key, eligibility,
    requested_at, decided_at, decided_by_user_id, effective_from
  ) values (
    v_space, v_admin, 'active', 'admin', '{"displayLabel":"Administrador Golden"}'::jsonb,
    now(), now(), v_admin, now()
  );

  insert into public.community_membership (
    community_space_id, user_id, state, role_key, eligibility, requested_at
  ) values (
    v_space, v_guardian, 'pending', 'member',
    '{"displayLabel":"Familia Golden","requestedRoleKey":"guardian"}'::jsonb,
    now()
  );

  update public.community_membership
     set state = 'active', role_key = 'guardian', decided_at = now(),
         decided_by_user_id = v_admin, effective_from = now(), updated_at = now()
   where community_space_id = v_space and user_id = v_guardian and state = 'pending';

  select count(*) into v_active_count
  from public.community_membership
  where community_space_id = v_space and state = 'active';
  if v_active_count <> 2 then
    raise exception 'COMMUNITY_SMOKE_ACTIVE_MEMBERS_EXPECTED_2_GOT_%', v_active_count;
  end if;

  insert into public.community_post (
    id, community_space_id, author_user_id, body, audience,
    pinned, announcement, content_state, moderation_state
  ) values (
    v_post, v_space, v_admin, 'Salida pedagógica: autorización y materiales', '{}'::jsonb,
    true, true, 'published', 'visible'
  );

  insert into public.community_school_item (
    community_space_id, post_id, stage, title, detail,
    action_required, sensitive, due_at, created_by_user_id
  ) values
    (v_space, v_post, 'schedule', 'Salida pedagógica', 'Viernes 09:00', false, false, now() + interval '7 days', v_admin),
    (v_space, v_post, 'supplies', 'Preparar materiales', 'Botella de agua y colación', true, false, now() + interval '6 days', v_admin);

  insert into public.community_school_item (
    community_space_id, post_id, stage, title, detail,
    action_required, sensitive, recipient_user_id, due_at, created_by_user_id
  ) values (
    v_space, v_post, 'child_notice', 'Autorización pendiente', 'Firma requerida para el estudiante',
    true, true, v_guardian, now() + interval '3 days', v_admin
  );

  select count(*) into v_visible_school_items
  from public.community_school_item
  where community_space_id = v_space
    and (recipient_user_id is null or recipient_user_id = v_guardian);
  if v_visible_school_items <> 3 then
    raise exception 'COMMUNITY_SMOKE_GUARDIAN_ITEMS_EXPECTED_3_GOT_%', v_visible_school_items;
  end if;

  insert into public.community_reaction (
    community_space_id, actor_user_id, target_type, target_id, reaction_key
  ) values (v_space, v_guardian, 'post', v_post, 'acknowledged');

  select count(*) into v_ack_count
  from public.community_reaction
  where community_space_id = v_space
    and actor_user_id = v_guardian
    and target_type = 'post'
    and target_id = v_post
    and reaction_key = 'acknowledged';
  if v_ack_count <> 1 then
    raise exception 'COMMUNITY_SMOKE_ACK_EXPECTED_1_GOT_%', v_ack_count;
  end if;

  v_caught := false;
  begin
    insert into public.community_school_item (
      community_space_id, post_id, stage, title, detail,
      action_required, sensitive, recipient_user_id, created_by_user_id
    ) values (
      v_space, v_post, 'child_notice', 'Invalid child notice', 'Must fail',
      true, false, null, v_admin
    );
  exception when check_violation then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'COMMUNITY_SMOKE_PUBLIC_CHILD_NOTICE_WAS_NOT_BLOCKED';
  end if;

  v_caught := false;
  begin
    insert into public.community_school_item (
      community_space_id, post_id, stage, title, detail,
      action_required, sensitive, created_by_user_id
    ) values (
      v_space, v_post, 'schedule', 'Duplicate schedule', 'Must fail dedupe',
      false, false, v_admin
    );
  exception when unique_violation then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'COMMUNITY_SMOKE_DUPLICATE_SCHOOL_ITEM_WAS_NOT_BLOCKED';
  end if;
end $$;

rollback;
