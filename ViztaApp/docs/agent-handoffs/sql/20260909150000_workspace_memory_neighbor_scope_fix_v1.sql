-- The Space is the graph container, not a semantic member of one of its own
-- groups. Keep its chunks searchable, but exclude them from grouping neighbors.

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
    select 'space_section'::text as source_type, ss.id as source_id
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

revoke all on function public.workspace_find_semantic_neighbors(uuid, uuid, text, uuid, integer, double precision)
  from public, anon, authenticated;

grant execute on function public.workspace_find_semantic_neighbors(uuid, uuid, text, uuid, integer, double precision)
  to service_role;
