import { supabase } from '../../utils/supabase';
import { normalizar } from './organizacion';

/**
 * Las enmiendas del pleno, explicadas.
 *
 * Una enmienda es un cambio a un artículo de un proyecto de ley, propuesto por
 * diputados y votado en el pleno. Su votación dice solo cuántos votaron; la
 * ficha que carga Poder Ciudadano (`pc_sesion_enmiendas`) dice a qué
 * iniciativa y artículo pertenece, quién la propuso, qué decía antes, qué se
 * propuso y qué significa. Lo que la ficha no trae se dice que falta: no se
 * completa a partir de otra cosa.
 */

const COLUMNAS = 'votacion_id, pc_sesion_id, orden, iniciativa_numero, articulo, titulo, proponentes, video_seg, resumen, efecto, t_dice, texto_antes, texto_propuesto';

/**
 * Si la votación es de una enmienda. «Aprobación de enmienda por sustitución
 * total del artículo 31…» lo es; «Aprobación del título IV… con las enmiendas
 * incorporadas» no: es el título, ya con sus enmiendas.
 */
export function esEnmienda(asunto) {
  const a = normalizar(asunto);
  if (!/\benmiendas?\b/.test(a)) return false;
  return !/con (la|las) enmiendas? incorporadas?/.test(a);
}

/**
 * Lo que el asunto de la votación dice de la enmienda, tal como lo escribe el
 * Congreso: de qué tipo es («por sustitución total») y de qué artículo. Si el
 * asunto no lo dice, queda en null.
 */
export function delAsunto(asunto) {
  const a = normalizar(asunto);
  const clase = a.match(/enmienda (por (?:sustitucion (?:total|parcial)|adicion|supresion(?: total| parcial)?)|por [a-z ]+?)(?= del| al| de |$)/)?.[1] || null;
  const articulo = a.match(/\bdel? articulo (\d+(?: (?:bis|ter|quater|[a-z]))?)\b/)?.[1]?.toUpperCase() || null;
  const iniciativa = Number(a.match(/iniciativa de ley (\d{3,5})/)?.[1]) || null;
  return { clase: clase ? clase.replace('sustitucion', 'sustitución').replace('adicion', 'adición').replace('supresion', 'supresión') : null, articulo, iniciativa };
}

/** Las fichas de unas votaciones, por id de votación. */
export async function traerFichas(votacionIds) {
  const ids = [...new Set((votacionIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const { data, error } = await supabase.from('pc_sesion_enmiendas').select(COLUMNAS).in('votacion_id', ids);
  if (error) throw error;
  return new Map((data || []).map((f) => [f.votacion_id, f]));
}

/**
 * Todo lo de una enmienda para su ficha: lo de Poder Ciudadano, la iniciativa
 * (nombre, decreto en que quedó, su trámite) y el video de la sesión.
 */
export async function traerEnmienda(votacion) {
  const fichas = await traerFichas([votacion.id]);
  const ficha = fichas.get(votacion.id) || null;
  const asunto = delAsunto(votacion.asunto);
  const numero = ficha?.iniciativa_numero || votacion.iniciativa_numero || asunto.iniciativa || null;
  const [ini, video] = await Promise.all([
    numero ? traerIniciativa(numero) : null,
    votacion.fecha ? videoDeLaSesion(votacion.fecha) : null,
  ]);
  return { ficha, asunto, numero, iniciativa: ini, video };
}

async function traerIniciativa(numero) {
  const { data, error } = await supabase
    .from('iniciativas_app_view')
    .select('numero, titulo, comisiones, decreto_resultante, eventos_timeline')
    .eq('numero', numero)
    .maybeSingle();
  if (error) return null;
  if (!data?.decreto_resultante) return data;
  // La ley en que quedó, si está en la biblioteca: su ficha y su estado real.
  const decreto = String(data.decreto_resultante).trim();
  const { data: normas } = await supabase.from('normas').select('id, titulo, decreto, estado, indexado').in('decreto', [`Decreto ${decreto}`, decreto]);
  return { ...data, norma: (normas || [])[0] || null };
}

/** El video de la sesión de ese día; si hay más de uno distinto, ninguno. */
async function videoDeLaSesion(fecha) {
  const { data } = await supabase.from('pc_congreso_sesiones_view').select('youtube_url').eq('fecha', String(fecha).slice(0, 10));
  const urls = [...new Set((data || []).map((s) => s.youtube_url).filter((u) => /^https:\/\//.test(u || '')))];
  return urls.length === 1 ? urls[0] : null;
}

/** El enlace al momento de la sesión en que se discutió. */
export function enlaceAlMomento(video, segundos) {
  if (!video) return null;
  if (!segundos) return video;
  return `${video}${video.includes('?') ? '&' : '?'}t=${Math.max(0, Math.floor(segundos))}s`;
}

/** «Amplió de **30 minutos a 3 horas** el plazo» → partes, con lo resaltado aparte. */
export function partesResaltadas(texto) {
  return String(texto || '')
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((t) => (/^\*\*[^*]+\*\*$/.test(t) ? { texto: t.slice(2, -2), marca: true } : { texto: t, marca: false }));
}

const EN_COMISION = new Set(['presentada', 'conocio_pleno', 'en_comision', 'dictamen_favorable', 'dictamen_desfavorable']);
const NOMBRE_EVENTO = {
  presentada: 'presentada',
  conocio_pleno: 'conoció el pleno',
  en_comision: 'pasó a comisión',
  dictamen_favorable: 'dictamen favorable',
  dictamen_desfavorable: 'dictamen desfavorable',
  primer_debate: 'primer debate',
  segundo_debate: 'segundo debate',
  tercer_debate: 'tercer debate',
  unico_debate: 'único debate',
  aprobada: 'aprobada',
  pendiente_sancion: 'pendiente de sanción',
  sancionada: 'sancionada',
  vetada: 'vetada',
};

/**
 * El trámite de la iniciativa, en dos partes: lo de comisión (hasta el
 * dictamen) y lo del pleno (debates, aprobación, sanción). Un mismo paso del
 * mismo día va una vez. Lo que el registro no nombra no se agrega.
 */
export function tramiteDe(eventos) {
  const vistos = new Set();
  const pasos = [...(eventos || [])]
    .filter((e) => NOMBRE_EVENTO[e.tipo] && e.fecha)
    // Del mismo paso y día queda la fuente oficial antes que la nota de prensa.
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || (a.fuente_tipo === 'noticia') - (b.fuente_tipo === 'noticia'))
    .filter((e) => {
      const clave = `${e.tipo}|${String(e.fecha).slice(0, 10)}`;
      if (vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    })
    .map((e) => ({
      tipo: e.tipo,
      nombre: NOMBRE_EVENTO[e.tipo],
      fecha: String(e.fecha).slice(0, 10),
      comision: e.detalle?.comision || null,
      // Un paso que solo cuenta la prensa se dice así hasta tener la fuente oficial.
      prensa: e.fuente_tipo === 'noticia',
    }));
  return {
    comision: pasos.filter((p) => EN_COMISION.has(p.tipo)),
    pleno: pasos.filter((p) => !EN_COMISION.has(p.tipo)),
  };
}
