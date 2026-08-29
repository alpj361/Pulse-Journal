/**
 * La niebla: qué está descubierto y qué no.
 *
 * **Por qué celdas y no polígonos.** Raspar es acumulativo: cada pasada del
 * dedo se suma a lo anterior, y dos manchas que se tocan tienen que volverse
 * una. Con polígonos eso es una unión booleana —caro, y el proyecto no tiene
 * turf— y además cada unión agrega vértices hasta que el path pesa más que el
 * mapa. Con una cuadrícula la unión es gratis: raspar dos veces la misma celda
 * es escribir la misma clave dos veces en un Set. Y persistir es una lista de
 * enteros en vez de geometría.
 *
 * **El tamaño de celda es una decisión de producto, no de rendimiento.** A
 * 0.0025° una celda mide unos 275 m: la cuadra grande, el sector, la manzana
 * ampliada. Más fino y descubrir la ciudad tomaría miles de pasadas; más
 * grueso y un solo toque revelaría medio municipio. También es la razón de que
 * raspar solo se habilite pasado cierto zoom: a escala de país el dedo taparía
 * departamentos enteros y la palabra «explorado» perdería sentido.
 *
 * Las celdas se identifican por índice entero desde el origen de coordenadas,
 * no por su esquina en grados: dos dispositivos que rasparon «el mismo lugar»
 * tienen que producir la misma clave, y los flotantes no garantizan eso.
 */

import { LAT_MAX } from './proyeccion';

/** Lado de la celda en grados. ~275 m en el ecuador. */
export const CELDA = 0.0025;

/** Debajo de este zoom no se puede raspar: el dedo cubriría demasiado. */
export const ZOOM_MINIMO_RASPADO = 11;

/** Radio del pincel, en píxeles de pantalla. Un pulpejo, no un punto. */
export const PINCEL = 34;

export const celdaDe = (lat, lng) => ({
  cx: Math.floor(lng / CELDA),
  cy: Math.floor(lat / CELDA),
});

/** La esquina suroeste de una celda, en grados. */
export const gradosDe = (cx, cy) => ({ lng: cx * CELDA, lat: cy * CELDA });

export const clave = (cx, cy) => `${cx}:${cy}`;

export function desdeClave(k) {
  const [cx, cy] = k.split(':');
  return { cx: Number(cx), cy: Number(cy) };
}

/**
 * Las celdas que toca un pincel circular centrado en un punto.
 *
 * El círculo se recorre por su caja envolvente y se descarta lo que queda
 * fuera del radio; con radios de unas pocas celdas es más barato que cualquier
 * cosa más lista, y mantiene el borde redondo en vez de cuadrado.
 *
 * `gradosPorPixel` viene de quien llama porque depende del zoom, y el zoom vive
 * en un shared value del hilo de UI: recalcularlo acá obligaría a pasar la
 * proyección entera.
 */
export function celdasBajoPincel({ lat, lng, gradosPorPixel, radioPx = PINCEL }) {
  const radio = gradosPorPixel * radioPx;
  if (!Number.isFinite(radio) || radio <= 0) return [];

  // Un pincel enorme —zoom muy bajo— podría generar cientos de miles de celdas
  // y colgar el hilo de JS. A esa escala raspar no debería estar habilitado,
  // pero el tope evita que un caso raro congele la app.
  const pasos = Math.ceil(radio / CELDA);
  if (pasos > 64) return [];

  const centro = celdaDe(lat, lng);
  const fuera = [];
  // La corrección por latitud: un grado de longitud se acorta al alejarse del
  // ecuador, así que sin esto el pincel saldría ovalado en pantalla.
  const cos = Math.cos((lat * Math.PI) / 180) || 1;

  for (let dy = -pasos; dy <= pasos; dy += 1) {
    for (let dx = -pasos; dx <= pasos; dx += 1) {
      const ex = dx * CELDA * cos;
      const ey = dy * CELDA;
      if (ex * ex + ey * ey > radio * radio) continue;
      const cy = centro.cy + dy;
      // Más allá del polo no hay mapa que descubrir.
      if (Math.abs(cy * CELDA) > LAT_MAX) continue;
      fuera.push(clave(centro.cx + dx, cy));
    }
  }
  return fuera;
}

/**
 * Cuántas celdas caben en la parte del mundo que a esta app le importa.
 *
 * Se usa solo para el porcentaje explorado, y el denominador es Guatemala, no
 * el planeta: «llevás 0.0001% del mundo» no le dice nada a nadie. Es la caja
 * del país, redondeada.
 */
const CAJA_PAIS = { latMin: 13.6, latMax: 17.9, lngMin: -92.3, lngMax: -88.1 };

export const CELDAS_DEL_PAIS = Math.round(
  ((CAJA_PAIS.latMax - CAJA_PAIS.latMin) / CELDA) *
    ((CAJA_PAIS.lngMax - CAJA_PAIS.lngMin) / CELDA) *
    // La caja es un rectángulo y el país no lo llena: sin este factor el
    // porcentaje quedaría siempre a la mitad de lo que se siente.
    0.55
);
