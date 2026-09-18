-- Palta Knowledge Platform v1 PRE-FLIGHT ONLY.
-- Review artifact: do not apply until development Postgres project and RLS are deliberately approved.
-- Canonical public knowledge tables below MUST NOT contain user/person/household private context.

create table if not exists knowledge_domain_registry (
  domain text primary key,
  maturity text not null check (maturity in ('seed','growing','mature','standalone')),
  public_surface text,
  updated_at timestamptz not null
);

create table if not exists knowledge_entities (
  id text primary key,
  domain text not null references knowledge_domain_registry(domain),
  kind text not null,
  current_version integer not null check (current_version > 0),
  title text not null,
  summary text,
  risk_tier text not null check (risk_tier in ('low','moderate','high','critical')),
  publication_state text not null check (publication_state in ('draft','in_review','validated','published','withdrawn')),
  country_scopes text[] not null default '{}',
  tags text[] not null default '{}',
  updated_at timestamptz not null
);

create table if not exists knowledge_revisions (
  id text primary key,
  entity_id text not null references knowledge_entities(id),
  base_version integer not null,
  revision_type text not null,
  actor_type text not null check (actor_type in ('human','ai','system')),
  actor_ref text not null,
  patch jsonb not null,
  state text not null,
  created_at timestamptz not null
);

create table if not exists knowledge_evidence (
  id text primary key,
  source_url text not null,
  publisher text,
  title text,
  checked_at timestamptz not null,
  valid_until timestamptz,
  verification text not null,
  license text,
  reuse_allowed boolean
);

create table if not exists knowledge_entity_evidence (
  entity_id text not null references knowledge_entities(id),
  evidence_id text not null references knowledge_evidence(id),
  primary key (entity_id, evidence_id)
);

create table if not exists knowledge_relations (
  source_id text not null references knowledge_entities(id),
  relation_type text not null,
  target_id text not null references knowledge_entities(id),
  note text,
  primary key (source_id, relation_type, target_id)
);

create table if not exists curriculum_frameworks (
  id text primary key,
  country text not null,
  level_range text not null,
  title text not null,
  status text not null,
  legal_refs text[] not null default '{}',
  valid_as_of date not null,
  source_refs jsonb not null default '[]'::jsonb
);

create table if not exists curriculum_objective_refs (
  id text primary key,
  country text not null,
  grade text not null,
  subject_id text not null,
  official_code text not null,
  framework_id text not null references curriculum_frameworks(id),
  source_url text not null,
  source_checked_at date not null,
  concept_refs text[] not null default '{}'
);

comment on table knowledge_entities is 'Canonical shared knowledge only. Private personalized projections belong in separate private storage.';
comment on table curriculum_objective_refs is 'Stores objective identity and source linkage; full official copyrighted text is not required for the registry.';
