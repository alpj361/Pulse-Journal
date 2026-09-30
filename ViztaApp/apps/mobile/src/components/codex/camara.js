/**
 * La cámara del grafo: acercar, mover, rotar y orbitar en 3D.
 *
 * El grafo se acomoda en un plano y además cada nodo tiene una profundidad
 * (`z`), calculada con la misma idea que el acomodo: lo conectado queda a
 * profundidad parecida. Sin mover la cámara el dibujo es exactamente el plano de
 * siempre; al orbitar aparece el volumen, con perspectiva: lo que queda cerca
 * se agranda y se ve nítido, lo que queda lejos se achica y se apaga.
 *
 * Se orbita alrededor de un pivote: el nodo tocado, o el centro del marco si no
 * hay ninguno. Así «girar alrededor de un nodo» es tocarlo y después arrastrar.
 */

export const CAMARA_INICIAL = { escala: 1, dx: 0, dy: 0, yaw: 0, pitch: 0, roll: 0 };

// Distancia del ojo al plano. Más chica, más perspectiva; más grande, más plano.
const FOCAL = 650;

export const LIMITES = { escalaMin: 0.5, escalaMax: 4, pitchMax: 1.35 };

export function esInicial(c) {
  return (
    Math.abs(c.escala - 1) < 0.01 &&
    Math.abs(c.dx) < 1 &&
    Math.abs(c.dy) < 1 &&
    Math.abs(c.yaw) < 0.01 &&
    Math.abs(c.pitch) < 0.01 &&
    Math.abs(c.roll) < 0.01
  );
}

/**
 * Un punto del grafo, visto por la cámara.
 *
 * La perspectiva se aplica sobre cuánto se acercó o alejó el punto al girar, y
 * no sobre su profundidad absoluta: por eso, sin girar, cada nodo queda
 * exactamente donde el acomodo lo puso.
 */
function verPunto(x, y, z, camara, pivote) {
  const px = x - pivote.x;
  const py = y - pivote.y;
  const pz = z - pivote.z;

  const cy = Math.cos(camara.yaw);
  const sy = Math.sin(camara.yaw);
  const x1 = px * cy + pz * sy;
  const z1 = -px * sy + pz * cy;

  const cp = Math.cos(camara.pitch);
  const sp = Math.sin(camara.pitch);
  const y1 = py * cp - z1 * sp;
  const z2 = py * sp + z1 * cp;

  const cr = Math.cos(camara.roll);
  const sr = Math.sin(camara.roll);
  const x2 = x1 * cr - y1 * sr;
  const y2 = x1 * sr + y1 * cr;

  // Cuánto se movió hacia el fondo (positivo) o hacia el ojo (negativo).
  const hondo = Math.max(-FOCAL * 0.7, z2 - pz);
  const s = FOCAL / (FOCAL + hondo);

  return {
    x: pivote.x + x2 * s * camara.escala + camara.dx,
    y: pivote.y + y2 * s * camara.escala + camara.dy,
    s,
    hondo,
  };
}

/**
 * Los nodos, vistos por la cámara: con posición en pantalla, tamaño según la
 * perspectiva y cuán al fondo quedaron (0 cerca, 1 lejos). Ordenados del fondo
 * al frente, que es el orden en que se dibujan.
 */
export function proyectar(nodos, camara, pivote) {
  if (esInicial(camara)) return nodos.map((n) => ({ ...n, fondo: 0 }));

  const vistos = nodos.map((n) => {
    const v = verPunto(n.x, n.y, n.z || 0, camara, pivote);
    return { ...n, x: v.x, y: v.y, cuerpo: n.cuerpo * v.s * Math.sqrt(camara.escala), hondo: v.hondo };
  });
  const hondos = vistos.map((n) => n.hondo);
  const min = Math.min(...hondos);
  const rango = Math.max(...hondos) - min || 1;
  return vistos.map((n) => ({ ...n, fondo: (n.hondo - min) / rango })).sort((a, b) => b.hondo - a.hondo);
}

/** Dónde se ve un punto, para mover el pivote sin que la vista salte. */
export function dondeSeVe(nodo, camara, pivote) {
  return verPunto(nodo.x, nodo.y, nodo.z || 0, camara, pivote);
}
