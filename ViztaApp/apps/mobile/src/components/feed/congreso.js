import { supabase } from '../../utils/supabase';

/**
 * El feed del Congreso: lo que publica el Congreso cada día, ya juntado en la
 * base (`congreso_items_app_view`). Son sus noticias, las publicaciones de su
 * cuenta que las cubren, y el noticiero legislativo.
 */

const COLUMNAS =
  'id, digest_date, tipo, titulo, url, iniciativa_numero, video_id, summary, stage, origin, comision_name, decreto_numero, resolucion_tipo, result, votes, actors, card_type, card_data, created_at';

const COLUMNAS_VOTACION = 'id, fecha, sesion, asunto, resultado, a_favor, en_contra, ausentes, licencia, iniciativa_numero';

/** Los últimos días con algo, cada uno con su noticiero y sus títulos. */
export async function traerCongreso() {
  const { data, error } = await supabase
    .from('congreso_items_app_view')
    .select(COLUMNAS)
    .order('digest_date', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(200);
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
  // Fuera lo que no cuenta nada, y una sola vez lo que llegó dos veces el
  // mismo día (por el sitio y por la cuenta, o en dos corridas del monitor).
  for (const d of dias) d.items = unaVez(d.items.filter((i) => i.tipo === 'noticiero' || !esRelleno(i)));
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

// ─── Limpieza ────────────────────────────────────────────────────────────────

/**
 * Un resumen que no sabe nada: repite el título («según el título de la
 * noticia», «sin más detalles») o promete algo que no dice («varias
 * iniciativas…» sin decir cuáles). La nota no se muestra.
 */
const RELLENO =
  /seg[uú]n el t[ií]tulo|el t[ií]tulo indica|el encabezado indica|sin (m[aá]s|mayores) detalles|sin detallar|no se (detalla|especifica)|sin ofrecer m[aá]s|^varias iniciativas/i;

export function esRelleno(item) {
  const r = String(item.summary || '').trim();
  if (!r) return /(\.\.\.|…)\s*$/.test(item.titulo || '') && !item.card_data?.subject;
  if (RELLENO.test(r)) return true;
  // Un resumen de una línea sin nadie nombrado es el título dicho otra vez.
  return r.length < 70 && !(item.actors || []).length && !item.iniciativa_numero;
}

/** La clave de «es lo mismo»: la iniciativa si tiene número, si no el tema. */
export function claveDe(item) {
  const numero = item.iniciativa_numero || item.card_data?.iniciativa_numero;
  if (numero) return `ini:${numero}`;
  const tema = item.card_data?.subject || item.titulo || '';
  return `tema:${plano(tema.replace(CORTADO, '')).split(' ').slice(0, 8).join(' ')}`;
}

/** Lo repetido, una vez: se queda la que trae más (resumen más largo). */
function unaVez(items) {
  const vistos = new Map();
  for (const i of items) {
    if (i.tipo === 'noticiero') {
      vistos.set(i.id, i);
      continue;
    }
    const clave = claveDe(i);
    const antes = vistos.get(clave);
    if (!antes || String(i.summary || '').length > String(antes.summary || '').length) vistos.set(clave, i);
  }
  return [...vistos.values()];
}

// ─── Lo organizado ───────────────────────────────────────────────────────────

/** Cuánto avanzó una iniciativa: sirve para quedarse con la etapa más nueva. */
const AVANCE = {
  iniciativa_presentada: 1,
  en_comision: 2,
  dictamen: 3,
  primer_debate: 4,
  segundo_debate: 5,
  tercer_debate: 6,
  aprobado: 7,
};

export const SECCIONES = [
  ['iniciativas', 'Iniciativas'],
  ['comisiones', 'Comisiones y citaciones'],
  ['pleno', 'Pleno y sesiones'],
  ['votaciones', 'Votaciones'],
  ['fiscalizacion', 'Fiscalización'],
  ['leyes', 'Leyes'],
];

/**
 * A qué sección va una nota. Sale de lo que el monitor ya marcó —la etapa y de
 * dónde viene—, no de leer el título.
 */
export function seccionDe(item) {
  const etapa = item.stage;
  const numero = item.iniciativa_numero || item.card_data?.iniciativa_numero;
  if (item.decreto_numero || item.resolucion_tipo || (etapa === 'aprobado' && numero)) return 'leyes';
  if (numero || ['iniciativa_presentada', 'dictamen', 'primer_debate', 'segundo_debate', 'tercer_debate'].includes(etapa)) {
    return 'iniciativas';
  }
  if (item.origin === 'comision' || etapa === 'en_comision' || etapa === 'citacion') return 'comisiones';
  if (['pleno', 'jefes_bloque', 'junta_directiva'].includes(item.origin) || etapa === 'eleccion' || etapa === 'aprobado') {
    return 'pleno';
  }
  return 'fiscalizacion';
}

/**
 * Lo de la semana, por sección.
 *
 * Una iniciativa es una entrada aunque haya salido cinco veces: se juntan por
 * número (o por tema, si no tiene) y queda la etapa más avanzada, con sus pasos
 * de la semana para abrirlos. Cada sección va de lo más nuevo a lo más viejo.
 */
export function organizar(dias) {
  const grupos = new Map();
  for (const dia of dias || []) {
    for (const item of dia.items) {
      if (item.tipo === 'noticiero') continue;
      const clave = claveDe(item);
      const g = grupos.get(clave) || { clave, pasos: [] };
      g.pasos.push({ fecha: item.digest_date, etapa: item.stage, item });
      grupos.set(clave, g);
    }
  }
  const secciones = Object.fromEntries(SECCIONES.map(([k]) => [k, []]));
  for (const g of grupos.values()) {
    g.pasos.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (AVANCE[a.etapa] || 0) - (AVANCE[b.etapa] || 0)));
    // La que representa al grupo: la más avanzada y, a igual avance, la más nueva.
    const cabeza = [...g.pasos].sort((a, b) => (AVANCE[b.etapa] || 0) - (AVANCE[a.etapa] || 0) || (a.fecha < b.fecha ? 1 : -1))[0];
    const entrada = { ...cabeza.item, _pasos: g.pasos, _ultima: g.pasos[g.pasos.length - 1].fecha };
    secciones[seccionDe(entrada)].push(entrada);
  }
  for (const k of Object.keys(secciones)) secciones[k].sort((a, b) => (a._ultima < b._ultima ? 1 : -1));
  // Las votaciones del pleno de la semana, de la más nueva a la más vieja. Ya
  // vienen ordenadas dentro de cada día (lo que decide algo antes del trámite).
  secciones.votaciones = (dias || []).flatMap((d) => d.votaciones || []);
  return secciones;
}

/**
 * Las leyes y acuerdos publicados más recientes, del registro de normas. La
 * semana casi nunca trae una: así la sección muestra igual lo último vigente.
 */
export async function traerLeyes() {
  const { data } = await supabase
    .from('normas')
    .select('id, decreto, titulo, tipo, estado, fecha_publicacion')
    .order('fecha_publicacion', { ascending: false, nullsFirst: false })
    .limit(5);
  return data || [];
}

/** «lun 12»: el día corto de una entrada organizada. */
export function diaCorto(fecha) {
  const [a, m, d] = String(fecha).split('-').map(Number);
  const dia = new Date(a, m - 1, d);
  return `${dia.toLocaleDateString('es-GT', { weekday: 'short' }).replace('.', '')} ${d}`;
}

/** De dónde sale una nota: la comisión con nombre, o el órgano que la produjo. */
const ORIGEN = { pleno: 'Pleno', jefes_bloque: 'Jefes de bloque', junta_directiva: 'Junta Directiva', comision: 'Comisión' };
export function origenDe(item) {
  if (item.comision_name) return item.comision_name;
  return ORIGEN[item.origin] || null;
}
