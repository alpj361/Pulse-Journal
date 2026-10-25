-- Task 3.4.2: indexing optimizations and service-only semantic neighbors.

create or replace function public.workspace_replace_memory_chunks(
  p_user_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_chunks jsonb,
  p_embedding_model text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_count integer;
begin
  if jsonb_typeof(p_chunks) <> 'array' then
    raise exception using errcode = '22023', message = 'WORKSPACE_MEMORY_CHUNKS_MUST_BE_ARRAY';
  end if;

  delete from public.workspace_memory_chunks c
  where c.user_id = p_user_id
    and c.source_type = p_source_type
    and c.source_id = p_source_id
    and not exists (
      select 1
      from jsonb_array_elements(p_chunks) item
      where (item->>'chunk_index')::integer = c.chunk_index
    );

  insert into public.workspace_memory_chunks (
    user_id, source_type, source_id, chunk_index, content, content_hash,
    embedding, embedding_model, token_count, language, metadata
  )
  select
    p_user_id,
    p_source_type,
    p_source_id,
    (item->>'chunk_index')::integer,
    item->>'content',
    item->>'content_hash',
    case
      when item ? 'embedding' and jsonb_typeof(item->'embedding') = 'array'
        then (item->'embedding')::text::vector(3072)
      else null
    end,
    case
      when item ? 'embedding' and jsonb_typeof(item->'embedding') = 'array'
        then p_embedding_model
      else null
    end,
    nullif(item->>'token_count', '')::integer,
    coalesce(nullif(item->>'language', ''), 'es'),
    coalesce(item->'metadata', '{}'::jsonb)
  from jsonb_array_elements(p_chunks) item
  on conflict (user_id, source_type, source_id, chunk_index) do update
  set content = excluded.content,
      content_hash = excluded.content_hash,
      embedding = case
        when public.workspace_memory_chunks.content_hash = excluded.content_hash
          and excluded.embedding is null
          then public.workspace_memory_chunks.embedding
        else excluded.embedding
      end,
      embedding_model = case
        when public.workspace_memory_chunks.content_hash = excluded.content_hash
          and excluded.embedding is null
          then public.workspace_memory_chunks.embedding_model
        else excluded.embedding_model
      end,
      token_count = excluded.token_count,
      language = excluded.language,
      metadata = excluded.metadata,
      updated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.workspace_find_semantic_neighbors(
  p_user_id uuid,
  p_space_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_limit integer default 8,
  p_min_similarity double precision default 0.78
)
returns table (
  source_type text,
  source_id uuid,
  chunk_id uuid,
  similarity double precision,
  excerpt text
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with eligible_sources as (
    select 'space'::text as source_type, s.id as source_id
    from public.spaces s
    where s.id = p_space_id and s.user_id = p_user_id

    union

    select 'space_section', ss.id
    from public.space_sections ss
    where ss.space_id = p_space_id and ss.user_id = p_user_id

    union

    select wr.resource_type, wr.resource_id
    from public.workspace_resources wr
    where wr.space_id = p_space_id
      and wr.user_id = p_user_id
      and wr.resource_type in ('codex_item', 'codex_auxiliary', 'dataset', 'simulation')

    union

    select 'dataset_row', dr.id
    from public.workspace_resources wr
    join public.datasets d
      on wr.resource_type = 'dataset'
     and wr.resource_id = d.id
     and d.user_id = wr.user_id
     and d.deleted_at is null
    join public.dataset_rows dr
      on dr.dataset_id = d.id
     and dr.deleted_at is null
    where wr.space_id = p_space_id and wr.user_id = p_user_id
  ), query_vector as (
    select avg(c.embedding)::vector(3072) as embedding
    from public.workspace_memory_chunks c
    where c.user_id = p_user_id
      and c.source_type = p_source_type
      and c.source_id = p_source_id
      and c.embedding is not null
  ), nearest_chunks as (
    select
      c.source_type,
      c.source_id,
      c.id as chunk_id,
      1 - ((c.embedding::halfvec(3072)) <=> (q.embedding::halfvec(3072))) as similarity,
      left(c.content, 700) as excerpt
    from public.workspace_memory_chunks c
    join eligible_sources e
      on e.source_type = c.source_type and e.source_id = c.source_id
    cross join query_vector q
    where c.user_id = p_user_id
      and c.embedding is not null
      and q.embedding is not null
      and not (c.source_type = p_source_type and c.source_id = p_source_id)
    order by (c.embedding::halfvec(3072)) <=> (q.embedding::halfvec(3072))
    limit least(greatest(p_limit, 1) * 12, 240)
  ), one_per_source as (
    select distinct on (n.source_type, n.source_id)
      n.source_type,
      n.source_id,
      n.chunk_id,
      n.similarity,
      n.excerpt
    from nearest_chunks n
    order by n.source_type, n.source_id, n.similarity desc
  )
  select o.source_type, o.source_id, o.chunk_id, o.similarity, o.excerpt
  from one_per_source o
  where o.similarity >= least(greatest(p_min_similarity, 0), 1)
  order by o.similarity desc
  limit least(greatest(p_limit, 1), 30);
$$;

create or replace function public.workspace_clear_semantic_source_suggestions(
  p_user_id uuid,
  p_space_id uuid,
  p_source_type text,
  p_source_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_edges integer := 0;
  v_groups integer := 0;
begin
  delete from public.workspace_graph_edges e
  where e.user_id = p_user_id
    and e.space_id = p_space_id
    and e.origin = 'semantic'
    and e.status = 'suggested'
    and (
      (e.source_type = p_source_type and e.source_id = p_source_id)
      or (e.target_type = p_source_type and e.target_id = p_source_id)
    );
  get diagnostics v_edges = row_count;

  delete from public.space_groups g
  where g.user_id = p_user_id
    and g.space_id = p_space_id
    and g.origin = 'semantic'
    and g.status = 'suggested'
    and not exists (
      select 1
      from public.workspace_graph_edges e
      where e.user_id = g.user_id
        and e.space_id = g.space_id
        and e.target_type = 'group'
        and e.target_id = g.id
        and e.relation_type = 'member_of'
        and e.status in ('suggested', 'confirmed')
    );
  get diagnostics v_groups = row_count;

  return jsonb_build_object('edges_deleted', v_edges, 'groups_deleted', v_groups);
end;
$$;

revoke all on function public.workspace_find_semantic_neighbors(uuid, uuid, text, uuid, integer, double precision)
  from public, anon, authenticated;
revoke all on function public.workspace_clear_semantic_source_suggestions(uuid, uuid, text, uuid)
  from public, anon, authenticated;

grant execute on function public.workspace_find_semantic_neighbors(uuid, uuid, text, uuid, integer, double precision)
  to service_role;
grant execute on function public.workspace_clear_semantic_source_suggestions(uuid, uuid, text, uuid)
  to service_role;
