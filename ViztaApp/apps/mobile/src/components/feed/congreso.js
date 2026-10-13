import { supabase } from '../../utils/supabase';

/**
 * El feed del Congreso: lo que publica el Congreso cada día, ya juntado en la
 * base (`congreso_items_app_view`). Son sus noticias, las publicaciones de su
 * cuenta que las cubren, y el noticiero legislativo.
 */

const COLUMNAS =
  'id, digest_date, tipo, titulo, url, iniciativa_numero, video_id, summary, stage, result, votes, card_type, card_data';

const COLUMNAS_VOTACION = 'id, fecha, sesion, asunto, resultado, a_favor, en_contra, ausentes, licencia, iniciativa_numero';

/** Los últimos días con algo, cada uno con su noticiero y sus títulos. */
export async function traerCongreso() {
  const { data, error } = await supabase
    .from('congreso_items_app_view')
    .select(COLUMNAS)
    .order('digest_date', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(80);
  if (error) throw error;

  await completarTitulos(data || []);
  // Lo nuevo del Congreso entra a la cola donde se buscan las menciones del
  // Codex. No se espera: el feed no depende de eso.
  supabase.rpc('codex_menciones_encolar_congreso').then(() => {}, () => {});

  const dias = [];
  for (const item of data || []) {
    let dia = dias.find((d) => d.fecha === item.digest_date);
    if (!dia) {
      dia = { fecha: item.digest_date, items: [] };
      dias.push(dia);
    }
    dia.items.push(item);
  }
  // El noticiero arriba de cada día: es el resumen de todo lo demás.
  for (const d of dias) d.items.sort((a, b) => (b.tipo === 'noticiero') - (a.tipo === 'noticiero'));
  // El noticiero también llega como «noticia» del sitio, con el mismo título:
  // ya está arriba como salto al video, y repetido no dice nada.
  for (const d of dias) d.items = d.items.filter((i) => i.tipo === 'noticiero' || !/^\s*noticiero legislativo/i.test(i.titulo || ''));
  const visibles = dias.slice(0, 7);

  // Las votaciones del pleno de esos días. Vienen de su propio registro, con
  // los 160 votos contados; se juntan con las noticias solo por la fecha, que
  // es lo único que de verdad comparten. Si fallan, el día se muestra igual.
  if (visibles.length) {
    const { data: votaciones } = await supabase
      .from('votaciones')
      .select(COLUMNAS_VOTACION)
      .in('fecha', visibles.map((d) => d.fecha))
      .order('created_at', { ascending: true });
    for (const d of visibles) {
      const delDia = (votaciones || []).filter((v) => v.fecha === d.fecha);
      // Primero lo que decide algo; aprobar el orden del día es trámite.
      const tramite = (v) => /orden del d[ií]a|acta de la sesi[oó]n/i.test(v.asunto || '');
      d.votaciones = delDia.sort((a, b) => tramite(a) - tramite(b));
    }
  }
  return visibles;
}

/**
 * Cómo votó cada diputado en una votación: sus 160 votos, uno por uno.
 *
 * Se pide recién cuando alguien abre la votación. Un día puede traer veinte, y
 * traer de entrada los votos de todas serían miles de filas para algo que casi
 * nadie despliega.
 */
export async function traerVotos(votacionId) {
  const { data, error } = await supabase
    .from('votos_diputado')
    .select('diputado, bloque, voto')
    .eq('votacion_id', votacionId)
    .limit(200);
  if (error) throw error;
  return data || [];
}

const CORTADO = /(\.\.\.|…)\s*$/;
const plano = (t) =>
  String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Los títulos que el sitio del Congreso cortó («…DEL RÍO...»), enteros.
 *
 * El listado del sitio los corta, pero cuando la nota se leyó completa su
 * título entero viene como encabezado dentro del texto. Se toma de ahí, y solo
 * si empieza igual que el cortado: así no se le pone a una nota el título de
 * otra. Las que no se leyeron completas —las que llegaron por tweets— quedan
 * cortadas: el título entero no está guardado en ningún lado.
 */
async function completarTitulos(items) {
  const cortados = items.filter((i) => CORTADO.test(i.titulo || ''));
  if (!cortados.length) return;
  const { data } = await supabase
    .from('congreso_items_app_view')
    .select('id, gap_content')
    .in('id', cortados.map((i) => i.id))
    .not('gap_content', 'is', null);
  const textos = new Map((data || []).map((f) => [f.id, f.gap_content]));
  for (const item of cortados) {
    const texto = textos.get(item.id);
    if (!texto) continue;
    const inicio = plano(item.titulo.replace(CORTADO, ''));
    const entero = tituloEntero(texto, inicio);
    if (entero) item.titulo = entero;
  }
}

/**
 * El título entero de una nota, sacado de su texto.
 *
 * En la página leída aparece dos veces: como encabezado («## TÍTULO») y como
 * enlace en la miga de pan («[Título](…)»). Se toma el que empiece igual que
 * el cortado.
 */
function tituloEntero(texto, inicio) {
  if (!texto || inicio.length < 8) return null;
  const candidatos = [];
  for (const l of texto.split('\n')) {
    if (/^#{1,3}\s+\S/.test(l)) candidatos.push(l.replace(/^#{1,3}\s+/, '').trim());
    for (const m of l.matchAll(/\[\**([^\]]+?)\**\]\(/g)) candidatos.push(m[1].trim());
  }
  return candidatos.find((c) => !CORTADO.test(c) && plano(c).startsWith(inicio) && plano(c).length > inicio.length) || null;
}

const COLUMNAS_NOTA =
  'id, titulo, url, gap_content, actors, comision_name, iniciativa_titulo, iniciativa_estado, norma_decreto, decreto_numero';

/**
 * Una nota abierta: su texto y lo que el monitor sabe de ella.
 *
 * Se pide al abrirla, no con el feed: el texto de una nota pesa varias veces lo
 * que pesa su fila, y casi todas se leen solo por el título.
 */
export async function traerNota(id) {
  const { data, error } = await supabase.from('congreso_items_app_view').select(COLUMNAS_NOTA).eq('id', id).single();
  if (error) throw error;
  const inicio = plano(String(data.titulo || '').replace(CORTADO, ''));
  return {
    ...data,
    tituloEntero: CORTADO.test(data.titulo || '') ? tituloEntero(data.gap_content, inicio) : null,
    parrafos: parrafosDe(data.gap_content),
  };
}

/**
 * Los párrafos de la nota, sin lo que la rodea en la página.
 *
 * El texto guardado es la página entera pasada a texto: buscador, menú,
 * imágenes, «noticias relacionadas». La nota va entre su encabezado y la raya
 * que la separa de lo relacionado; de ahí se dejan los renglones que son prosa.
 */
function parrafosDe(texto) {
  if (!texto) return [];
  const lineas = texto.split('\n');
  const desde = lineas.findIndex((l) => /^##\s+\S/.test(l));
  if (desde === -1) return [];
  const cuerpo = [];
  for (const cruda of lineas.slice(desde + 1)) {
    const l = cruda.trim();
    if (/^(\* \* \*|-{3,}|#{4,}\s)/.test(l)) break;
    if (!l || /^[|!\[#>]/.test(l) || /^- \[/.test(l)) continue;
    // La fecha suelta («Jueves, 08 de octubre de 2026») y los restos del
    // reproductor de video no son la nota.
    if (/^(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo),/i.test(l) && l.length < 50) continue;
    if (l.length < 40) continue;
    cuerpo.push(l.replace(/\\/g, '').replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'));
  }
  return cuerpo;
}

/**
 * El titular, legible.
 *
 * El Congreso los publica en MAYÚSCULAS y a veces cortados («…EN...»). En
 * mayúsculas corridas un titular en serif grita; se pasa a oración. Se pierde
 * la mayúscula de algún nombre propio, que es menos grave que diez titulares
 * gritando uno abajo del otro. Las siglas cortas se respetan.
 */
export function titular(crudo) {
  const t = String(crudo || '').trim().replace(/\\/g, '').replace(/\s*\.\.\.$/, '…').replace(/^#\w+:\s*/, '');
  const letras = t.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '');
  const gritando = letras.length > 6 && letras === letras.toUpperCase();
  if (!gritando) return t;
  const SIGLAS = /^(IGSS|SAT|ONU|OEA|CC|CSJ|MP|TSE|USAC|IVA|ISR|IUSI|PNC|INE|CONRED|EEUU|UE)$/;
  const frase = t
    .split(/(\s+)/)
    .map((p) => (SIGLAS.test(p.replace(/[^A-ZÁÉÍÓÚÑ]/g, '')) ? p : p.toLowerCase()))
    .join('');
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

/** «martes 6 de octubre», y «hoy» o «ayer» cuando corresponde. */
export function nombreDelDia(fecha) {
  const [a, m, d] = String(fecha).split('-').map(Number);
  const dia = new Date(a, m - 1, d);
  const hoy = new Date();
  const dif = Math.round((new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) - dia) / 86400000);
  if (dif === 0) return 'hoy';
  if (dif === 1) return 'ayer';
  return dia.toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** A dónde lleva el noticiero: su video en YouTube. */
export function enYouTube(item) {
  if (item.video_id) return `https://www.youtube.com/watch?v=${item.video_id}`;
  return /youtu\.?be/.test(item.url || '') ? item.url : null;
}

/**
 * Lo del Codex de esta persona que aparece en una nota o en una votación.
 *
 * Lo decide la base, con las mismas reglas que deciden las menciones de una
 * noticia: acá solo se leen las que quedaron en «sí». Sin sesión no hay Codex,
 * y vuelve vacío.
 */
export async function traerMencionados(fuente, refId) {
  const { data, error } = await supabase
    .from('codex_menciones_resueltas')
    .select('item_id')
    .eq('fuente', fuente)
    .eq('ref_id', String(refId))
    .eq('veredicto', 'si');
  if (error || !data?.length) return [];
  const ids = [...new Set(data.map((f) => f.item_id))];
  const { data: items } = await supabase.from('codex_universe_items').select('id, name, tipo').in('id', ids);
  return items || [];
}
