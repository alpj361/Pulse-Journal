-- Mirror of the security migration applied through Supabase MCP.
-- Copy this file into ExtractorW/migrations when SSH access is restored.

alter function public.set_spaces_updated_at()
  set search_path = pg_catalog, public;

revoke all on function public.set_spaces_updated_at() from public;
revoke all on function public.set_spaces_updated_at() from anon;
revoke all on function public.set_spaces_updated_at() from authenticated;

revoke all on function public.espacio_contexto(uuid) from public;
revoke all on function public.espacio_derivar(uuid) from public;
revoke all on function public.espacios_buscar(uuid, text, integer) from public;
revoke all on function public.espacios_de_item(uuid, uuid) from public;
revoke all on function public.espacios_reindexar(uuid) from public;
revoke all on function public.espacios_relacionados(uuid, integer) from public;
revoke all on function public.sync_espacio_indice() from public;
revoke all on function public.sync_espacios_de_item() from public;

grant execute on function public.espacio_contexto(uuid) to service_role;
grant execute on function public.espacio_derivar(uuid) to service_role;
grant execute on function public.espacios_buscar(uuid, text, integer) to service_role;
grant execute on function public.espacios_de_item(uuid, uuid) to service_role;
grant execute on function public.espacios_reindexar(uuid) to service_role;
grant execute on function public.espacios_relacionados(uuid, integer) to service_role;
grant execute on function public.sync_espacio_indice() to service_role;
grant execute on function public.sync_espacios_de_item() to service_role;
