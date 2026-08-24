import { useEffect, useMemo, useRef } from 'react';
import { Canvas, Circle, Group, Path, Skia } from '@shopify/react-native-skia';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { latAY, lngAX } from './proyeccion';

/**
 * Las capas del Codex sobre las teselas: territorios y pines.
 *
 * **Esto era SVG y ahora es Skia, por una razón medible.** Con
 * `react-native-svg` la capa era un lienzo de 2412×4392 —diez megapíxeles— que
 * iOS tenía que recomponer cada vez que cambiaba la transformación del padre, o
 * sea en cada frame del arrastre. Las teselas iban con el dedo y las fronteras
 * llegaban un frame tarde: se veían despegadas, arrastrándose por encima del
 * mapa. Skia dibuja en el hilo de UI y su lienzo mide lo que la pantalla, así
 * que la transformación es una operación de GPU y no una recomposición de
 * vistas nativas.
 *
 * **Todo se dibuja relativo a un ancla, no al origen de las teselas.** El origen
 * de las teselas cambia varias veces por arrastre, y atar los polígonos a él
 * obligaba a reproyectar los 358 municipios en medio del gesto. El ancla está
 * cuantizada a bloques grandes: se mueve una vez cada varias pantallas.
 *
 * **Se simplifica por distancia, no por índice.** Tirar uno de cada N puntos
 * borra justo donde la frontera tiene detalle y conserva puntos donde el borde
 * es recto. Acá se descarta el punto que cae a menos de un pelo del anterior
 * **medido en píxeles de la pantalla actual**, así que la costa mantiene su
 * forma y un municipio lejano se reduce solo.
 *
 * **Se recorta lo que no se ve.** A zoom de calle, 357 de los 358 polígonos
 * están fuera de la pantalla; cada uno guarda su caja envolvente y solo entran
 * los que tocan la ventana alrededor del ancla.
 */

/** Ni un punto más cerca que esto del anterior, en píxeles de pantalla. */
const PELO = 1.6;

/** Cuánto alrededor del ancla se considera «cerca». */
const VENTANA = 3;

const RELLENO = 'rgba(58,96,73,0.10)';
const RELLENO_ELEGIDO = 'rgba(58,96,73,0.26)';
const BORDE = 'rgba(40,70,52,0.78)';
const PIN = '#B45309';
const PIN_ARO = '#FFFDF8';

/** Lo que tarda el país en dibujarse solo al aparecer. */
const ENTRADA = 1100;

export default function MapaCapas({
  ancho,
  alto,
  ancla, // { x, y, z } — píxel de mundo cuantizado, y su nivel entero
  zoom, // shared
  lat, // shared
  lng, // shared
  areas,
  pines,
  mostrarAreas,
  mostrarPines,
  /** Qué nivel administrativo se está mostrando. Solo se usa para re-entintar. */
  nivel,
  elegido,
}) {
  const { rutas, puntos } = useMemo(() => {
    const z = ancla.z;
    const margenX = ancho * VENTANA;
    const margenY = alto * VENTANA;

    const cerca = (c) => {
      if (!c) return true;
      const x0 = lngAX(c.lngMin, z);
      const x1 = lngAX(c.lngMax, z);
      // La latitud se invierte al proyectar: el norte es el píxel más chico.
      const y0 = latAY(c.latMax, z);
      const y1 = latAY(c.latMin, z);
      return (
        x1 >= ancla.x - margenX &&
        x0 <= ancla.x + margenX &&
        y1 >= ancla.y - margenY &&
        y0 <= ancla.y + margenY
      );
    };

    const rutas = [];
    if (mostrarAreas) {
      for (const a of areas) {
        if (!cerca(a.caja)) continue;
        const d = geometriaAPath(a.geometry, z, ancla);
        if (!d) continue;
        const path = Skia.Path.MakeFromSVGString(d);
        if (path) rutas.push({ id: a.id, path });
      }
    }

    const puntos = mostrarPines
      ? pines.map((p) => ({
          id: p.id,
          x: lngAX(p.coordinates.lng, z) - ancla.x,
          y: latAY(p.coordinates.lat, z) - ancla.y,
        }))
      : [];

    return { rutas, puntos };
  }, [areas, pines, mostrarAreas, mostrarPines, ancla, ancho, alto]);

  // ─── Vida ───────────────────────────────────────────────────────────────────

  /**
   * La entrada: las fronteras se dibujan solas.
   *
   * Es un solo valor para todas, no uno por polígono. Cada path se recorta a la
   * misma fracción de su propio largo, así que arrancan juntas y terminan juntas
   * pero cada una a su ritmo — el país se va entintando en vez de aparecer de
   * golpe. Una animación por polígono costaría 358 valores para conseguir menos.
   */
  const entrada = useSharedValue(0);
  const nivelEntrado = useRef(undefined);

  /**
   * Se vuelve a entintar cada vez que cambia el nivel, no una sola vez.
   *
   * Se recuerda **qué nivel** se entintó y no un simple «ya pasó», por dos cosas
   * que hay que distinguir. Al arrancar, `rutas` llega vacío mientras carga la
   * consulta: hay que esperar a que haya algo que dibujar o la animación corre
   * sobre la nada y las fronteras aparecen de golpe. Y al arrastrar, `rutas`
   * cambia de largo todo el tiempo porque se recorta lo que no se ve — si eso
   * disparara la entrada, el país se re-entintaría en cada paneo.
   *
   * Con el nivel como testigo, las dos cosas se resuelven solas: se anima la
   * primera vez que hay trazos para un nivel, y de nuevo recién cuando el nivel
   * cambia. Prender los límites desde el mapa se siente como dibujarlos.
   */
  useEffect(() => {
    if (rutas.length === 0) return;
    if (nivelEntrado.current === nivel) return;
    nivelEntrado.current = nivel;
    entrada.value = 0;
    entrada.value = withTiming(1, { duration: ENTRADA, easing: Easing.out(Easing.cubic) });
  }, [rutas.length, nivel, entrada]);

  /** Los pines caen con resorte, un poco después de que la tinta arranque. */
  const pin = useSharedValue(0);
  useEffect(() => {
    if (puntos.length === 0) return;
    pin.value = 0;
    pin.value = withSequence(
      withTiming(0, { duration: 260 }),
      withSpring(1, { damping: 9, stiffness: 170 })
    );
  }, [puntos.length, pin]);

  /** El latido de lo elegido. Solo corre si hay algo elegido. */
  const latido = useSharedValue(0);
  useEffect(() => {
    if (!elegido) {
      cancelAnimation(latido);
      latido.value = withTiming(0, { duration: 200 });
      return;
    }
    latido.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
    return () => cancelAnimation(latido);
  }, [elegido, latido]);

  // ─── Transformación ─────────────────────────────────────────────────────────

  const transformacion = useDerivedValue(() => {
    const k = Math.pow(2, zoom.value - ancla.z);
    return [
      { translateX: ancho / 2 + (ancla.x - lngAX(lng.value, ancla.z)) * k },
      { translateY: alto / 2 + (ancla.y - latAY(lat.value, ancla.z)) * k },
      { scale: k },
    ];
  }, [ancho, alto, ancla]);

  /**
   * El grosor va dividido por la escala del grupo.
   *
   * Sin esto, acercar el mapa engorda las fronteras: a zoom 16 una línea de un
   * píxel se vuelve una franja. Una frontera impresa mide siempre lo mismo en la
   * pantalla, no en el terreno.
   */
  const escalaInv = useDerivedValue(() => 1 / Math.pow(2, zoom.value - ancla.z), [ancla]);
  const grosor = useDerivedValue(() => 1.1 * escalaInv.value);
  const grosorElegido = useDerivedValue(() => (2 + latido.value * 1.4) * escalaInv.value);
  const radioPin = useDerivedValue(() => 5.5 * pin.value * escalaInv.value);
  const radioAro = useDerivedValue(() => 2 * escalaInv.value);
  const radioLatido = useDerivedValue(() => (7 + latido.value * 6) * escalaInv.value);
  const opacidadLatido = useDerivedValue(() => 0.32 * (1 - latido.value));
  // El relleno entra después del trazo: primero la línea, después el color.
  const opacidadRelleno = useDerivedValue(() => Math.max(0, (entrada.value - 0.45) / 0.55));

  if (!rutas.length && !puntos.length) return null;

  return (
    <Canvas
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, width: ancho, height: alto }}
    >
      <Group transform={transformacion}>
        {rutas.map((r) => (
          <Group key={r.id}>
            <Path
              path={r.path}
              style="fill"
              color={elegido === r.id ? RELLENO_ELEGIDO : RELLENO}
              opacity={opacidadRelleno}
            />
            <Path
              path={r.path}
              style="stroke"
              strokeWidth={elegido === r.id ? grosorElegido : grosor}
              strokeJoin="round"
              color={BORDE}
              end={entrada}
            />
          </Group>
        ))}

        {puntos.map((p) => (
          <Group key={p.id}>
            {elegido === p.id ? (
              <Circle cx={p.x} cy={p.y} r={radioLatido} color={PIN} opacity={opacidadLatido} />
            ) : null}
            <Circle cx={p.x} cy={p.y} r={radioPin} color={PIN_ARO} />
            <Circle cx={p.x} cy={p.y} r={radioPin} color={PIN} style="stroke" strokeWidth={radioAro} />
            <Circle cx={p.x} cy={p.y} r={radioPin} color={PIN} opacity={0.9} />
          </Group>
        ))}
      </Group>
    </Canvas>
  );
}

// ─── Geometría ────────────────────────────────────────────────────────────────

/**
 * Un anillo a comando de path, simplificando por distancia en pantalla.
 *
 * Se conserva siempre el primero y el último para no abrir el polígono, y entre
 * medio solo entra el punto que se separó más de un pelo del último aceptado.
 */
function anilloAPath(anillo, z, ancla) {
  if (!Array.isArray(anillo) || anillo.length < 3) return '';

  const partes = [];
  let ux = 0;
  let uy = 0;

  for (let i = 0; i < anillo.length; i++) {
    const p = anillo[i];
    const x = lngAX(Number(p[0]), z) - ancla.x;
    const y = latAY(Number(p[1]), z) - ancla.y;

    if (i > 0 && i < anillo.length - 1) {
      const dx = x - ux;
      const dy = y - uy;
      if (dx * dx + dy * dy < PELO * PELO) continue;
    }

    partes.push(`${partes.length === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
    ux = x;
    uy = y;
  }

  return partes.length >= 3 ? partes.join(' ') + ' Z' : '';
}

function geometriaAPath(geometry, z, ancla) {
  if (!geometry?.coordinates) return '';
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map((a) => anilloAPath(a, z, ancla)).filter(Boolean).join(' ');
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .flatMap((poli) => poli.map((a) => anilloAPath(a, z, ancla)))
      .filter(Boolean)
      .join(' ');
  }
  return '';
}
