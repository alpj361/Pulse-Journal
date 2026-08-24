/**
 * Proyección Web Mercator — la matemática del mapa, sin dependencias.
 *
 * Es la misma que usan OpenStreetMap, Google y Mapbox (EPSG:3857), y son unas
 * pocas fórmulas. Tenerlas acá es la diferencia entre un mapa que es nuestro y
 * uno que es de otro: todo lo que viene después —capas, marcadores, animaciones
 * de vuelo— se apoya en estas cuatro funciones y en nada más.
 *
 * **El plano del mundo.** A cada zoom `z` el planeta entero es un cuadrado de
 * `256 · 2^z` píxeles, con el (0,0) arriba a la izquierda —cerca de 85°N y
 * 180°O— y creciendo hacia el sur y el este. Una tesela es un recorte de 256×256
 * de ese cuadrado, y su nombre es su posición: `z/x/y`.
 *
 * **Por qué el mapa se corta en 85°.** Mercator estira las latitudes con un
 * logaritmo que se va a infinito en los polos, así que hay que cortar en algún
 * lado. El corte de 85.05113° no es arbitrario: es exactamente la latitud a la
 * que el mundo sale cuadrado, y por eso la eligieron todos.
 */

export const TESELA = 256;

/*
 * Las cinco funciones de abajo llevan `'worklet'` porque el gesto las corre en
 * el hilo de UI: el dedo tiene que mover el mapa en el mismo frame, y cruzar al
 * hilo de JS para proyectar una coordenada haría que el mapa vaya siempre un
 * paso atrás de la mano. Marcarlas no les quita nada del lado de JS — desde ahí
 * se llaman igual, y así la matemática vive una sola vez.
 */

/** El corte de Mercator: `atan(sinh(π))` en grados. */
export const LAT_MAX = 85.0511287798;

const rad = Math.PI / 180;

/** Cuántos píxeles de lado tiene el mundo entero a este zoom. */
export function mundo(z) {
  'worklet';
  return TESELA * Math.pow(2, z);
}

/** Longitud → píxel X del plano del mundo. */
export function lngAX(lng, z) {
  'worklet';
  return ((lng + 180) / 360) * mundo(z);
}

/** Latitud → píxel Y. Acá vive el logaritmo que hace a Mercator, Mercator. */
export function latAY(lat, z) {
  'worklet';
  const l = Math.max(-LAT_MAX, Math.min(LAT_MAX, lat));
  const s = Math.sin(l * rad);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * mundo(z);
}

/** Píxel X → longitud. */
export function xALng(x, z) {
  'worklet';
  return (x / mundo(z)) * 360 - 180;
}

/** Píxel Y → latitud. La inversa del logaritmo de arriba. */
export function yALat(y, z) {
  'worklet';
  const n = Math.PI * (1 - (2 * y) / mundo(z));
  return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
}

export const aMundo = (lat, lng, z) => ({ x: lngAX(lng, z), y: latAY(lat, z) });
export const aGrados = (x, y, z) => ({ lat: yALat(y, z), lng: xALng(x, z) });

/**
 * Qué teselas hacen falta para llenar la pantalla.
 *
 * `margen` pide un anillo de más alrededor de lo visible. No es desperdicio: las
 * teselas se recalculan solo cuando el rango cambia de verdad, y sin ese colchón
 * cada arrastre destaparía el fondo por un instante antes de que llegue la fila
 * siguiente.
 *
 * El eje X se envuelve —el mundo da la vuelta, así que al este de 180° está otra
 * vez -180°— pero el Y se recorta: arriba del polo no hay nada, y pedir una
 * tesela negativa es un 404 seguro.
 */
export function teselasVisibles({ cx, cy, z, ancho, alto, escala = 1, margen = 1 }) {
  const n = Math.pow(2, z);

  // Esquinas de la pantalla, en píxeles del plano del mundo.
  const x0 = cx - ancho / 2 / escala;
  const x1 = cx + ancho / 2 / escala;
  const y0 = cy - alto / 2 / escala;
  const y1 = cy + alto / 2 / escala;

  const tx0 = Math.floor(x0 / TESELA) - margen;
  const tx1 = Math.floor(x1 / TESELA) + margen;
  const ty0 = Math.max(0, Math.floor(y0 / TESELA) - margen);
  const ty1 = Math.min(n - 1, Math.floor(y1 / TESELA) + margen);

  const fuera = [];
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      // La columna real después de dar la vuelta al mundo; la posición en
      // pantalla sigue usando `tx` sin envolver, que es donde se dibuja.
      const envuelta = ((tx % n) + n) % n;
      fuera.push({ z, x: envuelta, y: ty, px: tx * TESELA, py: ty * TESELA, clave: `${z}/${envuelta}/${ty}@${tx}` });
    }
  }
  return fuera;
}

/** Firma del rango visible. Si no cambió, no hay nada que recalcular. */
export function rangoClave({ cx, cy, z, ancho, alto, escala = 1 }) {
  const x0 = Math.floor((cx - ancho / 2 / escala) / TESELA);
  const x1 = Math.floor((cx + ancho / 2 / escala) / TESELA);
  const y0 = Math.floor((cy - alto / 2 / escala) / TESELA);
  const y1 = Math.floor((cy + alto / 2 / escala) / TESELA);
  return `${z}:${x0},${x1},${y0},${y1}`;
}

export const limitar = (v, min, max) => Math.max(min, Math.min(max, v));
