import { useEffect, useMemo, useRef } from 'react';
import { BlurMask, Canvas, Circle, FillType, Group, Path, Skia } from '@shopify/react-native-skia';
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
import { CELDA } from './niebla';

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

/**
 * Los colores del mapa, uno por rol.
 *
 * El criterio es que **la interfaz es tinta y los datos tienen color**. Antes
 * había cuatro azules distintos —uno para el borde, otro para el relleno, otro
 * para las rutas, otro para la herramienta activa— y un morado para el
 * borrador, y ninguno de los cinco salía de `theme.js`. Nada los relacionaba
 * entre sí, así que el mapa no se leía como una familia sino como cinco
 * decisiones tomadas en momentos distintos.
 *
 * Ahora cada color dice algo:
 *
 * - **verde** — territorio: fronteras y recorridos, lo que divide y conecta.
 * - **ámbar** — punto: lo que está en un lugar exacto.
 * - **índigo** — vos: tu ubicación y lo que estás trazando en este momento.
 *   Es el único acento que no describe datos guardados sino a la persona.
 *
 * Todos salen de `ACCENT` y de la paleta del papel; el heatmap conserva su
 * rampa frío→cálido porque ahí el color sí es la escala.
 */
const VERDE = '58,96,73';

/**
 * El velo.
 *
 * Papel, no gris ni negro: lo que no se descubrió está **pendiente**, no es de
 * noche. Un velo oscuro convertiría el mapa en un juego de sigilo; uno del
 * color del papel lo deja pareciendo una hoja que todavía no se terminó de
 * revelar, que es lo que efectivamente es.
 *
 * **Niebla, no pintura.** La primera versión tapaba al 93% con un canto duro, y
 * el resultado era que no había mapa: una lámina blanca con unos agujeros
 * recortados a tijera. Niebla de verdad es translúcida y no tiene borde — se
 * adivina la forma del terreno debajo, y lo descubierto se funde con lo que
 * falta en vez de encajar como una pieza.
 *
 * Dos perillas independientes, y conviene no confundirlas:
 *
 * - **`VELO`** decide cuánto tapa. Es lo que evita que la niebla se lea como
 *   pintura blanca: al 80% se adivina el terreno y descubrirlo sigue valiendo.
 * - **`VELO_DIFUSO`** decide cuánto se le come el filo a los agujeros. Con
 *   mucho desenfoque el raspado queda como una mancha de aliento sobre vidrio
 *   y se pierde de dónde salió; con poco se lee la cuadrícula —cada pasada
 *   descubre celdas, y verlas es parte de entender que el mapa se descubre a
 *   pedazos, no a brochazos.
 *
 * Va bajo, no en cero: un par de píxeles alcanzan para matar el borde dentado
 * sin disolver la tesela.
 */
const VELO = 'rgba(255,253,248,0.80)';
const VELO_DIFUSO = 3;

const RELLENO_DEPARTAMENTO = `rgba(${VERDE},0.055)`;
const RELLENO_ELEGIDO = `rgba(${VERDE},0.20)`;
const BORDE = `rgba(${VERDE},0.72)`;
const PIN = '#B45309';
const PIN_ARO = '#FFFDF8';
const RUTA = '#15803D';
const RUTA_ARO = 'rgba(255,253,248,0.92)';
const BORRADOR = '#4B4FA6';
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
  /** Celdas descubiertas visibles, ya recortadas al viewport por quien llama. */
  niebla = null,
  /** Qué nivel administrativo se está mostrando. Solo se usa para re-entintar. */
  nivel,
  elegido,
}) {
  /**
   * El velo, como un solo path con relleno par-impar.
   *
   * El rectángulo exterior cubre; cada celda descubierta es un subpath que,
   * por la regla par-impar, se convierte en agujero. Todo el efecto es **un
   * draw call**, sin máscaras, sin capas intermedias y sin un nodo por celda:
   * con unos miles de celdas descubiertas eso último sería impracticable.
   *
   * El rectángulo se dibuja en coordenadas del ancla y se hace deliberadamente
   * enorme. El ancla se recoloca cada 2048 px de mundo y solo cambia de nivel
   * con el zoom entero, así que el desplazamiento respecto de ella está
   * acotado; ±6000 cubre cualquier pantalla en cualquier punto del recorrido
   * sin tener que recalcular el path mientras el dedo se mueve.
   */
  const velo = useMemo(() => {
    const celdas = niebla?.celdas;
    if (!niebla?.activa) return null;

    const z = ancla.z;
    const path = Skia.Path.Make();
    path.addRect(Skia.XYWHRect(-6000, -6000, 12000, 12000));

    if (celdas?.length) {
      for (const { cx, cy } of celdas) {
        // La celda va de su esquina suroeste a la siguiente. En pantalla la
        // latitud crece hacia arriba y la Y hacia abajo, así que el borde
        // superior sale de `cy + 1`.
        const x0 = lngAX(cx * CELDA, z) - ancla.x;
        const x1 = lngAX((cx + 1) * CELDA, z) - ancla.x;
        const y0 = latAY((cy + 1) * CELDA, z) - ancla.y;
        const y1 = latAY(cy * CELDA, z) - ancla.y;
        if (!Number.isFinite(x0) || !Number.isFinite(y0)) continue;
        // Un pelo de solape entre celdas vecinas: sin él, el redondeo a píxeles
        // físicos deja una rejilla de hilos de velo entre celda y celda, y lo
        // descubierto se ve cuadriculado en vez de continuo. El solape no rompe
        // la regla par-impar porque las celdas se dibujan como un solo
        // rectángulo cada una, nunca anidadas.
        path.addRect(Skia.XYWHRect(x0, y0, x1 - x0 + 0.5, y1 - y0 + 0.5));
      }
    }

    path.setFillType(FillType.EvenOdd);
    return path;
  }, [niebla, ancla]);

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
    // Los tiradores van donde se tocó, siempre. En una ruta por calles el trazo
    // pasa por decenas de puntos que nadie eligió, y poner un tirador en cada
    // uno volvería imposible saber cuáles se pueden mover.
    const vertices = coordenadas.map(([ln, la]) => ({
      x: lngAX(Number(ln), z) - ancla.x,
      y: latAY(Number(la), z) - ancla.y,
    }));
    // La línea, en cambio, sigue el trazo cuando existe: es el camino real
    // entre esos puntos y no la cuerda recta que los une.
    const linea = Array.isArray(borrador?.trazo) && borrador.trazo.length > 1 ? borrador.trazo : coordenadas;
    const dBorrador = lineaAPath(linea, z, ancla, borrador?.tipo === 'area');
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

  /**
   * El halo del pin elegido.
   *
   * El latido de arriba engrosa el trazo de un área, que es lo que un área
   * tiene. Un pin no tiene trazo: mide cinco píxeles y engordarlo no se nota.
   * Así que la confirmación de «tocaste esto» es una onda que sale del punto y
   * se apaga.
   *
   * **Corre una vez y termina**, no en bucle. La onda contesta al toque; una
   * onda perpetua deja de ser respuesta y pasa a ser decoración que compite con
   * el mapa. Lo que sí queda mientras haya algo elegido es el latido del área,
   * porque ahí la forma es la que hay que poder seguir viendo.
   */
  const onda = useSharedValue(0);
  useEffect(() => {
    const punto = puntos.find((p) => p.id === elegido);
    if (!punto) {
      onda.value = 0;
      return undefined;
    }
    onda.value = 0;
    onda.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
    return undefined;
  }, [elegido, puntos, onda]);

  const puntoElegido = useMemo(() => puntos.find((p) => p.id === elegido) || null, [puntos, elegido]);

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
  const difusoVelo = useDerivedValue(() => VELO_DIFUSO * escalaInv.value);
  // La onda: el radio crece y la opacidad cae, así se expande y se disuelve en
  // vez de desaparecer de golpe. Va dividida por la escala como todo lo que
  // debe medir lo mismo en pantalla a cualquier zoom.
  const radioOnda = useDerivedValue(() => (6 + onda.value * 26) * escalaInv.value);
  const opacidadOnda = useDerivedValue(() => (1 - onda.value) * 0.5);
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

  // El velo se dibuja aunque no haya ni un territorio ni un pin: la niebla es
  // el estado inicial del mapa, no un adorno sobre los datos.
  if (!velo && !rutas.length && !lineas.length && !puntos.length && !dibujo.path && !dibujo.vertices.length) return null;

  return (
    <Canvas
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, width: ancho, height: alto }}
    >
      <Group transform={transformacion}>
        {/* El velo va primero: tapa las teselas, pero los territorios, los
            pines y lo que se está trazando se dibujan encima. Enterrar los
            propios datos bajo la niebla sería perder el mapa para ganar un
            efecto. */}
        {velo ? (
          <Path path={velo} style="fill" color={VELO}>
            {/* El difuminado se mide en píxeles de mundo, no de pantalla, así
                que se divide por la escala del grupo: sin eso, acercar el mapa
                convertiría la orilla de la niebla en un degradado de cien
                píxeles y alejar la volvería un canto duro otra vez. */}
            <BlurMask blur={difusoVelo} style="normal" />
          </Path>
        ) : null}

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

        {/* La onda del pin elegido. Va después de los pines para salir por
            encima, y como un solo círculo: solo hay un elegido a la vez. */}
        {puntoElegido ? (
          <Circle
            cx={puntoElegido.x}
            cy={puntoElegido.y}
            r={radioOnda}
            color={PIN}
            opacity={opacidadOnda}
          />
        ) : null}

        {dibujo.path ? (
          <Group>
            {dibujo.tipo === 'area' && dibujo.vertices.length >= 3 ? (
              <Path path={dibujo.path} style="fill" color="rgba(75,79,166,0.14)" />
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
