/**
 * Los 160 diputados: quiénes son, en qué curul se dibujan y cómo votaron.
 *
 * La lista sale del dataset «Congreso de Guatemala» que se armó en Vizta
 * (nombre, partido, distrito, foto), no de una tabla aparte: lo que se hace con
 * la herramienta es lo que se muestra.
 *
 * El Congreso no publica un plano de dónde se sienta cada quien. El hemiciclo
 * es por bancada: de la más grande a la más chica, los independientes al final,
 * y dentro de cada bancada por distrito. Cada diputado cae siempre en la misma
 * curul, así que en una votación se ve quién se apartó de los suyos.
 */
import { supabase } from '../../utils/supabase';

export const DATASET_DIPUTADOS = '45acd9cc-70b7-4470-ae1f-7910d266906d';

// Las seis bancadas grandes llevan color; las demás, uno solo: con diecisiete
// colores no se distingue ninguno.
export const COLOR_BANCADA = {
  VAMOS: '#7F77DD',
  UNE: '#D85A30',
  CABAL: '#1D9E75',
  VALOR: '#D4537E',
  VIVA: '#378ADD',
  TODOS: '#BA7517',
  IND: '#888780',
};
export const COLOR_OTRA = '#D3D1C7';
export const colorBancada = (sigla) => COLOR_BANCADA[sigla] || COLOR_OTRA;

/** El nombre sin acentos, espacios dobles ni orden: CINCO a veces pone primero los apellidos. */
export function claveNombre(nombre) {
  return String(nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

/** «Vamos por una Guatemala Diferente - VAMOS» → «VAMOS»; «Independiente - IND» → «IND». */
export function siglaDe(partido) {
  const s = String(partido || '').trim();
  const sigla = (s.includes(' - ') ? s.split(' - ').pop() : s).split('-')[0].trim().toUpperCase();
  return sigla || 'IND';
}

/** El bloque como lo escribe el registro de votos («INDEP», «WINAQ») en la misma sigla del dataset. */
export const siglaDelVoto = (bloque) => {
  const s = String(bloque || '').trim().toUpperCase();
  return s === 'INDEP' || s === 'INDEPENDIENTE' || !s ? 'IND' : s.split('-')[0];
};

/** «VAMOS» → «Vamos»; las siglas cortas (UNE, PU, VOS) se quedan; IND son los independientes. */
export function nombreBancada(sigla, { plural = false } = {}) {
  if (sigla === 'IND') return plural ? 'Independientes' : 'Independiente';
  return sigla.length <= 3 ? sigla : sigla.charAt(0) + sigla.slice(1).toLowerCase();
}

/** Las filas del dataset como diputados. */
export function diputadosDe(filas = []) {
  return filas
    .map(({ id, values: v = {} }) => ({
      id,
      nombre: String(v.nombre || '').replace(/\s+/g, ' ').trim(),
      sigla: siglaDe(v.partido),
      partido: v.partido || null,
      distrito: v.distrito || null,
      foto: v.foto_diputado || null,
      logo: v.logo_del_partido || null,
      estado: v.estado || null,
      fechaEstado: v.fecha_estado || null,
      ocupaLaCurulDe: v.ocupa_la_curul_de ? String(v.ocupa_la_curul_de).replace(/\s+/g, ' ').trim() : null,
    }))
    .filter((d) => d.nombre);
}

/*
 * Quien deja de ser diputado (falleció, renunció, lo destituyeron) sigue en la
 * lista: sus votos pasados son suyos. Su curul queda vacía hasta que la ocupa
 * quien lo reemplaza, que en el dataset lleva su nombre en `ocupa_la_curul_de`.
 * La licencia no deja la curul. Ver docs/DESIGN.md › Diputados que dejan el cargo.
 */
// Sustantivos, no verbos: el rótulo informa un hecho y no supone el género.
const NOMBRE_ESTADO = { fallecido: 'fallecimiento', renuncio: 'renuncia', destituido: 'destitución', licencia: 'licencia' };
const dia = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' });
const diaLargo = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' });

/** Dejó la curul: no se cuenta la licencia, que es temporal. */
export const dejoLaCurul = (d) => !!d && ['fallecido', 'renuncio', 'destituido'].includes(d.estado);

/** La pill de su estado: «fallecimiento · 6 nov». */
export function rotuloEstado(d) {
  const nombre = NOMBRE_ESTADO[d?.estado];
  if (!nombre) return null;
  return d.fechaEstado ? `${nombre} · ${dia(d.fechaEstado)}` : nombre;
}

/**
 * El helper de la pill, en registro instructivo: el hecho con su fecha, qué
 * pasa con la curul y qué pasa con sus votos. Ver docs/DESIGN.md › Ayudas.
 */
export function ayudaEstado(d, diputados = []) {
  if (!d) return null;
  const fecha = d.fechaEstado ? diaLargo(d.fechaEstado) : null;
  if (d.ocupaLaCurulDe) return `Sustituye en la curul a ${d.ocupaLaCurulDe}${fecha ? ` desde el ${fecha}` : ''}.`;
  if (!dejoLaCurul(d)) {
    return d.estado === 'licencia'
      ? `Licencia vigente${fecha ? ` desde el ${fecha}` : ''}. La curul se conserva; en las votaciones figura «con licencia».`
      : null;
  }
  const hecho = `${NOMBRE_ESTADO[d.estado][0].toUpperCase()}${NOMBRE_ESTADO[d.estado].slice(1)}${fecha ? `: ${fecha}` : ''}.`;
  const quien = diputados.find((o) => o.ocupaLaCurulDe && claveNombre(o.ocupaLaCurulDe) === claveNombre(d.nombre));
  const curul = quien
    ? `La curul la ocupa ${quien.nombre}.`
    : 'La curul permanece vacante hasta la juramentación de quien sustituya en el cargo.';
  return `${hecho} ${curul} Los votos emitidos antes de esa fecha se conservan en el registro.`;
}

/** Los que se sientan hoy: quien dejó la curul y ya tiene reemplazo sale; el reemplazo entra en su lugar. */
export function enElPleno(diputados = []) {
  const reemplazados = new Set(diputados.filter((d) => d.ocupaLaCurulDe).map((d) => claveNombre(d.ocupaLaCurulDe)));
  return diputados.filter((d) => !(dejoLaCurul(d) && reemplazados.has(claveNombre(d.nombre))));
}

export async function traerDiputados() {
  const { data, error } = await supabase
    .from('dataset_rows')
    .select('id, values')
    .eq('dataset_id', DATASET_DIPUTADOS)
    .is('deleted_at', null)
    .limit(200);
  if (error) throw error;
  return diputadosDe(data || []);
}

/** Las bancadas de la más grande a la más chica; los independientes, al final. */
export function ordenBancadas(diputados = []) {
  const tam = {};
  for (const d of diputados) tam[d.sigla] = (tam[d.sigla] || 0) + 1;
  const orden = Object.keys(tam)
    .filter((s) => s !== 'IND')
    .sort((a, b) => tam[b] - tam[a] || a.localeCompare(b));
  if (tam.IND) orden.push('IND');
  return orden.map((sigla) => ({ sigla, total: tam[sigla] }));
}

/**
 * Las 160 curules en media luna, de izquierda a derecha y, en cada ángulo, de
 * adentro hacia afuera. x, y en una media luna de radio 1.
 */
export function curulesDelHemiciclo() {
  const FILAS = [16, 18, 20, 22, 26, 28, 30]; // de adentro hacia afuera; suma 160
  const R0 = 0.42;
  const paso = (1 - R0) / (FILAS.length - 1);
  const puntos = [];
  FILAS.forEach((cuantas, f) => {
    const r = R0 + paso * f;
    for (let i = 0; i < cuantas; i += 1) {
      const a = Math.PI - (Math.PI * (i + 0.5)) / cuantas;
      puntos.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, a, r });
    }
  });
  return puntos.sort((p, q) => q.a - p.a || p.r - q.r);
}

/** Cada diputado en su curul: [{ x, y, diputado }], siempre en el mismo orden. */
export function asignarCurules(diputados = []) {
  const orden = ordenBancadas(diputados).map((b) => b.sigla);
  const sentados = [...diputados].sort(
    (a, b) =>
      orden.indexOf(a.sigla) - orden.indexOf(b.sigla) ||
      String(a.distrito).localeCompare(String(b.distrito)) ||
      a.nombre.localeCompare(b.nombre),
  );
  return curulesDelHemiciclo()
    .slice(0, sentados.length)
    .map((p, i) => ({ ...p, diputado: sentados[i] }));
}

// El color de cada voto, el mismo en el conteo y en cada curul.
export const COLOR_VOTO = { favor: '#15803D', contra: '#B91C1C', ausente: 'rgba(28,43,34,0.28)', licencia: 'rgba(28,43,34,0.12)' };

export const CLAVE_VOTO = { 'A FAVOR': 'favor', 'EN CONTRA': 'contra', AUSENTE: 'ausente', LICENCIA: 'licencia' };
export const ORDEN_VOTO = ['favor', 'contra', 'ausente', 'licencia'];

/**
 * Los votos de una votación, uno por persona. El registro trae a veces a la
 * misma persona dos veces, con el nombre en otro orden: cuenta una.
 */
export function votosUnicos(votos = []) {
  const vistos = new Map();
  for (const v of votos) {
    const clave = claveNombre(v.diputado);
    if (!clave || vistos.has(clave)) continue;
    const voto = CLAVE_VOTO[String(v.voto || '').toUpperCase()];
    if (voto) vistos.set(clave, { diputado: v.diputado, sigla: siglaDelVoto(v.bloque), voto });
  }
  return vistos;
}

/**
 * Cada bancada con cómo votaron los suyos, de la más grande a la más chica.
 * La bancada es la del día del voto, que es la del registro. Cada persona trae
 * su ficha del dataset si está (foto, distrito).
 */
export function bancadasDeLaVotacion(votos, diputados = []) {
  const fichas = new Map(diputados.map((d) => [claveNombre(d.nombre), d]));
  const bancadas = new Map();
  for (const [clave, v] of votos) {
    const b = bancadas.get(v.sigla) || { sigla: v.sigla, total: 0, favor: 0, contra: 0, ausente: 0, licencia: 0, personas: [] };
    b[v.voto] += 1;
    b.total += 1;
    const ficha = fichas.get(clave);
    b.personas.push({ ...(ficha || { nombre: v.diputado, distrito: null, foto: null }), sigla: v.sigla, voto: v.voto });
    bancadas.set(v.sigla, b);
  }
  // Quienes no votaron con la mayoría de su bancada van primero.
  for (const b of bancadas.values()) {
    const mayoria = ORDEN_VOTO.reduce((m, k) => (b[k] > b[m] ? k : m), 'favor');
    b.personas.sort((x, y) => (x.voto === mayoria) - (y.voto === mayoria) || ORDEN_VOTO.indexOf(x.voto) - ORDEN_VOTO.indexOf(y.voto) || x.nombre.localeCompare(y.nombre));
  }
  return [...bancadas.values()].sort((x, y) => y.total - x.total || (x.sigla === 'IND') - (y.sigla === 'IND') || x.sigla.localeCompare(y.sigla));
}

/** Los diputados de cada distrito. */
export function porDistrito(diputados = []) {
  const grupos = {};
  for (const d of diputados) (grupos[d.distrito] = grupos[d.distrito] || []).push(d);
  return grupos;
}

/** El logo de cada bancada, del dataset: { CABAL: 'https://…' }. */
export function logosDeBancadas(diputados = []) {
  const logos = {};
  for (const d of diputados) if (d.logo && !logos[d.sigla]) logos[d.sigla] = d.logo;
  return logos;
}

/** Los distritos con sus diputados, de más a menos y el Listado Nacional primero. */
export function distritosOrdenados(diputados = []) {
  return Object.entries(porDistrito(diputados))
    .map(([distrito, personas]) => ({ distrito, personas: [...personas].sort((a, b) => a.nombre.localeCompare(b.nombre)) }))
    .sort((a, b) => (b.distrito === 'Listado Nacional') - (a.distrito === 'Listado Nacional')
      || b.personas.length - a.personas.length || a.distrito.localeCompare(b.distrito));
}

/** «Ana Patricia Orantes Thomas» → «AO», para cuando no hay foto. */
export function iniciales(nombre) {
  const palabras = String(nombre || '').split(/\s+/).filter((w) => w.length > 2);
  const apellido = palabras.length > 2 ? palabras[palabras.length - 2] : palabras[1];
  return [palabras[0], apellido].filter(Boolean).map((w) => w.charAt(0).toUpperCase()).join('');
}
