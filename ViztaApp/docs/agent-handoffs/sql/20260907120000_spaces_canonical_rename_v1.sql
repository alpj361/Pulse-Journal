-- Mirror of the migration applied through Supabase MCP.
-- The canonical data model is `spaces`; `free_canvases` remains only as a
-- temporary, updatable compatibility view for clients not yet migrated.
-- Copy this file into ExtractorW/migrations when SSH access is restored.

alter table public.free_canvases rename to spaces;

alter table public.spaces
  rename constraint free_canvases_pkey to spaces_pkey;
alter table public.spaces
  rename constraint free_canvases_user_id_fkey to spaces_user_id_fkey;
alter table public.spaces
  rename constraint free_canvases_project_id_fkey to spaces_project_id_fkey;

alter index public.free_canvases_project_id_idx
  rename to spaces_project_id_idx;
alter index public.free_canvases_user_id_updated_at_idx
  rename to spaces_user_id_updated_at_idx;

alter trigger set_free_canvases_updated_at on public.spaces
  rename to set_spaces_updated_at;
alter function public.set_free_canvases_updated_at()
  rename to set_spaces_updated_at;

alter policy "Users can view own canvases" on public.spaces
  rename to "Users can view own spaces";
alter policy "Users can insert own canvases" on public.spaces
  rename to "Users can insert own spaces";
alter policy "Users can update own canvases" on public.spaces
  rename to "Users can update own spaces";
alter policy "Users can delete own canvases" on public.spaces
  rename to "Users can delete own spaces";

create unique index if not exists projects_id_user_id_uidx
  on public.projects (id, user_id);

alter table public.spaces
  drop constraint spaces_project_id_fkey;

alter table public.spaces
  add constraint spaces_project_owner_fkey
  foreign key (project_id, user_id)
  references public.projects (id, user_id)
  on update cascade
  on delete set null (project_id);

comment on table public.spaces is
  'Canonical user-owned workspaces. A space may be independent or belong to one project owned by the same user.';
comment on column public.spaces.project_id is
  'Optional parent project. Same-user ownership is enforced by spaces_project_owner_fkey.';
comment on column public.spaces.data is
  'Legacy canvas document payload. Its content, sections and resource links will be normalized incrementally in tasks 3.2 and 3.3.';

revoke all on table public.spaces from anon;
revoke all on table public.spaces from authenticated;
grant select, insert, update, delete on table public.spaces to authenticated;
grant all on table public.spaces to service_role;

create view public.free_canvases
with (security_invoker = true)
as
select
  id,
  user_id,
  name,
  data,
  created_at,
  updated_at,
  project_id
from public.spaces
with local check option;

comment on view public.free_canvases is
  'DEPRECATED compatibility view. New clients and agents must use public.spaces.';

revoke all on table public.free_canvases from anon;
revoke all on table public.free_canvases from authenticated;
grant select, insert, update, delete on table public.free_canvases to authenticated;
grant select, insert, update, delete on table public.free_canvases to service_role;
