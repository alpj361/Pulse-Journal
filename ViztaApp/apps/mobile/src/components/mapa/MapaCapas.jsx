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
 * **La ruta persiste durante el paneo.** La lista de formas se prepara al
 * cambiar de escala, no al cruzar una frontera de bloques. Así los límites y
 * selecciones viajan con el dedo en vez de desaparecer un frame.
 */

/** Ni un punto más cerca que esto del anterior, en píxeles de pantalla. */
const PELO = 1.6;

const RELLENO_DEPARTAMENTO = 'rgba(39,104,210,0.055)';
const RELLENO_ELEGIDO = 'rgba(20,103,232,0.24)';
const BORDE = 'rgba(48,107,204,0.60)';
const PIN = '#B45309';
const PIN_ARO = '#FFFDF8';
const RUTA = '#315E9E';
const RUTA_ARO = 'rgba(255,253,248,0.92)';
const BORRADOR = '#6941C6';
const CALOR_FRIO = 'rgba(33,102,172,0.16)';
const CALOR_MEDIO = 'rgba(245,158,11,0.17)';
const CALOR_ALTO = 'rgba(220,38,38,0.22)';

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
  recorridos = [],
  mostrarAreas,
  mostrarPines,
  mostrarCalor = false,
  borrador = null,
  /** Qué nivel administrativo se está mostrando. Solo se usa para re-entintar. */
  nivel,
  elegido,
}) {
  const { rutas, lineas, puntos, dibujo } = useMemo(() => {
    const z = ancla.z;
    const rutas = [];
    if (mostrarAreas) {
      for (const a of areas) {
        const d = geometriaAPath(a.geometry, z, ancla);
        if (!d) continue;
        const path = Skia.Path.MakeFromSVGString(d);
        if (path) rutas.push({ id: a.id, path });
      }
    }

    const lineas = recorridos
      .map((r) => {
        const d = geometriaLinealAPath(r.geometry, z, ancla);
        const path = d ? Skia.Path.MakeFromSVGString(d) : null;
        return path ? { id: r.id, path } : null;
      })
      .filter(Boolean);

    const puntos = mostrarPines || mostrarCalor
      ? pines.map((p) => ({
          id: p.id,
          x: lngAX(p.coordinates.lng, z) - ancla.x,
          y: latAY(p.coordinates.lat, z) - ancla.y,
        }))
      : [];

    const coordenadas = Array.isArray(borrador?.coordinates) ? borrador.coordinates : [];
    const vertices = coordenadas.map(([ln, la]) => ({
      x: lngAX(Number(ln), z) - ancla.x,
      y: latAY(Number(la), z) - ancla.y,
    }));
    const dBorrador = lineaAPath(coordenadas, z, ancla, borrador?.tipo === 'area');
    const dibujo = {
      tipo: borrador?.tipo || null,
      vertices,
      path: dBorrador ? Skia.Path.MakeFromSVGString(dBorrador) : null,
    };

    return { rutas, lineas, puntos, dibujo };
  }, [areas, pines, recorridos, mostrarAreas, mostrarPines, mostrarCalor, borrador, ancla]);

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
  const radioCalorFrio = useDerivedValue(() => 34 * escalaInv.value);
  const radioCalorMedio = useDerivedValue(() => 21 * escalaInv.value);
  const radioCalorAlto = useDerivedValue(() => 9 * escalaInv.value);
  const grosorRutaAro = useDerivedValue(() => 5.5 * escalaInv.value);
  const grosorRuta = useDerivedValue(() => 2.8 * escalaInv.value);
  const grosorBorrador = useDerivedValue(() => 2.4 * escalaInv.value);
  const radioVertice = useDerivedValue(() => 4.5 * escalaInv.value);
  // El relleno entra después del trazo: primero la línea, después el color.
  const opacidadRelleno = useDerivedValue(() => Math.max(0, (entrada.value - 0.45) / 0.55));

  if (!rutas.length && !lineas.length && !puntos.length && !dibujo.path && !dibujo.vertices.length) return null;

  return (
    <Canvas
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, width: ancho, height: alto }}
    >
      <Group transform={transformacion}>
        {mostrarCalor
          ? puntos.map((p) => (
              <Group key={`calor-${p.id}`}>
                <Circle cx={p.x} cy={p.y} r={radioCalorFrio} color={CALOR_FRIO} />
                <Circle cx={p.x} cy={p.y} r={radioCalorMedio} color={CALOR_MEDIO} />
                <Circle cx={p.x} cy={p.y} r={radioCalorAlto} color={CALOR_ALTO} />
              </Group>
            ))
          : null}

        {rutas.map((r) => (
          <Group key={r.id}>
            <Path
              path={r.path}
              style="fill"
              color={elegido === r.id ? RELLENO_ELEGIDO : RELLENO_DEPARTAMENTO}
              // Un municipio es información de precisión: su relleno no debe
              // velar calles, etiquetas ni el relieve de Mapbox.
              opacity={nivel === 'municipio' && elegido !== r.id ? 0 : opacidadRelleno}
            />
            <Path
              path={r.path}
              style="stroke"
              strokeWidth={elegido === r.id ? grosorElegido : nivel === 'municipio' ? grosor : grosor}
              strokeJoin="round"
              color={BORDE}
              end={entrada}
            />
          </Group>
        ))}

        {lineas.map((r) => (
          <Group key={r.id}>
            <Path path={r.path} style="stroke" strokeWidth={grosorRutaAro} strokeJoin="round" strokeCap="round" color={RUTA_ARO} />
            <Path
              path={r.path}
              style="stroke"
              strokeWidth={elegido === r.id ? grosorElegido : grosorRuta}
              strokeJoin="round"
              strokeCap="round"
              color={RUTA}
            />
          </Group>
        ))}

        {mostrarPines ? puntos.map((p) => (
          <Group key={p.id}>
            {elegido === p.id ? (
              <Circle cx={p.x} cy={p.y} r={radioLatido} color={PIN} opacity={opacidadLatido} />
            ) : null}
            <Circle cx={p.x} cy={p.y} r={radioPin} color={PIN_ARO} />
            <Circle cx={p.x} cy={p.y} r={radioPin} color={PIN} style="stroke" strokeWidth={radioAro} />
            <Circle cx={p.x} cy={p.y} r={radioPin} color={PIN} opacity={0.9} />
          </Group>
        )) : null}

        {dibujo.path ? (
          <Group>
            {dibujo.tipo === 'area' && dibujo.vertices.length >= 3 ? (
              <Path path={dibujo.path} style="fill" color="rgba(105,65,198,0.14)" />
            ) : null}
            <Path
              path={dibujo.path}
              style="stroke"
              strokeWidth={grosorBorrador}
              strokeJoin="round"
              strokeCap="round"
              color={BORRADOR}
            />
          </Group>
        ) : null}
        {dibujo.vertices.map((p, i) => (
          <Group key={`vertice-${i}`}>
            <Circle cx={p.x} cy={p.y} r={radioVertice} color={PIN_ARO} />
            <Circle cx={p.x} cy={p.y} r={radioVertice} color={BORRADOR} style="stroke" strokeWidth={radioAro} />
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

function lineaAPath(coordinates, z, ancla, cerrar = false) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return '';
  const partes = coordinates
    .map((p, i) => {
      const x = lngAX(Number(p?.[0]), z) - ancla.x;
      const y = latAY(Number(p?.[1]), z) - ancla.y;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .filter(Boolean);
  if (!partes.length) return '';
  return partes.join(' ') + (cerrar && partes.length >= 3 ? ' Z' : '');
}

function geometriaLinealAPath(geometry, z, ancla) {
  if (geometry?.type === 'LineString') return lineaAPath(geometry.coordinates, z, ancla);
  if (geometry?.type === 'MultiLineString') {
    return geometry.coordinates.map((linea) => lineaAPath(linea, z, ancla)).filter(Boolean).join(' ');
  }
  return '';
}
