-- Dataset contract function privileges.
-- Trigger functions are internal only; RLS helpers are callable only by signed-in users.

revoke all on function public.sync_legacy_dataset_contract() from public, anon, authenticated;
revoke all on function public.validate_dataset_codex_link() from public, anon, authenticated;
revoke all on function public.validate_dataset_field_binding() from public, anon, authenticated;
revoke all on function public.sync_dataset_row_to_legacy_json() from public, anon, authenticated;
revoke all on function public.sync_codex_item_to_dataset_rows() from public, anon, authenticated;

revoke all on function public.dataset_is_owned(uuid) from public, anon;
revoke all on function public.dataset_is_visible(uuid) from public, anon;
grant execute on function public.dataset_is_owned(uuid) to authenticated;
grant execute on function public.dataset_is_visible(uuid) to authenticated;
