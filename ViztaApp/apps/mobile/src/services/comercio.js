import { supabase } from '../utils/supabase';

/**
 * La información de comercio de un lugar guardado.
 *
 * **De dónde sale.** Apple Places devuelve nombre, dirección y coordenadas, y
 * nada más: no hay teléfono, horario ni sitio. Esa información sí está en
 * `map_lugares` —46 mil POIs de Guatemala con `phone`, `website` y
 * `opening_hours`— así que al abrir la ficha de un lugar se busca ahí su
 * equivalente.
 *
 * **Se busca por cercanía y se confirma por nombre.** Solo por cercanía, un
 * café pegado a una farmacia devuelve la farmacia; solo por nombre, «Farmacia
 * Galeno» devuelve una de sus cuarenta sucursales. Juntos —lo más cercano
 * dentro de 150 m cuyo nombre se parezca— aciertan o no devuelven nada, que es
 * el fallo correcto: mostrar el horario del negocio de al lado es peor que no
 * mostrar horario.
 *
 * **No encontrar nada es normal, no un error.** La mayoría de los lugares que
 * alguien marque no van a estar en el catálogo. La ficha simplemente muestra lo
 * que sabe.
 */

/** Radio de búsqueda en grados. ~150 m. */
const CERCA = 0.0015;

/** Palabras que no distinguen y ensucian la comparación de nombres. */
const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'zona', 's', 'a']);

const normalizar = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !VACIAS.has(w));

/** Cuántas palabras significativas comparten dos nombres. */
function parecido(a, b) {
  const pa = normalizar(a);
  const pb = new Set(normalizar(b));
  if (!pa.length || !pb.size) return 0;
  let comunes = 0;
  for (const w of pa) if (pb.has(w)) comunes += 1;
  return comunes / pa.length;
}

export async function comercioDe({ nombre, lat, lng }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  try {
    const { data, error } = await supabase
      .from('map_lugares')
      .select('lugar_id, name, category, subtype, address, phone, website, opening_hours, lat, lng')
      .gte('lat', lat - CERCA)
      .lte('lat', lat + CERCA)
      .gte('lng', lng - CERCA)
      .lte('lng', lng + CERCA)
      .limit(40);
    if (error || !data?.length) return null;

    let mejor = null;
    let mejorPuntaje = 0;
    for (const fila of data) {
      const p = parecido(nombre, fila.name);
      // La mitad de las palabras en común es el umbral: «PriceSmart Zona 11»
      // contra «PriceSmart» pasa, contra «Subway» no.
      if (p >= 0.5 && p > mejorPuntaje) {
        mejorPuntaje = p;
        mejor = fila;
      }
    }
    return mejor;
  } catch {
    return null;
  }
}

/**
 * Si está abierto ahora, según `opening_hours` de OpenStreetMap.
 *
 * Se interpreta un subconjunto deliberadamente chico del formato —el de la
 * forma `Mo-Fr 08:00-18:00; Sa 09:00-13:00`— porque la especificación completa
 * admite feriados, semanas del año y excepciones, y equivocarse ahí significa
 * decirle a alguien que un lugar está abierto cuando está cerrado. Lo que no se
 * entiende devuelve `null`, y la ficha muestra el texto crudo en vez de una
 * afirmación.
 */
const DIAS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function estadoHorario(opening, ahora = new Date()) {
  const texto = String(opening || '').trim();
  if (!texto) return null;
  if (/24\s*\/\s*7/.test(texto)) return { abierto: true, detalle: 'siempre abierto' };

  const hoy = DIAS[ahora.getDay()];
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();

  for (const bloque of texto.split(';')) {
    const m = bloque.trim().match(/^([A-Za-z,\-]+)\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
    if (!m) continue;
    const [, dias, h1, m1, h2, m2] = m;
    if (!cubreDia(dias, hoy)) continue;

    const desde = Number(h1) * 60 + Number(m1);
    const hasta = Number(h2) * 60 + Number(m2);
    // Un horario que termina antes de empezar cruza la medianoche.
    const dentro = hasta >= desde
      ? minutosAhora >= desde && minutosAhora < hasta
      : minutosAhora >= desde || minutosAhora < hasta;

    const hhmm = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
    return dentro
      ? { abierto: true, detalle: `cierra ${hhmm(hasta)}` }
      : { abierto: false, detalle: `abre ${hhmm(desde)}` };
  }

  return null;
}

function cubreDia(expr, dia) {
  for (const parte of expr.split(',')) {
    const rango = parte.trim().match(/^([A-Za-z]{2})-([A-Za-z]{2})$/);
    if (rango) {
      const a = DIAS.indexOf(rango[1]);
      const b = DIAS.indexOf(rango[2]);
      const d = DIAS.indexOf(dia);
      if (a < 0 || b < 0 || d < 0) continue;
      // El rango puede envolver la semana: `Fr-Mo`.
      if (a <= b ? d >= a && d <= b : d >= a || d <= b) return true;
    } else if (parte.trim() === dia) {
      return true;
    }
  }
  return false;
}
