-- Task 3.4.1: private semantic-memory and graph contract for Spaces.
-- This migration defines storage and access boundaries only. Indexing and
-- GraphRAG retrieval are implemented in tasks 3.4.2 and 3.4.3.

create table public.workspace_memory_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (
    source_type in (
      'space',
      'space_section',
      'codex_item',
      'codex_auxiliary',
      'dataset',
      'simulation',
      'project_decision',
      'project_memory'
    )
  ),
  source_id uuid not null,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (length(btrim(content)) > 0),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  embedding vector(3072),
  embedding_model text,
  token_count integer check (token_count is null or token_count >= 0),
  language text not null default 'es' check (
    language ~ '^[a-z]{2,3}(-[A-Za-z]{2,8})?$'
  ),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_type, source_id, chunk_index),
  check (embedding is null or length(btrim(embedding_model)) > 0)
);

comment on table public.workspace_memory_chunks is
  'Private, owner-scoped semantic fragments for Spaces and Projects. Separate from the global embeddings_index.';
comment on column public.workspace_memory_chunks.source_type is
  'Canonical source category. A source may produce multiple ordered chunks.';
comment on column public.workspace_memory_chunks.content_hash is
  'Lowercase SHA-256 of the normalized chunk content, used for idempotent reindexing.';

create index workspace_memory_chunks_source_idx
  on public.workspace_memory_chunks (user_id, source_type, source_id);

create index workspace_memory_chunks_updated_idx
  on public.workspace_memory_chunks (user_id, updated_at desc);

create index workspace_memory_chunks_fts_es_idx
  on public.workspace_memory_chunks
  using gin (to_tsvector('spanish', content));

create index workspace_memory_chunks_embedding_hnsw_idx
  on public.workspace_memory_chunks
  using hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops)
  with (m = 16, ef_construction = 64)
  where embedding is not null;

create table public.space_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null,
  name text not null check (length(btrim(name)) > 0),
  description text,
  origin text not null default 'user' check (
    origin in ('user', 'agent', 'semantic', 'system')
  ),
  status text not null default 'confirmed' check (
    status in ('suggested', 'confirmed', 'rejected', 'archived')
  ),
  position integer not null default 0 check (position >= 0),
  representative_terms text[] not null default array[]::text[],
  centroid_embedding vector(3072),
  embedding_model text,
  revision bigint not null default 1 check (revision > 0),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (space_id, user_id)
    references public.spaces(id, user_id)
    on delete cascade,
  check (centroid_embedding is null or length(btrim(embedding_model)) > 0)
);

comment on table public.space_groups is
  'Visible groupings inside a Space. Semantic concepts may suggest groups but do not silently reorganize content.';
comment on column public.space_groups.status is
  'Suggested groups require explicit acceptance before they become confirmed user structure.';

create index space_groups_space_status_idx
  on public.space_groups (user_id, space_id, status, position, created_at);

create index space_groups_name_idx
  on public.space_groups (user_id, space_id, lower(name));

create table public.workspace_graph_edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null,
  source_type text not null check (
    source_type in (
      'space',
      'group',
      'space_section',
      'codex_item',
      'codex_auxiliary',
      'dataset',
      'folder',
      'simulation'
    )
  ),
  source_id uuid not null,
  target_type text not null check (
    target_type in (
      'space',
      'group',
      'space_section',
      'codex_item',
      'codex_auxiliary',
      'dataset',
      'folder',
      'simulation'
    )
  ),
  target_id uuid not null,
  relation_type text not null check (
    relation_type in (
      'member_of',
      'related_to',
      'mentions',
      'references',
      'supports',
      'contradicts',
      'precedes',
      'derived_from'
    )
  ),
  origin text not null default 'user' check (
    origin in ('user', 'agent', 'semantic', 'codex_relation', 'canvas', 'system')
  ),
  status text not null default 'suggested' check (
    status in ('suggested', 'confirmed', 'rejected', 'archived')
  ),
  confidence double precision not null default 0.5 check (
    confidence >= 0 and confidence <= 1
  ),
  weight double precision not null default 1 check (
    weight >= 0 and weight <= 1
  ),
  is_directed boolean not null default true,
  evidence jsonb not null default '[]'::jsonb check (
    jsonb_typeof(evidence) = 'array'
  ),
  model_version text,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (space_id, user_id)
    references public.spaces(id, user_id)
    on delete cascade,
  unique (
    user_id,
    space_id,
    source_type,
    source_id,
    target_type,
    target_id,
    relation_type
  ),
  check (not (source_type = target_type and source_id = target_id)),
  check (relation_type <> 'member_of' or target_type = 'group')
);

comment on table public.workspace_graph_edges is
  'Owner-scoped graph associations inside a Space. Semantic associations remain suggested until accepted.';
comment on column public.workspace_graph_edges.evidence is
  'Source references and excerpts supporting an inferred association; not a substitute for canonical Codex relations.';

create index workspace_graph_edges_source_idx
  on public.workspace_graph_edges
  (user_id, space_id, source_type, source_id, status);

create index workspace_graph_edges_target_idx
  on public.workspace_graph_edges
  (user_id, space_id, target_type, target_id, status);

create index workspace_graph_edges_relation_idx
  on public.workspace_graph_edges
  (user_id, space_id, relation_type, status, confidence desc);

create or replace function public.validate_workspace_memory_chunk()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  source_is_owned boolean := false;
begin
  case new.source_type
    when 'space' then
      select exists (
        select 1 from public.spaces s
        where s.id = new.source_id and s.user_id = new.user_id
      ) into source_is_owned;
    when 'space_section' then
      select exists (
        select 1 from public.space_sections ss
        where ss.id = new.source_id and ss.user_id = new.user_id
      ) into source_is_owned;
    when 'codex_item' then
      select exists (
        select 1 from public.codex_universe_items cui
        where cui.id = new.source_id and cui.user_id = new.user_id
      ) into source_is_owned;
    when 'codex_auxiliary' then
      select exists (
        select 1 from public.codex_items ci
        where ci.id = new.source_id and ci.user_id = new.user_id
      ) into source_is_owned;
    when 'dataset' then
      select exists (
        select 1 from public.datasets d
        where d.id = new.source_id
          and d.user_id = new.user_id
          and d.deleted_at is null
      ) into source_is_owned;
    when 'simulation' then
      select exists (
        select 1 from public.codex_simulations cs
        where cs.id = new.source_id and cs.user_id = new.user_id
      ) into source_is_owned;
    when 'project_decision' then
      select exists (
        select 1
        from public.project_decisions pd
        join public.projects p on p.id = pd.project_id
        where pd.id = new.source_id and p.user_id = new.user_id
      ) into source_is_owned;
    when 'project_memory' then
      select exists (
        select 1
        from public.project_memory pm
        join public.projects p on p.id = pm.project_id
        where pm.id = new.source_id and p.user_id = new.user_id
      ) into source_is_owned;
    else
      source_is_owned := false;
  end case;

  if not source_is_owned then
    raise exception using
      errcode = '23503',
      message = 'WORKSPACE_MEMORY_SOURCE_NOT_FOUND_OR_NOT_OWNED';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.touch_space_group()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  new.updated_at := now();
  new.revision := old.revision + 1;
  return new;
end;
$$;

create or replace function public.workspace_graph_endpoint_exists(
  p_user_id uuid,
  p_space_id uuid,
  p_endpoint_type text,
  p_endpoint_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  case p_endpoint_type
    when 'space' then
      return p_endpoint_id = p_space_id and exists (
        select 1 from public.spaces s
        where s.id = p_space_id and s.user_id = p_user_id
      );
    when 'group' then
      return exists (
        select 1 from public.space_groups sg
        where sg.id = p_endpoint_id
          and sg.space_id = p_space_id
          and sg.user_id = p_user_id
      );
    when 'space_section' then
      return exists (
        select 1 from public.space_sections ss
        where ss.id = p_endpoint_id
          and ss.space_id = p_space_id
          and ss.user_id = p_user_id
      );
    when 'codex_item', 'codex_auxiliary', 'dataset', 'folder', 'simulation' then
      return exists (
        select 1 from public.workspace_resources wr
        where wr.user_id = p_user_id
          and wr.space_id = p_space_id
          and wr.resource_type = p_endpoint_type
          and wr.resource_id = p_endpoint_id
      );
    else
      return false;
  end case;
end;
$$;

create or replace function public.validate_workspace_graph_edge()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.workspace_graph_endpoint_exists(
    new.user_id,
    new.space_id,
    new.source_type,
    new.source_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'WORKSPACE_GRAPH_SOURCE_NOT_FOUND_IN_SPACE';
  end if;

  if not public.workspace_graph_endpoint_exists(
    new.user_id,
    new.space_id,
    new.target_type,
    new.target_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'WORKSPACE_GRAPH_TARGET_NOT_FOUND_IN_SPACE';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger validate_workspace_memory_chunk_trigger
before insert or update of user_id, source_type, source_id, content, embedding
on public.workspace_memory_chunks
for each row execute function public.validate_workspace_memory_chunk();

create trigger touch_space_group_trigger
before update on public.space_groups
for each row execute function public.touch_space_group();

create trigger validate_workspace_graph_edge_trigger
before insert or update of user_id, space_id, source_type, source_id, target_type, target_id
on public.workspace_graph_edges
for each row execute function public.validate_workspace_graph_edge();

alter table public.workspace_memory_chunks enable row level security;
alter table public.space_groups enable row level security;
alter table public.workspace_graph_edges enable row level security;

create policy space_groups_select_own
on public.space_groups
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy workspace_graph_edges_select_own
on public.workspace_graph_edges
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.workspace_memory_chunks from public, anon, authenticated;
revoke all on table public.space_groups from public, anon, authenticated;
revoke all on table public.workspace_graph_edges from public, anon, authenticated;

grant select on table public.space_groups to authenticated;
grant select on table public.workspace_graph_edges to authenticated;

grant all on table public.workspace_memory_chunks to service_role;
grant all on table public.space_groups to service_role;
grant all on table public.workspace_graph_edges to service_role;

revoke all on function public.validate_workspace_memory_chunk() from public, anon, authenticated;
revoke all on function public.touch_space_group() from public, anon, authenticated;
revoke all on function public.workspace_graph_endpoint_exists(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.validate_workspace_graph_edge() from public, anon, authenticated;

grant execute on function public.validate_workspace_memory_chunk() to service_role;
grant execute on function public.touch_space_group() to service_role;
grant execute on function public.workspace_graph_endpoint_exists(uuid, uuid, text, uuid) to service_role;
grant execute on function public.validate_workspace_graph_edge() to service_role;
