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
    const { data, error } = await supabase.from('normas').select('id, titulo, decreto, estado, indexado, fecha_vigencia, articulos_count').order('id').range(desde, desde + 499);
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
  return de[0] ? { fecha: String(de[0].fecha).slice(0, 10), prensa: de[0].fuente_tipo === 'noticia', detalle: de[0].detalle || null } : null;
}

const VIGOR = new Set(['vigente', 'reformada', 'derogada']);
const PUBLICADA = new Set(['vigente', 'reformada', 'derogada', 'vigencia_diferida']);

const dia = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' });
const el = (p) => (p?.fecha ? ` el ${dia(p.fecha)}` : '');

/**
 * Por dónde va un decreto, del pleno a su vigencia: aprobado, en manos del
 * Ejecutivo, sancionado (o vetado), publicado en el Diario de Centro América
 * y en vigor. Cada paso dice si ya pasó y su fecha, si consta. Un paso
 * posterior que ya pasó da por pasados los anteriores. Un decreto vetado
 * vuelve al Congreso: el camino sigue hasta que el pleno acepta el veto o lo
 * supera.
 *
 * Cada paso trae su ayuda: qué significa, en frases completas. La pantalla
 * solo muestra los puntos; la ayuda se abre al tocar un paso.
 *
 * Devuelve { pasos, actual, vetado }.
 */
export function caminoDelDecreto({ eventos = [], estado = null, fechaVigencia = null, sinFicha = false, hoy = new Date().toISOString().slice(0, 10) } = {}) {
  const aprobado = fechaDe(eventos, 'aprobada');
  const enviado = fechaDe(eventos, 'pendiente_sancion');
  const sancionado = fechaDe(eventos, 'sancionada');
  const vetado = fechaDe(eventos, 'vetada') || (estado === 'vetado' ? {} : null);
  const aceptado = vetado && fechaDe(eventos, 'veto_aceptado');
  const superado = vetado && !aceptado && fechaDe(eventos, 'veto_superado');
  const enVigor = VIGOR.has(estado) || (estado === 'vigencia_diferida' && fechaVigencia && fechaVigencia <= hoy);
  const publicado = PUBLICADA.has(estado);

  const pasos = [
    { clave: 'aprobado', nombre: 'aprobado', ...aprobado, hecho: true },
    // El Ejecutivo es el paso en que se espera: queda hecho cuando lo sanciona o lo veta.
    { clave: 'ejecutivo', nombre: 'Ejecutivo', ...enviado, enviado: !!enviado, hecho: false },
  ];
  if (vetado) {
    pasos.push({ clave: 'vetado', nombre: 'vetado', ...vetado, hecho: true, veto: true });
    if (aceptado) pasos.push({ clave: 'congreso', nombre: 'veto aceptado', ...aceptado, hecho: true, veto: true, final: true });
    else if (superado) pasos.push({ clave: 'congreso', nombre: 'veto superado', ...superado, hecho: true });
    else pasos.push({ clave: 'congreso', nombre: 'Congreso', hecho: false });
  }
  if (!vetado || superado) {
    pasos.push(
      ...(vetado ? [] : [{ clave: 'sancionado', nombre: 'sancionado', ...sancionado, hecho: !!sancionado }]),
      { clave: 'publicado', nombre: 'publicado', hecho: publicado },
      { clave: 'vigor', nombre: 'en vigor', fecha: fechaVigencia || null, hecho: !!enVigor },
    );
  }
  // Lo que ya pasó después dice que lo de antes también pasó.
  for (let i = pasos.length - 2; i >= 0; i -= 1) if (pasos[i + 1].hecho) pasos[i].hecho = true;
  const pendiente = pasos.findIndex((p) => !p.hecho);
  const actual = pendiente === -1 ? pasos.length - 1 : pendiente;
  const ctx = { estado, fechaVigencia, enVigor, sinFicha };
  return { pasos: pasos.map((p) => ({ ...p, ayuda: ayudaDelPaso(p, ctx) })), actual, vetado: !!vetado };
}

/**
 * Qué significa cada paso, para la ayuda. Frases completas y en registro
 * neutro: explican el trámite (Constitución, arts. 177 a 180).
 */
export function ayudaDelPaso(p, { estado, fechaVigencia, enVigor, sinFicha } = {}) {
  switch (p.clave) {
    case 'aprobado':
      return `El pleno del Congreso lo aprobó${el(p)}. Después, la Junta Directiva tiene hasta diez días para enviarlo al Organismo Ejecutivo.`;
    case 'ejecutivo':
      if (p.hecho) return `El Ejecutivo lo recibió${el(p)}. Tenía 15 días para sancionarlo o vetarlo.`;
      return p.enviado
        ? `Actualmente se espera la sanción del Ejecutivo, que lo recibió${el(p)}. Desde que lo recibe, tiene 15 días para sancionarlo o vetarlo.`
        : 'Actualmente se espera la sanción del Ejecutivo. Puede tardar, según cuándo se entregue a la Secretaría General de la Presidencia; desde que lo recibe, el Ejecutivo tiene 15 días para sancionarlo o vetarlo.';
    case 'sancionado':
      return p.hecho
        ? `El Presidente lo sancionó${el(p)}: lo firmó y ordenó publicarlo.`
        : 'Sancionar es firmar el decreto y ordenar su publicación. Si el Ejecutivo deja pasar los 15 días sin vetarlo, se tiene por sancionado.';
    case 'publicado':
      if (p.hecho) return 'Se publicó en el Diario de Centro América, el diario oficial. Desde la publicación cuenta el plazo para que entre en vigor.';
      return `Después de la sanción se publica en el Diario de Centro América, el diario oficial.${sinFicha ? ' La ficha de la ley, con su texto, aparece cuando se publica.' : ''}`;
    case 'vigor':
      if (estado === 'derogada') return 'Estuvo vigente, pero otra ley la derogó.';
      if (enVigor) return fechaVigencia ? `Está vigente desde el ${dia(fechaVigencia)}: ya se aplica.` : 'Está vigente: ya se aplica.';
      if (fechaVigencia) return `Entra en vigor el ${dia(fechaVigencia)}, la fecha que fija el decreto.`;
      return 'Una ley entra en vigor ocho días después de publicarse, salvo que ella misma fije otro plazo.';
    case 'vetado': {
      const acuerdo = p.detalle?.acuerdo_gubernativo ? `, mediante el Acuerdo Gubernativo ${p.detalle.acuerdo_gubernativo}` : '';
      return `El Presidente, en Consejo de Ministros, lo vetó${el(p)}${acuerdo}: no lo sancionó y lo devolvió al Congreso con sus objeciones. Un veto es siempre de todo el decreto, no de una parte.`;
    }
    case 'congreso': {
      const votos = p.detalle?.a_favor ? `, con ${p.detalle.a_favor} votos a favor` : '';
      if (p.final) return `El Congreso aceptó el veto${el(p)}${votos}. El decreto no llega a ser ley.`;
      if (p.hecho) return `El Congreso superó el veto${el(p)}${votos}. El Ejecutivo debe sancionarlo y publicarlo dentro de los ocho días siguientes.`;
      return 'El Congreso todavía no ha resuelto el veto. Tiene hasta 30 días para aceptarlo, y entonces el decreto no llega a ser ley, o para superarlo con dos tercios de los diputados (107 de 160).';
    }
    default:
      return '';
  }
}

/**
 * Lo que el pleno resolvió de cada veto, desde sus votaciones: «aceptación
 * del veto al Decreto 21-2026», aprobada, es un veto aceptado. Una votación
 * que no se aprobó no resuelve nada.
 */
export function resolucionesDeVeto(votos = []) {
  const porDecreto = new Map();
  for (const v of votos) {
    if (v.resultado !== 'aprobada' || !/veto/i.test(v.asunto || '')) continue;
    const numero = limpio(v.decreto) || limpio((String(v.asunto).match(/decreto\s+(?:n[uú]mero\s+)?(\d+-\d{4})/i) || [])[1]);
    if (!numero) continue;
    const asunto = String(v.asunto);
    const tipo = /(rechaz|super|primac|no\s+acept)/i.test(asunto) ? 'veto_superado' : /acept/i.test(asunto) ? 'veto_aceptado' : null;
    if (!tipo) continue;
    porDecreto.set(numero, { tipo, fecha: String(v.fecha).slice(0, 10), fuente_tipo: 'acta', detalle: { a_favor: v.a_favor ?? null, votacion_id: v.id } });
  }
  return porDecreto;
}

export async function traerResolucionesVeto() {
  const { data, error } = await supabase.from('votaciones').select('id, fecha, asunto, decreto, resultado, a_favor').ilike('asunto', '%veto%');
  if (error) throw error;
  return resolucionesDeVeto(data || []);
}

/** Los eventos de un decreto, con lo que el pleno resolvió de su veto. */
export function conResolucion(eventos = [], numero, resoluciones) {
  const r = resoluciones?.get?.(limpio(numero));
  return r && !eventos.some((e) => e.tipo === r.tipo) ? [...eventos, r] : eventos;
}
