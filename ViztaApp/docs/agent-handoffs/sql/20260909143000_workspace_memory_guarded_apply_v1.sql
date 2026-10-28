-- Prevent a stale worker generation from overwriting chunks produced for a
-- newer edit of the same source.

create or replace function public.workspace_apply_memory_job(
  p_job_id uuid,
  p_generation bigint,
  p_chunks jsonb,
  p_embedding_model text,
  p_delete boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_job public.workspace_memory_index_jobs%rowtype;
  v_result jsonb;
  v_written integer := 0;
begin
  select * into v_job
  from public.workspace_memory_index_jobs j
  where j.id = p_job_id
    and j.status = 'processing'
    and j.generation = p_generation
    and j.claimed_generation = p_generation
  for update;

  if not found then
    return jsonb_build_object('applied', false, 'reason', 'stale_generation');
  end if;

  if p_delete or v_job.operation = 'delete' then
    v_result := public.workspace_delete_memory_source(
      v_job.user_id,
      v_job.source_type,
      v_job.source_id
    );
    return jsonb_build_object(
      'applied', true,
      'operation', 'delete',
      'result', v_result
    );
  end if;

  v_written := public.workspace_replace_memory_chunks(
    v_job.user_id,
    v_job.source_type,
    v_job.source_id,
    coalesce(p_chunks, '[]'::jsonb),
    p_embedding_model
  );

  return jsonb_build_object(
    'applied', true,
    'operation', 'upsert',
    'chunks_written', v_written
  );
end;
$$;

revoke all on function public.workspace_apply_memory_job(uuid, bigint, jsonb, text, boolean)
  from public, anon, authenticated;

grant execute on function public.workspace_apply_memory_job(uuid, bigint, jsonb, text, boolean)
  to service_role;
