import { supabase } from '../../utils/supabase';

/**
 * Las fechas claves del calendario del feed: sesiones, plazos, el proceso
 * electoral, tomas de posesión y asuetos. Salen del dataset «Fechas claves»
 * de Vizta (de PJ, público); lo que se edita ahí es lo que se ve.
 */
export const DATASET_FECHAS = 'd3771168-4729-4b84-a1af-9046126106e7';

/** Cada tipo dice qué clase de fecha es, no cuánto importa. */
export const TIPOS_FECHA = {
  sesion: { nombre: 'sesión del pleno', color: '#2F4A7A' },
  periodo: { nombre: 'periodo de sesiones', color: '#5A6B60' },
  plazo: { nombre: 'plazo', color: '#B45309' },
  designacion: { nombre: 'elección en el pleno', color: '#1D9E75' },
  reunion: { nombre: 'reunión', color: '#378ADD' },
  electoral: { nombre: 'proceso electoral', color: '#7F77DD' },
  posesion: { nombre: 'toma de posesión', color: '#15803D' },
  asueto: { nombre: 'asueto', color: '#D4537E' },
};

/**
 * Qué temas del dataset entran al calendario de cada feed. Un feed que no está
 * acá no lleva calendario: por ahora solo el Congreso (PJ, 1-nov-2026).
 */
export const TEMAS_DEL_FEED = {
  congreso: ['congreso'],
};

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Las filas del dataset como fechas, en orden; en un mismo día, lo que tiene
 * hora va primero. Las que no traen día válido no entran.
 */
export function fechasDe(filas = []) {
  return filas
    .map(({ id, values: v = {} }) => ({
      id,
      fecha: String(v.fecha || '').slice(0, 10),
      fin: DIA.test(String(v.fecha_fin || '').slice(0, 10)) ? String(v.fecha_fin).slice(0, 10) : null,
      hora: v.hora || null,
      titulo: String(v.titulo || '').trim(),
      tipo: TIPOS_FECHA[v.tipo] ? v.tipo : 'plazo',
      tema: v.tema || 'pais',
      detalle: v.detalle || null,
      prevista: v.estado === 'prevista',
    }))
    .filter((f) => DIA.test(f.fecha) && f.titulo)
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : String(a.hora || '99').localeCompare(String(b.hora || '99'))));
}

export async function traerFechasClaves() {
  const { data, error } = await supabase
    .from('dataset_rows')
    .select('id, values')
    .eq('dataset_id', DATASET_FECHAS)
    .is('deleted_at', null)
    .limit(1000);
  if (error) throw error;
  return fechasDe(data || []);
}

/** Las fechas de los temas de un feed. */
export function delFeed(fechas = [], feed) {
  const temas = TEMAS_DEL_FEED[feed] || [];
  return fechas.filter((f) => temas.includes(f.tema));
}

/** Si una fecha (o su rango) toca ese día. */
export const tocaElDia = (f, dia) => dia >= f.fecha && dia <= (f.fin || f.fecha);

export const delDia = (fechas = [], dia) => fechas.filter((f) => tocaElDia(f, dia));

/** Lo que viene desde `hoy`, contando lo que ya empezó y no terminó. */
export function proximas(fechas = [], hoy, cuantas = 4) {
  return fechas.filter((f) => (f.fin || f.fecha) >= hoy).slice(0, cuantas);
}

const dosDigitos = (n) => String(n).padStart(2, '0');
export const diaDe = (anio, mes, d) => `${anio}-${dosDigitos(mes + 1)}-${dosDigitos(d)}`;

/**
 * Las semanas de un mes, de lunes a domingo; los huecos antes del 1 y
 * después del último día van en `null`. `mes` empieza en 0.
 */
export function semanasDelMes(anio, mes) {
  const primero = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const total = new Date(anio, mes + 1, 0).getDate();
  const celdas = [...Array(primero).fill(null), ...Array.from({ length: total }, (_, i) => diaDe(anio, mes, i + 1))];
  while (celdas.length % 7) celdas.push(null);
  const semanas = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return semanas;
}

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** «3 nov» */
export function fechaCorta(dia) {
  const [, m, d] = String(dia).split('-').map(Number);
  return `${d} ${MESES[m - 1].slice(0, 3)}`;
}

/** «3 de noviembre» */
export function fechaMedia(dia) {
  const [, m, d] = String(dia).split('-').map(Number);
  return `${d} de ${MESES[m - 1]}`;
}

/** «del 29 de marzo al 25 de junio» para lo que dura más de un día. */
export function rangoDe(f) {
  if (!f.fin) return null;
  const parte = (dia) => {
    const [, m, d] = dia.split('-').map(Number);
    return `${d} de ${MESES[m - 1]}`;
  };
  return `del ${parte(f.fecha)} al ${parte(f.fin)}`;
}

/** Los días con algo publicado, para que el calendario los distinga de los vacíos. */
export async function traerDiasConPublicaciones(feed) {
  if (feed === 'congreso') {
    const [items, votaciones] = await Promise.all([
      supabase.from('congreso_items_app_view').select('digest_date').order('digest_date', { ascending: false }).limit(2000),
      supabase.from('votaciones').select('fecha').limit(2000),
    ]);
    return [...new Set([...(items.data || []).map((f) => f.digest_date), ...(votaciones.data || []).map((f) => f.fecha)].filter(Boolean))];
  }
  const { data } = await supabase.from('news_cards').select('generated_at').eq('pais', 'gt').order('generated_at', { ascending: false }).limit(300);
  return [...new Set((data || []).map((f) => new Date(f.generated_at).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' })))];
}
