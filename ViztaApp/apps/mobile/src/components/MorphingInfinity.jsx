import { useMemo } from 'react';
import { View } from 'react-native';
import {
  Canvas,
  Path,
  Skia,
  useClock,
  usePathInterpolation,
} from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { INK } from './theme';

/**
 * Loader: un anillo que se pliega en infinito y vuelve, mientras un trazo lo
 * recorre.
 *
 * Reemplaza al `ActivityIndicator` del sistema. La ruedita gira siempre igual y
 * a los tres segundos deja de leerse como progreso: se vuelve parte del fondo, y
 * ahí es cuando la espera se siente rota. Esto cambia de forma todo el tiempo, y
 * el ojo lee cambio como avance.
 *
 * Está hecho con Skia y no con la versión web que me pasaste: esa usa clases de
 * Tailwind y animación CSS, que no existen en React Native. La idea es la misma.
 *
 * Dos ciclos con periodos distintos —el pliegue y el trazo— que no son múltiplos
 * entre sí, así que la combinación no se repite igual y no se vuelve un bucle
 * reconocible.
 */

// Puntos de muestreo de cada figura. Los dos caminos tienen que tener la MISMA
// cantidad de vértices y los mismos verbos, o `interpolate` devuelve null.
const N = 96;

const PLIEGUE = 2400; // ms: círculo → infinito → círculo
const TRAZO = 1700; // ms: el trazo se dibuja y se borra

/** Suaviza un 0..1 para que arranque y termine sin tirón. */
function suave(t) {
  'worklet';
  return t * t * (3 - 2 * t);
}

/**
 * Construye las dos figuras con la misma estructura.
 *
 *  · anillo   — círculo paramétrico
 *  · infinito — lemniscata de Gerono: (cos t, sin t · cos t). Recorre el ocho
 *    una vez en el mismo rango de t que el círculo, así que la interpolación
 *    punto a punto pliega la figura por el centro en vez de deformarla al azar.
 */
function figuras(lado) {
  const r = lado / 2 - lado * 0.11; // margen para el grosor del trazo
  const cx = lado / 2;
  const cy = lado / 2;

  const anillo = Skia.Path.Make();
  const infinito = Skia.Path.Make();

  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;

    const ax = cx + Math.cos(t) * r;
    const ay = cy + Math.sin(t) * r;

    const bx = cx + Math.cos(t) * r;
    const by = cy + Math.sin(t) * Math.cos(t) * r;

    if (i === 0) {
      anillo.moveTo(ax, ay);
      infinito.moveTo(bx, by);
    } else {
      anillo.lineTo(ax, ay);
      infinito.lineTo(bx, by);
    }
  }
  anillo.close();
  infinito.close();

  return { anillo, infinito };
}

export default function MorphingInfinity({ size = 96, color = INK.title, grosor, style }) {
  const { anillo, infinito } = useMemo(() => figuras(size), [size]);
  const ancho = grosor ?? Math.max(2, size * 0.055);

  const clock = useClock();

  // Coseno en vez de rampa: la figura se demora en el anillo y en el infinito,
  // y pasa rápido por el medio. Con una rampa lineal el pliegue se siente
  // mecánico, como un slider que alguien arrastra.
  const pliegue = useDerivedValue(() => {
    const f = (clock.value % PLIEGUE) / PLIEGUE;
    return (1 - Math.cos(f * Math.PI * 2)) / 2;
  });

  const camino = usePathInterpolation(pliegue, [0, 1], [anillo, infinito]);

  // El trazo se dibuja en la primera mitad del ciclo y se borra en la segunda.
  // Es a propósito que no dé la vuelta envolviendo el final con el principio:
  // con `start` mayor que `end` el path no dibuja nada y se ve un parpadeo.
  const inicio = useDerivedValue(() => {
    const f = (clock.value % TRAZO) / TRAZO;
    return f < 0.5 ? 0 : suave((f - 0.5) * 2);
  });

  const fin = useDerivedValue(() => {
    const f = (clock.value % TRAZO) / TRAZO;
    return f < 0.5 ? suave(f * 2) : 1;
  });

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Canvas style={{ flex: 1 }}>
        {/* La pista: siempre visible, muy tenue. Sin ella, en el instante en que
            el trazo termina de borrarse no quedaría nada en pantalla y parecería
            que la app se colgó. */}
        <Path
          path={camino}
          style="stroke"
          strokeWidth={ancho}
          strokeCap="round"
          strokeJoin="round"
          color={color}
          opacity={0.18}
        />
        <Path
          path={camino}
          start={inicio}
          end={fin}
          style="stroke"
          strokeWidth={ancho}
          strokeCap="round"
          strokeJoin="round"
          color={color}
        />
      </Canvas>
    </View>
  );
}
