-- Task 3.4.2: durable, owner-scoped indexing queue and atomic chunk writes.

alter table public.workspace_memory_chunks
  drop constraint workspace_memory_chunks_source_type_check;

alter table public.workspace_memory_chunks
  add constraint workspace_memory_chunks_source_type_check check (
    source_type in (
      'space',
      'space_section',
      'codex_item',
      'codex_auxiliary',
      'dataset',
      'dataset_row',
      'simulation',
      'project_decision',
      'project_memory'
    )
  );

alter table public.workspace_graph_edges
  drop constraint workspace_graph_edges_source_type_check,
  drop constraint workspace_graph_edges_target_type_check;

alter table public.workspace_graph_edges
  add constraint workspace_graph_edges_source_type_check check (
    source_type in (
      'space',
      'group',
      'space_section',
      'codex_item',
      'codex_auxiliary',
      'dataset',
      'dataset_row',
      'folder',
      'simulation'
    )
  ),
  add constraint workspace_graph_edges_target_type_check check (
    target_type in (
      'space',
      'group',
      'space_section',
      'codex_item',
      'codex_auxiliary',
      'dataset',
      'dataset_row',
      'folder',
      'simulation'
    )
  );

alter table public.space_groups
  add column semantic_key text check (
    semantic_key is null or semantic_key ~ '^[0-9a-f]{64}$'
  );

comment on column public.space_groups.semantic_key is
  'Stable hash of a semantic proposal. A rejected proposal is not recreated with the same key.';

create unique index space_groups_semantic_key_unique_idx
  on public.space_groups (user_id, space_id, semantic_key)
  where semantic_key is not null;

create table public.workspace_memory_index_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (
    source_type in (
      'space',
      'space_section',
      'codex_item',
      'codex_auxiliary',
      'dataset',
      'dataset_row',
      'simulation',
      'project_decision',
      'project_memory'
    )
  ),
  source_id uuid not null,
  operation text not null default 'upsert' check (
    operation in ('upsert', 'delete')
  ),
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'retry', 'done', 'dead')
  ),
  priority smallint not null default 0 check (priority between -10 and 10),
  generation bigint not null default 1 check (generation > 0),
  claimed_generation bigint,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  completed_at timestamptz,
  last_error text,
  stats jsonb not null default '{}'::jsonb check (jsonb_typeof(stats) = 'object'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);

comment on table public.workspace_memory_index_jobs is
  'Durable coalescing queue for private workspace indexing. One row per canonical source; generation prevents stale workers from completing newer work.';

create index workspace_memory_index_jobs_claim_idx
  on public.workspace_memory_index_jobs (status, available_at, priority desc, updated_at)
  where status in ('queued', 'retry', 'processing');

create index workspace_memory_index_jobs_owner_idx
  on public.workspace_memory_index_jobs (user_id, status, updated_at desc);

create or replace function public.workspace_queue_memory_source(
  p_user_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_operation text default 'upsert',
  p_priority smallint default 0,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_job_id uuid;
begin
  if p_user_id is null or p_source_id is null then
    return null;
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    return null;
  end if;

  if p_source_type not in (
    'space', 'space_section', 'codex_item', 'codex_auxiliary',
    'dataset', 'dataset_row', 'simulation', 'project_decision', 'project_memory'
  ) then
    raise exception using errcode = '22023', message = 'INVALID_WORKSPACE_MEMORY_SOURCE_TYPE';
  end if;

  if p_operation not in ('upsert', 'delete') then
    raise exception using errcode = '22023', message = 'INVALID_WORKSPACE_MEMORY_OPERATION';
  end if;

  insert into public.workspace_memory_index_jobs (
    user_id, source_type, source_id, operation, status, priority,
    generation, claimed_generation, attempts, available_at,
    locked_at, locked_by, completed_at, last_error, stats, metadata
  ) values (
    p_user_id, p_source_type, p_source_id, p_operation, 'queued', p_priority,
    1, null, 0, now(), null, null, null, null, '{}'::jsonb,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (user_id, source_type, source_id) do update
  set operation = excluded.operation,
      status = 'queued',
      priority = greatest(public.workspace_memory_index_jobs.priority, excluded.priority),
      generation = public.workspace_memory_index_jobs.generation + 1,
      claimed_generation = null,
      attempts = 0,
      available_at = now(),
      locked_at = null,
      locked_by = null,
      completed_at = null,
      last_error = null,
      stats = '{}'::jsonb,
      metadata = public.workspace_memory_index_jobs.metadata || excluded.metadata,
      updated_at = now()
  returning id into v_job_id;

  return v_job_id;
end;
$$;

create or replace function public.workspace_claim_memory_jobs(
  p_worker_id text,
  p_limit integer default 5,
  p_stale_after_seconds integer default 900
)
returns table (
  id uuid,
  user_id uuid,
  source_type text,
  source_id uuid,
  operation text,
  generation bigint,
  attempts integer,
  max_attempts integer,
  metadata jsonb
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  with candidates as (
    select j.id
    from public.workspace_memory_index_jobs j
    where (
      (j.status in ('queued', 'retry') and j.available_at <= now())
      or (
        j.status = 'processing'
        and j.locked_at < now() - make_interval(secs => greatest(p_stale_after_seconds, 60))
      )
    )
    order by j.priority desc, j.available_at, j.updated_at
    for update skip locked
    limit least(greatest(p_limit, 1), 50)
  ), claimed as (
    update public.workspace_memory_index_jobs j
    set status = 'processing',
        claimed_generation = j.generation,
        attempts = j.attempts + 1,
        locked_at = now(),
        locked_by = left(p_worker_id, 200),
        updated_at = now()
    from candidates c
    where j.id = c.id
    returning j.*
  )
  select
    c.id,
    c.user_id,
    c.source_type,
    c.source_id,
    c.operation,
    c.claimed_generation as generation,
    c.attempts,
    c.max_attempts,
    c.metadata
  from claimed c
  order by c.priority desc, c.updated_at;
$$;

create or replace function public.workspace_complete_memory_job(
  p_job_id uuid,
  p_generation bigint,
  p_stats jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.workspace_memory_index_jobs j
  set status = 'done',
      completed_at = now(),
      locked_at = null,
      locked_by = null,
      last_error = null,
      stats = coalesce(p_stats, '{}'::jsonb),
      updated_at = now()
  where j.id = p_job_id
    and j.status = 'processing'
    and j.generation = p_generation
    and j.claimed_generation = p_generation;

  return found;
end;
$$;

create or replace function public.workspace_fail_memory_job(
  p_job_id uuid,
  p_generation bigint,
  p_error text,
  p_retry_after_seconds integer default 30
)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_status text;
begin
  update public.workspace_memory_index_jobs j
  set status = case when j.attempts >= j.max_attempts then 'dead' else 'retry' end,
      available_at = case
        when j.attempts >= j.max_attempts then j.available_at
        else now() + make_interval(secs => least(greatest(p_retry_after_seconds, 5), 3600))
      end,
      completed_at = case when j.attempts >= j.max_attempts then now() else null end,
      locked_at = null,
      locked_by = null,
      last_error = left(coalesce(p_error, 'Unknown indexing error'), 4000),
      updated_at = now()
  where j.id = p_job_id
    and j.status = 'processing'
    and j.generation = p_generation
    and j.claimed_generation = p_generation
  returning j.status into v_status;

  return v_status;
end;
$$;

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
      embedding = excluded.embedding,
      embedding_model = excluded.embedding_model,
      token_count = excluded.token_count,
      language = excluded.language,
      metadata = excluded.metadata,
      updated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.workspace_delete_memory_source(
  p_user_id uuid,
  p_source_type text,
  p_source_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_chunks integer := 0;
  v_edges integer := 0;
begin
  delete from public.workspace_memory_chunks c
  where c.user_id = p_user_id
    and c.source_type = p_source_type
    and c.source_id = p_source_id;
  get diagnostics v_chunks = row_count;

  if p_source_type in (
    'space', 'space_section', 'codex_item', 'codex_auxiliary',
    'dataset', 'dataset_row', 'simulation'
  ) then
    delete from public.workspace_graph_edges e
    where e.user_id = p_user_id
      and e.origin = 'semantic'
      and e.status = 'suggested'
      and (
        (e.source_type = p_source_type and e.source_id = p_source_id)
        or (e.target_type = p_source_type and e.target_id = p_source_id)
      );
    get diagnostics v_edges = row_count;
  end if;

  return jsonb_build_object('chunks_deleted', v_chunks, 'edges_deleted', v_edges);
end;
$$;

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
    when 'dataset_row' then
      select exists (
        select 1
        from public.dataset_rows dr
        join public.datasets d on d.id = dr.dataset_id
        where dr.id = new.source_id
          and d.user_id = new.user_id
          and dr.deleted_at is null
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
    when 'dataset_row' then
      return exists (
        select 1
        from public.dataset_rows dr
        join public.datasets d on d.id = dr.dataset_id
        join public.workspace_resources wr
          on wr.resource_type = 'dataset'
         and wr.resource_id = d.id
         and wr.user_id = p_user_id
         and wr.space_id = p_space_id
        where dr.id = p_endpoint_id
          and d.user_id = p_user_id
          and dr.deleted_at is null
          and d.deleted_at is null
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

create or replace function public.queue_workspace_memory_row()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_row jsonb;
  v_user_id uuid;
  v_source_id uuid;
  v_operation text;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_user_id := nullif(v_row->>'user_id', '')::uuid;
  v_source_id := nullif(v_row->>'id', '')::uuid;
  v_operation := case
    when tg_op = 'DELETE' then 'delete'
    when tg_argv[0] = 'dataset' and (v_row->>'deleted_at') is not null then 'delete'
    else 'upsert'
  end;

  perform public.workspace_queue_memory_source(
    v_user_id,
    tg_argv[0],
    v_source_id,
    v_operation,
    0,
    jsonb_build_object('table', tg_table_name, 'event', lower(tg_op))
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.queue_workspace_dataset_row()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_row jsonb;
  v_user_id uuid;
  v_operation text;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  select d.user_id into v_user_id
  from public.datasets d
  where d.id = (v_row->>'dataset_id')::uuid;

  v_operation := case
    when tg_op = 'DELETE' or (v_row->>'deleted_at') is not null then 'delete'
    else 'upsert'
  end;

  perform public.workspace_queue_memory_source(
    v_user_id,
    'dataset_row',
    (v_row->>'id')::uuid,
    v_operation,
    0,
    jsonb_build_object('table', tg_table_name, 'event', lower(tg_op))
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.queue_workspace_project_child()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_row jsonb;
  v_user_id uuid;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  select p.user_id into v_user_id
  from public.projects p
  where p.id = (v_row->>'project_id')::uuid;

  perform public.workspace_queue_memory_source(
    v_user_id,
    tg_argv[0],
    (v_row->>'id')::uuid,
    case when tg_op = 'DELETE' then 'delete' else 'upsert' end,
    0,
    jsonb_build_object('table', tg_table_name, 'event', lower(tg_op))
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.queue_workspace_resource_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  v_row public.workspace_resources%rowtype;
  v_dataset_row record;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;

  if v_row.resource_type in ('codex_item', 'codex_auxiliary', 'dataset', 'simulation') then
    perform public.workspace_queue_memory_source(
      v_row.user_id,
      v_row.resource_type,
      v_row.resource_id,
      'upsert',
      1,
      jsonb_build_object('table', tg_table_name, 'event', lower(tg_op), 'space_id', v_row.space_id)
    );
  end if;

  if v_row.resource_type = 'dataset' then
    for v_dataset_row in
      select dr.id
      from public.dataset_rows dr
      where dr.dataset_id = v_row.resource_id and dr.deleted_at is null
    loop
      perform public.workspace_queue_memory_source(
        v_row.user_id,
        'dataset_row',
        v_dataset_row.id,
        'upsert',
        0,
        jsonb_build_object('table', tg_table_name, 'event', lower(tg_op), 'space_id', v_row.space_id)
      );
    end loop;
  end if;

  if tg_op = 'DELETE' then
    delete from public.workspace_graph_edges e
    where e.user_id = v_row.user_id
      and e.space_id = v_row.space_id
      and (
        (e.source_type = v_row.resource_type and e.source_id = v_row.resource_id)
        or (e.target_type = v_row.resource_type and e.target_id = v_row.resource_id)
      );
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.workspace_queue_memory_backfill(
  p_user_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_source record;
  v_count integer := 0;
begin
  for v_source in
    select s.user_id, 'space'::text as source_type, s.id as source_id
    from public.spaces s
    where p_user_id is null or s.user_id = p_user_id
    union
    select ss.user_id, 'space_section', ss.id
    from public.space_sections ss
    where p_user_id is null or ss.user_id = p_user_id
    union
    select wr.user_id, wr.resource_type, wr.resource_id
    from public.workspace_resources wr
    where wr.resource_type in ('codex_item', 'codex_auxiliary', 'dataset', 'simulation')
      and (p_user_id is null or wr.user_id = p_user_id)
    union
    select d.user_id, 'dataset_row', dr.id
    from public.dataset_rows dr
    join public.datasets d on d.id = dr.dataset_id
    join public.workspace_resources wr
      on wr.resource_type = 'dataset'
     and wr.resource_id = d.id
     and wr.user_id = d.user_id
    where dr.deleted_at is null
      and d.deleted_at is null
      and (p_user_id is null or d.user_id = p_user_id)
    union
    select p.user_id, 'project_decision', pd.id
    from public.project_decisions pd
    join public.projects p on p.id = pd.project_id
    where p_user_id is null or p.user_id = p_user_id
    union
    select p.user_id, 'project_memory', pm.id
    from public.project_memory pm
    join public.projects p on p.id = pm.project_id
    where p_user_id is null or p.user_id = p_user_id
  loop
    perform public.workspace_queue_memory_source(
      v_source.user_id,
      v_source.source_type,
      v_source.source_id,
      'upsert',
      -1,
      '{"reason":"backfill"}'::jsonb
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create trigger queue_workspace_space_memory_trigger
after insert or update or delete on public.spaces
for each row execute function public.queue_workspace_memory_row('space');

create trigger queue_workspace_section_memory_trigger
after insert or update or delete on public.space_sections
for each row execute function public.queue_workspace_memory_row('space_section');

create trigger queue_workspace_codex_item_memory_trigger
after insert or update or delete on public.codex_universe_items
for each row execute function public.queue_workspace_memory_row('codex_item');

create trigger queue_workspace_codex_auxiliary_memory_trigger
after insert or update or delete on public.codex_items
for each row execute function public.queue_workspace_memory_row('codex_auxiliary');

create trigger queue_workspace_dataset_memory_trigger
after insert or update or delete on public.datasets
for each row execute function public.queue_workspace_memory_row('dataset');

create trigger queue_workspace_dataset_row_memory_trigger
after insert or update or delete on public.dataset_rows
for each row execute function public.queue_workspace_dataset_row();

create trigger queue_workspace_simulation_memory_trigger
after insert or update or delete on public.codex_simulations
for each row execute function public.queue_workspace_memory_row('simulation');

create trigger queue_workspace_project_decision_memory_trigger
after insert or update or delete on public.project_decisions
for each row execute function public.queue_workspace_project_child('project_decision');

create trigger queue_workspace_project_memory_trigger
after insert or update or delete on public.project_memory
for each row execute function public.queue_workspace_project_child('project_memory');

create trigger queue_workspace_resource_change_trigger
after insert or delete on public.workspace_resources
for each row execute function public.queue_workspace_resource_change();

alter table public.workspace_memory_index_jobs enable row level security;

create policy workspace_memory_index_jobs_service_all
on public.workspace_memory_index_jobs
for all
to service_role
using (true)
with check (true);

revoke all on table public.workspace_memory_index_jobs from public, anon, authenticated;
grant all on table public.workspace_memory_index_jobs to service_role;

revoke all on function public.workspace_queue_memory_source(uuid, text, uuid, text, smallint, jsonb) from public, anon, authenticated;
revoke all on function public.workspace_claim_memory_jobs(text, integer, integer) from public, anon, authenticated;
revoke all on function public.workspace_complete_memory_job(uuid, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.workspace_fail_memory_job(uuid, bigint, text, integer) from public, anon, authenticated;
revoke all on function public.workspace_replace_memory_chunks(uuid, text, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.workspace_delete_memory_source(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.queue_workspace_memory_row() from public, anon, authenticated;
revoke all on function public.queue_workspace_dataset_row() from public, anon, authenticated;
revoke all on function public.queue_workspace_project_child() from public, anon, authenticated;
revoke all on function public.queue_workspace_resource_change() from public, anon, authenticated;
revoke all on function public.workspace_queue_memory_backfill(uuid) from public, anon, authenticated;

grant execute on function public.workspace_queue_memory_source(uuid, text, uuid, text, smallint, jsonb) to service_role;
grant execute on function public.workspace_claim_memory_jobs(text, integer, integer) to service_role;
grant execute on function public.workspace_complete_memory_job(uuid, bigint, jsonb) to service_role;
grant execute on function public.workspace_fail_memory_job(uuid, bigint, text, integer) to service_role;
grant execute on function public.workspace_replace_memory_chunks(uuid, text, uuid, jsonb, text) to service_role;
grant execute on function public.workspace_delete_memory_source(uuid, text, uuid) to service_role;
grant execute on function public.queue_workspace_memory_row() to service_role;
grant execute on function public.queue_workspace_dataset_row() to service_role;
grant execute on function public.queue_workspace_project_child() to service_role;
grant execute on function public.queue_workspace_resource_change() to service_role;
grant execute on function public.workspace_queue_memory_backfill(uuid) to service_role;
