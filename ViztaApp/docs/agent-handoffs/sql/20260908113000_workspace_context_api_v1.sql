-- Task 3.3: service-only context and search API for Projects and Spaces.
-- Applied through Supabase MCP. Copy into ExtractorW/migrations when SSH returns.

create or replace function public.workspace_hydrate_resource(
  p_user_id uuid,
  p_resource_type text,
  p_resource_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select case p_resource_type
    when 'codex_item' then (
      select jsonb_build_object(
        'id', item.id,
        'type', item.tipo,
        'name', item.name,
        'description', left(coalesce(item.description, ''), 4000),
        'aliases', item.aliases,
        'tags', item.tags,
        'thumbnail_url', item.thumbnail_url,
        'is_profile', item.is_profile,
        'field_keys', item.field_keys,
        'preset_keys', item.preset_keys,
        'geo', item.geo,
        'updated_at', item.updated_at
      )
      from public.codex_universe_items item
      where item.id = p_resource_id and item.user_id = p_user_id
    )
    when 'codex_auxiliary' then (
      select jsonb_build_object(
        'id', item.id,
        'type', item.tipo,
        'title', item.titulo,
        'description', left(coalesce(item.descripcion, ''), 4000),
        'tags', item.etiquetas,
        'file_name', item.nombre_archivo,
        'source_url', coalesce(item.source_url, item.url),
        'created_at', item.created_at
      )
      from public.codex_items item
      where item.id = p_resource_id and item.user_id = p_user_id
    )
    when 'dataset' then (
      select jsonb_build_object(
        'id', dataset.id,
        'type', 'dataset',
        'name', dataset.name,
        'description', left(coalesce(dataset.description, ''), 4000),
        'row_count', dataset.row_count,
        'row_codex_type', dataset.row_codex_type,
        'connection_mode', dataset.connection_mode,
        'tags', dataset.tags,
        'updated_at', dataset.updated_at
      )
      from public.datasets dataset
      where dataset.id = p_resource_id
        and dataset.user_id = p_user_id
        and dataset.deleted_at is null
    )
    when 'folder' then (
      select jsonb_build_object(
        'id', folder.id,
        'type', 'folder',
        'name', folder.name,
        'color', folder.color,
        'icon', folder.icon,
        'scope', folder.scope,
        'updated_at', folder.updated_at
      )
      from public.post_folders folder
      where folder.id = p_resource_id and folder.user_id = p_user_id
    )
    when 'simulation' then (
      select jsonb_build_object(
        'id', simulation.id,
        'type', 'simulation',
        'title', simulation.title,
        'scenario', left(coalesce(simulation.scenario, ''), 4000),
        'status', simulation.status,
        'version', simulation.version,
        'analysis', left(coalesce(simulation.analysis, ''), 4000),
        'updated_at', coalesce(simulation.completed_at, simulation.started_at, simulation.created_at)
      )
      from public.codex_simulations simulation
      where simulation.id = p_resource_id and simulation.user_id = p_user_id
    )
    else null
  end;
$$;

create or replace function public.workspace_get_space_context(
  p_user_id uuid,
  p_space_id uuid,
  p_section_id uuid default null,
  p_max_chars integer default 30000
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  result jsonb;
  safe_max_chars integer := greatest(1000, least(coalesce(p_max_chars, 30000), 100000));
begin
  if not exists (
    select 1 from public.spaces
    where id = p_space_id and user_id = p_user_id
  ) then
    raise exception using errcode = 'P0002', message = 'SPACE_NOT_FOUND';
  end if;

  if p_section_id is not null and not exists (
    select 1 from public.space_sections
    where id = p_section_id and space_id = p_space_id and user_id = p_user_id
  ) then
    raise exception using errcode = 'P0002', message = 'SPACE_SECTION_NOT_FOUND';
  end if;

  with recursive section_tree as (
    select
      section.id,
      section.parent_id,
      section.section_kind,
      section.title,
      section.content_format,
      section.content_json,
      section.content_text,
      section.position,
      section.revision,
      section.metadata,
      section.updated_at,
      0 as depth,
      array[lpad(section.position::text, 10, '0') || ':' || section.id::text] as path
    from public.space_sections section
    where section.space_id = p_space_id
      and section.user_id = p_user_id
      and (
        (p_section_id is null and section.parent_id is null)
        or section.id = p_section_id
      )

    union all

    select
      child.id,
      child.parent_id,
      child.section_kind,
      child.title,
      child.content_format,
      child.content_json,
      child.content_text,
      child.position,
      child.revision,
      child.metadata,
      child.updated_at,
      parent.depth + 1,
      parent.path || (lpad(child.position::text, 10, '0') || ':' || child.id::text)
    from public.space_sections child
    join section_tree parent on parent.id = child.parent_id
    where child.space_id = p_space_id and child.user_id = p_user_id
  ), section_budget as (
    select
      section_tree.*,
      coalesce(sum(char_length(content_text)) over (
        order by path rows between unbounded preceding and 1 preceding
      ), 0)::integer as used_before
    from section_tree
  ), section_payload as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', id,
        'parent_id', parent_id,
        'kind', section_kind,
        'title', title,
        'content_format', content_format,
        'content_text', left(content_text, greatest(0, safe_max_chars - used_before)),
        'content_truncated', char_length(content_text) > greatest(0, safe_max_chars - used_before),
        'position', position,
        'depth', depth,
        'revision', revision,
        'metadata', metadata,
        'updated_at', updated_at
      ) order by path
    ) filter (where used_before < safe_max_chars), '[]'::jsonb) as sections,
    count(*) filter (where used_before >= safe_max_chars) as omitted_sections,
    least(coalesce(sum(char_length(content_text)), 0), safe_max_chars) as included_chars
    from section_budget
  ), resource_payload as (
    select
      coalesce(jsonb_agg(
        jsonb_build_object(
          'association_id', resource.id,
          'resource_type', resource.resource_type,
          'role', resource.role,
          'label', resource.label,
          'position', resource.position,
          'resource', public.workspace_hydrate_resource(
            resource.user_id,
            resource.resource_type,
            resource.resource_id
          )
        ) order by resource.position, resource.created_at
      ) filter (where resource.ordinal <= 100), '[]'::jsonb) as resources,
      count(*) as resource_count
    from (
      select workspace_resources.*, row_number() over (
        order by position, created_at
      ) as ordinal
      from public.workspace_resources
      where space_id = p_space_id and user_id = p_user_id
    ) resource
  )
  select jsonb_build_object(
    'scope', case when p_section_id is null then 'space' else 'section' end,
    'space', jsonb_build_object(
      'id', space.id,
      'project_id', space.project_id,
      'name', space.name,
      'description', space.description,
      'kind', space.space_kind,
      'status', space.status,
      'revision', space.revision,
      'metadata', space.metadata,
      'updated_at', space.updated_at
    ),
    'selected_section_id', p_section_id,
    'sections', section_payload.sections,
    'context_budget', jsonb_build_object(
      'max_chars', safe_max_chars,
      'included_chars', section_payload.included_chars,
      'omitted_sections', section_payload.omitted_sections
    ),
    'resources', resource_payload.resources,
    'resource_count', resource_payload.resource_count,
    'resources_truncated', resource_payload.resource_count > 100,
    'legacy_canvas', jsonb_build_object(
      'notes', case
        when jsonb_typeof(space.data -> 'notes') = 'array' then (
          select coalesce(jsonb_agg(note.value order by note.ordinality), '[]'::jsonb)
          from jsonb_array_elements(space.data -> 'notes') with ordinality note(value, ordinality)
          where note.ordinality <= 25
        )
        else '[]'::jsonb
      end,
      'notes_truncated', case
        when jsonb_typeof(space.data -> 'notes') = 'array'
          then jsonb_array_length(space.data -> 'notes') > 25
        else false
      end,
      'has_visual_data', coalesce(space.data, '{}'::jsonb) <> '{}'::jsonb
    )
  )
  into result
  from public.spaces space
  cross join section_payload
  cross join resource_payload
  where space.id = p_space_id and space.user_id = p_user_id;

  return result;
end;
$$;

create or replace function public.workspace_get_project_context(
  p_user_id uuid,
  p_project_id uuid,
  p_max_chars integer default 60000
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  result jsonb;
  safe_max_chars integer := greatest(2000, least(coalesce(p_max_chars, 60000), 200000));
  owned_space_count integer;
  per_space_chars integer;
begin
  if not exists (
    select 1 from public.projects
    where id = p_project_id and user_id = p_user_id
  ) then
    raise exception using errcode = 'P0002', message = 'PROJECT_NOT_FOUND';
  end if;

  select count(*) into owned_space_count
  from public.spaces
  where project_id = p_project_id and user_id = p_user_id and status = 'active';

  per_space_chars := greatest(1000, safe_max_chars / greatest(owned_space_count, 1));

  with project_spaces as (
    select coalesce(jsonb_agg(
      public.workspace_get_space_context(
        p_user_id,
        space.id,
        null,
        per_space_chars
      ) order by space.position, space.updated_at desc
    ), '[]'::jsonb) as payload
    from public.spaces space
    where space.project_id = p_project_id
      and space.user_id = p_user_id
      and space.status = 'active'
  ), project_resources as (
    select
      coalesce(jsonb_agg(
        jsonb_build_object(
          'association_id', resource.id,
          'resource_type', resource.resource_type,
          'role', resource.role,
          'label', resource.label,
          'position', resource.position,
          'resource', public.workspace_hydrate_resource(
            resource.user_id,
            resource.resource_type,
            resource.resource_id
          )
        ) order by resource.position, resource.created_at
      ) filter (where resource.ordinal <= 100), '[]'::jsonb) as payload,
      count(*) as total
    from (
      select workspace_resources.*, row_number() over (
        order by position, created_at
      ) as ordinal
      from public.workspace_resources
      where project_id = p_project_id and user_id = p_user_id
    ) resource
  ), project_codex as (
    select coalesce(jsonb_agg(summary order by name) filter (where ordinal <= 100), '[]'::jsonb) as payload,
           count(*) as total
    from (
      select jsonb_build_object(
        'id', item.id,
        'type', item.tipo,
        'name', item.name,
        'description', left(coalesce(item.description, ''), 2000),
        'is_profile', item.is_profile,
        'updated_at', item.updated_at
      ) as summary,
      item.name,
      row_number() over (order by item.name, item.updated_at desc) as ordinal
      from public.codex_universe_items item
      where item.project_id = p_project_id and item.user_id = p_user_id
    ) codex
  ), project_datasets as (
    select coalesce(jsonb_agg(summary order by name) filter (where ordinal <= 100), '[]'::jsonb) as payload,
           count(*) as total
    from (
      select jsonb_build_object(
        'id', dataset.id,
        'name', dataset.name,
        'description', left(coalesce(dataset.description, ''), 2000),
        'row_count', dataset.row_count,
        'row_codex_type', dataset.row_codex_type,
        'connection_mode', dataset.connection_mode,
        'updated_at', dataset.updated_at
      ) as summary,
      dataset.name,
      row_number() over (order by dataset.name, dataset.updated_at desc) as ordinal
      from public.datasets dataset
      where dataset.project_id = p_project_id
        and dataset.user_id = p_user_id
        and dataset.deleted_at is null
    ) dataset_list
  )
  select jsonb_build_object(
    'scope', 'project',
    'project', jsonb_build_object(
      'id', project.id,
      'title', project.title,
      'description', project.description,
      'status', project.status,
      'priority', project.priority,
      'category', project.category,
      'tags', project.tags,
      'country', project.country,
      'updated_at', project.updated_at
    ),
    'context_budget', jsonb_build_object(
      'max_chars', safe_max_chars,
      'active_space_count', owned_space_count,
      'per_space_chars', per_space_chars
    ),
    'spaces', project_spaces.payload,
    'project_resources', project_resources.payload,
    'project_resource_count', project_resources.total,
    'project_resources_truncated', project_resources.total > 100,
    'codex_items', project_codex.payload,
    'codex_item_count', project_codex.total,
    'codex_items_truncated', project_codex.total > 100,
    'datasets', project_datasets.payload,
    'dataset_count', project_datasets.total,
    'datasets_truncated', project_datasets.total > 100,
    'decisions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', decision.id,
        'title', decision.title,
        'description', left(coalesce(decision.description, ''), 3000),
        'type', decision.decision_type,
        'status', decision.status,
        'urgency', decision.urgency,
        'updated_at', decision.updated_at
      ) order by decision.sequence_number nulls last, decision.updated_at desc), '[]'::jsonb)
      from public.project_decisions decision
      where decision.project_id = p_project_id
    ),
    'declared_context', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', context.id,
        'situation', context.situation_description,
        'objectives', context.objectives,
        'main_problem', context.main_problem,
        'geographic_scope', context.geographic_scope,
        'time_frame', context.time_frame,
        'type', context.context_type,
        'version', context.version
      ) order by context.version desc, context.updated_at desc), '[]'::jsonb)
      from public.project_contexts context
      where context.project_id = p_project_id
    ),
    'memory', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', memory.id,
        'type', memory.memory_type,
        'title', memory.title,
        'description', left(coalesce(memory.description, ''), 3000),
        'key_findings', memory.key_findings,
        'importance', memory.importance_level,
        'updated_at', memory.updated_at
      ) order by memory.updated_at desc), '[]'::jsonb)
      from public.project_memory memory
      where memory.project_id = p_project_id
    )
  )
  into result
  from public.projects project
  cross join project_spaces
  cross join project_resources
  cross join project_codex
  cross join project_datasets
  where project.id = p_project_id and project.user_id = p_user_id;

  return result;
end;
$$;

create or replace function public.workspace_search_context(
  p_user_id uuid,
  p_query text,
  p_project_id uuid default null,
  p_space_id uuid default null,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  query_value text := btrim(coalesce(p_query, ''));
  safe_limit integer := greatest(1, least(coalesce(p_limit, 20), 50));
  search_query tsquery;
  result jsonb;
begin
  if query_value = '' then
    raise exception using errcode = '22023', message = 'SEARCH_QUERY_REQUIRED';
  end if;

  if p_project_id is not null and not exists (
    select 1 from public.projects
    where id = p_project_id and user_id = p_user_id
  ) then
    raise exception using errcode = 'P0002', message = 'PROJECT_NOT_FOUND';
  end if;

  if p_space_id is not null and not exists (
    select 1 from public.spaces
    where id = p_space_id and user_id = p_user_id
  ) then
    raise exception using errcode = 'P0002', message = 'SPACE_NOT_FOUND';
  end if;

  search_query := websearch_to_tsquery('spanish'::regconfig, query_value);

  with matches as (
    select
      'section'::text as result_type,
      space.project_id,
      space.id as space_id,
      space.name as space_name,
      section.id as section_id,
      section.title as title,
      ts_rank_cd(
        to_tsvector('spanish'::regconfig, coalesce(section.title, '') || ' ' || coalesce(section.content_text, '')),
        search_query
      ) as rank,
      ts_headline(
        'spanish'::regconfig,
        coalesce(section.content_text, section.title),
        search_query,
        'MaxWords=30, MinWords=8, StartSel=<mark>, StopSel=</mark>'
      ) as excerpt,
      section.updated_at
    from public.space_sections section
    join public.spaces space on space.id = section.space_id and space.user_id = section.user_id
    where section.user_id = p_user_id
      and (p_project_id is null or space.project_id = p_project_id)
      and (p_space_id is null or space.id = p_space_id)
      and to_tsvector(
        'spanish'::regconfig,
        coalesce(section.title, '') || ' ' || coalesce(section.content_text, '')
      ) @@ search_query

    union all

    select
      'legacy_space'::text as result_type,
      space.project_id,
      space.id as space_id,
      space.name as space_name,
      null::uuid as section_id,
      space.name as title,
      ts_rank_cd(index.texto_busqueda, search_query) as rank,
      ts_headline(
        'spanish'::regconfig,
        coalesce(index.texto_indexado, space.name),
        search_query,
        'MaxWords=30, MinWords=8, StartSel=<mark>, StopSel=</mark>'
      ) as excerpt,
      greatest(space.updated_at, index.updated_at) as updated_at
    from public.espacio_index index
    join public.spaces space on space.id = index.espacio_id
    where space.user_id = p_user_id
      and (p_project_id is null or space.project_id = p_project_id)
      and (p_space_id is null or space.id = p_space_id)
      and index.texto_busqueda @@ search_query
  ), ranked as (
    select * from matches
    order by rank desc, updated_at desc
    limit safe_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'result_type', result_type,
    'project_id', project_id,
    'space_id', space_id,
    'space_name', space_name,
    'section_id', section_id,
    'title', title,
    'rank', rank,
    'excerpt', excerpt,
    'updated_at', updated_at
  ) order by rank desc, updated_at desc), '[]'::jsonb)
  into result
  from ranked;

  return result;
end;
$$;

revoke all on function public.workspace_hydrate_resource(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.workspace_get_space_context(uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.workspace_get_project_context(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.workspace_search_context(uuid, text, uuid, uuid, integer) from public, anon, authenticated;

grant execute on function public.workspace_hydrate_resource(uuid, text, uuid) to service_role;
grant execute on function public.workspace_get_space_context(uuid, uuid, uuid, integer) to service_role;
grant execute on function public.workspace_get_project_context(uuid, uuid, integer) to service_role;
grant execute on function public.workspace_search_context(uuid, text, uuid, uuid, integer) to service_role;

comment on function public.workspace_get_space_context(uuid, uuid, uuid, integer) is
  'Service-only bounded context reader for a complete Space or one section subtree.';
comment on function public.workspace_get_project_context(uuid, uuid, integer) is
  'Service-only bounded context reader that composes a Project from its Spaces and owned resources without copying them.';
comment on function public.workspace_search_context(uuid, text, uuid, uuid, integer) is
  'Service-only lexical search across normalized Space sections and the legacy Space index.';
