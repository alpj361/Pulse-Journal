import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
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

/** Cada cuántos píxeles de mundo se vuelve a anclar las capas. */
const PASO_ANCLA = 2048;

const Z_MIN = 3;
const Z_MAX = 19;

/** Ciudad de Guatemala. */
export const CENTRO_INICIAL = { lat: 14.6349, lng: -90.5069, zoom: 12 };

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
  mostrarAreas = true,
  mostrarPines = true,
  nivel,
  elegido,
  onTocar,
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
   * en medio del gesto. El ancla está cuantizada a bloques de `PASO_ANCLA`, así
   * que se mueve una vez cada varias pantallas y entre medio arrastrar no le
   * cuesta nada a nadie.
   */
  const [ancla, setAncla] = useState({ x: 0, y: 0, z: Math.round(inicial.zoom) });

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
      const crudas = teselasVisibles({ cx, cy, z, ancho, alto, escala, margen: 1 });
      const ox = crudas.length ? Math.min(...crudas.map((t) => t.px)) : 0;
      const oy = crudas.length ? Math.min(...crudas.map((t) => t.py)) : 0;
      setOrigen({ x: ox, y: oy });
      const locales = crudas.map((t) => ({ ...t, lx: t.px - ox, ly: t.py - oy }));
      setTeselas(locales);

      const ax = Math.floor(cx / PASO_ANCLA) * PASO_ANCLA;
      const ay = Math.floor(cy / PASO_ANCLA) * PASO_ANCLA;
      // Se devuelve el objeto anterior cuando no cambió: así los `useMemo` que
      // dependen del ancla no se invalidan por una identidad nueva.
      setAncla((prev) => (prev.x === ax && prev.y === ay && prev.z === z ? prev : { x: ax, y: ay, z }));
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
      const z1 = Math.max(Z_MIN, Math.min(Z_MAX, z0 + Math.log2(factor)));
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
    .onEnd((e) => {
      const z = zoom.value;
      const px = lngAX(lng.value, z) + (e.x - ancho / 2);
      const py = latAY(lat.value, z) + (e.y - alto / 2);
      if (onTocar) runOnJS(onTocar)({ lat: yALat(py, z), lng: xALng(px, z), zoom: z });
    });

  // El doble toque tiene prioridad: el simple espera a que aquel falle, si no
  // acercar dos veces también abriría una ficha.
  const gesto = Gesture.Simultaneous(Gesture.Exclusive(doble, simple, arrastre), pellizco);

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
    <GestureDetector gesture={gesto}>
      <View style={{ width: ancho, height: alto, overflow: 'hidden', backgroundColor: '#EDEBE3' }}>
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
          mostrarAreas={mostrarAreas}
          mostrarPines={mostrarPines}
          nivel={nivel}
          elegido={elegido}
        />

        {children}

        {/* OpenStreetMap pide crédito visible. No es decoración legal: es la
            condición de uso de las teselas. */}
        <View pointerEvents="none" style={{ position: 'absolute', right: 8, bottom: 6 }}>
          <Text style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(28,43,34,0.45)' }}>
            {FUENTE.atribucion}
          </Text>
        </View>
      </View>
    </GestureDetector>
  );
}

/**
 * Una tesela.
 *
 * Se monta ya con su posición del plano del mundo; la transformación de arriba
 * la lleva a pantalla. Aparece con un fundido corto porque llegan desordenadas
 * por la red, y verlas caer de golpe una por una parece un error de carga.
 */
function Tesela({ t, nivel }) {
  const opacidad = useSharedValue(0);
  const estilo = useAnimatedStyle(() => ({ opacity: opacidad.value }));

  // Un nivel distinto al que se está dibujando es una tesela que quedó de un
  // zoom anterior: no se monta, pero tampoco se rompe si aparece.
  if (t.z !== nivel) return null;

  return (
    <Animated.View
      style={[{ position: 'absolute', left: t.lx, top: t.ly, width: TESELA, height: TESELA }, estilo]}
    >
      <Image
        source={FUENTE.headers ? { uri: FUENTE.url(t.z, t.x, t.y), headers: FUENTE.headers } : { uri: FUENTE.url(t.z, t.x, t.y) }}
        onLoad={() => {
          opacidad.value = withTiming(1, { duration: 180 });
        }}
        // `+1` mata la costura: con teselas de ancho exacto, el redondeo a
        // píxeles físicos deja una hilacha del fondo entre columna y columna.
        style={{ width: TESELA + 1, height: TESELA + 1 }}
        fadeDuration={0}
      />
    </Animated.View>
  );
}
