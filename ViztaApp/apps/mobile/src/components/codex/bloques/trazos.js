import { getStroke } from 'perfect-freehand';

/**
 * La geometría de los dibujos.
 *
 * Un trazo se guarda como puntos normalizados —de 0 a 1 del ancho del
 * bloque, con la presión—, así el dibujo se ve igual en un teléfono y en una
 * tablet. Se guardan pocos puntos: el dedo manda decenas por segundo, y casi
 * todos están sobre la misma recta. `simplificar` se queda con los que
 * cambian la forma (Ramer–Douglas–Peucker).
 *
 * Para pintar, `perfect-freehand` convierte la línea en el contorno de un
 * trazo con grosor variable —como una lapicera— y eso se dibuja con Skia.
 */

/** Distancia de un punto a un segmento. */
function distancia([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const largo = dx * dx + dy * dy;
  const t = largo ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / largo)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Menos puntos, misma forma. `tolerancia` en la misma unidad que los puntos
 * (normalizados: 0,002 es un par de píxeles en un teléfono).
 */
export function simplificar(puntos, tolerancia = 0.002) {
  if (!puntos || puntos.length < 3) return puntos || [];
  let peor = 0;
  let donde = 0;
  const ultimo = puntos.length - 1;
  for (let i = 1; i < ultimo; i++) {
    const d = distancia(puntos[i], puntos[0], puntos[ultimo]);
    if (d > peor) {
      peor = d;
      donde = i;
    }
  }
  if (peor <= tolerancia) return [puntos[0], puntos[ultimo]];
  const izq = simplificar(puntos.slice(0, donde + 1), tolerancia);
  const der = simplificar(puntos.slice(donde), tolerancia);
  return [...izq.slice(0, -1), ...der];
}

/** Redondear para que el documento no guarde quince decimales por punto. */
const r = (x) => Math.round(x * 10000) / 10000;

/** Un trazo listo para guardar: puntos normalizados, simplificados y redondeados. */
export function trazoParaGuardar(puntosEnPantalla, ancho, { color = '#1C2B22', grosor = 3 } = {}) {
  const normal = puntosEnPantalla.map(([x, y, p = 0.5]) => [x / ancho, y / ancho, p]);
  const pocos = simplificar(normal);
  return { color, grosor, puntos: pocos.map(([x, y, p]) => [r(x), r(y), r(p)]) };
}

/** Del contorno de `perfect-freehand` a un path SVG. */
function caminoDeContorno(contorno) {
  if (!contorno.length) return '';
  const d = contorno.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...contorno[0], 'Q'],
  );
  d.push('Z');
  return d.map((x) => (typeof x === 'number' ? Math.round(x * 100) / 100 : x)).join(' ');
}

/** El path SVG de un trazo guardado, en un lienzo de `ancho` puntos. */
export function caminoDeTrazo(trazo, ancho) {
  const puntos = (trazo?.puntos || []).map(([x, y, p]) => [x * ancho, y * ancho, p ?? 0.5]);
  if (!puntos.length) return '';
  const contorno = getStroke(puntos, {
    size: (trazo.grosor || 3) * (ancho / 360) * 1.6,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.4,
    simulatePressure: puntos.every(([, , p]) => p === 0.5),
    last: true,
  });
  return caminoDeContorno(contorno);
}
