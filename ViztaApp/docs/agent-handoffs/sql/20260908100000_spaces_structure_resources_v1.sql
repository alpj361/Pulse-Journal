-- Task 3.2: normalized Space structure and Workspace resource links.
-- Applied through Supabase MCP. Copy into ExtractorW/migrations when SSH returns.

alter table public.spaces
  add column description text,
  add column space_kind text not null default 'document',
  add column status text not null default 'active',
  add column position integer not null default 0,
  add column revision bigint not null default 1,
  add column metadata jsonb not null default '{}'::jsonb;

alter table public.spaces
  add constraint spaces_name_not_blank_check
    check (char_length(btrim(name)) between 1 and 200),
  add constraint spaces_kind_check
    check (space_kind in (
      'document', 'story', 'article', 'case', 'research',
      'market_research', 'workflow', 'deck', 'other'
    )),
  add constraint spaces_status_check
    check (status in ('active', 'archived')),
  add constraint spaces_position_check
    check (position >= 0),
  add constraint spaces_revision_check
    check (revision > 0),
  add constraint spaces_metadata_object_check
    check (jsonb_typeof(metadata) = 'object');

create unique index spaces_id_user_id_uidx
  on public.spaces (id, user_id);
create index spaces_user_project_position_idx
  on public.spaces (user_id, project_id, position, updated_at desc);
create index spaces_user_kind_status_idx
  on public.spaces (user_id, space_kind, status, updated_at desc);

create or replace function public.set_spaces_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  new.revision := old.revision + 1;
  return new;
end;
$$;

revoke all on function public.set_spaces_updated_at() from public, anon, authenticated;
grant execute on function public.set_spaces_updated_at() to service_role;

create table public.space_sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  space_id uuid not null,
  parent_id uuid,
  section_kind text not null default 'section',
  title text not null default 'Sección sin título',
  content_format text not null default 'tiptap',
  content_json jsonb,
  content_text text not null default '',
  position integer not null default 0,
  revision bigint not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint space_sections_space_owner_fkey
    foreign key (space_id, user_id)
    references public.spaces (id, user_id)
    on update cascade on delete cascade,
  constraint space_sections_kind_check
    check (section_kind in (
      'part', 'chapter', 'section', 'subsection', 'scene',
      'page', 'step', 'slide', 'block', 'custom'
    )),
  constraint space_sections_title_check
    check (char_length(btrim(title)) between 1 and 300),
  constraint space_sections_content_format_check
    check (content_format in ('tiptap', 'markdown', 'plain_text', 'json')),
  constraint space_sections_content_json_check
    check (
      content_json is null
      or jsonb_typeof(content_json) in ('object', 'array')
    ),
  constraint space_sections_position_check check (position >= 0),
  constraint space_sections_revision_check check (revision > 0),
  constraint space_sections_metadata_check check (jsonb_typeof(metadata) = 'object'),
  constraint space_sections_not_own_parent_check check (parent_id is null or parent_id <> id),
  constraint space_sections_identity_unique unique (id, space_id, user_id)
);

alter table public.space_sections
  add constraint space_sections_parent_same_space_fkey
  foreign key (parent_id, space_id, user_id)
  references public.space_sections (id, space_id, user_id)
  on update cascade on delete cascade;

create index space_sections_tree_idx
  on public.space_sections (space_id, parent_id, position, created_at);
create index space_sections_user_updated_idx
  on public.space_sections (user_id, updated_at desc);
create index space_sections_search_idx
  on public.space_sections using gin (
    to_tsvector('spanish'::regconfig, coalesce(title, '') || ' ' || coalesce(content_text, ''))
  );

create or replace function public.validate_space_section_parent()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.parent_id is null then
    return new;
  end if;

  if exists (
    with recursive ancestors as (
      select s.id, s.parent_id
      from public.space_sections s
      where s.id = new.parent_id
        and s.space_id = new.space_id
        and s.user_id = new.user_id
      union all
      select p.id, p.parent_id
      from public.space_sections p
      join ancestors a on a.parent_id = p.id
      where p.space_id = new.space_id
        and p.user_id = new.user_id
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception using errcode = '23514', message = 'SPACE_SECTION_CYCLE';
  end if;

  return new;
end;
$$;

create or replace function public.touch_space_section_revision()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  new.revision := old.revision + 1;
  return new;
end;
$$;

revoke all on function public.validate_space_section_parent() from public, anon, authenticated;
revoke all on function public.touch_space_section_revision() from public, anon, authenticated;
grant execute on function public.validate_space_section_parent() to service_role;
grant execute on function public.touch_space_section_revision() to service_role;

create trigger space_sections_validate_parent
before insert or update of parent_id, space_id, user_id
on public.space_sections
for each row execute function public.validate_space_section_parent();

create trigger space_sections_touch_revision
before update on public.space_sections
for each row execute function public.touch_space_section_revision();

alter table public.space_sections enable row level security;

create policy "Users can view own space sections"
on public.space_sections for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Users can create own space sections"
on public.space_sections for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Users can update own space sections"
on public.space_sections for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Users can delete own space sections"
on public.space_sections for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.space_sections from anon;
grant select, insert, update, delete on table public.space_sections to authenticated;
grant all on table public.space_sections to service_role;

create table public.workspace_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid,
  space_id uuid,
  resource_type text not null,
  resource_id uuid not null,
  role text not null default 'context',
  label text,
  position integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_resources_one_container_check
    check ((project_id is not null)::integer + (space_id is not null)::integer = 1),
  constraint workspace_resources_project_owner_fkey
    foreign key (project_id, user_id)
    references public.projects (id, user_id)
    on update cascade on delete cascade,
  constraint workspace_resources_space_owner_fkey
    foreign key (space_id, user_id)
    references public.spaces (id, user_id)
    on update cascade on delete cascade,
  constraint workspace_resources_type_check
    check (resource_type in (
      'codex_item', 'codex_auxiliary', 'dataset', 'folder', 'simulation'
    )),
  constraint workspace_resources_role_check
    check (role in (
      'context', 'reference', 'evidence', 'subject', 'output', 'attachment'
    )),
  constraint workspace_resources_position_check check (position >= 0),
  constraint workspace_resources_metadata_check check (jsonb_typeof(metadata) = 'object'),
  constraint workspace_resources_unique
    unique nulls not distinct (
      user_id, project_id, space_id, resource_type, resource_id, role
    )
);

create index workspace_resources_project_idx
  on public.workspace_resources (project_id, position, created_at)
  where project_id is not null;
create index workspace_resources_space_idx
  on public.workspace_resources (space_id, position, created_at)
  where space_id is not null;
create index workspace_resources_target_idx
  on public.workspace_resources (user_id, resource_type, resource_id);

create or replace function public.validate_workspace_resource_owner()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  owned boolean := false;
begin
  case new.resource_type
    when 'codex_item' then
      select exists (
        select 1 from public.codex_universe_items
        where id = new.resource_id and user_id = new.user_id
      ) into owned;
    when 'codex_auxiliary' then
      select exists (
        select 1 from public.codex_items
        where id = new.resource_id and user_id = new.user_id
      ) into owned;
    when 'dataset' then
      select exists (
        select 1 from public.datasets
        where id = new.resource_id and user_id = new.user_id and deleted_at is null
      ) into owned;
    when 'folder' then
      select exists (
        select 1 from public.post_folders
        where id = new.resource_id and user_id = new.user_id
      ) into owned;
    when 'simulation' then
      select exists (
        select 1 from public.codex_simulations
        where id = new.resource_id and user_id = new.user_id
      ) into owned;
  end case;

  if not owned then
    raise exception using errcode = '23514', message = 'WORKSPACE_RESOURCE_OWNER_MISMATCH';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.validate_workspace_resource_owner() from public, anon, authenticated;
grant execute on function public.validate_workspace_resource_owner() to service_role;

create trigger workspace_resources_validate_owner
before insert or update of user_id, resource_type, resource_id
on public.workspace_resources
for each row execute function public.validate_workspace_resource_owner();

alter table public.workspace_resources enable row level security;

create policy "Users can view own workspace resources"
on public.workspace_resources for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Users can create own workspace resources"
on public.workspace_resources for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Users can update own workspace resources"
on public.workspace_resources for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Users can delete own workspace resources"
on public.workspace_resources for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.workspace_resources from anon;
grant select, insert, update, delete on table public.workspace_resources to authenticated;
grant all on table public.workspace_resources to service_role;

insert into public.workspace_resources (
  user_id, space_id, resource_type, resource_id, role, metadata
)
select distinct
  s.user_id,
  s.id,
  'codex_item',
  u.id,
  'context',
  jsonb_build_object('migrated_from', 'spaces.data.canvasItems')
from public.spaces s
cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(s.data->'canvasItems') = 'array'
       then s.data->'canvasItems' else '[]'::jsonb end
) raw(item_id)
join public.codex_universe_items u
  on raw.item_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 and u.id = raw.item_id::uuid
 and u.user_id = s.user_id
on conflict do nothing;

insert into public.workspace_resources (
  user_id, space_id, resource_type, resource_id, role, metadata
)
select distinct
  s.user_id,
  s.id,
  'codex_auxiliary',
  c.id,
  'context',
  jsonb_build_object('migrated_from', 'spaces.data.canvasItems')
from public.spaces s
cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(s.data->'canvasItems') = 'array'
       then s.data->'canvasItems' else '[]'::jsonb end
) raw(item_id)
join public.codex_items c
  on raw.item_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 and c.id = raw.item_id::uuid
 and c.user_id = s.user_id
on conflict do nothing;

comment on table public.space_sections is
  'Ordered hierarchical document units inside a Space. The Space itself is the root context.';
comment on table public.workspace_resources is
  'Explicit user-owned references from one Project or Space to canonical resources. Resources are referenced, not copied.';
comment on column public.spaces.data is
  'Legacy canvas payload kept for visual compatibility. New document structure lives in space_sections and explicit references in workspace_resources.';
