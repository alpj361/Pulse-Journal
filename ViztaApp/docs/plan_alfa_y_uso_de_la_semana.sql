-- PENDIENTE DE APLICAR (2026-10-13). Proyecto Supabase qqshdccpmypelhmyqnut.
--
-- 1. Plan «Alfa»: los mismos cupos y funciones del semanal, sin nada que renovar.
--    Los cupos por semana se reinician solos (usage_counters cuenta por periodo).
-- 2. Una cuenta Alfa no cae al plan gratis.
-- 3. Todas las cuentas Alfa pasan al plan Alfa.
-- 4. get_my_usage devuelve además lo gastado en la semana (`semana`, `reinicia`).
--
-- No borra nada. Se puede correr más de una vez.

insert into public.plans (plan_key, version, display_name, limits, features, is_active)
select 'alpha', 1, 'Alfa', w.limits, w.features, true
from public.plans w
where w.plan_key = 'weekly' and w.version = 1
  and not exists (select 1 from public.plans a where a.plan_key = 'alpha' and a.version = 1);

-- Si algo manda una cuenta Alfa al plan gratis (una suscripción de prueba que
-- vence: el webhook de RevenueCat pone 'free'), vuelve al plan Alfa.
create or replace function public.alfa_conserva_su_plan()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_alfa uuid;
begin
  if new.user_type = 'Alpha' then
    select id into v_alfa from public.plans
    where plan_key = 'alpha' and is_active order by version desc limit 1;
    if v_alfa is not null and (
      new.plan_id is null
      or exists (select 1 from public.plans p where p.id = new.plan_id and p.plan_key = 'free')
    ) then
      new.plan_id := v_alfa;
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger alfa_conserva_su_plan
before insert or update of plan_id, user_type on public.profiles
for each row execute function public.alfa_conserva_su_plan();

update public.profiles pr
set plan_id = (select id from public.plans where plan_key = 'alpha' and is_active order by version desc limit 1)
where pr.user_type = 'Alpha';

-- El uso: los totales de siempre (`areas`) y lo que se gasta por semana (`semana`).
create or replace function public.get_my_usage()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid       uuid := auth.uid();
  v_admin     boolean;
  v_limits    jsonb;
  v_features  jsonb;
  v_tope      bigint;
  v_posts     bigint := 0;
  v_espacios  bigint;
  v_bytes     bigint;
  v_hay_posts boolean;
  v_areas     jsonb := '[]'::jsonb;
  v_periodo   jsonb := '[]'::jsonb;
  v_reinicia  timestamptz;
  r           record;
  v_ini       timestamptz;
  v_fin       timestamptz;
  v_usado     bigint;
begin
  if v_uid is null then
    return null;
  end if;

  select (pr.role = 'admin' or 'admin' = any(coalesce(pr.roles, '{}'))),
         p.limits || coalesce(pl.overrides -> 'limits', '{}'::jsonb),
         p.features || coalesce(pl.overrides -> 'features', '{}'::jsonb)
    into v_admin, v_limits, v_features
  from public.profiles pr
  left join public.plans p on p.id = pr.plan_id
  left join public.profile_limits pl on pl.user_id = pr.id
  where pr.id = v_uid;

  if not found then
    return null;
  end if;
  -- Los admins también tienen límites: se calcula como para cualquiera.
  v_admin := false;

  v_hay_posts := coalesce(v_admin, false)
    or coalesce(v_features -> 'posts.saved' ->> 'availability', 'disabled') = 'enabled'
    or public.credit_balance(v_uid) > 0;

  -- Cuántos posts hay guardados, no cuántos se agregaron hoy: las otras dos
  -- filas (espacios, almacenamiento) son totales, y una tasa disfrazada de
  -- total se lee como un error —una biblioteca de 77 posts mostrando «0»—.
  if v_hay_posts then
    select count(*) into v_posts
    from public.codex_universe_items
    where user_id = v_uid and lower(tipo) = 'post';

    v_tope := nullif(v_limits -> 'posts.total' ->> 'value', '')::bigint;

    v_areas := v_areas || jsonb_build_array(jsonb_build_object(
      'clave', 'posts', 'usado', v_posts,
      'limite', case when coalesce(v_admin, false) then null else v_tope end,
      'porcentaje', case when coalesce(v_admin, false) or v_tope is null then null
                         else least(100, round(v_posts * 100.0 / greatest(1, v_tope))) end));
  end if;

  select count(*) into v_espacios from public.spaces where user_id = v_uid;

  select coalesce(sum((metadata ->> 'size')::bigint), 0) into v_bytes
  from storage.objects
  where bucket_id = 'digitalstorage' and name like v_uid::text || '/%';

  v_areas := v_areas || jsonb_build_array(
    jsonb_build_object(
      'clave', 'espacios', 'usado', v_espacios,
      'limite', case when coalesce(v_admin, false) then null else nullif(v_limits -> 'spaces.total' ->> 'value', '')::bigint end,
      'porcentaje', case when coalesce(v_admin, false) or (v_limits -> 'spaces.total' ->> 'value') is null then null
                         else least(100, round(v_espacios * 100.0 / greatest(1, (v_limits -> 'spaces.total' ->> 'value')::bigint))) end),
    jsonb_build_object(
      'clave', 'almacenamiento', 'usado', v_bytes,
      'limite', case when coalesce(v_admin, false) then null else nullif(v_limits -> 'storage.bytes' ->> 'value', '')::bigint end,
      'porcentaje', case when coalesce(v_admin, false) or (v_limits -> 'storage.bytes' ->> 'value') is null then null
                         else least(100, round(v_bytes * 100.0 / greatest(1, (v_limits -> 'storage.bytes' ->> 'value')::bigint))) end)
  );

  -- Lo que se gasta y vuelve: los cupos por semana del plan, con lo usado en la
  -- semana que corre. A quien no los tiene (plan gratis) no le aparece nada.
  select lp.period_start, lp.resets_at into v_ini, v_fin from public._limit_period('week', now()) lp;

  for r in
    select k.clave, k.llave
    from (values
      ('posts', 'posts.add', 1),
      ('analisis', 'posts.analyses', 2),
      ('minutos', 'posts.transcription_minutes', 3),
      ('busquedas', 'search.web', 4),
      ('vizta', 'vizta.microusd', 5)
    ) as k(clave, llave, orden)
    where v_limits -> k.llave ->> 'period' = 'week'
      and nullif(v_limits -> k.llave ->> 'value', '') is not null
    order by k.orden
  loop
    select coalesce(max(uc.used), 0) into v_usado
    from public.usage_counters uc
    where uc.user_id = v_uid and uc.limit_key = r.llave and uc.period_start = v_ini;
    v_tope := (v_limits -> r.llave ->> 'value')::bigint;
    v_reinicia := v_fin;

    v_periodo := v_periodo || jsonb_build_array(jsonb_build_object(
      'clave', r.clave, 'usado', v_usado, 'limite', v_tope,
      'porcentaje', least(100, round(v_usado * 100.0 / greatest(1, v_tope)))));
  end loop;

  return jsonb_build_object(
    'admin', coalesce(v_admin, false),
    'areas', v_areas,
    'semana', v_periodo,
    'reinicia', v_reinicia);
end;
$function$;
