-- Keep the private chunk index backend-only while making its intended service
-- access explicit to the database linter.

create policy workspace_memory_chunks_service_all
on public.workspace_memory_chunks
for all
to service_role
using (true)
with check (true);
