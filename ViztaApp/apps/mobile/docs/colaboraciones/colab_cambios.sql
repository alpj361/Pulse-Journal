-- Avisos en vivo de lo que cambia un agente, para el humano dueño.
-- Aplicado en Supabase (qqshdccpmypelhmyqnut) el 2026-10-27 como
-- `colab_cambios_tabla` y `colab_cambios_trigger_*`. Se guarda acá como registro.
--
-- Las filas del agente (visible_humano = false) no le llegan al humano por
-- Realtime por RLS. Esta tabla solo dice "qué cambió", sin contenido; la app
-- (utils/enVivo.js) la escucha y vuelve a pedir los Espacios y el Codex del agente.

create table if not exists public.colab_cambios (
  id bigint generated always as identity primary key,
  humano_id uuid not null,
  agente_id uuid not null,
  tabla text not null,
  recurso_id uuid,
  tipo text not null,
  created_at timestamptz not null default now()
);
create index if not exists colab_cambios_humano_idx on public.colab_cambios (humano_id, created_at desc);
create index if not exists colab_cambios_created_idx on public.colab_cambios (created_at);
alter table public.colab_cambios enable row level security;
drop policy if exists colab_cambios_leer on public.colab_cambios;
create policy colab_cambios_leer on public.colab_cambios
  for select to authenticated using (humano_id = (select auth.uid()));

create or replace function public.colab_avisar_cambio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fila jsonb;
  v_agente uuid;
  v_humano uuid;
begin
  fila := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  if tg_table_name = 'artifacts' then
    if fila->>'dueno_tipo' is distinct from 'agente' then return null; end if;
    v_agente := (fila->>'dueno_id')::uuid;
  else
    if fila->>'cuenta_tipo' is distinct from 'agente' then return null; end if;
    v_agente := (fila->>'cuenta_id')::uuid;
  end if;
  if v_agente is null then return null; end if;
  select humano_id into v_humano from agent_accounts where id = v_agente;
  if v_humano is null then return null; end if;
  insert into colab_cambios (humano_id, agente_id, tabla, recurso_id, tipo)
  values (v_humano, v_agente, tg_table_name, (fila->>'id')::uuid, tg_op);
  -- De vez en cuando se barre lo viejo: solo sirve para avisar al momento.
  if random() < 0.01 then
    delete from colab_cambios where created_at < now() - interval '1 day';
  end if;
  return null;
exception when others then
  -- Un aviso que falla nunca frena lo que el agente guarda.
  return null;
end;
$$;
revoke all on function public.colab_avisar_cambio() from public, anon, authenticated;
alter publication supabase_realtime add table public.colab_cambios;

-- Cada trigger se aplicó por separado, con lock_timeout, para no trabarse con
-- el indexador que escribe en las mismas tablas.
create trigger colab_avisar_cambio after insert or update or delete on public.spaces
  for each row execute function public.colab_avisar_cambio();
create trigger colab_avisar_cambio after insert or update or delete on public.artifacts
  for each row execute function public.colab_avisar_cambio();
create trigger colab_avisar_cambio after insert or update or delete on public.codex_items
  for each row execute function public.colab_avisar_cambio();
create trigger colab_avisar_cambio after insert or update or delete on public.codex_universe_items
  for each row execute function public.colab_avisar_cambio();
