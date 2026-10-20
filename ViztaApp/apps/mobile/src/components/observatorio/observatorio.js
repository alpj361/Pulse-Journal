import { EXTRACTORW_URL } from '../../utils/servicios';
import { supabase } from '../../utils/supabase';

/**
 * Lo que la app lee del Observatorio de Poder Ciudadano: por ahora, la Corte de
 * Constitucionalidad (resoluciones), el presupuesto anual y los actores.
 *
 * Todo pasa por ExtractorW (`/api/v1/observatorios`), que lee de la base con
 * su propia llave: la app no puede leer esas tablas directo. Es público
 * (PJ, 20-oct): con sesión se manda el token, sin sesión se pide igual. Los nombres llegan como los dejó el monitor y se muestran
 * así, sin completarlos.
 */
const BASE = `${EXTRACTORW_URL}/api/v1/observatorios`;

export class SinAcceso extends Error {}

async function pedir(ruta, params = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const res = await fetch(`${BASE}${ruta}${query ? `?${query}` : ''}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (res.status === 401 || res.status === 403) throw new SinAcceso('Sin acceso');
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message || `Error ${res.status}`);
  return json;
}

/** Una página de resoluciones, de la más nueva a la más vieja. */
export const traerResoluciones = (filtros = {}, page = 1, limit = 25) => pedir('/resoluciones', { ...filtros, page, limit });

/** Cuántas hay con esos filtros, sin traerlas. */
export const contarResoluciones = async (filtros = {}) => (await pedir('/resoluciones', { ...filtros, page: 1, limit: 1 })).total || 0;

export const traerResolucion = async (expediente) => (await pedir(`/resoluciones/${encodeURIComponent(expediente)}`)).data;
export const traerPresupuesto = async () => (await pedir('/presupuesto/anual')).data || [];
export const traerActores = async () => (await pedir('/actores')).data || [];

/**
 * Una faceta del diccionario (materia, mes…), sumada entre periodos: el
 * monitor cuenta por periodo de la Corte (2025-2026, 2026-2027).
 */
export async function traerFaceta(faceta) {
  const filas = (await pedir('/diccionario', { faceta })).data || [];
  const suma = new Map();
  for (const f of filas) {
    const antes = suma.get(f.valor) || { valor: f.valor, etiqueta: f.etiqueta, conteo: 0 };
    antes.conteo += f.conteo || 0;
    suma.set(f.valor, antes);
  }
  return [...suma.values()];
}

const CLASE = {
  PERSONA_NATURAL: 'Una persona',
  EMPRESA_U_ORGANIZACION_PRIVADA: 'Una empresa',
  ESTADO_PGN: 'El Estado (PGN)',
  MINISTERIO_PUBLICO: 'Ministerio Público',
  MINISTERIO_O_SECRETARIA: 'Un ministerio',
  MUNICIPALIDAD: 'Una municipalidad',
  IGSS: 'IGSS',
  SAT: 'SAT',
  CONGRESO: 'Congreso',
  TRIBUNAL_ORDINARIO: 'Un tribunal',
  ORGANISMO_JUDICIAL: 'Organismo Judicial',
  PRESIDENCIA_O_MINISTERIO: 'Presidencia o un ministerio',
  PARTICULAR: 'Un particular',
};

/**
 * Quién pidió el amparo, para la tarjeta.
 *
 * Tal como viene, con tres salvedades: la materia protegida dice «Nombre
 * reservado» y nada más; cuando pidieron varios, el campo trae una frase y no
 * un nombre, así que dice «Varios solicitantes» (la frase queda para el
 * detalle); y sin nombre, la clase.
 */
export function quienPidio(r) {
  if (r?.materia_protegida) return { texto: 'Nombre reservado', reservado: true };
  if (r?.solicitante_clase === 'VARIOS') return { texto: 'Varios solicitantes' };
  return { texto: r?.solicitante_nombre || CLASE[r?.solicitante_clase] || null };
}

export function contraQuien(r) {
  return r?.autoridad_nombre || CLASE[r?.autoridad_clase] || null;
}

/** Quetzales en algo que se lee: «Q148.5 mil millones». */
export function quetzales(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  if (v >= 1e9) return `Q${(v / 1e9).toFixed(1)} mil millones`;
  if (v >= 1e6) return `Q${Math.round(v / 1e6).toLocaleString('es-GT')} millones`;
  return `Q${v.toLocaleString('es-GT')}`;
}

/** «2026-07» → «jul 2026». */
export function mesCorto(mes) {
  const [a, m] = String(mes).split('-').map(Number);
  if (!a || !m) return String(mes);
  return `${new Date(a, m - 1, 1).toLocaleDateString('es-GT', { month: 'short' }).replace('.', '')} ${a}`;
}

/** El primer y último día de un mes, para filtrar por fecha. */
export function rangoDeMes(mes) {
  const [a, m] = String(mes).split('-').map(Number);
  const fin = new Date(a, m, 0).getDate();
  return { fecha_desde: `${mes}-01`, fecha_hasta: `${mes}-${String(fin).padStart(2, '0')}` };
}

/** Cómo le fue a quien pidió: el color del resultado. */
export function tonoDe(resultado) {
  if (/DENEGADO|SIN_LUGAR/.test(resultado || '')) return '#B91C1C';
  if (/OTORGADO|CON_LUGAR/.test(resultado || '')) return '#15803D';
  return 'rgba(28,43,34,0.5)';
}
