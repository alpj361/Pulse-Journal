import { supabase } from '../../utils/supabase';
import { EXTRACTORW_URL } from '../../utils/servicios';
import { normalizar } from './organizacion';
import { etapaDe } from './iniciativas';

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

const NUMERO_ARTICULO = /\bart(?:[íi]culos?|s?\.)?\s*(\d+)(?![\d])/i;
// Los sufijos latinos van en serie (bis, ter, quáter…) y las letras en otra
// (A, B… Ñ). Ñ no es N y sexies no es el número solo: cada uno es su artículo.
const LATINOS = ['BIS', 'TER', 'QUATER', 'QUINQUIES', 'SEXIES', 'SEPTIES', 'OCTIES', 'NONIES', 'DECIES'];
const SUFIJO_LATINO = /^\s*[«"“”]?\s*(bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies)(?![a-zñáéíóú])\s*[»"“”]?/i;
const SUFIJO_LETRA = /^\s*([«"“”])?\s*([a-zñ])(?![a-zñáéíóú])\s*([»"“”])?/i;

/** El sufijo que sigue al número, si lo hay, y cuánto texto ocupa. */
function sufijoDe(despues) {
  const latino = despues.match(SUFIJO_LATINO);
  if (latino) return { sufijo: latino[1].toUpperCase().replace('Á', 'A'), largo: latino[0].length };
  const letra = despues.match(SUFIJO_LETRA);
  if (!letra) return null;
  // «art 5 a la ley» no es el 5 A: una letra suelta cuenta si va entre
  // comillas, en mayúscula o justo antes de la ley («327 g del código»).
  const sigue = despues.slice(letra[0].length);
  const esSufijo = (letra[1] && letra[3]) || /[A-ZÑ]/.test(letra[2]) || /^\s*(?:$|[,.;:)]|del?\b)/i.test(sigue);
  return esSufijo ? { sufijo: letra[2].toUpperCase(), largo: letra[0].length } : null;
}

/**
 * Qué se pidió: el texto tal cual, y si nombra un artículo, su número y lo
 * demás (casi siempre, la ley: «constitución», «código de trabajo»).
 */
export function leerConsulta(texto) {
  const q = String(texto || '').replace(/\s+/g, ' ').trim();
  const m = q.match(NUMERO_ARTICULO);
  if (!m) return { q, numero: null, resto: '' };
  const fin = m.index + m[0].length;
  const suf = sufijoDe(q.slice(fin));
  const numero = suf ? `${m[1]} ${suf.sufijo}` : m[1];
  const resto = (q.slice(0, m.index) + ' ' + q.slice(fin + (suf?.largo || 0))).replace(/\b(de|del|la|el)\b/gi, ' ').replace(/\s+/g, ' ').trim();
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
  let f = String(fragmento || '')
    .replace(/(?:<b>)?Fuente(?:<\/b>)?:[^.]*\.\s*/gi, ' ')
    // Las notas de quien cargó el texto («Ojo: …», «ATENCIÓN: …») no son para quien lee.
    .replace(/(?:^|\s)(?:Ojo|ATENCI[ÓO]N|Nota interna):[\s\S]*$/i, ' ');
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
  else {
    // Un fragmento que empieza a media frase del título («Penal (Decreto
    // 51-92). …»): se quita ese final del título.
    for (let k = Math.min(fichas.length, palabras.length - 1); k >= 1; k--) {
      const inicio = fichas.slice(0, k).map(plana).join(' ');
      if (inicio && inicio === palabras.slice(-k).map(plana).join(' ')) { f = fichas.slice(k).join(' '); break; }
    }
  }
  f = f.replace(/^\s*\((?:<b>)?decreto[^)]*\)\.?/i, '').replace(/^\s*de (?:la Rep[úu]blica de )?Guatemala[.,]?\s*/i, '');
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
/** «327 G» como lo escribe una ley: «327 "G"», «327 “G”», «195 Quáter». */
function patronArticulo(numero) {
  const [base, ...resto] = String(numero).trim().split(/\s+/);
  const sufijo = resto.join(' ');
  if (!sufijo) return escapar(base);
  return `${escapar(base)}\\s*[«"“”']?\\s*${escapar(sufijo).replace(/A/gi, '[aá]')}\\s*[»"“”']?`;
}

export function textoLegible(texto, { numero, titulo } = {}) {
  let t = String(texto || '').replace(/\r/g, '');
  if (numero) t = t.replace(new RegExp(`^\\s*art[íi]culo\\.?\\s+${patronArticulo(numero)}(?![a-zñ\\d])\\s*[.:\\-–—]?\\s*`, 'i'), '');
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
  return na - nb || rangoSufijo(a) - rangoSufijo(b) || String(a).localeCompare(String(b), 'es', { numeric: true });
}

/** El lugar del sufijo: sin sufijo, luego bis, ter, quáter…, luego A, B… Ñ… Z. */
function rangoSufijo(numero) {
  const suf = String(numero).replace(/^\d+\s*/, '').toUpperCase().replace('Á', 'A');
  if (!suf) return 0;
  const latino = LATINOS.indexOf(suf);
  if (latino >= 0) return 1 + latino;
  if (/^[A-ZÑ]$/.test(suf)) return 20 + 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.indexOf(suf);
  return 100;
}

/**
 * La nota de reforma que trae un artículo, sin lo que es de quien cargó el
 * texto (respaldos, notas de carga): queda lo que le sirve a quien lee.
 */
export function notaVisible(nota) {
  const limpia = String(nota || '')
    .split(/(?<=\.)\s+/)
    .filter((o) => !/backup|respaldo|nota de carga|texto anterior en/i.test(o))
    .join(' ')
    .trim();
  return limpia || null;
}

/**
 * Las notas internas que vienen en la descripción de una ley (de dónde salió
 * el texto, qué le falta al archivo) no son para quien lee: quedan las
 * oraciones que dicen qué regula y qué la reformó.
 */
export function descripcionDe(norma) {
  const d = String(norma?.descripcion || '').replace(/^Fuente:[^.]*\.\s*/i, '').trim();
  if (!d) return null;
  const t = compacto(norma.titulo);
  const oraciones = d
    .split(/(?<=\.)\s+/)
    .filter((o) => !/texto cargado|fuente compilada|corpus|^atenci[oó]n|^ojo/i.test(o))
    // La oración que solo nombra la ley («Código de Trabajo de Guatemala.»,
    // «Código de Comercio (Decreto 2-70).») repite el título de arriba.
    .filter((o, i) => !(i === 0 && t && compacto(o).startsWith(t) && o.length < (norma.titulo || '').length + 40));
  return oraciones.join(' ').trim() || null;
}

const compacto = (t) => normalizar(t).replace(/[^a-z0-9]/g, '');

const NOMBRE_TIPO = {
  constitucion: 'constitución', codigo: 'código', ley: 'ley', convenio: 'convenio', reglamento: 'reglamento', otro: 'acuerdo',
};
export const nombreTipo = (tipo) => NOMBRE_TIPO[tipo] || tipo || null;

/**
 * El rótulo de una ley, sin lo que el título ya dice: «CÓDIGO · DECRETO 1441»
 * sobre «Código de Trabajo» queda «DECRETO 1441»; «CONSTITUCIÓN ·
 * CONSTITUCIÓN 1985», «CONSTITUCIÓN 1985»; y un convenio cuyo título ya
 * trae su número queda con su tipo.
 */
export function rotuloDeNorma(norma) {
  const titulo = compacto(norma?.titulo);
  const tipo = nombreTipo(norma?.tipo);
  const nombre = nombreDecreto(norma?.decreto);
  const decreto = nombre && !titulo.includes(compacto(nombre)) ? nombre : null;
  const tipoDicho = tipo && (titulo.startsWith(compacto(tipo)) || compacto(decreto).startsWith(compacto(tipo)));
  const partes = [tipoDicho ? null : tipo, decreto].filter(Boolean);
  return (partes.length ? partes : [tipo || 'ley']).join(' · ').toUpperCase();
}

const NOMBRE_ESTADO = {
  vigente: null, derogada: 'derogada', vetado: 'vetada', pendiente_sancion: 'pendiente de sanción', vigencia_diferida: 'vigencia diferida',
};
/** Vigente no se dice: es lo esperado. Lo demás sí, porque cambia lo que vale. */
export const nombreEstado = (estado) => (estado in NOMBRE_ESTADO ? NOMBRE_ESTADO[estado] : estado || null);

// ─── Iniciativas y leyes ─────────────────────────────────────────────────────

/** Los decretos que nombra un texto: «Decreto Número 51-92» → «51-92». */
export function decretosNombrados(texto) {
  const re = /decretos?(?:[\s-]+ley)?\s+(?:n[úu]mero\s+|no\.\s*)?(\d{1,4}(?:\s*-\s*\d{2,4})?)/gi;
  const vistos = new Set();
  for (const m of String(texto || '').matchAll(re)) vistos.add(m[1].replace(/\s+/g, ''));
  return [...vistos];
}

/** El número de una ley de la base: «Decreto 51-92» (o «51-92» solo) → «51-92». Los acuerdos y tratados no tienen. */
export const numeroDeDecreto = (decreto) => String(decreto || '').trim().match(/^(?:decreto(?:[\s-]+ley)?\s+)?(\d{1,4}(?:-\d{2,4})?)$/i)?.[1] || null;

/** Algunas leyes se cargaron con el número solo: «9-2009» se dice «Decreto 9-2009». */
export const nombreDecreto = (decreto) => {
  const d = String(decreto || '').trim();
  return d ? (/^\d/.test(d) ? `Decreto ${d}` : d) : null;
};

/**
 * A qué leyes de la base se refiere una iniciativa: las que nombra por su
 * decreto («reformas al Decreto Número 17-73») o, si no nombra ninguno, por su
 * nombre («reformas al Código Tributario»).
 */
export function leyesNombradas(titulo, normas) {
  const numeros = decretosNombrados(titulo);
  const porNumero = normas.filter((n) => numeros.includes(numeroDeDecreto(n.decreto)));
  if (porNumero.length) return porNumero.slice(0, 3);
  const t = normalizar(titulo);
  return normas
    .filter((n) => ['codigo', 'constitucion'].includes(n.tipo) || String(n.titulo || '').length >= 18)
    .filter((n) => t.includes(normalizar(n.titulo)))
    .slice(0, 3);
}

/** Qué propone: cambiar una ley que ya existe, una ley nueva u otra cosa (un préstamo, un presupuesto). */
export function propositoDe(titulo) {
  const t = normalizar(titulo);
  if (/\b(reforma|modifica|adiciona|deroga|interpreta)/.test(t)) return 'reforma';
  if (/\bley\b|\bcodigo\b/.test(t)) return 'nueva';
  return 'otra';
}

/**
 * Una iniciativa leída al lado de las leyes: en qué etapa va, si ya es ley
 * (y cuál), y qué leyes cambia. Lo que todavía no se aprueba no es ley: es
 * una propuesta, y así se muestra.
 */
export function relacionDe(ini, normas) {
  const etapa = etapaDe(ini);
  const resultante = ini.decreto_resultante
    ? normas.find((n) => numeroDeDecreto(n.decreto) === String(ini.decreto_resultante).replace(/\s+/g, '')) || { decreto: `Decreto ${ini.decreto_resultante}` }
    : null;
  const proposito = propositoDe(ini.titulo);
  const cambia = proposito === 'reforma' ? leyesNombradas(ini.titulo, normas).filter((n) => !resultante?.id || n.id !== resultante.id) : [];
  // Los decretos que nombra y no están en la base: se dicen, sin enlace.
  const conocidos = new Set(cambia.map((n) => numeroDeDecreto(n.decreto)));
  const sinFicha = proposito === 'reforma' ? decretosNombrados(ini.titulo).filter((d) => !conocidos.has(d)).slice(0, 2) : [];
  // El Congreso la aprobó, pero si el Ejecutivo la vetó no es ley: no cambió nada.
  const vetada = resultante?.estado === 'vetado';
  const aprobada = !vetada && (etapa === 'aprobado' || !!resultante);
  // Aprobada y todavía sin valer del todo: pendiente de sanción, vigencia diferida, derogada.
  const estadoLey = aprobada ? nombreEstado(resultante?.estado) : null;
  return { etapa, aprobada, vetada, estadoLey, resultante, proposito, cambia, sinFicha };
}

/**
 * Lo que pasa en el Congreso con una ley: la iniciativa de la que nació y las
 * que la quieren cambiar, primero las que siguen en trámite y las más nuevas.
 */
export function iniciativasDeLey(norma, iniciativas, normas = []) {
  const numero = numeroDeDecreto(norma?.decreto);
  const origen = numero ? iniciativas.find((i) => String(i.decreto_resultante || '').replace(/\s+/g, '') === numero) || null : null;
  const indice = normas.some((n) => n.id === norma?.id) ? normas : [...normas, norma];
  const cambios = iniciativas
    .filter((i) => i !== origen && propositoDe(i.titulo) === 'reforma' && leyesNombradas(i.titulo, [norma]).length)
    .map((i) => ({ ini: i, rel: relacionDe(i, indice) }))
    .sort((a, b) => terminada(a.rel) - terminada(b.rel) || b.ini.numero - a.ini.numero);
  return { origen: origen ? { ini: origen, rel: relacionDe(origen, indice) } : null, cambios };
}

const terminada = (rel) => Number(rel.aprobada || rel.vetada);

/** Todas las leyes de la base, para reconocerlas en los títulos de las iniciativas. */
export async function traerIndiceNormas() {
  const { data, error } = await supabase.from('normas').select('id, titulo, decreto, tipo, estado').eq('indexado', true);
  if (error) throw error;
  return data || [];
}

/**
 * El documento de una ley para el lector: el enlace oficial, o el PDF que
 * guarda la biblioteca legal. Un texto plano no es el documento: ya está en
 * sus artículos.
 */
export async function urlDeDocumento(norma) {
  const ruta = norma?.storage_path;
  if (!ruta) return null;
  if (/^https?:\/\//i.test(ruta)) return ruta;
  if (!/\.pdf$/i.test(ruta)) return null;
  const { data, error } = await supabase.storage.from('documentos-legales').createSignedUrl(ruta, 60 * 60);
  return error ? null : data?.signedUrl || null;
}

// ─── Consultas ───────────────────────────────────────────────────────────────

/**
 * Un artículo por su número: primero la resolución exacta del servidor (la
 * misma de Vizta), que distingue el Código Penal del Procesal Penal y no
 * cambia un artículo por otro parecido. Sin sesión o sin servidor, se busca
 * el número aquí.
 */
async function porNumero(numero, resto, q) {
  if (resto) {
    const exacto = await resolverExacto(q);
    if (exacto?.ambigua) return conProcedencia(await numeroEnLaBase(numero, '', exacto.candidatos));
    if (exacto) return exacto.resultados;
  }
  return conProcedencia(await numeroEnLaBase(numero, resto));
}

/** null si no se pudo preguntar; si no, lo que el servidor resolvió, sin adivinar. */
async function resolverExacto(q) {
  try {
    const { data: sesion } = await supabase.auth.getSession();
    const token = sesion?.session?.access_token;
    if (!token) return null;
    const control = new AbortController();
    const espera = setTimeout(() => control.abort(), 6000);
    const res = await fetch(`${EXTRACTORW_URL}/api/legal/resolve?limit=10&query=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: control.signal,
    }).finally(() => clearTimeout(espera));
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.seleccion?.referencia_invalida) return null;
    // Varias leyes posibles: se muestra el artículo en cada una, sin elegir.
    if (json?.seleccion?.ambigua) return { ambigua: true, candidatos: (json.seleccion.candidatos || []).map((c) => c.id) };
    return { resultados: (json?.results || []).map(deResolucion) };
  } catch {
    return null;
  }
}

/** Un artículo como lo devuelve el servidor, como un resultado del buscador. */
export function deResolucion(r) {
  const numero = String(r.articulo || '').replace(/^art\.?\s*/i, '');
  return {
    tipo: 'articulo', clave: `articulo-${r.articulo_id}`, id: r.articulo_id, normaId: r.norma_id, numero,
    titulo: r.norma, decreto: r.decreto,
    partes: [{ texto: textoLegible(r.texto, { numero, titulo: r.norma }).slice(0, 260), marca: false }],
    reforma: reformaDe(r.procedencia),
  };
}

/** El número escrito como está en la base: quáter va con y sin tilde. */
const patronNumero = (numero) => numero.replace(/QUATER$/, 'QU_TER');

async function numeroEnLaBase(numero, resto, soloNormas = null) {
  let consulta = supabase
    .from('articulos')
    .select('id, numero_articulo, texto, norma_id, derogado, normas(titulo, decreto, tipo)')
    .ilike('numero_articulo', patronNumero(numero))
    .eq('excluido_busqueda', false);
  if (soloNormas?.length) consulta = consulta.in('norma_id', soloNormas);
  const { data, error } = await consulta.limit(300);
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
      derogado: !!f.derogado,
      partes: [{ texto: textoLegible(f.texto, { numero: f.numero_articulo, titulo: f.normas?.titulo }).slice(0, 260), marca: false }],
    }));
}

/**
 * Qué decreto cambió el texto de un artículo y desde cuándo vale, como lo
 * acredita la base. Sin reforma acreditada, nada: no se adivina.
 */
export function reformaDe(p) {
  if (!p?.decreto_reforma && !p?.reformado_por) return null;
  return { decreto: nombreDecreto(p.decreto_reforma), normaId: p.reformado_por || null, desde: p.vigente_desde || null };
}

/** Los artículos encontrados, con su reforma: una sola consulta para todos. */
async function conProcedencia(resultados) {
  const ids = resultados.filter((r) => r.tipo === 'articulo').map((r) => r.id);
  if (!ids.length) return resultados;
  const { data, error } = await supabase.rpc('legal_procedencia_articulos', { p_ids: ids });
  // La procedencia acompaña; si no llega, los artículos se muestran igual.
  if (error || !Array.isArray(data)) return resultados;
  const porId = new Map(data.map((p) => [p.articulo_id, p]));
  return resultados.map((r) => (r.tipo === 'articulo' && porId.has(r.id) ? { ...r, reforma: reformaDe(porId.get(r.id)) } : r));
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
    const exactos = await porNumero(numero, resto, q);
    if (exactos.length) return { resultados: exactos, amplia: false, numero };
  }
  const resultados = await deLaBase(q);
  if (resultados.length) return { resultados: porCoincidencia(await conProcedencia(resultados), q), amplia: false };
  const amplia = consultaAmplia(q);
  if (!amplia) return { resultados: [], amplia: false };
  return { resultados: porCoincidencia(await conProcedencia(await deLaBase(amplia))), amplia: true };
}

/**
 * Lo que más coincide, primero, sea ley, artículo o iniciativa. Lo que no
 * muestra dónde coincide (una ley que lo dice en algún lugar de su texto
 * completo, lejos del fragmento) va después de lo que sí. Un fragmento sin
 * nada marcado no se muestra: solo repetiría el título.
 */
export function porCoincidencia(resultados, q = '') {
  const ORDEN = { ley: 0, articulo: 1, iniciativa: 2 };
  const seVe = (r) => (r.coincide ?? r.partes.some((p) => p.marca)) ? 1 : 0;
  // Si lo buscado es el nombre de una ley («código penal»), esa ley va primero.
  const buscado = compacto(q);
  const esLaLey = (r) => (r.tipo === 'ley' && buscado && compacto(r.titulo) === buscado ? 1 : 0);
  return resultados
    .map((r) => (r.tipo !== 'articulo' && !r.partes.some((p) => p.marca) ? { ...r, partes: [] } : r))
    .sort((a, b) => esLaLey(b) - esLaLey(a) || seVe(b) - seVe(a) || (b.rank || 0) - (a.rank || 0) || ORDEN[a.tipo] - ORDEN[b.tipo]);
}

/** Una ley con todos sus artículos, en orden. */
export async function traerNorma(id) {
  const { data: norma, error } = await supabase
    .from('normas')
    .select('id, titulo, decreto, tipo, area, estado, descripcion, storage_path, fecha_publicacion, fecha_vigencia, articulos_count, necesita_revision, texto_al')
    .eq('id', id)
    .single();
  if (error) throw error;
  const filas = [];
  const lote = 250;
  for (let desde = 0; ; desde += lote) {
    const { data, error: e } = await supabase
      .from('articulos')
      .select('id, numero_articulo, libro, titulo_seccion, capitulo, texto, notas_reforma, derogado, reformado_por, vigente_desde')
      .eq('norma_id', id)
      .eq('excluido_busqueda', false)
      .order('id')
      .range(desde, desde + lote - 1);
    if (e) throw e;
    filas.push(...(data || []));
    if ((data || []).length < lote) break;
  }
  const { reformas, porConfirmar, decretos } = await reformasDeLaLey(id, filas);
  const articulos = filas
    .map((a) => ({ ...a, reforma: reformaDeArticulo(a, reformas, decretos) }))
    .sort((a, b) => compararArticulos(a.numero_articulo, b.numero_articulo));
  return { norma: { ...norma, ultimaReforma: ultimaReforma(articulos), porConfirmar }, articulos };
}

/**
 * Lo que los decretos le hicieron a una ley: qué artículo reformaron,
 * agregaron o derogaron (lo aplicado), y cuántas instrucciones siguen por
 * confirmar. Los decretos se traen por su id para nombrarlos.
 */
async function reformasDeLaLey(normaId, filas) {
  const { data } = await supabase
    .from('reformas')
    .select('numero_destino, accion, estado, decreto_id')
    .eq('norma_destino_id', normaId)
    .in('estado', ['aplicada', 'revision']);
  const lista = data || [];
  const reformas = new Map(lista.filter((r) => r.estado === 'aplicada').map((r) => [`${r.decreto_id}|${r.numero_destino}`, r.accion]));
  const ids = [...new Set(filas.map((a) => a.reformado_por).filter(Boolean))];
  const decretos = new Map();
  if (ids.length) {
    const { data: normas } = await supabase.from('normas').select('id, titulo, decreto').in('id', ids);
    for (const n of normas || []) decretos.set(n.id, n);
  }
  return { reformas, decretos, porConfirmar: lista.filter((r) => r.estado === 'revision').length };
}

/** La reforma de un artículo: qué decreto, qué hizo y desde cuándo. */
export function reformaDeArticulo(a, reformas, decretos) {
  if (!a.reformado_por) return null;
  const decreto = decretos.get(a.reformado_por);
  const accion = a.derogado ? 'deroga' : reformas.get(`${a.reformado_por}|${a.numero_articulo}`) || 'reforma';
  return { decreto: nombreDecreto(decreto?.decreto), titulo: decreto?.titulo || null, normaId: a.reformado_por, desde: a.vigente_desde || null, accion };
}

/** La reforma más reciente que se aplicó a la ley, para decir hasta dónde llega. */
export function ultimaReforma(articulos) {
  return articulos
    .filter((a) => a.reforma?.desde && a.reforma.decreto)
    .reduce((ultima, a) => (!ultima || a.reforma.desde > ultima.desde ? a.reforma : ultima), null);
}

/**
 * El texto que tuvo un artículo antes de su última reforma, solo cuando se
 * pide. Si la base no lo tiene (el artículo se reformó pero su texto anterior
 * nunca se cargó), se dice; no se completa con el texto actual.
 */
export async function traerVersionAnterior(articuloId) {
  const { data, error } = await supabase.rpc('legal_detalle_articulo', { p_articulo: articuloId, p_fecha: null, p_version: null, p_offset: 0, p_limite: 20 });
  if (error) throw error;
  const versiones = data?.versiones || [];
  const actual = versiones.find((v) => v.es_actual);
  const anterior = versiones.find((v) => !v.es_actual);
  if (!anterior) return { texto: null, desconocida: !!actual?.anterior_desconocida };
  const { data: elegida, error: e } = await supabase.rpc('legal_detalle_articulo', { p_articulo: articuloId, p_fecha: null, p_version: anterior.id, p_offset: 0, p_limite: 1 });
  if (e) throw e;
  return { texto: elegida?.version_seleccionada?.texto || null, hasta: anterior.vigente_hasta || null, desconocida: false };
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
