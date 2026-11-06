import { supabase } from '../../utils/supabase';
import { compararArticulos, nombreDecreto, numeroDeDecreto } from './buscadorLegal';

/**
 * El estado real de cada decreto del Congreso, desde la biblioteca legal.
 *
 * Que el pleno aprobara un decreto no lo hace vigente: puede estar vetado,
 * pendiente de sanción o con vigencia diferida. El estado sale de la ficha de
 * la ley (`normas.estado`); si el decreto no tiene ficha, el estado queda sin
 * confirmar, nunca «vigente» por defecto. Las reformas que aplica salen de lo
 * que la biblioteca ya consolidó (`reformas` aplicadas): no se deducen del
 * título.
 */

const NOMBRE = {
  vigente: 'vigente',
  reformada: 'vigente · reformada',
  vetado: 'vetada',
  derogada: 'derogada',
  pendiente_sancion: 'pendiente de sanción',
  vigencia_diferida: 'vigencia diferida',
};

/** El nombre del estado, o «estado sin confirmar» si no hay ficha. */
export const nombreDelEstado = (estado) => NOMBRE[estado] || (estado ? estado.replace(/_/g, ' ') : 'estado sin confirmar');

/** Lo que hace falta de la biblioteca, en dos consultas. */
export async function traerBiblioteca() {
  const normas = [];
  for (let desde = 0; ; desde += 500) {
    const { data, error } = await supabase.from('normas').select('id, titulo, decreto, estado, indexado').order('id').range(desde, desde + 499);
    if (error) throw error;
    normas.push(...(data || []));
    if ((data || []).length < 500) break;
  }
  const { data: reformas, error } = await supabase.from('reformas').select('decreto_id, norma_destino_id, numero_destino').eq('estado', 'aplicada');
  if (error) throw error;
  return { normas, reformas: reformas || [] };
}

/**
 * Para cada número de decreto («26-2026»): su ficha, su estado y las leyes
 * que cambió, con sus artículos. Una ley que otros decretos ya reformaron se
 * dice «reformada».
 */
export function indexarBiblioteca({ normas = [], reformas = [] } = {}) {
  const porId = new Map(normas.map((n) => [n.id, n]));
  const reformadas = new Set(reformas.map((r) => r.norma_destino_id).filter(Boolean));
  const cambios = new Map();
  for (const r of reformas) {
    if (!r.decreto_id || !r.norma_destino_id || !porId.has(r.norma_destino_id)) continue;
    const delDecreto = cambios.get(r.decreto_id) || new Map();
    const ley = delDecreto.get(r.norma_destino_id) || { norma: porId.get(r.norma_destino_id), articulos: [] };
    if (r.numero_destino && !ley.articulos.includes(r.numero_destino)) ley.articulos.push(r.numero_destino);
    delDecreto.set(r.norma_destino_id, ley);
    cambios.set(r.decreto_id, delDecreto);
  }
  const porNumero = new Map();
  for (const n of normas) {
    const numero = numeroDeDecreto(n.decreto);
    if (!numero || porNumero.has(numero)) continue;
    const estado = n.estado === 'vigente' && reformadas.has(n.id) ? 'reformada' : n.estado;
    const leyes = [...(cambios.get(n.id)?.values() || [])].map((l) => ({
      ...l,
      nombre: l.norma.titulo || nombreDecreto(l.norma.decreto),
      articulos: [...l.articulos].sort(compararArticulos),
    }));
    porNumero.set(numero, { norma: n, estado, cambia: leyes });
  }
  return porNumero;
}

/** «arts. 327 B, 327 F y 327 G», o «art. 5». */
export function articulosDichos(articulos) {
  if (!articulos?.length) return null;
  if (articulos.length === 1) return `art. ${articulos[0]}`;
  return `arts. ${articulos.slice(0, -1).join(', ')} y ${articulos[articulos.length - 1]}`;
}
