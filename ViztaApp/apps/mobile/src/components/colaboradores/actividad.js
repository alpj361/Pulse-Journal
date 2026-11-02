import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { escuchar } from '../../utils/enVivo';
import { supabase } from '../../utils/supabase';
import { enMarcha } from './logica';

/**
 * Lo que hacen los agentes, visto desde la app.
 *
 * Cada herramienta que un agente usa por MCP queda en `actividad_cuenta`
 * (la anota el servidor, con `agente_id`, la acción —leer, crear, modificar,
 * borrar—, la herramienta y el id de lo que tocó). La persona dueña la puede
 * leer. De ahí salen dos cosas:
 *
 * - si el agente está trabajando ahora (algo en los últimos minutos, o una
 *   tarea en curso), para el diamante al lado de su nombre;
 * - qué hizo, para contarlo en el chat con un enlace a lo que creó o editó.
 */

/** Hasta cuánto después de su última acción se lo cuenta como trabajando. */
export const ACTIVO_MS = 2 * 60 * 1000;
/** Acciones seguidas del mismo tipo, a menos de esto, van juntas en una línea. */
export const JUNTAS_MS = 15 * 60 * 1000;

/** Los ids con que un agente puede aparecer: su cuenta y su fila de colaborador. */
export const idsDeAgente = (c) => (c?.cuenta_tipo === 'agente' ? [c.cuenta_id, c.id].filter(Boolean) : []);

export async function traerAgentesActivos(ahora = Date.now()) {
  const { data, error } = await supabase
    .from('actividad_cuenta')
    .select('agente_id')
    .not('agente_id', 'is', null)
    .gte('creado_at', new Date(ahora - ACTIVO_MS).toISOString())
    .limit(200);
  if (error) throw error;
  return [...new Set((data || []).map((f) => f.agente_id))];
}

/**
 * Si un agente está trabajando: hizo algo hace poco, o tiene una tarea en
 * curso que no quedó quieta. `tareas` es lo que trae su ficha (opcional).
 */
export function useTrabajando(colaborador, tareas) {
  const esAgente = colaborador?.cuenta_tipo === 'agente';
  const ids = idsDeAgente(colaborador);
  const clave = ids.join(',');
  // Lo que toca en vivo (`colab_cambios`) lo enciende al momento, sin esperar
  // a la próxima consulta; y se apaga solo cuando pasa la ventana.
  const [vivoHasta, setVivoHasta] = useState(0);
  const [, setReloj] = useState(0);
  useEffect(() => {
    if (!clave) return undefined;
    const mios = clave.split(',');
    return escuchar(['colab_cambios'], ({ fila }) => {
      if (fila?.agente_id && mios.includes(fila.agente_id)) setVivoHasta(Date.now() + ACTIVO_MS);
    });
  }, [clave]);
  useEffect(() => {
    const falta = vivoHasta - Date.now();
    if (falta <= 0) return undefined;
    const t = setTimeout(() => setReloj((n) => n + 1), falta + 50);
    return () => clearTimeout(t);
  }, [vivoHasta]);
  const { data } = useQuery({
    queryKey: ['colab-activos'],
    queryFn: () => traerAgentesActivos(),
    enabled: esAgente,
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
    retry: false,
  });
  if (!esAgente) return false;
  return vivoHasta > Date.now() || ids.some((id) => (data || []).includes(id)) || enMarcha(tareas?.haciendo_ahora);
}

// --- Lo que hizo -------------------------------------------------------------

const CLASE_DE_TABLA = {
  codex_universe_items: 'elemento',
  codex_items: 'elemento',
  spaces: 'espacio',
  artifacts: 'dashboard',
};

/** De cada id tocado, en qué tabla está y cómo se llama. */
async function resolverRecursos(ids) {
  const recursos = new Map();
  if (!ids.length) return recursos;
  const lote = ids.slice(0, 150);
  const [u, c, s, a] = await Promise.all([
    supabase.from('codex_universe_items').select('id, name, tipo').in('id', lote),
    supabase.from('codex_items').select('id, titulo, tipo').in('id', lote),
    supabase.from('spaces').select('id, name').in('id', lote),
    supabase.from('artifacts').select('id, titulo, tipo').in('id', lote),
  ]);
  for (const f of u.data || []) recursos.set(f.id, { tabla: 'codex_universe_items', titulo: f.name, tipo: f.tipo });
  for (const f of c.data || []) if (!recursos.has(f.id)) recursos.set(f.id, { tabla: 'codex_items', titulo: f.titulo, tipo: f.tipo });
  for (const f of s.data || []) recursos.set(f.id, { tabla: 'spaces', titulo: f.name });
  for (const f of a.data || []) recursos.set(f.id, { tabla: 'artifacts', titulo: f.titulo, tipo: f.tipo });
  return recursos;
}

/**
 * Una fila de actividad, contada: qué verbo, sobre qué clase de cosa y cuál.
 * Lo que no se puede nombrar ni abrir (leer, el propio chat, ids que ya no
 * existen) no se cuenta, salvo un borrado, que se dice sin enlace.
 */
export function accionDe(fila, recursos) {
  const recurso = fila.recurso_id ? recursos.get(fila.recurso_id) : null;
  const operacion = fila.detalle?.operacion || null;
  if (fila.accion === 'borrar') {
    return {
      id: fila.id,
      verbo: 'borrar',
      clase: recurso ? CLASE_DE_TABLA[recurso.tabla] : String(fila.recurso || '').includes('workspace') ? 'espacio' : 'elemento',
      ref: null,
      titulo: recurso?.titulo || null,
      en: fila.creado_at,
    };
  }
  if (!recurso) return null;
  const clase = CLASE_DE_TABLA[recurso.tabla];
  const verbo = operacion === 'add_item_to_space' ? 'sumar' : fila.accion === 'crear' ? 'crear' : 'editar';
  return {
    id: fila.id,
    verbo,
    clase,
    ref: { tabla: recurso.tabla, id: fila.recurso_id, tipo: recurso.tipo || null },
    titulo: recurso.titulo || null,
    en: fila.creado_at,
  };
}

/**
 * Las acciones en líneas para el chat, de la más vieja a la más nueva.
 *
 * Van juntas las seguidas del mismo verbo y la misma clase, a menos de
 * `JUNTAS_MS` una de otra y sin un mensaje en medio (`cortes`: las horas de
 * los mensajes). Dentro de una línea, cada cosa una sola vez; y editar algo
 * que acaba de crear no se cuenta aparte.
 */
export function agruparAcciones(acciones, cortes = []) {
  const orden = [...acciones].filter(Boolean).sort((a, b) => (a.en < b.en ? -1 : a.en > b.en ? 1 : 0));
  const creados = new Map();
  const grupos = [];
  for (const a of orden) {
    if (a.verbo === 'crear' && a.ref) creados.set(a.ref.id, Date.parse(a.en));
    if (a.verbo === 'editar' && a.ref && creados.has(a.ref.id) && Date.parse(a.en) - creados.get(a.ref.id) < JUNTAS_MS) continue;
    const ultimo = grupos[grupos.length - 1];
    const seguido = ultimo
      && ultimo.verbo === a.verbo
      && ultimo.clase === a.clase
      && Date.parse(a.en) - Date.parse(ultimo.hasta) < JUNTAS_MS
      && !cortes.some((t) => t > ultimo.hasta && t < a.en);
    if (seguido) {
      ultimo.hasta = a.en;
      const clave = a.ref?.id || a.id;
      if (!ultimo.cosas.some((c) => (c.ref?.id || c.id) === clave)) ultimo.cosas.push(a);
    } else {
      grupos.push({ id: `accion-${a.id}`, verbo: a.verbo, clase: a.clase, desde: a.en, hasta: a.en, cosas: [a] });
    }
  }
  return grupos;
}

const VERBOS = { crear: 'Creó', editar: 'Editó', borrar: 'Borró', sumar: 'Sumó' };
const PLURAL = { elemento: 'elementos', espacio: 'espacios', dashboard: 'dashboards' };

/** La línea de un grupo: «Creó 5 elementos en tu Codex», «Editó el espacio «Caso X»». */
export function textoDeGrupo(g) {
  const n = g.cosas.length;
  const verbo = VERBOS[g.verbo] || g.verbo;
  const una = g.cosas[0];
  const nombre = n === 1 && una.titulo ? `«${una.titulo}»` : null;
  const enCodex = g.clase === 'elemento' ? (g.verbo === 'borrar' ? ' de tu Codex' : ' en tu Codex') : '';
  if (g.verbo === 'sumar') return n === 1 ? `${verbo} ${nombre || 'un elemento'} a un espacio` : `${verbo} ${n} elementos a un espacio`;
  if (n > 1) return `${verbo} ${n} ${PLURAL[g.clase] || g.clase}${enCodex}`;
  if (g.clase === 'elemento') return `${verbo} ${nombre || 'un elemento'}${enCodex}`;
  return `${verbo} el ${g.clase}${nombre ? ` ${nombre}` : ''}`;
}

/** Lo que hizo un agente desde `desde`, ya en líneas. */
export async function traerAccionesDe(ids, desde) {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('actividad_cuenta')
    .select('id, accion, recurso, recurso_id, detalle, creado_at')
    .in('agente_id', ids)
    .in('accion', ['crear', 'modificar', 'borrar'])
    .gte('creado_at', desde)
    .order('creado_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  const filas = (data || []).filter((f) => f.detalle?.exito !== false);
  const recursos = await resolverRecursos([...new Set(filas.map((f) => f.recurso_id).filter(Boolean))]);
  return filas.map((f) => accionDe(f, recursos)).filter(Boolean);
}
