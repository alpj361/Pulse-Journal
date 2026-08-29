import { EXTRACTORW_URL } from '../utils/servicios';
import { supabase } from '../utils/supabase';

/**
 * Buscar lugares reales.
 *
 * **El proveedor es Apple Places, y no lo llamamos nosotros.** ExtractorW ya
 * expone `/api/maps/apple-search` y ThePulse lo usa desde la web hace rato: el
 * token de Apple vive en el servidor, que es donde tiene que vivir. Meterlo en
 * la app sería repartir una credencial en cada teléfono instalado, y rotarla
 * obligaría a publicar una versión nueva.
 *
 * **El sesgo por cercanía no es cosmético.** Apple ordena por relevancia
 * alrededor de un punto, así que buscar «Pollo Campero» desde el centro de la
 * capital y desde Xela tiene que dar resultados distintos. Por eso quien llama
 * pasa el centro del mapa: es la mejor pista disponible de qué está mirando la
 * persona, mejor incluso que su ubicación real si está explorando otro lado.
 *
 * **Un fallo devuelve lista vacía, no excepción.** Buscar es incremental —una
 * consulta por cada pausa al teclear— y una caída de red no debería tumbar la
 * pantalla; se muestra «sin resultados» y la siguiente tecla vuelve a intentar.
 */

/** Lo que devuelve el proxy por cada sugerencia. */
// { id, name, address, lat, lng }

export async function buscarLugares(consulta, { lat, lng, señal } = {}) {
  const q = String(consulta || '').trim();
  if (q.length < 2) return [];

  try {
    const { data: sesion } = await supabase.auth.getSession();
    const token = sesion?.session?.access_token;
    if (!token) return [];

    const params = new URLSearchParams({ q });
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      params.set('lat', String(lat));
      params.set('lng', String(lng));
    }

    const r = await fetch(`${EXTRACTORW_URL}/api/maps/apple-search?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: señal,
    });
    if (!r.ok) return [];
    const json = await r.json();
    const filas = Array.isArray(json?.results) ? json.results : [];

    // Sin coordenadas no hay nada que poner en el mapa, y una sugerencia que no
    // se puede marcar solo ocupa lugar en la lista.
    return filas.filter((f) => Number.isFinite(f?.lat) && Number.isFinite(f?.lng));
  } catch {
    return [];
  }
}

/**
 * La forma del `geo` de un lugar guardado.
 *
 * Comparte contenedor con los territorios trazados a mano —los dos son
 * `codex_universe_items` con `geo`— y se distinguen por el bloque `lugar`: si
 * está, esto vino de un proveedor externo y no lo dibujó nadie. Eso es lo que
 * después deja mostrar una ficha distinta, con dirección y teléfono, en vez de
 * la de un polígono.
 *
 * `spatial_role: 'location'` es el mismo rol que ya usa `GeoTerritorio` para un
 * punto suelto, así que el resto de la app —el mapa, la ficha, el detalle— no
 * necesita aprender un caso nuevo para dibujarlo.
 */
export function geoDeLugar(sugerencia) {
  return {
    spatial_role: 'location',
    geometry: {
      type: 'Point',
      coordinates: [Number(sugerencia.lng), Number(sugerencia.lat)],
    },
    lugar: {
      fuente: 'apple',
      id: sugerencia.id || null,
      address: sugerencia.address || null,
    },
  };
}

/** Si un item del Codex es un lugar guardado y no algo trazado a mano. */
export const esLugar = (item) => Boolean(item?.geo?.lugar);
