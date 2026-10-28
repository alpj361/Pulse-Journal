-- Task 3.4.3: owner-scoped hybrid retrieval, traceable graph expansion,
-- and editorial review functions for Space discoveries.

create or replace function public.workspace_memory_source_label(
  p_user_id uuid,
  p_source_type text,
  p_source_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_label text;
begin
  case p_source_type
    when 'space' then
      select s.name into v_label
      from public.spaces s
      where s.id = p_source_id and s.user_id = p_user_id;
    when 'space_section' then
      select ss.title into v_label
      from public.space_sections ss
      where ss.id = p_source_id and ss.user_id = p_user_id;
    when 'codex_item' then
      select cui.name into v_label
      from public.codex_universe_items cui
      where cui.id = p_source_id and cui.user_id = p_user_id;
    when 'codex_auxiliary' then
      select ci.titulo into v_label
      from public.codex_items ci
      where ci.id = p_source_id and ci.user_id = p_user_id;
    when 'dataset' then
      select d.name into v_label
      from public.datasets d
      where d.id = p_source_id and d.user_id = p_user_id and d.deleted_at is null;
    when 'dataset_row' then
      select concat(d.name, ' · fila ', dr.position + 1) into v_label
      from public.dataset_rows dr
      join public.datasets d on d.id = dr.dataset_id
      where dr.id = p_source_id
        and d.user_id = p_user_id
        and dr.deleted_at is null
        and d.deleted_at is null;
    when 'simulation' then
      select cs.title into v_label
      from public.codex_simulations cs
      where cs.id = p_source_id and cs.user_id = p_user_id;
    when 'project_decision' then
      select pd.title into v_label
      from public.project_decisions pd
      join public.projects p on p.id = pd.project_id
      where pd.id = p_source_id and p.user_id = p_user_id;
    when 'project_memory' then
      select coalesce(nullif(pm.title, ''), 'Memoria de proyecto') into v_label
      from public.project_memory pm
      join public.projects p on p.id = pm.project_id
      where pm.id = p_source_id and p.user_id = p_user_id;
    when 'group' then
      select sg.name into v_label
      from public.space_groups sg
      where sg.id = p_source_id and sg.user_id = p_user_id;
    else
      v_label := null;
  end case;

  return coalesce(nullif(btrim(v_label), ''), 'Elemento sin título');
end;
$$;

create or replace function public.workspace_hybrid_search(
  p_user_id uuid,
  p_query text,
  p_query_embedding text default null,
  p_project_id uuid default null,
  p_space_id uuid default null,
  p_limit integer default 12
)
returns table (
  source_type text,
  source_id uuid,
  source_label text,
  chunk_id uuid,
  chunk_index integer,
  content text,
  semantic_similarity double precision,
  lexical_rank real,
  hybrid_score double precision,
  space_ids uuid[]
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with scope_spaces as (
    select s.id
    from public.spaces s
    where s.user_id = p_user_id
      and (p_space_id is null or s.id = p_space_id)
      and (p_project_id is null or s.project_id = p_project_id)
  ), eligible_sources as (
    select ss.id as space_id, 'space'::text as source_type, ss.id as source_id
    from scope_spaces ss

    union

    select ss.space_id, 'space_section', ss.id
    from public.space_sections ss
    join scope_spaces scope on scope.id = ss.space_id
    where ss.user_id = p_user_id

    union

    select wr.space_id, wr.resource_type, wr.resource_id
    from public.workspace_resources wr
    join scope_spaces scope on scope.id = wr.space_id
    where wr.user_id = p_user_id
      and wr.resource_type in ('codex_item', 'codex_auxiliary', 'dataset', 'simulation')

    union

    select wr.space_id, 'dataset_row', dr.id
    from public.workspace_resources wr
    join scope_spaces scope on scope.id = wr.space_id
    join public.datasets d
      on wr.resource_type = 'dataset'
     and wr.resource_id = d.id
     and d.user_id = p_user_id
     and d.deleted_at is null
    join public.dataset_rows dr
      on dr.dataset_id = d.id
     and dr.deleted_at is null
    where wr.user_id = p_user_id

    union

    select null::uuid, wr.resource_type, wr.resource_id
    from public.workspace_resources wr
    where p_project_id is not null
      and wr.project_id = p_project_id
      and wr.space_id is null
      and wr.user_id = p_user_id
      and wr.resource_type in ('codex_item', 'codex_auxiliary', 'dataset', 'simulation')

    union

    select null::uuid, 'project_decision', pd.id
    from public.project_decisions pd
    join public.projects p on p.id = pd.project_id
    where p_project_id is not null
      and pd.project_id = p_project_id
      and p.user_id = p_user_id

    union

    select null::uuid, 'project_memory', pm.id
    from public.project_memory pm
    join public.projects p on p.id = pm.project_id
    where p_project_id is not null
      and pm.project_id = p_project_id
      and p.user_id = p_user_id
  ), eligible_chunks as (
    select
      c.id,
      c.source_type,
      c.source_id,
      c.chunk_index,
      c.content,
      c.embedding,
      array_remove(array_agg(distinct es.space_id), null) as space_ids
    from public.workspace_memory_chunks c
    join eligible_sources es
      on es.source_type = c.source_type
     and es.source_id = c.source_id
    where c.user_id = p_user_id
    group by c.id
  ), query_input as (
    select
      case
        when nullif(btrim(p_query_embedding), '') is null then null::vector(3072)
        else p_query_embedding::vector(3072)
      end as embedding,
      websearch_to_tsquery('spanish', coalesce(p_query, '')) as text_query
  ), semantic_candidates as (
    select
      ec.id,
      row_number() over (
        order by (ec.embedding::halfvec(3072)) <=> (qi.embedding::halfvec(3072))
      ) as semantic_position,
      1 - ((ec.embedding::halfvec(3072)) <=> (qi.embedding::halfvec(3072))) as semantic_similarity
    from eligible_chunks ec
    cross join query_input qi
    where qi.embedding is not null
      and ec.embedding is not null
      and 1 - ((ec.embedding::halfvec(3072)) <=> (qi.embedding::halfvec(3072))) >= 0.35
    order by (ec.embedding::halfvec(3072)) <=> (qi.embedding::halfvec(3072))
    limit least(greatest(p_limit, 1) * 8, 240)
  ), lexical_candidates as (
    select
      ec.id,
      row_number() over (
        order by ts_rank_cd(to_tsvector('spanish', ec.content), qi.text_query) desc
      ) as lexical_position,
      ts_rank_cd(to_tsvector('spanish', ec.content), qi.text_query) as lexical_rank
    from eligible_chunks ec
    cross join query_input qi
    where qi.text_query <> ''::tsquery
      and to_tsvector('spanish', ec.content) @@ qi.text_query
    order by lexical_rank desc
    limit least(greatest(p_limit, 1) * 8, 240)
  ), fused as (
    select
      coalesce(sc.id, lc.id) as id,
      sc.semantic_similarity,
      lc.lexical_rank,
      coalesce(1.0 / (60 + sc.semantic_position), 0) +
        coalesce(1.0 / (60 + lc.lexical_position), 0) as hybrid_score
    from semantic_candidates sc
    full join lexical_candidates lc on lc.id = sc.id
  )
  select
    ec.source_type,
    ec.source_id,
    public.workspace_memory_source_label(p_user_id, ec.source_type, ec.source_id),
    ec.id,
    ec.chunk_index,
    ec.content,
    f.semantic_similarity,
    f.lexical_rank,
    f.hybrid_score,
    ec.space_ids
  from fused f
  join eligible_chunks ec on ec.id = f.id
  order by f.hybrid_score desc, f.semantic_similarity desc nulls last, f.lexical_rank desc nulls last
  limit least(greatest(p_limit, 1), 50);
$$;

create or replace function public.workspace_get_graph_connections(
  p_user_id uuid,
  p_space_id uuid,
  p_source_type text default null,
  p_source_id uuid default null,
  p_include_suggested boolean default true,
  p_limit integer default 30
)
returns table (
  edge_id uuid,
  relation_type text,
  origin text,
  status text,
  confidence double precision,
  source_type text,
  source_id uuid,
  source_label text,
  target_type text,
  target_id uuid,
  target_label text,
  evidence jsonb
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    e.id,
    e.relation_type,
    e.origin,
    e.status,
    e.confidence,
    e.source_type,
    e.source_id,
    public.workspace_memory_source_label(p_user_id, e.source_type, e.source_id),
    e.target_type,
    e.target_id,
    public.workspace_memory_source_label(p_user_id, e.target_type, e.target_id),
    e.evidence
  from public.workspace_graph_edges e
  join public.spaces s
    on s.id = e.space_id
   and s.user_id = e.user_id
  where e.user_id = p_user_id
    and e.space_id = p_space_id
    and (
      e.status = 'confirmed'
      or (p_include_suggested and e.status = 'suggested')
    )
    and (
      p_source_type is null
      or p_source_id is null
      or (e.source_type = p_source_type and e.source_id = p_source_id)
      or (e.target_type = p_source_type and e.target_id = p_source_id)
    )
  order by
    case e.status when 'confirmed' then 0 else 1 end,
    e.confidence desc,
    e.updated_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

create or replace function public.workspace_review_group(
  p_user_id uuid,
  p_group_id uuid,
  p_status text default null,
  p_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_group public.space_groups%rowtype;
  v_status text;
begin
  if p_status is null and nullif(btrim(p_name), '') is null then
    raise exception using errcode = '22023', message = 'WORKSPACE_REVIEW_REQUIRES_CHANGE';
  end if;
  if p_status is not null and p_status not in ('confirmed', 'rejected', 'archived') then
    raise exception using errcode = '22023', message = 'WORKSPACE_REVIEW_STATUS_INVALID';
  end if;

  select * into v_group
  from public.space_groups g
  where g.id = p_group_id and g.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'WORKSPACE_GROUP_NOT_FOUND';
  end if;

  v_status := coalesce(p_status, v_group.status);
  update public.space_groups g
  set name = coalesce(nullif(btrim(p_name), ''), g.name),
      status = v_status,
      metadata = g.metadata || jsonb_build_object(
        'editorially_reviewed', true,
        'editorially_reviewed_at', now()
      )
  where g.id = v_group.id
  returning * into v_group;

  if p_status is not null then
    update public.workspace_graph_edges e
    set status = v_status,
        reviewed_at = now()
    where e.user_id = p_user_id
      and e.space_id = v_group.space_id
      and e.target_type = 'group'
      and e.target_id = v_group.id
      and e.relation_type = 'member_of'
      and e.status in ('suggested', 'confirmed');
  end if;

  return jsonb_build_object(
    'id', v_group.id,
    'space_id', v_group.space_id,
    'name', v_group.name,
    'status', v_group.status,
    'origin', v_group.origin,
    'revision', v_group.revision
  );
end;
$$;

create or replace function public.workspace_review_graph_edge(
  p_user_id uuid,
  p_edge_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_edge public.workspace_graph_edges%rowtype;
begin
  if p_status not in ('confirmed', 'rejected', 'archived') then
    raise exception using errcode = '22023', message = 'WORKSPACE_REVIEW_STATUS_INVALID';
  end if;

  update public.workspace_graph_edges e
  set status = p_status,
      reviewed_at = now(),
      metadata = e.metadata || jsonb_build_object('editorially_reviewed', true)
  where e.id = p_edge_id and e.user_id = p_user_id
  returning * into v_edge;

  if not found then
    raise exception using errcode = 'P0002', message = 'WORKSPACE_EDGE_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'id', v_edge.id,
    'space_id', v_edge.space_id,
    'relation_type', v_edge.relation_type,
    'status', v_edge.status,
    'origin', v_edge.origin,
    'confidence', v_edge.confidence,
    'source', jsonb_build_object(
      'type', v_edge.source_type,
      'id', v_edge.source_id,
      'label', public.workspace_memory_source_label(p_user_id, v_edge.source_type, v_edge.source_id)
    ),
    'target', jsonb_build_object(
      'type', v_edge.target_type,
      'id', v_edge.target_id,
      'label', public.workspace_memory_source_label(p_user_id, v_edge.target_type, v_edge.target_id)
    )
  );
end;
$$;

revoke all on function public.workspace_memory_source_label(uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.workspace_hybrid_search(uuid, text, text, uuid, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.workspace_get_graph_connections(uuid, uuid, text, uuid, boolean, integer)
  from public, anon, authenticated;
revoke all on function public.workspace_review_group(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.workspace_review_graph_edge(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.workspace_memory_source_label(uuid, text, uuid)
  to service_role;
grant execute on function public.workspace_hybrid_search(uuid, text, text, uuid, uuid, integer)
  to service_role;
grant execute on function public.workspace_get_graph_connections(uuid, uuid, text, uuid, boolean, integer)
  to service_role;
grant execute on function public.workspace_review_group(uuid, uuid, text, text)
  to service_role;
grant execute on function public.workspace_review_graph_edge(uuid, uuid, text)
  to service_role;

comment on function public.workspace_hybrid_search(uuid, text, text, uuid, uuid, integer) is
  'Service-only hybrid retrieval over owner-scoped Space memory. Uses reciprocal rank fusion and returns traceable source chunks.';
comment on function public.workspace_get_graph_connections(uuid, uuid, text, uuid, boolean, integer) is
  'Returns confirmed and optionally suggested Space connections with readable endpoint labels.';
comment on function public.workspace_review_group(uuid, uuid, text, text) is
  'Applies an explicit editorial decision to a suggested grouping; it does not create a canonical Codex relation.';
comment on function public.workspace_review_graph_edge(uuid, uuid, text) is
  'Applies an explicit editorial decision to a Space graph edge; it does not modify codex_relations.';
