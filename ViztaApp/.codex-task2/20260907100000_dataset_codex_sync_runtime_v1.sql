-- Dataset <-> Codex runtime bridge, task 2 of 4.
-- Keeps legacy json_data readable while canonical rows and approved bindings drive sync.

alter table public.dataset_field_bindings
  add column if not exists target_storage_key text;

comment on column public.dataset_field_bindings.target_storage_key is
  'Physical key inside codex_universe_items.details. Resolved from schema when a binding is approved.';

create or replace function public.sync_dataset_row_to_legacy_json()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source_table text;
begin
  if new.values is not distinct from old.values then
    return new;
  end if;

  select d.legacy_source into source_table
  from public.datasets d
  where d.id = new.dataset_id;

  if source_table = 'private_datasets' then
    update public.private_datasets
    set json_data = jsonb_set(json_data, array[new.position::text], new.values, false),
        size_bytes = octet_length(jsonb_set(json_data, array[new.position::text], new.values, false)::text),
        updated_at = now()
    where id = new.dataset_id
      and jsonb_array_length(json_data) > new.position;
  elsif source_table = 'public_datasets' then
    update public.public_datasets
    set json_data = jsonb_set(json_data, array[new.position::text], new.values, false),
        size_bytes = octet_length(jsonb_set(json_data, array[new.position::text], new.values, false)::text),
        updated_at = now()
    where id = new.dataset_id
      and jsonb_array_length(json_data) > new.position;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_dataset_row_to_legacy_json() from public;

drop trigger if exists dataset_rows_sync_legacy_json on public.dataset_rows;
create trigger dataset_rows_sync_legacy_json
after update of values on public.dataset_rows
for each row
when (old.values is distinct from new.values)
execute function public.sync_dataset_row_to_legacy_json();

create or replace function public.sync_codex_item_to_dataset_rows()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sync_operation_id uuid := gen_random_uuid();
  target record;
  storage_key text;
  next_value jsonb;
  previous_value jsonb;
  old_value_exists boolean;
  value_exists boolean;
  changed_rows integer := 0;
begin
  if new.details is not distinct from old.details
     and new.field_keys is not distinct from old.field_keys then
    return new;
  end if;

  for target in
    select
      l.user_id,
      l.dataset_row_id,
      r.dataset_id,
      r.values,
      b.column_key,
      b.target_kind,
      b.target_key,
      b.target_storage_key,
      b.empty_policy
    from public.dataset_row_codex_links l
    join public.dataset_rows r
      on r.id = l.dataset_row_id and r.deleted_at is null
    join public.datasets d
      on d.id = r.dataset_id and d.deleted_at is null
    join public.dataset_field_bindings b
      on b.dataset_id = d.id and b.active = true
    where l.codex_item_id = new.id
      and l.status = 'confirmed'
      and l.user_id = new.user_id
      and d.user_id = new.user_id
      and d.connection_mode = 'sync'
      and b.direction in ('both', 'codex_to_dataset')
  loop
    storage_key := coalesce(nullif(target.target_storage_key, ''), target.target_key);
    value_exists := coalesce(new.details, '{}'::jsonb) ? storage_key;
    old_value_exists := coalesce(old.details, '{}'::jsonb) ? storage_key;

    if not value_exists and target.target_kind = 'field' then
      storage_key := target.target_key;
      value_exists := coalesce(new.details, '{}'::jsonb) ? storage_key;
      old_value_exists := coalesce(old.details, '{}'::jsonb) ? storage_key;
    end if;

    if not value_exists and not old_value_exists then
      continue;
    end if;

    next_value := case
      when value_exists then new.details -> storage_key
      else 'null'::jsonb
    end;
    previous_value := target.values -> target.column_key;

    if next_value in ('null'::jsonb, '""'::jsonb)
       and target.empty_policy = 'ignore_empty' then
      continue;
    end if;

    if next_value in ('null'::jsonb, '""'::jsonb)
       and target.empty_policy = 'confirm_clear' then
      insert into public.codex_sync_events (
        operation_id, user_id, origin_kind, origin_id,
        source_kind, source_id, target_kind, target_id,
        field_key, previous_value, next_value, status, error, metadata
      ) values (
        sync_operation_id, target.user_id, 'codex', new.id,
        'codex_item', new.id, 'dataset_row', target.dataset_row_id,
        target.target_key, previous_value, next_value, 'conflict',
        'CLEAR_REQUIRES_CONFIRMATION',
        jsonb_build_object('column_key', target.column_key, 'dataset_id', target.dataset_id)
      );
      continue;
    end if;

    if previous_value is not distinct from next_value then
      continue;
    end if;

    update public.dataset_rows
    set values = jsonb_set(values, array[target.column_key], next_value, true)
    where id = target.dataset_row_id;

    insert into public.codex_sync_events (
      operation_id, user_id, origin_kind, origin_id,
      source_kind, source_id, target_kind, target_id,
      field_key, previous_value, next_value, status, applied_at, metadata
    ) values (
      sync_operation_id, target.user_id, 'codex', new.id,
      'codex_item', new.id, 'dataset_row', target.dataset_row_id,
      target.target_key, previous_value, next_value, 'applied', now(),
      jsonb_build_object('column_key', target.column_key, 'dataset_id', target.dataset_id)
    );

    changed_rows := changed_rows + 1;
  end loop;

  if changed_rows > 0 then
    update public.datasets
    set last_codex_sync = now(), updated_at = now()
    where id in (
      select distinct r.dataset_id
      from public.dataset_row_codex_links l
      join public.dataset_rows r on r.id = l.dataset_row_id
      where l.codex_item_id = new.id and l.status = 'confirmed'
    );
  end if;

  return new;
end;
$$;

revoke all on function public.sync_codex_item_to_dataset_rows() from public;

drop trigger if exists codex_items_sync_dataset_rows on public.codex_universe_items;
create trigger codex_items_sync_dataset_rows
after update of details, field_keys on public.codex_universe_items
for each row execute function public.sync_codex_item_to_dataset_rows();

create index if not exists dataset_field_bindings_sync_lookup_idx
  on public.dataset_field_bindings(dataset_id, direction)
  where active = true;
