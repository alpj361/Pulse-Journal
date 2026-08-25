import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { MONO } from '../codex/mono';
import {
  LAT_MAX,
  TESELA,
  latAY,
  lngAX,
  limitar,
  rangoClave,
  teselasVisibles,
  xALng,
  yALat,
} from './proyeccion';
import { roce } from '../../utils/haptics';
import MapaCapas from './MapaCapas';

/**
 * El mapa.
 *
 * No hay SDK de mapas acá abajo: hay teselas, una proyección y dos gestos. Un
 * mapa de verdad es exactamente eso, y hacerlo así significa que las capas que
 * vengan después —lugares, calor, trayectos— se dibujan con las mismas
 * herramientas que el resto de la app y no contra la API de un tercero.
 *
 * **El centro se guarda en grados, no en píxeles.** Podría guardarse en píxeles
 * del plano y ahorrar dos proyecciones por frame, pero entonces cada cambio de
 * zoom obligaría a reescalar el centro, y ese reescalado a mitad de un pellizco
 * es de donde salen los saltos. En grados, el centro es el centro: el zoom pasa
 * por encima sin tocarlo.
 *
 * **Las teselas se recalculan solo cuando cambian.** El gesto corre entero en el
 * hilo de UI; cruzar al de JS en cada frame para preguntar qué teselas tocan
 * sería justo lo que hace que un mapa se sienta pegajoso. En vez de eso se
 * vigila la firma del rango visible, y solo cuando esa firma cambia —un par de
 * veces por arrastre, no sesenta— se avisa del otro lado.
 *
 * **Por qué el nivel entero y la escala van separados.** Las teselas existen
 * solo en zooms enteros, pero el pellizco es continuo. Así que se dibuja el
 * nivel entero más cercano y se lo estira con `k` para cubrir la fracción; al
 * cruzar de nivel, entra el juego de teselas nuevo. Es lo mismo que hace
 * cualquier mapa, y es la razón de que al pellizcar se vea un instante borroso
 * antes de volver a estar nítido.
 */

const Z_MIN = 3;
const Z_MAX = 19;

/**
 * Cuánto se deja pasar el zoom más allá de sus límites mientras se pellizca.
 *
 * Sin esto, tocar el fondo del zoom se siente como tocar una pared: el gesto
 * sigue pero el número no se mueve, y no hay forma de saber si el mapa se
 * congeló o si de verdad no hay más para acercar. Con un margen que cede un
 * poco y después vuelve con un resorte —como el fondo de una lista en
 * iOS— el límite se siente, no se choca.
 */
const Z_ELASTICO = 0.6;

/** El overshoot se aplana a medida que crece: los primeros grados de exceso
 *  ceden casi entero, los siguientes casi nada. Así el tope sigue sintiéndose
 *  como un tope, no como zoom infinito con freno de mano. */
function conElasticidad(exceso) {
  const signo = Math.sign(exceso);
  return signo * Z_ELASTICO * (1 - Math.exp(-Math.abs(exceso) / Z_ELASTICO));
}

/** Ciudad de Guatemala. */
// Una vista de país da contexto antes de bajar al detalle. El mapa cambia a
// municipios al acercarse, así que no hace falta empezar encerrado en la capital.
export const CENTRO_INICIAL = { lat: 15.15, lng: -90.25, zoom: 7.6 };

/**
 * La fuente de teselas.
 *
 * Mapbox, con el mismo estilo que ThePulse —`outdoors-v12`— para que las dos
 * mitades del proyecto muestren el mismo país. OpenStreetMap queda de red: si
 * falta el token la app no se queda con un mapa vacío, que es la peor forma de
 * fallar por una variable de entorno.
 *
 * Se piden en 256 y `@2x`: la cuadrícula es la misma que ya usa la proyección,
 * así que el cambio no toca una sola línea de matemática, y la imagen llega al
 * doble de resolución para que el texto del mapa no se vea blando en la pantalla
 * de un teléfono.
 *
 * Mapbox cobra por tesela servida. Este es el mismo token que usa la web, así
 * que las dos mitades consumen de la misma cuenta.
 */
const MAPBOX = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
const ESTILO = 'mapbox/outdoors-v12';

const FUENTE = MAPBOX
  ? {
      url: (z, x, y) =>
        `https://api.mapbox.com/styles/v1/${ESTILO}/tiles/256/${z}/${x}/${y}@2x?access_token=${MAPBOX}`,
      // Mapbox exige crédito a los dos: al estilo y a los datos, que son de
      // OpenStreetMap. No es cortesía, son los términos de uso.
      atribucion: '© Mapbox © OpenStreetMap',
      headers: null,
    }
  : {
      url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
      atribucion: '© OpenStreetMap',
      headers: { 'User-Agent': 'Vizta/0.0.5 (+https://standatpd.com)' },
    };

/**
 * El velo de papel.
 *
 * Una lámina translúcida del color del papel, para que el mapa termine de
 * pertenecer a esta pantalla en vez de parecer una captura de otro programa.
 *
 * Con OpenStreetMap hacía falta al 30%: su estilo por defecto trae verdes y
 * amarillos de señalización que sobre crema gritan. El de Mapbox ya viene calmo,
 * así que acá es apenas un tinte — más que esto solo apagaría un mapa que ya
 * estaba bien.
 */
const VELO = MAPBOX ? 'rgba(255,253,248,0.12)' : 'rgba(255,253,248,0.30)';

export default function MapaVizta({
  ancho,
  alto,
  inicial = CENTRO_INICIAL,
  reinicio = 0,
  onMover,
  areas = [],
  pines = [],
  recorridos = [],
  mostrarAreas = true,
  mostrarPines = true,
  mostrarCalor = false,
  borrador = null,
  nivel,
  elegido,
  onTocar,
  onExplorar,
  modo = 'navegar',
  // Controles superpuestos: RNGH puede reconocer su toque aunque sean
  // hermanos visuales del lienzo, así que sus rectángulos se excluyen del
  // acierto geográfico.
  zonasSinToque = [],
  children,
}) {
  const lat = useSharedValue(inicial.lat);
  const lng = useSharedValue(inicial.lng);
  const zoom = useSharedValue(inicial.zoom);

  // El nivel entero que se está dibujando. Lo leen tanto el juego de teselas
  // como las dos transformaciones, así que vive en un solo lado.
  const [zInt, setZInt] = useState(Math.round(inicial.zoom));
  const [teselas, setTeselas] = useState([]);
  const [bloque, setBloque] = useState({ w: 0, h: 0 });
  const [origen, setOrigen] = useState({ x: 0, y: 0 });

  /**
   * El ancla de las capas del Codex.
   *
   * Las teselas se recolocan con `origen`, que cambia cada vez que el rango
   * visible se corre —varias veces por arrastre—. Los polígonos no pueden
   * colgar de eso: reproyectarlos con esa frecuencia es trabajo del hilo de JS
   * en medio del gesto. El ancla se fija mientras se conserva la misma escala:
   * así Skia transforma las rutas existentes junto al dedo, sin vaciarlas para
   * volverlas a crear a mitad de un paneo.
   */
  const [ancla, setAncla] = useState(() => {
    const z = Math.round(inicial.zoom);
    return { x: lngAX(inicial.lng, z), y: latAY(inicial.lat, z), z };
  });

  const claveVista = useRef('');

  /**
   * El origen del bloque de teselas que se está dibujando.
   *
   * Existe porque las coordenadas del plano del mundo son enormes: el centro de
   * Guatemala a zoom 12 cae en el píxel 260096, 480512. Una vista puesta a esa
   * distancia del origen **no la dibuja iOS** — ni siquiera pide la imagen por
   * la red, que fue exactamente el síntoma: treinta teselas montadas, cero
   * peticiones, pantalla vacía.
   *
   * Así que las teselas se posicionan respecto de la esquina de su propio
   * bloque, con números de tres cifras, y la distancia al origen del mundo se
   * mete adentro de la traslación, que sí tolera valores grandes porque es una
   * transformación y no una posición de layout.
   */

  const pellizcoPrevio = useSharedValue(1);
  const ultimaExploracion = useSharedValue(0);

  /** Recalcula el juego de teselas. Solo se llama cuando el rango cambió. */
  const recomputar = useCallback(
    (la, ln, zf) => {
      const z = Math.round(limitar(zf, Z_MIN, Z_MAX));
      const cx = lngAX(ln, z);
      const cy = latAY(la, z);
      const escala = Math.pow(2, zf - z);

      const clave = rangoClave({ cx, cy, z, ancho, alto, escala });
      if (clave === claveVista.current) return;
      claveVista.current = clave;

      setZInt(z);
      // Dos anillos por delante cubren una inercia corta y permiten que
      // expo-image resuelva desde memoria/disco antes de que la tesela entre a
      // la pantalla. Es preferible a mostrar el fondo mientras llega la red.
      const crudas = teselasVisibles({ cx, cy, z, ancho, alto, escala, margen: 2 });
      const ox = crudas.length ? Math.min(...crudas.map((t) => t.px)) : 0;
      const oy = crudas.length ? Math.min(...crudas.map((t) => t.py)) : 0;
      setOrigen({ x: ox, y: oy });
      const locales = crudas.map((t) => ({ ...t, lx: t.px - ox, ly: t.py - oy }));
      setTeselas(locales);

      // El cambio de ancla recrea paths Skia. Durante un arrastre eso dejaba un
      // frame vacío; por eso solo se reemplaza al cambiar de zoom entero.
      setAncla((prev) => (prev.z === z ? prev : { x: cx, y: cy, z }));
      setBloque({
        w: locales.length ? Math.max(...locales.map((t) => t.lx)) + TESELA : 0,
        h: locales.length ? Math.max(...locales.map((t) => t.ly)) + TESELA : 0,
      });
      onMover?.({ lat: la, lng: ln, zoom: zf });
    },
    [ancho, alto, onMover]
  );

  useEffect(() => {
    recomputar(inicial.lat, inicial.lng, inicial.zoom);
    // Solo al montar y al cambiar de tamaño: después manda el gesto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ancho, alto]);

  /**
   * Volver al punto de partida.
   *
   * Se dispara subiendo `reinicio` en vez de con una referencia imperativa: un
   * contador es una sola línea de cada lado y no obliga a que quien use el mapa
   * sepa nada de su interior. Sin esto, arrastrar hasta el Pacífico deja al
   * mapa sin retorno, y la única salida sería cerrar la pantalla.
   */
  useEffect(() => {
    if (!reinicio) return;
    const t = { duration: 620 };
    lat.value = withTiming(inicial.lat, t);
    lng.value = withTiming(inicial.lng, t);
    zoom.value = withTiming(inicial.zoom, t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reinicio]);

  // El vigía del rango. Corre en el hilo de UI y solo cruza a JS cuando de
  // verdad hay teselas nuevas que traer.
  useAnimatedReaction(
    () => {
      const z = Math.round(zoom.value);
      const escala = Math.pow(2, zoom.value - z);
      const cx = lngAX(lng.value, z);
      const cy = latAY(lat.value, z);
      const x0 = Math.floor((cx - ancho / 2 / escala) / TESELA);
      const y0 = Math.floor((cy - alto / 2 / escala) / TESELA);
      const x1 = Math.floor((cx + ancho / 2 / escala) / TESELA);
      const y1 = Math.floor((cy + alto / 2 / escala) / TESELA);
      return `${z}:${x0},${x1},${y0},${y1}`;
    },
    (ahora, antes) => {
      if (ahora !== antes) runOnJS(recomputar)(lat.value, lng.value, zoom.value);
    },
    [ancho, alto, recomputar]
  );

  // ─── Gestos ─────────────────────────────────────────────────────────────────

  /**
   * Arrastrar. Se usa el delta de cada frame y no el acumulado desde que empezó
   * el gesto: el acumulado obliga a guardar un centro de partida, y ese centro
   * queda viejo apenas el zoom cambia por debajo. Con el delta, mover y acercar
   * a la vez no se pelean.
   */
  const arrastre = Gesture.Pan()
    .minDistance(2)
    // Un dedo, nunca dos. Sin este límite, un toque de dos dedos puede quedar
    // reclamado por el arrastre antes de que el pellizco llegue a activarse: es
    // una carrera entre los dos reconocedores nativos, y Pan la gana seguido.
    .maxPointers(1)
    // `onChange` y no `onUpdate`: el delta por frame —`changeX`, `changeY`—
    // solo viene poblado en `onChange`. En `onUpdate` llega `undefined`, la
    // resta da `NaN`, y el centro del mapa se vuelve `NaN` para siempre: la
    // pantalla se queda en blanco al primer arrastre y ya no vuelve.
    .onChange((e) => {
      const z = zoom.value;
      const x = lngAX(lng.value, z) - e.changeX;
      const y = latAY(lat.value, z) - e.changeY;
      const nLng = xALng(x, z);
      const nLat = yALat(y, z);
      // Una coordenada rota no se escribe. Un solo frame malo dejaría el mapa
      // inutilizable, y no hay forma de volver desde `NaN`.
      if (!Number.isFinite(nLng) || !Number.isFinite(nLat)) return;
      lng.value = nLng;
      lat.value = Math.max(-LAT_MAX, Math.min(LAT_MAX, nLat));
    });

  /** Pellizcar, anclado al punto entre los dedos. */
  const pellizco = Gesture.Pinch()
    .onBegin(() => {
      pellizcoPrevio.value = 1;
    })
    .onUpdate((e) => {
      const factor = e.scale / pellizcoPrevio.value;
      pellizcoPrevio.value = e.scale;

      const z0 = zoom.value;
      // El destino sin recortar. Si cae dentro del rango, se usa tal cual; si se
      // pasa, el exceso se amortigua en vez de cortarse en seco — ver
      // `conElasticidad`. `zoom.value` puede quedar un poco afuera de
      // [Z_MIN, Z_MAX] mientras el dedo sigue en pantalla; `recomputar` ya
      // redondea y recorta antes de pedir teselas, así que un 19.3 pasajero
      // nunca pide una tesela de un nivel que no existe.
      const crudo = z0 + Math.log2(factor);
      const z1 =
        crudo < Z_MIN
          ? Z_MIN + conElasticidad(crudo - Z_MIN)
          : crudo > Z_MAX
            ? Z_MAX + conElasticidad(crudo - Z_MAX)
            : crudo;
      if (z1 === z0) return;

      // El punto del mundo que está bajo los dedos tiene que seguir ahí después
      // de acercar. Sin este anclaje el mapa se acerca al centro de la pantalla
      // y la mano termina señalando otra cosa.
      const dx = e.focalX - ancho / 2;
      const dy = e.focalY - alto / 2;

      const anclaLng = xALng(lngAX(lng.value, z0) + dx, z0);
      const anclaLat = yALat(latAY(lat.value, z0) + dy, z0);

      lng.value = xALng(lngAX(anclaLng, z1) - dx, z1);
      lat.value = Math.max(-LAT_MAX, Math.min(LAT_MAX, yALat(latAY(anclaLat, z1) - dy, z1)));
      zoom.value = z1;
    })
    .onEnd(() => {
      // Al soltar, lo que quedó afuera del rango vuelve con un resorte. Si
      // nunca se pasó del límite, esto no hace nada — `withSpring` hacia el
      // mismo valor no anima.
      const acotado = Math.max(Z_MIN, Math.min(Z_MAX, zoom.value));
      if (acotado !== zoom.value) {
        zoom.value = withSpring(acotado, { damping: 14, stiffness: 180 });
      }
    });

  /** Doble toque: un nivel más, anclado donde se tocó. */
  const doble = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(280)
    .onEnd((e) => {
      const z0 = zoom.value;
      const z1 = Math.min(Z_MAX, z0 + 1);
      if (z1 === z0) return;

      const dx = e.x - ancho / 2;
      const dy = e.y - alto / 2;
      const anclaLng = xALng(lngAX(lng.value, z0) + dx, z0);
      const anclaLat = yALat(latAY(lat.value, z0) + dy, z0);

      lng.value = withTiming(xALng(lngAX(anclaLng, z1) - dx, z1), { duration: 260 });
      lat.value = withTiming(yALat(latAY(anclaLat, z1) - dy, z1), { duration: 260 });
      zoom.value = withTiming(z1, { duration: 260 });
      runOnJS(roce)();
    });

  /**
   * Toque simple: no elige nada por su cuenta, solo informa **en grados** dónde
   * cayó el dedo.
   *
   * La alternativa era dejar que el SVG de las capas recibiera el toque, y eso
   * está roto de raíz: react-native-svg resuelve el acierto en su propio sistema
   * de coordenadas, sin pasar por la transformación de Reanimated que mueve la
   * capa. El resultado era tocar la capital y que se seleccionara un municipio a
   * cien kilómetros. Convertir acá y buscar en JS usa la misma proyección que
   * dibujó el mapa, así que no puede desalinearse.
   */
  const simple = Gesture.Tap()
    .maxDuration(260)
    // Un arrastre real debe hacer fallar el toque antes de levantar el dedo.
    // Sin un límite explícito, algunos eventos sintéticos de iOS llegan como
    // un toque en el punto final y abren una ficha en vez de mover el mapa.
    .maxDistance(8)
    .onEnd((e) => {
      for (const zona of zonasSinToque) {
        if (e.x >= zona.x && e.x <= zona.x + zona.ancho && e.y >= zona.y && e.y <= zona.y + zona.alto) {
          return;
        }
      }
      const z = zoom.value;
      const px = lngAX(lng.value, z) + (e.x - ancho / 2);
      const py = latAY(lat.value, z) + (e.y - alto / 2);
      if (onTocar) runOnJS(onTocar)({ lat: yALat(py, z), lng: xALng(px, z), zoom: z });
    });

  /**
   * Explorar territorios con el dedo, sin mover la cámara.
   *
   * La consulta cruza a JS como máximo cada 72 ms (~14 veces por segundo). Es
   * suficiente para que el resaltado siga al dedo y evita recorrer cientos de
   * cajas geográficas sesenta veces por segundo.
   */
  const exploracion = Gesture.Pan()
    .minDistance(0)
    .maxPointers(1)
    .onBegin((e) => {
      if (!onExplorar) return;
      const z = zoom.value;
      const px = lngAX(lng.value, z) + (e.x - ancho / 2);
      const py = latAY(lat.value, z) + (e.y - alto / 2);
      ultimaExploracion.value = Date.now();
      runOnJS(onExplorar)({ lat: yALat(py, z), lng: xALng(px, z), zoom: z });
    })
    .onChange((e) => {
      if (!onExplorar) return;
      const ahora = Date.now();
      if (ahora - ultimaExploracion.value < 72) return;
      ultimaExploracion.value = ahora;
      const z = zoom.value;
      const px = lngAX(lng.value, z) + (e.x - ancho / 2);
      const py = latAY(lat.value, z) + (e.y - alto / 2);
      runOnJS(onExplorar)({ lat: yALat(py, z), lng: xALng(px, z), zoom: z });
    });

  // El arrastre compite directamente con el toque y gana apenas se superan
  // tres píxeles. El doble toque conserva prioridad sobre ambos.
  const navegacion = Gesture.Simultaneous(
    Gesture.Exclusive(doble, Gesture.Race(arrastre, simple)),
    pellizco
  );
  const edicion = Gesture.Simultaneous(Gesture.Exclusive(doble, simple), pellizco);
  const gesto = modo === 'explorar' ? Gesture.Simultaneous(exploracion, pellizco) : modo === 'navegar' ? navegacion : edicion;

  /**
   * La transformación.
   *
   * El contenedor tiene el tamaño exacto del bloque de teselas y transforma
   * desde su esquina superior izquierda, así que una tesela puesta en el píxel
   * local (lx, ly) aterriza en `lx·k + t` y nada más.
   *
   * La primera versión usaba un contenedor de 0×0 —con centro y origen en el
   * mismo punto, el mismo efecto sin declarar nada— y no dibujaba nada: la
   * Nueva Arquitectura descarta los hijos de una vista sin área, hasta el punto
   * de que las imágenes ni siquiera se pedían por la red.
   */
  /**
   * La transformación lee `zInt` y `origen` del estado de React, no de valores
   * compartidos. Los compartidos se escriben al instante y el estado un frame
   * después, así que teniendo las capas de un lado y las teselas del otro los
   * polígonos patinaban sobre el mapa en cada recálculo. Leyendo los dos el
   * mismo estado, se mueven juntos por construcción. Nada se pierde: estos dos
   * valores solo cambian cuando corre `recomputar`, que ya es del hilo de JS.
   */
  const lienzo = useAnimatedStyle(() => {
    const k = Math.pow(2, zoom.value - zInt);
    return {
      transform: [
        { translateX: ancho / 2 + (origen.x - lngAX(lng.value, zInt)) * k },
        { translateY: alto / 2 + (origen.y - latAY(lat.value, zInt)) * k },
        { scale: k },
      ],
    };
  }, [ancho, alto, zInt, origen]);

  return (
    <View style={{ width: ancho, height: alto, overflow: 'hidden', backgroundColor: '#EDEBE3' }}>
      {/* Los gestos solo pertenecen al lienzo. Los controles del Codex son
          hermanos, no hijos: de ese modo elegir “municipios” no toca también
          el polígono que quedó debajo del botón. */}
      <GestureDetector gesture={gesto}>
        <View style={{ position: 'absolute', left: 0, top: 0, width: ancho, height: alto }}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              top: 0,
              width: bloque.w,
              height: bloque.h,
              // Sin esto, React Native transforma respecto del centro de la
              // vista y habría que corregir por la mitad del bloque en cada
              // frame — con un bloque que cambia de tamaño al moverse.
              transformOrigin: 'top left',
            },
            lienzo,
          ]}
        >
          {teselas.map((t) => (
            <Tesela key={t.clave} t={t} nivel={zInt} />
          ))}
        </Animated.View>

        {/* El velo va sobre las teselas y debajo de todo lo demás: tiñe el mapa,
            no los marcadores ni los controles. */}
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: VELO }} />

        <MapaCapas
          ancho={ancho}
          alto={alto}
          ancla={ancla}
          zoom={zoom}
          lat={lat}
          lng={lng}
          areas={areas}
          pines={pines}
          recorridos={recorridos}
          mostrarAreas={mostrarAreas}
          mostrarPines={mostrarPines}
          mostrarCalor={mostrarCalor}
          borrador={borrador}
          nivel={nivel}
          elegido={elegido}
        />

        {/* OpenStreetMap pide crédito visible. No es decoración legal: es la
            condición de uso de las teselas. */}
        <View pointerEvents="none" style={{ position: 'absolute', right: 8, bottom: 6 }}>
          <Text style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(28,43,34,0.45)' }}>
            {FUENTE.atribucion}
          </Text>
        </View>
        </View>
      </GestureDetector>

      {children}
    </View>
  );
}

/** El color detrás de una tesela mientras no llegó ninguna imagen todavía. */
const TESELA_VACIA = MAPBOX ? '#EFEFEA' : '#E9E7DE';

/**
 * Una tesela.
 *
 * Se monta ya con su posición del plano del mundo; la transformación de arriba
 * la lleva a pantalla. Aparece con un fundido corto porque llegan desordenadas
 * por la red, y verlas caer de golpe una por una parece un error de carga.
 *
 * **`expo-image` y no el `Image` del núcleo.** El resto de la app ya lo usa por
 * su caché en disco y su decodificado fuera del hilo principal; acá importaba
 * más, porque el mapa vuelve a pedir teselas que ya se vieron cada vez que se
 * arrastra de un lado a otro y de vuelta. Con el `Image` del núcleo, cada
 * regreso era una descarga nueva —y en una red de teléfono, cada descarga es
 * un salto en la pantalla—; con caché en disco, la segunda vez sale de ahí.
 *
 * **El fondo de la tesela no es blanco mientras carga.** Un blanco puro sobre
 * el mapa de por sí calmo se lee como un hueco roto; un tono cercano al de la
 * tierra hace que la tesela que falta se note menos mientras llega.
 */
function Tesela({ t, nivel }) {
  // Un nivel distinto al que se está dibujando es una tesela que quedó de un
  // zoom anterior: no se monta, pero tampoco se rompe si aparece.
  if (t.z !== nivel) return null;

  return (
    <View
      style={{
        position: 'absolute',
        left: t.lx,
        top: t.ly,
        width: TESELA,
        height: TESELA,
        backgroundColor: TESELA_VACIA,
      }}
    >
      <Image
        source={FUENTE.headers ? { uri: FUENTE.url(t.z, t.x, t.y), headers: FUENTE.headers } : { uri: FUENTE.url(t.z, t.x, t.y) }}
        cachePolicy="memory-disk"
        recyclingKey={t.clave}
        // `+1` mata la costura: con teselas de ancho exacto, el redondeo a
        // píxeles físicos deja una hilacha del fondo entre columna y columna.
        style={{ width: TESELA + 1, height: TESELA + 1 }}
        transition={null}
      />
    </View>
  );
}
