/**
 * Las calles y el clima del día, para «Cómo está el día».
 *
 * Calles: los eventos que NewsCron saca de las noticias de Movilidad
 * (`feed_data`, categoría Movilidad): bloqueos, accidentes, obras, cierres.
 * Es lo que hay mientras la medición de tráfico por tramo del mapa no corra
 * (está parada desde el 13-oct); cuando el mapa tenga los accidentes en
 * tiempo real, la lista se va allá y acá queda solo el nivel.
 *
 * Clima: el pronóstico del día (Open-Meteo, Ciudad de Guatemala) más lo que
 * reportan las noticias (`feed_data`, Clima y desastres). Open-Meteo es gratis
 * solo para uso no comercial: antes de publicar, pasar a su plan pagado o a
 * WeatherKit por ExtractorW.
 */
import { supabase } from '../../utils/supabase';

const lista = (v) => (Array.isArray(v) ? v : []);

/** La última fila de Movilidad y de Clima y desastres. */
export async function traerFeedsDelDia() {
  const { data, error } = await supabase
    .from('feed_data')
    .select('categoria, data, generated_at')
    .in('categoria', ['Movilidad', 'Clima y desastres'])
    .order('generated_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  const por = {};
  for (const r of data || []) if (!por[r.categoria]) por[r.categoria] = r;
  return { movilidad: por.Movilidad || null, clima: por['Clima y desastres'] || null };
}

const TIPO = {
  accidente: 'Accidente',
  bloqueo: 'Bloqueo',
  cierre: 'Cierre',
  obra: 'Obra',
  manifestacion: 'Manifestación',
  incendio: 'Incendio',
  deslizamiento: 'Deslave',
  derrumbe: 'Derrumbe',
  inundacion: 'Inundación',
  lluvia: 'Lluvia',
  sismo: 'Sismo',
};
const tipoDe = (t) => {
  const k = String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return TIPO[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1) : 'Evento');
};

/** Los eventos activos, los de impacto alto primero. */
export function eventosActivos(fila) {
  const peso = { alto: 0, medio: 1, bajo: 2 };
  return lista(fila?.data?.eventos)
    .filter((e) => e?.activo !== false)
    .sort((a, b) => (peso[a.impacto] ?? 3) - (peso[b.impacto] ?? 3))
    .map((e) => ({ id: e.id, tipo: tipoDe(e.tipo), zona: e.zona || null, alto: e.impacto === 'alto', url: e.fuente?.enlace || null }));
}

/**
 * Cómo están las calles: por los eventos activos, sin modelo.
 * Pesado: 2 o más de impacto alto, o 5 o más activos. Cargado: 2 o más activos.
 */
export function nivelCalles(eventos) {
  const altos = eventos.filter((e) => e.alto).length;
  if (altos >= 2 || eventos.length >= 5) return { clave: 'pesado', nombre: 'Pesado', color: '#C0453B' };
  if (eventos.length >= 2) return { clave: 'cargado', nombre: 'Cargado', color: '#D98A3D' };
  return { clave: 'tranquilo', nombre: 'Tranquilo', color: '#4C9A6A' };
}

// ─── Pronóstico ──────────────────────────────────────────────────────────────

const CIUDAD = { lat: 14.6349, lon: -90.5069 };

/** El clima de los últimos 7 días y de hoy, por día: { '2026-10-19': {...} }. */
export async function traerPronostico() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${CIUDAD.lat}&longitude=${CIUDAD.lon}` +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max' +
    '&timezone=America%2FGuatemala&past_days=7&forecast_days=1';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Clima ${res.status}`);
  const j = await res.json();
  const d = j?.daily || {};
  const out = {};
  lista(d.time).forEach((dia, i) => {
    out[dia] = {
      codigo: d.weather_code?.[i],
      max: d.temperature_2m_max?.[i],
      min: d.temperature_2m_min?.[i],
      lluviaMm: d.precipitation_sum?.[i],
      probLluvia: d.precipitation_probability_max?.[i],
    };
  });
  return out;
}

/**
 * El estado del cielo por código WMO, con el sticker que le toca. Los
 * stickers propios (sol, nublado, lluvia, tormenta, neblina) los hace Raúl;
 * mientras no estén, todos caen al de Clima.
 */
export function cielo(codigo) {
  const c = Number(codigo);
  if (c === 0) return { nombre: 'Despejado', sticker: 'clima-sol' };
  if (c <= 2) return { nombre: 'Parcialmente nublado', sticker: 'clima-nublado' };
  if (c === 3) return { nombre: 'Nublado', sticker: 'clima-nublado' };
  if (c === 45 || c === 48) return { nombre: 'Neblina', sticker: 'clima-neblina' };
  if (c >= 51 && c <= 57) return { nombre: 'Llovizna', sticker: 'clima-lluvia' };
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return { nombre: c === 65 || c === 82 ? 'Lluvia fuerte' : 'Lluvia', sticker: 'clima-lluvia' };
  if (c >= 95) return { nombre: 'Tormenta', sticker: 'clima-tormenta' };
  return { nombre: 'Variable', sticker: 'clima' };
}
