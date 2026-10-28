-- Explicit role grants existed in addition to the PUBLIC grant.
-- Remove direct anon/authenticated execution from internal space functions.

revoke all on function public.espacio_contexto(uuid) from anon, authenticated;
revoke all on function public.espacio_derivar(uuid) from anon, authenticated;
revoke all on function public.espacios_buscar(uuid, text, integer) from anon, authenticated;
revoke all on function public.espacios_de_item(uuid, uuid) from anon, authenticated;
revoke all on function public.espacios_reindexar(uuid) from anon, authenticated;
revoke all on function public.espacios_relacionados(uuid, integer) from anon, authenticated;
revoke all on function public.sync_espacio_indice() from anon, authenticated;
revoke all on function public.sync_espacios_de_item() from anon, authenticated;
