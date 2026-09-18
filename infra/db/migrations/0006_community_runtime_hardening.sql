-- PALTA COMMUNITY RUNTIME HARDENING
-- Applied after 0003/0004 once the first palta-dev advisor pass identified
-- foreign-key columns without covering indexes.

create index if not exists community_comment_space_idx
  on public.community_comment(community_space_id);

create index if not exists community_comment_parent_idx
  on public.community_comment(parent_comment_id)
  where parent_comment_id is not null;

create index if not exists community_reaction_space_idx
  on public.community_reaction(community_space_id);

create index if not exists community_school_item_post_idx
  on public.community_school_item(post_id);
