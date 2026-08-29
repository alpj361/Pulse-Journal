/**
 * Rutas que siguen calles.
 *
 * **Por qué no basta con unir los puntos.** Una línea recta entre dos toques
 * cruza manzanas, ríos y barrancos: dice «de acá a allá» pero no dice por
 * dónde, y un recorrido que no dice por dónde no es un recorrido. Mapbox
 * Directions devuelve la geometría real de la calle entre dos puntos, que es lo
 * que convierte el trazo en algo que alguien podría recorrer.
 *
 * **Se pide la ruta entera, no el tramo nuevo.** Cuesta lo mismo —una petición
 * por toque— y evita el problema de coser tramos: si cada segmento se calcula
 * por separado, mover un punto intermedio obliga a recalcular dos y a empalmar
 * los extremos, y los empalmes se ven. Pidiendo la ruta completa, la respuesta
 * ya viene continua.
 *
 * **El perfil es `driving` a propósito.** `walking` toma senderos, escaleras y
 * atajos peatonales, que para trazar un recorrido sobre el mapa se leen como
 * ruido: la línea se va por lugares que no parecen calles. `driving` se
 * mantiene en la red vial, que es lo que se pidió.
 *
 * **Un fallo devuelve `null`, no una excepción.** Sin red o con el servicio
 * caído, el trazo cae a la línea recta de siempre: peor, pero utilizable. Que
 * un recorrido no se pueda dibujar porque no hay señal sería peor todavía.
 */

const MAPBOX = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

/** Tope de la API. Más puntos que esto y hay que partir en varias peticiones. */
export const MAX_PUNTOS = 25;

export async function rutaPorCalles(puntos, { señal } = {}) {
  if (!MAPBOX) return null;
  if (!Array.isArray(puntos) || puntos.length < 2) return null;

  // Con más de 25 se usan los últimos: el tramo que se está trazando ahora es
  // el que importa, y truncar por el principio conserva la punta viva.
  const usados = puntos.length > MAX_PUNTOS ? puntos.slice(-MAX_PUNTOS) : puntos;
  const coords = usados.map(([ln, la]) => `${Number(ln).toFixed(6)},${Number(la).toFixed(6)}`).join(';');

  try {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
      `?geometries=geojson&overview=full&access_token=${MAPBOX}`;
    const r = await fetch(url, { signal: señal });
    if (!r.ok) return null;
    const json = await r.json();
    const linea = json?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(linea) || linea.length < 2) return null;

    // Si se truncó, lo que quedó afuera se antepone tal cual: es historia ya
    // trazada y recalcularla no aportaría nada.
    const previos = puntos.length > MAX_PUNTOS ? puntos.slice(0, puntos.length - MAX_PUNTOS) : [];
    return [...previos, ...linea];
  } catch {
    return null;
  }
}
