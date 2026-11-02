import { supabase } from '../../utils/supabase';
import { normalizar } from './organizacion';

/**
 * El buscador legal: todo lo indexado (leyes, códigos, convenios, acuerdos,
 * sus artículos y las iniciativas del Congreso), en una sola búsqueda.
 *
 * Busca con el texto completo de la base (`buscar_leyes`, `buscar_articulos`,
 * `buscar_iniciativas`): por palabras, que encuentran también sus variantes
 * («despido» encuentra «despidos»), y por frase exacta entre comillas. Dos
 * casos van aparte:
 *
 * - un artículo por su número («art 102 constitución»), que el texto
 *   completo no resuelve: se busca el número y se ordena por la ley que se
 *   nombró;
 * - una pregunta dicha como se habla («qué pasa si me despiden»): si nada
 *   tiene todas las palabras, se busca de nuevo con cualquiera de las que
 *   dicen algo, y se avisa que es una búsqueda amplia.
 */

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const TIPOS_RESULTADO = ['ley', 'articulo', 'iniciativa'];

// Palabras que no dicen de qué se busca: no entran en la búsqueda amplia.
const VACIAS = new Set([
  'que', 'qué', 'como', 'cómo', 'cual', 'cuál', 'cuales', 'donde', 'dónde', 'cuando', 'cuándo', 'quien', 'quién',
  'pasa', 'pasar', 'puede', 'pueden', 'puedo', 'debe', 'deben', 'hay', 'tiene', 'tienen', 'tengo', 'dice', 'dicen',
  'sobre', 'para', 'por', 'con', 'sin', 'los', 'las', 'del', 'una', 'uno', 'unos', 'unas', 'este', 'esta', 'esto',
  'ese', 'esa', 'eso', 'mi', 'mis', 'me', 'se', 'si', 'sí', 'es', 'son', 'ley', 'leyes', 'guatemala', 'según',
]);

const NUMERO_ARTICULO = /\bart(?:[íi]culos?|s?\.)?\s*(\d+(?:\s*(?:bis|ter|quater|[a-g]))?)\b/i;

/**
 * Qué se pidió: el texto tal cual, y si nombra un artículo, su número y lo
 * demás (casi siempre, la ley: «constitución», «código de trabajo»).
 */
export function leerConsulta(texto) {
  const q = String(texto || '').replace(/\s+/g, ' ').trim();
  const m = q.match(NUMERO_ARTICULO);
  if (!m) return { q, numero: null, resto: '' };
  const numero = m[1].replace(/\s+/g, ' ').toUpperCase();
  const resto = (q.slice(0, m.index) + ' ' + q.slice(m.index + m[0].length)).replace(/\b(de|del|la|el)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  return { q, numero, resto };
}

/** La misma búsqueda, con cualquiera de las palabras que dicen algo. */
export function consultaAmplia(q) {
  const palabras = String(q || '')
    .replace(/["'¿?¡!.,;:()]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length >= 3 && !VACIAS.has(p.toLowerCase()));
  const unicas = [...new Set(palabras.map((p) => p.toLowerCase()))];
  return unicas.length >= 2 ? unicas.join(' or ') : null;
}

/**
 * El fragmento de una ley o una iniciativa sin lo que ya está a la vista: su
 * título (que va arriba) ni la nota de dónde salió el texto («Fuente: …»).
 */
export function sinTitulo(fragmento, titulo) {
  let f = String(fragmento || '').replace(/(?:<b>)?Fuente(?:<\/b>)?:[^.]*\.\s*/gi, ' ');
  const palabras = String(titulo || '').trim().split(/\s+/).filter(Boolean);
  if (palabras.length) {
    const t = palabras.map((w) => `(?:<b>)?${escapar(w)}(?:</b>)?`).join('\\s+');
    f = f.replace(new RegExp(t, 'gi'), ' ');
  }
  // Un título más largo que el fragmento llega cortado: se quita palabra por
  // palabra lo que coincide desde el principio.
  const fichas = f.trim().split(/\s+/);
  const plana = (w) => normalizar(w.replace(/<\/?b>/g, '')).replace(/[^a-z0-9]/g, '');
  let n = 0;
  while (n < fichas.length && n < palabras.length && plana(fichas[n]) && plana(fichas[n]) === plana(palabras[n])) n++;
  if (n >= 4 || n === fichas.length) f = fichas.slice(n).join(' ');
  return f.replace(/^[\s,.;:–—-]+/, '').replace(/\s+/g, ' ').trim();
}

/**
 * El fragmento que devuelve la base marca con <b> lo que coincide. Se parte en
 * pedazos para dibujar en negrita lo encontrado, sin etiquetas en pantalla.
 */
export function partesDelFragmento(fragmento, articulo) {
  const limpio = (articulo ? textoLegible(fragmento, articulo) : String(fragmento || '')).replace(/\s+/g, ' ').trim();
  const partes = [];
  const re = /<b>(.*?)<\/b>/g;
  let desde = 0;
  let m;
  while ((m = re.exec(limpio))) {
    if (m.index > desde) partes.push({ texto: limpio.slice(desde, m.index), marca: false });
    partes.push({ texto: m[1], marca: true });
    desde = m.index + m[0].length;
  }
  if (desde < limpio.length) partes.push({ texto: limpio.slice(desde), marca: false });
  // Dos marcas seguidas («<b>justa</b> <b>causa</b>») se leen como una sola.
  return partes.reduce((acc, p) => {
    const ultima = acc[acc.length - 1];
    if (ultima && ultima.marca === p.marca) ultima.texto += p.texto;
    else if (ultima?.marca && !p.marca && /^\s+$/.test(p.texto)) ultima.texto += p.texto;
    else acc.push({ ...p });
    return acc;
  }, []);
}

/**
 * El texto de un artículo como se lee: sin los cortes de renglón del PDF, sin
 * repetir «Artículo 102.» (ya va arriba) y sin el encabezado de página que se
 * cuela en medio («CONSTITUCIÓN POLÍTICA… 20»).
 */
export function textoLegible(texto, { numero, titulo } = {}) {
  let t = String(texto || '').replace(/\r/g, '');
  if (numero) t = t.replace(new RegExp(`^\\s*art[íi]culo\\s+${escapar(String(numero))}\\s*[.:\\-–—]?\\s*`, 'i'), '');
  if (titulo) {
    const palabras = String(titulo).toLocaleUpperCase('es').trim().split(/\s+/).map(escapar).join('\\s+');
    t = t.replace(new RegExp(`\\s*${palabras}\\s+\\d{1,4}\\b\\s*`, 'g'), ' ');
  }
  return t
    .split(/\n\s*\n/)
    .map((p) => p.replace(/-\n(?=[a-záéíóúñ])/g, '').replace(/\s*\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

const ENCABEZADO = /\s+((?:SECCI[ÓO]N|CAP[ÍI]TULO|T[ÍI]TULO|LIBRO)\s+[A-ZÁÉÍÓÚÑ0-9]{1,}\b[\s\S]*)$/;

/**
 * En el PDF, el título de la sección que sigue («SECCIÓN SÉPTIMA Salud,
 * seguridad y asistencia social») queda pegado al final del artículo
 * anterior. Se separa para ponerlo arriba del artículo que abre.
 */
export function separarEncabezado(texto) {
  const m = String(texto || '').match(ENCABEZADO);
  if (!m || m[1].length > 200) return { texto, encabezado: null };
  return { texto: texto.slice(0, m.index).trim(), encabezado: m[1].replace(/\s+/g, ' ').trim() };
}

/**
 * De un artículo largo, el pedazo donde aparece lo buscado (sin depender de
 * tildes), con «…» donde se corta. Si no aparece, nada.
 */
export function recorteAlrededor(texto, buscado, antes = 140, despues = 320) {
  const palabras = normalizar(buscado).trim().split(/\s+/).filter((p) => p.length >= 2);
  const plano = normalizar(texto);
  const i = Math.min(...palabras.map((p) => plano.indexOf(p)).filter((x) => x >= 0));
  if (!Number.isFinite(i)) return null;
  let desde = Math.max(0, i - antes);
  let hasta = Math.min(texto.length, i + despues);
  // Cortar en un espacio, no a mitad de palabra.
  if (desde > 0) desde = texto.indexOf(' ', desde) + 1 || desde;
  if (hasta < texto.length) hasta = texto.lastIndexOf(' ', hasta) > i ? texto.lastIndexOf(' ', hasta) : hasta;
  return `${desde > 0 ? '… ' : ''}${texto.slice(desde, hasta).trim()}${hasta < texto.length ? ' …' : ''}`;
}

/** Números de artículo en orden de lectura: 41, 41 BIS, 41 TER, 42… */
export function compararArticulos(a, b) {
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  if (Number.isNaN(na) || Number.isNaN(nb)) return Number.isNaN(na) - Number.isNaN(nb) || String(a).localeCompare(String(b));
  return na - nb || String(a).localeCompare(String(b), 'es', { numeric: true });
}

/**
 * Las notas internas que vienen en la descripción de una ley (de dónde salió
 * el texto, qué le falta al archivo) no son para quien lee: quedan las
 * oraciones que dicen qué regula y qué la reformó.
 */
export function descripcionDe(norma) {
  const d = String(norma?.descripcion || '').replace(/^Fuente:[^.]*\.\s*/i, '').trim();
  if (!d) return null;
  const oraciones = d.split(/(?<=\.)\s+/).filter((o) => !/texto cargado|fuente compilada|corpus|^atenci[oó]n|^ojo/i.test(o));
  const texto = oraciones.join(' ').trim();
  if (!texto) return null;
  // Si solo repite el título, no dice nada nuevo.
  const t = normalizar(norma.titulo).replace(/[^a-z0-9]/g, '');
  return t && normalizar(texto).replace(/[^a-z0-9]/g, '').startsWith(t) && texto.length < (norma.titulo || '').length + 20 ? null : texto;
}

const NOMBRE_TIPO = {
  constitucion: 'constitución', codigo: 'código', ley: 'ley', convenio: 'convenio', reglamento: 'reglamento', otro: 'acuerdo',
};
export const nombreTipo = (tipo) => NOMBRE_TIPO[tipo] || tipo || null;

const NOMBRE_ESTADO = {
  vigente: null, derogada: 'derogada', vetado: 'vetada', pendiente_sancion: 'pendiente de sanción', vigencia_diferida: 'vigencia diferida',
};
/** Vigente no se dice: es lo esperado. Lo demás sí, porque cambia lo que vale. */
export const nombreEstado = (estado) => (estado in NOMBRE_ESTADO ? NOMBRE_ESTADO[estado] : estado || null);

// ─── Consultas ───────────────────────────────────────────────────────────────

async function porNumero(numero, resto) {
  const { data, error } = await supabase
    .from('articulos')
    .select('id, numero_articulo, texto, norma_id, normas(titulo, decreto, tipo)')
    .ilike('numero_articulo', numero)
    .limit(300);
  if (error) throw error;
  const palabras = normalizar(resto).split(/\s+/).filter((p) => p.length >= 3);
  const puntaje = (f) => {
    const titulo = normalizar(`${f.normas?.titulo || ''} ${f.normas?.decreto || ''}`);
    return palabras.filter((p) => titulo.includes(p)).length;
  };
  const filas = (data || []).map((f) => ({ f, p: puntaje(f) }));
  const mejor = Math.max(0, ...filas.map((x) => x.p));
  // Si nombró la ley, solo esa; si no, el artículo en todas, primero las de base.
  const BASE = { constitucion: 0, codigo: 1 };
  return filas
    .filter((x) => !palabras.length || !mejor || x.p === mejor)
    .sort((a, b) => b.p - a.p || (BASE[a.f.normas?.tipo] ?? 2) - (BASE[b.f.normas?.tipo] ?? 2))
    .slice(0, 20)
    .map(({ f }) => ({
      tipo: 'articulo',
      clave: `articulo-${f.id}`,
      id: f.id,
      normaId: f.norma_id,
      numero: f.numero_articulo,
      titulo: f.normas?.titulo,
      decreto: f.normas?.decreto,
      partes: [{ texto: textoLegible(f.texto, { numero: f.numero_articulo, titulo: f.normas?.titulo }).slice(0, 260), marca: false }],
    }));
}

async function deLaBase(q) {
  const [leyes, articulos, iniciativas] = await Promise.all([
    supabase.rpc('buscar_leyes', { q, limite: 30 }),
    supabase.rpc('buscar_articulos', { q, limite: 60 }),
    supabase.rpc('buscar_iniciativas', { q, limite: 30 }),
  ]);
  for (const r of [leyes, articulos, iniciativas]) if (r.error) throw r.error;
  return [
    ...(leyes.data || []).map((l) => ({
      tipo: 'ley', clave: `ley-${l.id}`, id: l.id, normaId: l.id, titulo: l.titulo, decreto: l.decreto,
      estado: l.estado, articulos: l.articulos_count, rank: l.rank, coincide: /<b>/.test(l.fragmento || ''),
      partes: partesDelFragmento(sinTitulo(l.fragmento, l.titulo)),
    })),
    ...(articulos.data || []).map((a) => ({
      tipo: 'articulo', clave: `articulo-${a.articulo_id}`, id: a.articulo_id, normaId: a.norma_id, numero: a.numero_articulo,
      titulo: a.norma_titulo, decreto: a.norma_decreto, rank: a.rank,
      partes: partesDelFragmento(a.fragmento, { numero: a.numero_articulo, titulo: a.norma_titulo }),
    })),
    ...(iniciativas.data || []).map((i) => ({
      tipo: 'iniciativa', clave: `iniciativa-${i.numero}`, numero: i.numero, titulo: i.titulo, estado: i.estado,
      fecha: i.fecha_lectura, decreto: i.decreto_resultante, rank: i.rank, coincide: /<b>/.test(i.fragmento || ''),
      partes: partesDelFragmento(sinTitulo(i.fragmento, i.titulo)),
    })),
  ];
}

/**
 * Busca en todo lo indexado. Devuelve los resultados y si la búsqueda fue
 * amplia (ninguno tenía todas las palabras).
 */
export async function buscarLegal(texto) {
  const { q, numero, resto } = leerConsulta(texto);
  if (q.length < 2) return { resultados: [], amplia: false };
  if (numero) {
    const exactos = await porNumero(numero, resto);
    if (exactos.length) return { resultados: exactos, amplia: false, numero };
  }
  const resultados = await deLaBase(q);
  if (resultados.length) return { resultados: porCoincidencia(resultados), amplia: false };
  const amplia = consultaAmplia(q);
  if (!amplia) return { resultados: [], amplia: false };
  return { resultados: porCoincidencia(await deLaBase(amplia)), amplia: true };
}

/**
 * Lo que más coincide, primero, sea ley, artículo o iniciativa. Lo que no
 * muestra dónde coincide (una ley que lo dice en algún lugar de su texto
 * completo, lejos del fragmento) va después de lo que sí. Un fragmento sin
 * nada marcado no se muestra: solo repetiría el título.
 */
export function porCoincidencia(resultados) {
  const ORDEN = { ley: 0, articulo: 1, iniciativa: 2 };
  const seVe = (r) => (r.coincide ?? r.partes.some((p) => p.marca)) ? 1 : 0;
  return resultados
    .map((r) => (r.tipo !== 'articulo' && !r.partes.some((p) => p.marca) ? { ...r, partes: [] } : r))
    .sort((a, b) => seVe(b) - seVe(a) || (b.rank || 0) - (a.rank || 0) || ORDEN[a.tipo] - ORDEN[b.tipo]);
}

/** Una ley con todos sus artículos, en orden. */
export async function traerNorma(id) {
  const { data: norma, error } = await supabase
    .from('normas')
    .select('id, titulo, decreto, tipo, area, estado, descripcion, storage_path, fecha_publicacion, fecha_vigencia, articulos_count, necesita_revision')
    .eq('id', id)
    .single();
  if (error) throw error;
  const articulos = [];
  const lote = 250;
  for (let desde = 0; ; desde += lote) {
    const { data, error: e } = await supabase
      .from('articulos')
      .select('id, numero_articulo, libro, titulo_seccion, capitulo, texto, notas_reforma')
      .eq('norma_id', id)
      .order('id')
      .range(desde, desde + lote - 1);
    if (e) throw e;
    articulos.push(...(data || []));
    if ((data || []).length < lote) break;
  }
  articulos.sort((a, b) => compararArticulos(a.numero_articulo, b.numero_articulo));
  return { norma, articulos };
}

/** La Constitución y los códigos, para empezar sin escribir nada. */
export async function traerLeyesDeBase() {
  const { data, error } = await supabase
    .from('normas')
    .select('id, titulo, decreto, tipo, articulos_count')
    .in('tipo', ['constitucion', 'codigo'])
    .eq('indexado', true);
  if (error) throw error;
  return (data || []).sort((a, b) => (a.tipo === 'constitucion' ? -1 : b.tipo === 'constitucion' ? 1 : a.titulo.localeCompare(b.titulo)));
}

/** El documento oficial, si la ley lo tiene en línea. */
export const enlaceDeNorma = (norma) => (/^https?:\/\//i.test(norma?.storage_path || '') ? norma.storage_path : null);
