/**
 * Qué es cada cosa del tablero del Congreso, y quién es quién en ella.
 *
 * El tablero mezcla todo lo del día —aprobaciones, citaciones, iniciativas,
 * notas institucionales— y antes todo se dibujaba igual: un rótulo, un título y
 * un resumen. Acá se decide la clase de cada una para que cada clase tenga su
 * forma: la aprobación con su hemiciclo, la citación con a quién citan, la
 * iniciativa como en «Organizado».
 *
 * Sale de lo que el monitor ya marcó (`stage`, `card_type`, `votes`, `origin`);
 * el título solo se lee para lo que el monitor no marca, como la interpelación.
 */

const plano = (t) =>
  String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Cada clase: el texto de su etiqueta, su sticker (con uno que ya existe de
 * respaldo mientras llega el propio) y su paleta, en la misma familia de
 * lavados pálidos que los temas del feed.
 */
export const CLASES = {
  aprobacion: {
    nombre: 'Aprobado',
    sticker: 'congreso-aprobacion',
    respaldo: 'leyes',
    paleta: { lavado: ['#E8EFE9', '#DAE7DC'], tinta: '#2F6B45' },
  },
  eleccion: {
    nombre: 'Elección',
    sticker: 'congreso-eleccion',
    respaldo: 'pleno',
    paleta: { lavado: ['#E8EFE9', '#DAE7DC'], tinta: '#2F6B45' },
  },
  interpelacion: {
    nombre: 'Interpelación',
    sticker: 'congreso-interpelacion',
    respaldo: 'fiscalizacion',
    paleta: { lavado: ['#F3E9E7', '#EBDBD7'], tinta: '#783D34' },
  },
  citacion: {
    nombre: 'Citación',
    sticker: 'congreso-citacion',
    respaldo: 'fiscalizacion',
    paleta: { lavado: ['#F3EEE4', '#EAE1D0'], tinta: '#6A5433' },
  },
  iniciativa: {
    nombre: 'Iniciativa',
    sticker: 'congreso-iniciativa',
    respaldo: 'iniciativas',
    paleta: { lavado: ['#E9ECF3', '#DCE3EF'], tinta: '#2F4A7A' },
  },
  comision: {
    nombre: 'Comisión',
    sticker: 'congreso-comision',
    respaldo: 'comisiones',
    paleta: { lavado: ['#E4EEF1', '#D4E5EA'], tinta: '#2D5862' },
  },
  pleno: {
    nombre: 'Pleno',
    sticker: 'congreso-pleno',
    respaldo: 'pleno',
    paleta: { lavado: ['#ECEAF3', '#DFDDEE'], tinta: '#484468' },
  },
  noticia: {
    nombre: 'Noticia',
    sticker: 'congreso-noticia',
    respaldo: 'congreso',
    paleta: { lavado: ['#EDEDEB', '#E3E3E0'], tinta: '#545956' },
  },
};

const ETAPAS_DE_LEY = ['en_comision', 'dictamen', 'primer_debate', 'segundo_debate', 'tercer_debate'];

export const numeroDe = (item) => item?.iniciativa_numero || item?.card_data?.iniciativa_numero || null;

/** La clase de una nota del tablero. El orden importa: la primera que aplica gana. */
export function claseDe(item) {
  const texto = plano(`${item?.titulo || ''} ${item?.card_data?.subject || ''}`);
  const favor = Number(item?.votes?.favor);
  if (/\binterpel/.test(texto) || /\binterpel/.test(plano(item?.summary))) return 'interpelacion';
  if (item?.stage === 'eleccion' || item?.card_type === 'ficha') return 'eleccion';
  if (item?.stage === 'aprobado' || item?.card_type === 'hemiciclo' || favor > 0) return 'aprobacion';
  if (item?.stage === 'citacion' || /\bcita(cion|n a|do a|da a)\b|\bcito a\b/.test(texto)) return 'citacion';
  if (item?.stage === 'iniciativa_presentada' || (numeroDe(item) && ETAPAS_DE_LEY.includes(item?.stage))) return 'iniciativa';
  if (item?.origin === 'comision' || item?.comision_name || ETAPAS_DE_LEY.includes(item?.stage)) return 'comision';
  if (['pleno', 'jefes_bloque', 'junta_directiva'].includes(item?.origin)) return 'pleno';
  return 'noticia';
}

// ─── Quién es quién ──────────────────────────────────────────────────────────

const INSTITUCION =
  /^(ministerio|direccion|instituto|secretaria|comision|procuraduria|contraloria|unidad|hospital|oficina|superintendencia|registro|tribunal|corte|organismo|policia|municipalidad|alcaldia|empresa|asociacion|fondo|consejo|banco|universidad|entidad|comite|fiscalia|sistema|programa|departamento|gobernacion|junta|federacion|camara|autoridad|agencia|servicio|coordinadora|defensoria|foro)\b/;

// Lo que nombra al Congreso entero o a nadie en particular.
const GENERICO = /^(congreso|el congreso|congreso de la republica|\d+ diputados|diputados|x legislatura|la legislatura|pleno|comite de vecinos|vecinos|dirigentes comunitarios)\b/;

const sinCargo = (n) => String(n || '').replace(/^\s*(el |la )?(diputad[oa]|congresista|jef[ea] de bloque)\s+/i, '').trim();

/** ¿Es una sigla o un nombre de institución? («PNC», «Fegua», «CIV», «Ministerio de…»). */
function esInstitucion(nombre) {
  const p = plano(nombre);
  if (INSTITUCION.test(p)) return true;
  // Siglas: todo mayúsculas (PNC, MSPAS).
  const limpio = String(nombre).replace(/\(.*?\)/g, '').trim();
  if (/^[A-ZÁÉÍÓÚÑ0-9-]{2,}$/.test(limpio)) return true;
  // Una sola palabra no es el nombre de una persona: «Fegua», «Emetra».
  if (!/\s/.test(limpio)) return true;
  if (/\([A-ZÁÉÍÓÚÑa-z]{2,}\)/.test(nombre)) return true;
  return false;
}

/**
 * Un nombre del monitor contra la lista de diputados: es esa persona si todas
 * sus palabras están en el nombre completo y no hay otro que también calce.
 * El monitor escribe «Ronald Portillo»; la lista, «Ronald Yomelfy Portillo
 * Cordón».
 */
export function diputadoDe(nombre, diputados = []) {
  const palabras = plano(sinCargo(nombre)).split(' ').filter((w) => w.length > 1);
  if (palabras.length < 2) return null;
  const calzan = diputados.filter((d) => {
    const completo = new Set(plano(d.nombre).split(' '));
    return palabras.every((w) => completo.has(w));
  });
  return calzan.length === 1 ? calzan[0] : null;
}

/** «VAMOS» → «Vamos»; las siglas cortas (UNE, VOS) se quedan. */
export const nombreDeBloque = (b) => {
  const s = String(b || '').trim();
  if (!s) return null;
  return s.length <= 3 ? s.toUpperCase() : s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

/**
 * Los actores de una nota, repartidos: diputados (con su bloque), instituciones
 * y otras personas. Los bloques sueltos («Vamos», «bancada VOS») no se listan:
 * ya van al lado de su diputado. Lo genérico («160 diputados») se descarta.
 */
export function repartirActores(actores = [], diputados = []) {
  const bloques = new Set(diputados.map((d) => plano(d.bloque)).filter(Boolean));
  const out = { diputados: [], instituciones: [], personas: [] };
  const vistos = new Set();
  for (const crudo of actores || []) {
    const nombre = sinCargo(crudo);
    const p = plano(nombre);
    if (!p || vistos.has(p) || GENERICO.test(p)) continue;
    vistos.add(p);
    const sinPrefijo = p.replace(/^(bloque|bancada|partido)\s+/, '');
    if (/^(bloque|bancada)\b/.test(p) || bloques.has(sinPrefijo) || /^winaq$/.test(sinPrefijo)) continue;
    const d = diputadoDe(nombre, diputados);
    if (d) out.diputados.push({ nombre, bloque: nombreDeBloque(d.bloque) });
    else if (esInstitucion(nombre)) out.instituciones.push({ nombre });
    else out.personas.push({ nombre });
  }
  return out;
}

/** Qué alcanzó una votación con `n` votos a favor de 160. */
export function mayoriaDe(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 107) return 'alcanzó los dos tercios (107)';
  if (v >= 81) return 'alcanzó la mayoría absoluta (81)';
  return 'no llegó a la mayoría absoluta (81)';
}
