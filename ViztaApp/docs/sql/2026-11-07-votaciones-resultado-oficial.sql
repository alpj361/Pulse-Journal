-- Resultado de las votaciones desde fuentes oficiales (PJ, 7-nov-2026).
--
-- Antes: NewsCron daba por aprobada una votación solo con 81 votos a favor
-- (datacinco.js y poder_ciudadano/votaciones_pc.mjs). Un orden del día con 33 a
-- favor y quórum reducido quedaba «no aprobada».
--
-- Ahora: las cifras las cargan los scrapers; el resultado lo pone esta función,
-- con su fuente en `resultado_fuente`. Sin fuente, queda NULL («sin confirmar»).
-- No toca votos_diputado.
--
-- Correr entero en el editor SQL de Supabase (proyecto qqshdccpmypelhmyqnut).

alter table public.votaciones add column if not exists resultado_fuente text;
alter table public.votaciones drop constraint if exists votaciones_resultado_fuente_check;
alter table public.votaciones add constraint votaciones_resultado_fuente_check
  check (resultado_fuente is null or resultado_fuente in ('pc_mocion', 'pc_agenda', 'dos_tercios', 'manual'));
comment on column public.votaciones.resultado_fuente is
  'De dónde sale resultado: pc_mocion (pc_sesion_mociones.resultado), pc_agenda (puntos_hechos del capítulo de agenda de PC, para el acta), dos_tercios (107 o más a favor: alcanza cualquier mayoría), manual. NULL = sin resultado confirmado; nunca se deduce de 81.';

create or replace function public.votaciones_resultado_oficial()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- 1. Mociones y propuestas: el resultado que publica Poder Ciudadano.
  update votaciones v
     set resultado = case when lower(m.resultado) ~ '^aprobad' then 'aprobada' else 'no_aprobada' end,
         resultado_fuente = 'pc_mocion'
    from pc_sesion_mociones m
   where m.votacion_id = v.id
     and lower(coalesce(m.resultado, '')) ~ '^(aprobad|rechazad|improbad|no aprobad)'
     and coalesce(v.resultado_fuente, '') <> 'manual'
     and (v.resultado is distinct from case when lower(m.resultado) ~ '^aprobad' then 'aprobada' else 'no_aprobada' end
          or v.resultado_fuente is distinct from 'pc_mocion');

  -- La iniciativa de la que trata una moción (retorno a comisión, alterar el
  -- orden del día para conocerla): así se muestra con su ley, no como trámite.
  update votaciones v
     set iniciativa_numero = (substring(m.propuesta from '(?i)iniciativa\s+(\d{3,5})'))::int
    from pc_sesion_mociones m
   where m.votacion_id = v.id
     and v.iniciativa_numero is null
     and substring(m.propuesta from '(?i)iniciativa\s+(\d{3,5})') is not null
     and exists (select 1 from iniciativas i where i.numero = (substring(m.propuesta from '(?i)iniciativa\s+(\d{3,5})'))::int);

  -- 2. El acta: el punto de agenda del acta y lo que PC anota que pasó con él
  --    («aprobada», «improbada»). Solo si ese día hay una sola votación de acta.
  with acta as (
    select n.fecha,
           lower(c.extra->'puntos_hechos'->>(a->>'punto')) as hecho
      from pc_sesion_narrativa n
      join pc_sesion_capitulos c on c.pc_sesion_id = n.pc_sesion_id and c.extra ? 'puntos_hechos'
      cross join lateral jsonb_array_elements(case when jsonb_typeof(n.agenda_aprobada) = 'array' then n.agenda_aprobada else '[]'::jsonb end) a
     where a->>'texto' ~* 'acta'
  ), unica as (
    select fecha, min(id::text)::uuid as id
      from votaciones
     where asunto ~* 'aprobaci[oó]n (del|de las?) actas?'
     group by fecha having count(*) = 1
  )
  update votaciones v
     set resultado = case when acta.hecho ~ '^aprobad' then 'aprobada' else 'no_aprobada' end,
         resultado_fuente = 'pc_agenda'
    from acta join unica using (fecha)
   where v.id = unica.id
     and acta.hecho ~ '^(aprobad|improbad|rechazad)'
     and coalesce(v.resultado_fuente, '') in ('', 'pc_agenda', 'dos_tercios');

  -- 3. 107 o más a favor alcanza cualquier mayoría que pida la ley.
  update votaciones
     set resultado = 'aprobada', resultado_fuente = 'dos_tercios'
   where resultado_fuente is null and a_favor >= 107
     and resultado is distinct from 'aprobada';
  update votaciones set resultado_fuente = 'dos_tercios'
   where resultado_fuente is null and a_favor >= 107 and resultado = 'aprobada';

  -- 4. Lo demás no tiene resultado confirmado: no se deduce de 81 ni de quién tuvo más.
  update votaciones set resultado = null
   where resultado_fuente is null and resultado is not null;
end;
$fn$;

revoke all on function public.votaciones_resultado_oficial() from public, anon, authenticated;

-- Se recalcula sola cuando llegan votaciones, mociones o capítulos de PC.
create or replace function public.votaciones_resultado_oficial_trigger()
returns trigger language plpgsql security definer set search_path = public as $tg$
begin
  perform public.votaciones_resultado_oficial();
  return null;
end;
$tg$;
revoke all on function public.votaciones_resultado_oficial_trigger() from public, anon, authenticated;

drop trigger if exists votaciones_resultado_al_insertar on public.votaciones;
create trigger votaciones_resultado_al_insertar after insert on public.votaciones
  for each statement execute function public.votaciones_resultado_oficial_trigger();
drop trigger if exists votaciones_resultado_por_mociones on public.pc_sesion_mociones;
create trigger votaciones_resultado_por_mociones after insert or update on public.pc_sesion_mociones
  for each statement execute function public.votaciones_resultado_oficial_trigger();
drop trigger if exists votaciones_resultado_por_capitulos on public.pc_sesion_capitulos;
create trigger votaciones_resultado_por_capitulos after insert or update on public.pc_sesion_capitulos
  for each statement execute function public.votaciones_resultado_oficial_trigger();

-- Sesión 56 (3-nov-2026): el orden del día con la propuesta incorporada (33-25)
-- se aprobó con quórum reducido según Poder Ciudadano; no tiene fuente
-- estructurada, así que va como manual.
update public.votaciones set resultado = 'aprobada', resultado_fuente = 'manual'
 where id = '7270504d-bc41-4219-8320-4b4fe559a2a0';

select public.votaciones_resultado_oficial();

-- Para revisar: la sesión 56 debe quedar con la propuesta, el orden del día y el
-- acta aprobados; la moción para alterar el orden del día rechazada (con la
-- iniciativa 6509) y el retorno a comisión aprobado (con la iniciativa 5906).
select asunto, a_favor, en_contra, resultado, resultado_fuente, iniciativa_numero
  from public.votaciones where fecha = '2026-11-03' and (iniciativa_numero is null or iniciativa_numero <> 6347)
 order by created_at;
