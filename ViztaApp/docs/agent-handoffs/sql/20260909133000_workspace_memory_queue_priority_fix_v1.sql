-- Fix trigger calls: PostgreSQL integer literals do not implicitly resolve a
-- function argument declared as smallint.

create function public.workspace_queue_memory_source(
  p_user_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_operation text,
  p_priority integer,
  p_metadata jsonb
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
    p_user_id,
    p_source_type,
    p_source_id,
    p_operation,
    'queued',
    least(greatest(p_priority, -10), 10)::smallint,
    1,
    null,
    0,
    now(),
    null,
    null,
    null,
    null,
    '{}'::jsonb,
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

drop function public.workspace_queue_memory_source(uuid, text, uuid, text, smallint, jsonb);

revoke all on function public.workspace_queue_memory_source(uuid, text, uuid, text, integer, jsonb)
  from public, anon, authenticated;

grant execute on function public.workspace_queue_memory_source(uuid, text, uuid, text, integer, jsonb)
  to service_role;
