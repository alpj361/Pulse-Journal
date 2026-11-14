import { supabase } from '../../utils/supabase';

/**
 * Los datos de una vista de Vizta.
 *
 * Una pieza no trae el nombre ni la foto de nadie escritos a mano: trae el id
 * del Codex, y lo demás se lee acá al abrirla. Así un agente que no conoce a
 * la persona no puede inventar a un actor, y si la ficha cambia (otra foto, un
 * cargo nuevo), la vista ya sale al día.
 */

const COLUMNAS = 'id, name, tipo, description, details, thumbnail_url, tags';

/** Los ids de una lista que mezcla ids sueltos y objetos con `id` (lo que trae un Query). */
export function idsDe(lista) {
  const out = [];
  for (const x of Array.isArray(lista) ? lista : []) {
    const id = typeof x === 'string' ? x : x && typeof x === 'object' ? x.id : null;
    if (typeof id === 'string' && id && !out.includes(id)) out.push(id);
  }
  return out;
}

/** Los items por id, en el orden pedido. Los que no existen o no se ven, no salen. */
export async function traerItems(ids) {
  if (!ids?.length) return [];
  const { data, error } = await supabase.from('codex_universe_items').select(COLUMNAS).in('id', ids);
  if (error) throw error;
  const por = new Map((data || []).map((it) => [it.id, it]));
  return ids.map((id) => por.get(id)).filter(Boolean);
}

/** Buscar en el Codex: por tipo, texto en el nombre o la descripción, y etiqueta. */
export async function buscarItems({ tipo, texto, etiqueta, limite = 40 } = {}) {
  let q = supabase.from('codex_universe_items').select(COLUMNAS).limit(Math.min(Number(limite) || 40, 100));
  if (tipo) q = q.eq('tipo', tipo);
  if (etiqueta) q = q.contains('tags', [etiqueta]);
  const t = String(texto || '').replace(/[%,()]/g, ' ').trim();
  if (t) q = q.or(`name.ilike.%${t}%,description.ilike.%${t}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** Las relaciones de un item, con el otro extremo resuelto. */
export async function traerRelaciones(id) {
  const { data, error } = await supabase
    .from('codex_relations')
    .select('id, subject_id, verb, object_id, note, date')
    .or(`subject_id.eq.${id},object_id.eq.${id}`)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  const rels = data || [];
  const otros = await traerItems(idsDe(rels.map((r) => (r.subject_id === id ? r.object_id : r.subject_id))));
  const por = new Map(otros.map((o) => [o.id, o]));
  return rels
    .map((r) => {
      const sale = r.subject_id === id;
      const otro = por.get(sale ? r.object_id : r.subject_id);
      return otro ? { id: r.id, verbo: verboLegible(r.verb), sale, otro, fecha: r.date || null } : null;
    })
    .filter(Boolean);
}

// ─── Lectura de una ficha ───────────────────────────────────────────────────

/** «secretario_general_de» → «secretario general de». */
export const verboLegible = (v) => String(v || '').replace(/_/g, ' ').trim();

/**
 * El nombre para debajo de una foto. El Codex guarda «Roberto Arzú
 * García-Granados (Roberto Arzú)»: el paréntesis es el nombre por el que se
 * le conoce. En una entidad el paréntesis es la sigla, y la sigla es lo corto.
 */
export function nombreCorto(item) {
  const nombre = String(item?.name || '').trim();
  const m = nombre.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (m) return m[2].trim() || m[1].trim();
  // «Vamos por una Guatemala Diferente - VAMOS»: la sigla va después del guion.
  const sigla = nombre.match(/^.+\s[-–]\s([A-ZÁÉÍÓÚÑ0-9]{2,12})$/);
  return sigla ? sigla[1] : nombre;
}

/** Lo de una ficha que se lee como texto: un ref es su nombre. */
function valor(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map(valor).filter(Boolean).join(', ') || null;
  if (typeof v === 'object') return valor(v.name || v.nombre || v.value || null);
  return null;
}

export const cargoDe = (item) => valor(item?.details?.Cargo) || valor(item?.details?.cargo);

/** El partido de un actor: su sigla si la tiene. */
export function partidoDe(item) {
  const nombre = valor(item?.details?.Partido) || valor(item?.details?.partido) || valor(item?.details?.Afiliación);
  return nombre ? nombreCorto({ name: nombre }) : null;
}

/** Grupos para una cuadrícula: por partido o por tipo; lo que no tiene, al final. */
export function agrupar(items, por) {
  if (!por) return [{ nombre: null, items }];
  const clave = por === 'partido' ? partidoDe : (it) => it.tipo || null;
  const grupos = new Map();
  for (const it of items) {
    const k = clave(it) || null;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(it);
  }
  const conNombre = [...grupos.entries()].filter(([k]) => k).sort((a, b) => b[1].length - a[1].length);
  const sin = grupos.get(null);
  return [...conNombre.map(([nombre, its]) => ({ nombre, items: its })), ...(sin ? [{ nombre: por === 'partido' ? 'Sin partido' : 'Otros', items: sin }] : [])];
}
