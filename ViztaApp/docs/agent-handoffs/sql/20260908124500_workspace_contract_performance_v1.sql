-- Tasks 3.2/3.3: covering indexes and RLS init-plan improvements reported by Supabase Advisor.

create index spaces_project_owner_idx
  on public.spaces (project_id, user_id);

create index space_sections_space_owner_idx
  on public.space_sections (space_id, user_id);

create index space_sections_parent_owner_idx
  on public.space_sections (parent_id, space_id, user_id);

create index workspace_resources_project_owner_idx
  on public.workspace_resources (project_id, user_id);

create index workspace_resources_space_owner_idx
  on public.workspace_resources (space_id, user_id);

drop policy "Users can view own spaces" on public.spaces;
drop policy "Users can insert own spaces" on public.spaces;
drop policy "Users can update own spaces" on public.spaces;
drop policy "Users can delete own spaces" on public.spaces;

create policy "Users can view own spaces"
on public.spaces for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own spaces"
on public.spaces for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own spaces"
on public.spaces for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own spaces"
on public.spaces for delete to authenticated
using ((select auth.uid()) = user_id);
