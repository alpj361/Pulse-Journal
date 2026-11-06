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
    const { data, error } = await supabase.from('normas').select('id, titulo, decreto, estado, indexado, fecha_vigencia').order('id').range(desde, desde + 499);
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

// ─── El camino de un decreto ─────────────────────────────────────────────────

const limpio = (n) => String(n || '').replace(/^decreto\s+/i, '').replace(/\s+/g, '');

/** Las iniciativas de las que nació un decreto, y sus eventos juntos. */
export function delDecreto(numero, iniciativas = []) {
  const n = limpio(numero);
  const suyas = n ? iniciativas.filter((i) => limpio(i.decreto_resultante) === n) : [];
  return { iniciativas: suyas, eventos: suyas.flatMap((i) => i.eventos_timeline || []) };
}

/** La fecha de un paso: la de fuente oficial antes que la de prensa, y la primera. */
function fechaDe(eventos, tipo) {
  const de = eventos.filter((e) => e.tipo === tipo && e.fecha).sort((a, b) =>
    (a.fuente_tipo === 'noticia') - (b.fuente_tipo === 'noticia') || String(a.fecha).localeCompare(String(b.fecha)));
  return de[0] ? { fecha: String(de[0].fecha).slice(0, 10), prensa: de[0].fuente_tipo === 'noticia' } : null;
}

const VIGOR = new Set(['vigente', 'reformada', 'derogada']);
const PUBLICADA = new Set(['vigente', 'reformada', 'derogada', 'vigencia_diferida']);

/**
 * Por dónde va un decreto, del pleno a su vigencia: aprobado, en manos del
 * Ejecutivo, sancionado (o vetado), publicado en el Diario de Centro América
 * y en vigor. Cada paso dice si ya pasó y su fecha, si consta. Un paso
 * posterior que ya pasó da por pasados los anteriores. Un decreto vetado
 * termina en el veto.
 *
 * Devuelve { pasos, actual, vetado, explicacion }.
 */
export function caminoDelDecreto({ eventos = [], estado = null, fechaVigencia = null, hoy = new Date().toISOString().slice(0, 10) } = {}) {
  const aprobado = fechaDe(eventos, 'aprobada');
  const enviado = fechaDe(eventos, 'pendiente_sancion');
  const sancionado = fechaDe(eventos, 'sancionada');
  const vetado = fechaDe(eventos, 'vetada') || (estado === 'vetado' ? {} : null);
  const enVigor = VIGOR.has(estado) || (estado === 'vigencia_diferida' && fechaVigencia && fechaVigencia <= hoy);
  const publicado = PUBLICADA.has(estado);

  const pasos = [
    { clave: 'aprobado', nombre: 'aprobado', ...aprobado, hecho: true },
    { clave: 'ejecutivo', nombre: 'al Ejecutivo', ...enviado, hecho: !!enviado },
  ];
  if (vetado) {
    pasos.push({ clave: 'vetado', nombre: 'vetado', ...vetado, hecho: true, veto: true });
  } else {
    pasos.push(
      { clave: 'sancionado', nombre: 'sancionado', ...sancionado, hecho: !!sancionado },
      { clave: 'publicado', nombre: 'publicado', hecho: publicado },
      { clave: 'vigor', nombre: 'en vigor', fecha: fechaVigencia || null, hecho: !!enVigor },
    );
  }
  // Lo que ya pasó después dice que lo de antes también pasó.
  for (let i = pasos.length - 2; i >= 0; i -= 1) if (pasos[i + 1].hecho) pasos[i].hecho = true;
  const actual = vetado ? pasos.length - 1 : Math.max(0, pasos.findIndex((p) => !p.hecho));
  return { pasos, actual: pasos.every((p) => p.hecho) && !vetado ? pasos.length - 1 : actual, vetado: !!vetado, explicacion: explicar(pasos, { vetado, estado, fechaVigencia, enVigor }) };
}

const dia = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' });

/** Lo que significa el paso en que va, en una oración. */
function explicar(pasos, { vetado, estado, fechaVigencia, enVigor }) {
  if (vetado) return 'El Ejecutivo lo vetó. Vuelve al Congreso, que puede aceptar el veto o superarlo con dos tercios de los votos.';
  if (estado === 'derogada') return 'Ya no está vigente: otra ley la derogó.';
  if (enVigor) return fechaVigencia ? `Vigente desde el ${dia(fechaVigencia)}.` : 'Vigente.';
  if (estado === 'vigencia_diferida') return fechaVigencia ? `Ya se publicó; entra en vigor el ${dia(fechaVigencia)}.` : 'Ya se publicó; entra en vigor en la fecha que fija el decreto.';
  const sancionado = pasos.find((p) => p.clave === 'sancionado')?.hecho;
  if (sancionado) return 'Sancionado. Entra en vigor cuando se publique en el Diario de Centro América, en el plazo que fija el decreto.';
  const enviado = pasos.find((p) => p.clave === 'ejecutivo');
  if (enviado?.fecha) return `En manos del Ejecutivo desde el ${dia(enviado.fecha)}: tiene 15 días para sancionarlo o vetarlo.`;
  return 'Aprobado por el pleno. Cuando lo recibe el Ejecutivo, tiene 15 días para sancionarlo o vetarlo.';
}
