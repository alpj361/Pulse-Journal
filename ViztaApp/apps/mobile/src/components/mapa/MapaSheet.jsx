import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Check,
  CloudFog,
  Crosshair,
  Footprints,
  LocateFixed,
  Eraser,
  Flame,
  Hand,
  MapPinPlus,
  Pentagon,
  Quote,
  Globe,
  Landmark,
  MapPin,
  PenTool,
  Phone,
  Route,
  Search,
  Shapes,
  SlidersHorizontal,
  Spline,
  Store,
  Trash2,
  Undo2,
  X,
} from 'lucide-react-native';
import { ACCENT, INK, RADIUS, SERIF } from '../theme';
import { MONO } from '../codex/mono';
import { PAPEL } from '../codex/Papel';
import MorphingInfinity from '../MorphingInfinity';
import MapaVizta, { CENTRO_INICIAL } from './MapaVizta';
import BuscarLugar from './BuscarLugar';
import AccionEnPunto from './AccionEnPunto';
import { crearCarpeta, listarCarpetas, moverItem, NOTA, POST, SIN_CARPETA, TERRITORIO } from '../../utils/carpetas';
import FiltroTerritorios from './FiltroTerritorios';
import { geoDeLugar } from '../../services/lugares';
import { rutaPorCalles } from '../../services/rutas';
import { comercioDe, estadoHorario } from '../../services/comercio';
import { ROLES } from '../codex/geo';
import ItemDetailSheet from '../codex/ItemDetailSheet';
import CreateSnippetSheet from '../codex/CreateSnippetSheet';
import { construirIndice, segmentar, normalizar } from '../codex/menciones';
import { supabase } from '../../utils/supabase';
import { usePulseConnectionStore } from '../../state/pulseConnectionStore';
import { useMapaStore, useCamaraLista } from '../../state/mapaStore';
import { useNieblaStore } from '../../state/nieblaStore';
import { CELDA, desdeClave, celdasBajoPincel, ZOOM_MINIMO_RASPADO } from './niebla';
import SelectorNiveles from './SelectorNiveles';
import useMiUbicacion from './useMiUbicacion';
import { roce } from '../../utils/haptics';
import { geoDeArea, geoDePunto, geoDeRecorrido } from '../codex/geo';

const CABEZAL = 46;

/**
 * La lista vacía, una sola para toda la pantalla.
 *
 * `const { data = [] }` parece inofensivo y es la causa de un bucle: mientras
 * la consulta no tiene datos —o mientras está deshabilitada— ese `[]` es un
 * array **nuevo en cada render**, así que cualquier `useMemo` que dependa de él
 * se recalcula siempre. Acá eso significaba recorrer 96 textos contra un índice
 * de mil entidades en cada cuadro del arrastre, y reconstruir todos los paths
 * de Skia detrás. Compartiendo una constante, la identidad no cambia y los
 * memos hacen lo que prometen.
 */
const VACIO = [];

const TENUE = 'rgba(28,43,34,0.3)';
const VERDE = 'rgba(58,96,73,0.72)';
const AMBAR = '#B45309';

/** El punto de un `geo`, venga como GeoJSON o como el par suelto que usa el Codex. */
function coordenadasDe(geo) {
  const g = geo?.geometry;
  if (g?.type === 'Point' && Array.isArray(g.coordinates)) {
    const [lng, lat] = g.coordinates;
    if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      return { lat: Number(lat), lng: Number(lng) };
    }
  }
  const c = geo?.coordinates;
  if (Number.isFinite(Number(c?.lat)) && Number.isFinite(Number(c?.lng))) {
    return { lat: Number(c.lat), lng: Number(c.lng) };
  }
  // El ancla de un territorio con polígono. No se usa para decidir si algo es
  // pin —un municipio se dibuja como su forma— pero sí para poder señalarlo
  // cuando lo que importa es dónde queda y no cómo es su borde.
  const a = geo?.anchor;
  if (Number.isFinite(Number(a?.lat)) && Number.isFinite(Number(a?.lng))) {
    return { lat: Number(a.lat), lng: Number(a.lng) };
  }
  return null;
}

/**
 * Los niveles administrativos que se pueden prender y apagar por separado.
 *
 * El orden es de grande a chico y es el que se ve en la leyenda: primero el
 * nivel que contiene, después el contenido.
 */
const NIVELES = [
  { clave: 'pais', etiqueta: 'países' },
  { clave: 'departamento', etiqueta: 'departamentos' },
  { clave: 'municipio', etiqueta: 'municipios' },
  { clave: 'zona', etiqueta: 'zonas' },
  { clave: 'nivel5', etiqueta: 'nivel 05' },
  { clave: 'nivel6', etiqueta: 'nivel 06' },
];

// «Otros» ya no es una escala: era el cajón de descarte del selector y no
// contesta «a qué escala miro». Lo dibujado a mano no desaparece por eso — se
// ve siempre, sin importar qué escala esté activa (ver `areasVisibles`).

/**
 * De qué nivel es este territorio.
 *
 * `boundary_type` decide el nivel pero no decide si algo se dibuja —eso lo
 * decide la geometría, ver abajo—. Lo que no cae en un nivel conocido va a
 * «otros» en vez de desaparecer: un territorio con una etiqueta que nadie previó
 * sigue siendo un polígono que alguien cargó y espera ver.
 */
function nivelDe(item, geo) {
  const crudo = String(geo?.boundary_type || item?.details?.boundary_type || '').toLowerCase();
  if (['pais', 'departamento', 'municipio', 'zona', 'nivel5', 'nivel6'].includes(crudo)) return crudo;
  return 'otro';
}

/**
 * Reparte los territorios en las dos capas.
 *
 * La regla es la geometría, no la etiqueta: **si tiene polígono es un área, y si
 * no, con que tenga un punto alcanza para ser un pin.** Mirar `boundary_type`
 * para decidir dejaba afuera en silencio a los que dicen `place` —hay dos en la
 * base— que tienen coordenadas perfectamente buenas y simplemente no se
 * dibujaban en ningún lado.
 */
function repartir(items) {
  const areas = [];
  const pines = [];
  const recorridos = [];

  for (const item of items || []) {
    const geo = item?.geo || {};
    const g = geo.geometry;
    const base = {
      id: item.id,
      name: item.name || 'Sin nombre',
      tipo: geo.boundary_type || item?.details?.boundary_type || 'territorio',
      description: item.description || null,
      folder_id: item.folder_id || null,
      // El rol geográfico real —frontera, área, ubicación, ruta— que es lo que
      // permite subagrupar por tipo dentro de cada familia visual sin adivinar
      // nada a partir de la geometría.
      rol: geo.spatial_role || null,
      itemTipo: item.tipo || null,
      // El item entero, sin aplastar. La ficha solo necesita cuatro campos
      // para dibujarse, pero el botón que abre el detalle necesita el item tal
      // como vino del Codex. Sin esta referencia, tocar un punto era un
      // callejón: se leía el resumen y no había a dónde ir.
      //
      // `_source` no es decoración: al guardar, el detalle elige entre
      // `codex_universe_items` y `wiki_items` mirando esta marca. Estos items
      // salen de la primera, pero sin decirlo se los toma por wiki y el UPDATE
      // se va a la tabla equivocada.
      original: { ...item, _source: 'universe' },
    };

    if (g?.type === 'Polygon' || g?.type === 'MultiPolygon') {
      areas.push({ ...base, geometry: g, clase: 'area', caja: cajaDe(g), nivel: nivelDe(item, geo) });
      continue;
    }

    if (g?.type === 'LineString' || g?.type === 'MultiLineString') {
      recorridos.push({ ...base, geometry: g, clase: 'ruta', caja: cajaDe(g) });
      continue;
    }

    const coordinates = coordenadasDe(geo);
    if (coordinates) pines.push({ ...base, coordinates, clase: 'pin' });
  }

  return { areas, pines, recorridos };
}

const anillosDe = (g) =>
  g?.type === 'Polygon' ? g.coordinates : g?.type === 'MultiPolygon' ? g.coordinates.flat() : [];

const trazosDe = (g) => {
  if (g?.type === 'Polygon') return g.coordinates;
  if (g?.type === 'MultiPolygon') return g.coordinates.flat();
  if (g?.type === 'LineString') return [g.coordinates];
  if (g?.type === 'MultiLineString') return g.coordinates;
  return [];
};

/** Caja envolvente en grados. Se calcula una vez por territorio y no cambia. */
function cajaDe(g) {
  let lngMin = Infinity;
  let lngMax = -Infinity;
  let latMin = Infinity;
  let latMax = -Infinity;
  for (const anillo of trazosDe(g)) {
    for (const [ln, la] of anillo) {
      if (ln < lngMin) lngMin = ln;
      if (ln > lngMax) lngMax = ln;
      if (la < latMin) latMin = la;
      if (la > latMax) latMax = la;
    }
  }
  return { lngMin, lngMax, latMin, latMax };
}

/**
 * Punto en polígono por conteo de cruces.
 *
 * Se traza un rayo hacia el este desde el punto y se cuentan los lados que
 * cruza: impar es adentro, par es afuera. Los agujeros salen gratis —un anillo
 * interior vuelve a cambiar la paridad—, que es justo lo que hace falta para un
 * municipio con un enclave adentro.
 */
function adentro(g, lat, lng) {
  let dentro = false;
  for (const anillo of anillosDe(g)) {
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      const [xi, yi] = anillo[i];
      const [xj, yj] = anillo[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
  }
  return dentro;
}

/**
 * Qué se tocó.
 *
 * Los pines van primero y por cercanía: son puntos, así que hay que perdonar el
 * dedo — el radio se mide en píxeles de pantalla y se convierte a grados con el
 * zoom del toque, de modo que la tolerancia es la misma de cerca y de lejos.
 * Después los territorios, filtrando por caja antes de recorrer los miles de
 * puntos de un anillo: casi siempre quedan uno o dos candidatos.
 *
 * Entre dos territorios superpuestos gana el más chico. Un municipio adentro de
 * su departamento tiene que poder tocarse, y el grande es el que siempre está
 * también debajo del dedo.
 *
 * Las áreas llegan ya filtradas por nivel visible, y por eso acá no hay ninguna
 * bandera que consultar: si un nivel está apagado sus polígonos no están en la
 * lista, y entonces no se dibuja ni se toca. Con una bandera aparte, las dos
 * cosas podían discrepar y se terminaba seleccionando un municipio invisible.
 */
// Las listas llegan ya filtradas: lo que está acá es lo que se ve, y lo que se
// ve es lo que se puede tocar. Antes había dos banderines aparte —`verPines`,
// `verRecorridos`— que decidían lo mismo por su cuenta, y bastaba con que uno
// se desincronizara para poder seleccionar algo invisible.
function loQueSeToco({ lat, lng, zoom }, areas, pines, recorridos) {
  {
    const grados = 24 / Math.pow(2, zoom) / 1.1; // ~24 px de tolerancia
    let mejor = null;
    let corta = Infinity;
    for (const p of pines) {
      const dx = (p.coordinates.lng - lng) * Math.cos((lat * Math.PI) / 180);
      const dy = p.coordinates.lat - lat;
      const d = dx * dx + dy * dy;
      if (d < corta && d < grados * grados) {
        corta = d;
        mejor = p;
      }
    }
    if (mejor) return mejor;
  }

  {
    const tolerancia = 20 / Math.pow(2, zoom) / 1.1;
    const coseno = Math.cos((lat * Math.PI) / 180);
    let mejor = null;
    let corta = tolerancia * tolerancia;
    for (const r of recorridos) {
      const c = r.caja;
      if (
        lng < c.lngMin - tolerancia ||
        lng > c.lngMax + tolerancia ||
        lat < c.latMin - tolerancia ||
        lat > c.latMax + tolerancia
      ) continue;
      for (const linea of trazosDe(r.geometry)) {
        for (let i = 1; i < linea.length; i++) {
          const d = distanciaSegmento(
            { x: lng * coseno, y: lat },
            { x: Number(linea[i - 1][0]) * coseno, y: Number(linea[i - 1][1]) },
            { x: Number(linea[i][0]) * coseno, y: Number(linea[i][1]) }
          );
          if (d < corta) {
            corta = d;
            mejor = r;
          }
        }
      }
    }
    if (mejor) return mejor;
  }

  {
    let mejor = null;
    let area = Infinity;
    for (const a of areas) {
      const c = a.caja;
      if (lng < c.lngMin || lng > c.lngMax || lat < c.latMin || lat > c.latMax) continue;
      if (!adentro(a.geometry, lat, lng)) continue;
      const tamano = (c.lngMax - c.lngMin) * (c.latMax - c.latMin);
      if (tamano < area) {
        area = tamano;
        mejor = a;
      }
    }
    if (mejor) return mejor;
  }

  return null;
}

/**
 * Si dos coordenadas caen en el mismo lugar de la pantalla.
 *
 * En grados, «cerca» no significa nada: a zoom de país medio kilómetro es un
 * píxel y a zoom de cuadra son cien. El radio se define en píxeles —el pulpejo
 * del dedo— y se convierte a grados con la escala actual.
 */
function cercaDe(punto, otro, zoom, radioPx = 22) {
  const gradosPorPixel = 360 / (256 * Math.pow(2, zoom));
  const cos = Math.cos((otro.lat * Math.PI) / 180) || 1;
  const dx = (punto.lng - otro.lng) * cos;
  const dy = punto.lat - otro.lat;
  const radio = gradosPorPixel * radioPx;
  return dx * dx + dy * dy <= radio * radio;
}

function distanciaSegmento(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo2 = dx * dx + dy * dy;
  const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / largo2));
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
}

/**
 * La pantalla del mapa.
 *
 * Encima de las teselas van las dos capas del Codex: los territorios con
 * frontera y los que son un punto. Nada más por ahora — la leyenda de abajo a la
 * izquierda es también el interruptor, que es la forma de explicar los símbolos
 * sin gastar una fila aparte en explicarlos.
 */
export default function MapaSheet({ onClose, topInset = 0, bottomInset = 0 }) {
  const { width: W, height: H } = useWindowDimensions();
  const [reinicio, setReinicio] = useState(0);
  // El mapa se orienta por escala: departamentos para descubrir el país,
  // municipios al bajar al detalle. La persona puede fijar un nivel desde el
  // selector o apagar la capa por completo.
  // La escala vive en el store: se recuerda entre aperturas y arranca en `null`
  // —sin capa—, que es el mapa limpio.
  // Dónde quedó el mapa la última vez.
  //
  // `MapaVizta` lee su centro inicial una sola vez, al montar, así que no se lo
  // puede montar antes de saber la respuesta: si el disco todavía no hidrató,
  // arrancaría en la capital y la cámara guardada llegaría tarde. Por eso el
  // mapa espera —unos milisegundos— a que `lista` sea cierto, y `inicial` se
  // fija recién ahí.
  const camaraLista = useCamaraLista();
  const recordarCamara = useMapaStore((s) => s.recordar);
  const [inicial, setInicial] = useState(null);

  useEffect(() => {
    if (!camaraLista || inicial) return;
    setInicial(useMapaStore.getState().camara || CENTRO_INICIAL);
  }, [camaraLista, inicial]);

  const [vista, setVista] = useState(CENTRO_INICIAL);
  const [mostrarCalor, setMostrarCalor] = useState(false);
  // La niebla arranca encendida: es el estado natural de un mapa por explorar,
  // no una capa opcional que haya que ir a buscar. Se puede apagar —a veces se
  // necesita ver el terreno completo— y esa preferencia no se guarda a
  // propósito: apagarla es para una consulta puntual, no para vivir sin ella.
  const [nieblaActiva, setNieblaActiva] = useState(false);
  const [buscandoLugar, setBuscandoLugar] = useState(false);
  const [destino, setDestino] = useState(null);
  const celdasRaspadas = useNieblaStore((s) => s.celdas);
  const ocultos = useMapaStore((s) => s.ocultos);
  const procedencia = useMapaStore((s) => s.procedencia);
  const nivel = useMapaStore((s) => s.nivel);
  const elegirProcedencia = useMapaStore((s) => s.elegirProcedencia);
  const elegirNivel = useMapaStore((s) => s.elegirNivel);
  const alternarOculto = useMapaStore((s) => s.alternarOculto);
  const mostrarTodo = useMapaStore((s) => s.mostrarTodo);

  const [filtrando, setFiltrando] = useState(false);

  /**
   * El punto sobre el que hay que decidir, y la nota que se está escribiendo.
   *
   * Marcar en el mapa contesta «acá», no «qué es esto»: lo que sigue puede ser
   * un lugar guardado o una nota con ese punto. Ver `AccionEnPunto`.
   */
  const [decidiendo, setDecidiendo] = useState(null);
  const [notaEnPunto, setNotaEnPunto] = useState(null);

  /**
   * Mi punto, y el mapa que se destapa al andar. Ver `useMiUbicacion`: no pide
   * nada hasta que alguien toca el botón, y descubrir solo es un permiso
   * aparte que se pide en su momento.
   */
  const { permiso: permisoUbicacion, yo, explorando, ubicar, alternarExploracion } = useMiUbicacion(true);

  const rasparCeldas = useNieblaStore((s) => s.raspar);
  const [modo, setModo] = useState('navegar');
  const [borrador, setBorrador] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [nombreBorrador, setNombreBorrador] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorEditor, setErrorEditor] = useState(null);
  const [elegido, setElegido] = useState(null);
  // El item cuyo detalle está abierto. Separado de `elegido` a propósito: al
  // cerrar el detalle se vuelve a la ficha sobre el mapa, no al mapa pelado.
  // Cerrar una capa debería devolverte a la anterior, no al principio.
  const [detalle, setDetalle] = useState(null);

  // El usuario sale de la conexión con Pulse, que es la sesión que usa el resto
  // de la app. La otra —`utils/auth`, con su JWT en SecureStore— es el login web
  // antiguo y hoy no la alimenta nadie: colgarse de ella dejaba este mapa
  // pidiendo iniciar sesión para siempre, con el usuario ya conectado.
  const userId = usePulseConnectionStore((s) => s.connectedUser?.id);
  const queryClient = useQueryClient();

  /**
   * Las carpetas que se muestran son las del cajón que se está mirando.
   *
   * Filtrar por «Amarillos» mirando notas no es lo mismo que filtrar por
   * «Amarillos» mirando territorios: en el primer caso se pregunta por las
   * notas de esa carpeta, en el segundo por los territorios guardados ahí. Son
   * tres cajones distintos en `post_folders` —`scope` los separa— y el panel
   * enseña el que corresponde: el del historial de notas, el de posts, o el de
   * territorios. Mostrar siempre el de territorios era ofrecer un filtro que
   * no podía cruzarse con nada de lo que estaba en pantalla.
   */
  /**
   * En qué espacio mirar. `null` es «todos».
   *
   * Un espacio (`spaces` + `workspace_resources`) agrupa lo que estás
   * investigando: los items, las notas y los posts de un caso. Filtrar por
   * espacio contesta «de lo que estoy trabajando en el Caso USAC, ¿qué lugares
   * hay?», que es otra pregunta que la carpeta —la carpeta ordena, el espacio
   * investiga— y por eso son dos filtros, no uno.
   *
   * No se persiste, por lo mismo que la carpeta: es una consulta de paso.
   */
  const [espacioFiltro, setEspacioFiltro] = useState(null);

  const { data: espacios = VACIO } = useQuery({
    queryKey: ['mapa-espacios', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('spaces')
        .select('id, name, status')
        .neq('status', 'archived')
        .order('position', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60,
  });

  /**
   * Qué hay dentro de cada espacio, como un conjunto de ids.
   *
   * Solo `codex_item`: es el tipo de recurso que apunta a `codex_universe_items`,
   * o sea lo mismo que el mapa ya dibuja y los textos que ya lee. Un territorio
   * y una nota son los dos un item, así que el mismo conjunto sirve para los dos
   * modos del filtro sin preguntar dos veces.
   */
  const { data: enEspacio = null } = useQuery({
    queryKey: ['mapa-espacio-recursos', userId, espacioFiltro],
    enabled: Boolean(userId && espacioFiltro),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspace_resources')
        .select('resource_id')
        .eq('space_id', espacioFiltro)
        .eq('resource_type', 'codex_item');
      if (error) throw error;
      return new Set((data || []).map((r) => r.resource_id));
    },
    staleTime: 1000 * 60,
  });

  const scopeCarpetas = procedencia === 'notas' ? NOTA : procedencia === 'posts' ? POST : TERRITORIO;

  const { data: carpetas = VACIO, error: errorCarpetas } = useQuery({
    queryKey: ['mapa-carpetas', userId, scopeCarpetas],
    enabled: Boolean(userId),
    queryFn: () => listarCarpetas(scopeCarpetas),
    staleTime: 1000 * 60,
  });

  // Una lista vacía y una consulta que falló se ven igual en pantalla, y la
  // segunda es un problema.
  useEffect(() => {
    if (errorCarpetas) console.warn('[mapa] carpetas', scopeCarpetas, errorCarpetas.message);
  }, [errorCarpetas, scopeCarpetas]);

  const crearCarpetaTerritorio = useCallback(
    async (nombre) => {
      const nueva = await crearCarpeta(nombre, carpetas, TERRITORIO);
      queryClient.invalidateQueries({ queryKey: ['mapa-carpetas', userId] });
      return nueva;
    },
    [carpetas, queryClient, userId]
  );

  /** Mover un territorio de carpeta. `null` lo saca de donde esté. */
  const moverACarpeta = useCallback(
    async (itemId, carpetaId) => {
      await moverItem(itemId, carpetaId);
      // El `folder_id` vive en `codex_universe_items`, la misma fila que ya
      // trae la consulta de territorios: no hace falta un estado aparte, alcanza
      // con refrescar la que ya existe.
      queryClient.invalidateQueries({ queryKey: ['mapa-territorios', userId] });
    },
    [queryClient, userId]
  );

  const alto = H - topInset - CABEZAL - bottomInset;

  const { data: territorios = VACIO, isLoading, isError } = useQuery({
    queryKey: ['mapa-territorios', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      /**
       * Lo justo para dibujar, y no el archivo entero.
       *
       * Traer el `geo` completo de los 366 territorios eran 6.2 MB de JSON por
       * apertura: descargarlos, parsearlos y reproyectarlos es exactamente el
       * tiempo que el mapa tardaba en aparecer. La función del servidor
       * devuelve la misma forma con la geometría simplificada a unos 55 m —que
       * a la escala en que se mira un departamento no se distingue— y pesa
       * 1.4 MB.
       *
       * Lo que llega así viene marcado con `geo.dibujo`, y **no se puede
       * guardar de vuelta**: quien edite pide antes el original por id. Ver
       * `traerCompleto`.
       */
      const { data, error } = await supabase.rpc('map_territorios_dibujo', { p_tolerancia: 0.0005 });
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  /**
   * El territorio entero, por id.
   *
   * Para editar y para la ficha de detalle, que escribe de vuelta: guardar
   * sobre la versión simplificada reemplazaría una frontera oficial por su
   * contorno recortado, en silencio.
   */
  const traerCompleto = useCallback(async (id) => {
    const { data, error } = await supabase
      .from('codex_universe_items')
      .select('id, name, tipo, description, tags, aliases, details, geo, folder_id, rastreo')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }, []);

  /**
   * Las notas que tienen un dónde.
   *
   * Una nota ubicada **no es un lugar**: el lugar es el sitio y existe por sí
   * mismo; la nota es lo que escribiste, que además pasó en algún lado. Por eso
   * son dos consultas y dos puntos distintos en el mapa, y no un item con dos
   * disfraces — ver `AccionEnPunto`, donde se elige cuál de los dos se está
   * creando.
   */
  const { data: notasUbicadas = VACIO } = useQuery({
    queryKey: ['mapa-notas-ubicadas', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('codex_universe_items')
        .select('id, name, tipo, description, tags, aliases, details, geo, folder_id, rastreo')
        .in('tipo', ['Snippet', 'snippet'])
        .not('geo', 'is', null);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!userId) return undefined;
    const canal = supabase
      .channel(`mapa-territorios-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'codex_universe_items', filter: `user_id=eq.${userId}` },
        (payload) => {
          // La suscripción abarca toda la tabla, así que guardar una nota
          // dispararía la recarga de los 358 polígonos. Solo interesa cuando lo
          // que cambió es un territorio.
          const tipo = payload?.new?.tipo ?? payload?.old?.tipo;
          if (String(tipo || '').toLowerCase() !== 'territorio') return;
          queryClient.invalidateQueries({ queryKey: ['mapa-territorios', userId] });
        }
      )
      .subscribe();
    return () => supabase.removeChannel(canal);
  }, [queryClient, userId]);

  // Guardar al reposar, no al moverse. `onMover` ya viene estrangulado —solo
  // corre cuando cambia el rango de teselas—, pero un arrastre largo cruza
  // varios rangos, y cada uno sería una escritura a disco. Medio segundo de
  // quietud es la señal de que la persona llegó a donde iba.
  useEffect(() => {
    // Antes de que el mapa monte, `vista` sigue siendo el valor por defecto:
    // persistirlo borraría la posición real que todavía no se leyó.
    if (!inicial) return undefined;
    const t = setTimeout(() => recordarCamara(vista), 500);
    return () => clearTimeout(t);
  }, [vista, inicial, recordarCamara]);

  const { areas: areasTodas, pines: pinesTodos, recorridos: recorridosTodos } = useMemo(
    () => repartir(territorios),
    [territorios]
  );

  /**
   * Lo que el filtro deja pasar.
   *
   * Se aplica una sola vez y arriba de todo, para que el resto del archivo
   * —niveles, leyendas, lo que se puede tocar— trabaje sobre una única
   * respuesta a «qué está visible». Repartir esa decisión en cada consumidor es
   * como terminan existiendo tres filtros que no coinciden.
   */
  /**
   * Una sola lista para el panel.
   *
   * El panel ya no piensa en familias, así que recibe los tres grupos juntos
   * con su forma adentro: la forma sirve para el glifo de cada renglón, no para
   * separar secciones.
   */
  const itemsPanel = useMemo(
    () => [
      ...areasTodas.map((t) => ({ ...t, clase: 'area' })),
      ...pinesTodos.map((t) => ({ ...t, clase: 'pin' })),
      ...recorridosTodos.map((t) => ({ ...t, clase: 'ruta' })),
    ],
    [areasTodas, pinesTodos, recorridosTodos]
  );

  /**
   * En qué carpeta mirar.
   *
   * `null` es «todas», el string especial `SIN_CARPETA` es «sin carpeta
   * asignada», y cualquier otro valor es el id de una carpeta real. No se
   * persiste junto al resto del filtro: mirar una carpeta es una consulta de
   * paso, no una preferencia — la próxima vez que se abra el mapa tiene más
   * sentido ver todo que recordar en qué carpeta se había quedado.
   */
  const [carpetaFiltro, setCarpetaFiltro] = useState(null);

  // Las carpetas de notas, posts y territorios son cajones distintos: el id que
  // se eligió en uno no significa nada en el otro, y dejarlo puesto filtraría
  // contra una carpeta que ya no está en la lista —cero resultados sin motivo
  // visible—. Al cambiar de cajón se vuelve a «todas».
  useEffect(() => {
    setCarpetaFiltro(null);
  }, [procedencia]);

  /**
   * En modo menciones, la carpeta es la del texto, no la del territorio.
   *
   * Es la diferencia que hace útil el filtro: elegir «Amarillos» no es
   * «territorios guardados en Amarillos», es «los lugares que nombran las notas
   * —o los posts— de Amarillos».
   *
   * «Sin carpeta» sí significa algo acá: los textos que nadie archivó. Antes
   * se comportaba como «todas», que es la peor respuesta posible — parece que
   * el filtro no hace nada.
   */
  const carpetaDeTextos = carpetaFiltro || null;

  /**
   * Los textos donde buscar menciones.
   *
   * Solo notas y posts: las noticias son 3,452 y no hacen falta para esto.
   */
  const { data: textos = VACIO } = useQuery({
    queryKey: ['mapa-textos', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('codex_textos_buscables')
        .select('fuente, ref_id, titulo, texto')
        .in('fuente', ['snippet', 'post']);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  /**
   * De qué carpeta es cada texto, y qué resolvió su análisis.
   *
   * El análisis de un post ya identifica los lugares que nombra —«Atte for
   * Coffee» contra Apple Maps, con dirección y coordenadas— y lo guarda en
   * `details.analysis.menciones[].identidad`. Eso no pasa por el índice de
   * nombres, y no podría: un café no es un item tuyo ni una frontera del
   * catálogo. Se lee de ahí y se dibuja igual que cualquier otra mención.
   */
  const { data: duenos = VACIO } = useQuery({
    queryKey: ['mapa-duenos-textos', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('codex_universe_items')
        .select('id, folder_id, analisis:details->analysis')
        .in('tipo', ['Snippet', 'post', 'Post']);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  /**
   * El catálogo de fronteras, para resolver lo que no es item tuyo.
   *
   * Tus posts nombran quince países —Guatemala en 49, Estados Unidos en 3— y
   * ninguno es item del Codex, así que buscando solo entre tus items no
   * resolvía ninguno. El catálogo tiene los 242 países y las 386 fronteras
   * guatemaltecas con su centroide, y **no crea nada**: si después tocás ese
   * pin y lo guardás, ahí nace el item con su frontera ya vinculada.
   */
  const { data: bordes = VACIO } = useQuery({
    queryKey: ['mapa-catalogo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('map_boundaries')
        .select('boundary_id, name, level, centroid');
      if (error) throw error;
      return data || [];
    },
    staleTime: Infinity,
  });

  /**
   * Qué territorios menciona lo que escribiste y lo que guardaste.
   *
   * **Se calcula acá y no en la base.** La consulta equivalente tardaba más de
   * los 8 segundos que Supabase le da al rol `authenticated`, y el timeout
   * llegaba como un conjunto vacío: el panel decía tranquilamente «0
   * menciones», que es una respuesta legítima y por eso la más difícil de
   * notar. Acá son 96 textos contra 366 territorios y es instantáneo.
   *
   * Y no es un mecanismo nuevo: `construirIndice` y `segmentar` son los mismos
   * que resaltan las menciones mientras escribís una nota, con el mismo piso de
   * cuatro letras que usa la función del Codex. Lo que se pinta en el mapa y lo
   * que se subraya en la nota no pueden discrepar porque son el mismo código.
   */
  const menciones = useMemo(() => {
    if (!textos.length) return { notas: null, posts: null };

    // Un item tuyo gana sobre la frontera homónima: «Mixco» es tu ficha, no el
    // polígono del catálogo. El catálogo entra solo donde no tenés nada.
    const nombresPropios = new Set();
    for (const i of territorios) {
      for (const crudo of [i.name, ...(Array.isArray(i.aliases) ? i.aliases : [])]) {
        if (crudo) nombresPropios.add(normalizar(crudo));
      }
    }
    const delCatalogo = bordes
      .filter((b) => b.name && !nombresPropios.has(normalizar(b.name)))
      .map((b) => ({ id: b.boundary_id, name: b.name, nivel: b.level, centroid: b.centroid, catalogo: true }));

    const indice = construirIndice([...territorios, ...delCatalogo]);
    const carpetaDe = new Map(duenos.map((d) => [d.id, d.folder_id]));
    const notas = new Map();
    const posts = new Map();

    for (const t of textos) {
      const esNota = t.fuente === 'snippet';
      // La carpeta filtra el texto, no el territorio: elegir «Amarillos» es
      // «los lugares que nombran lo que está guardado en Amarillos». Vale para
      // los dos cajones —las notas cuando se mira notas, los posts cuando se
      // mira posts— porque la carpeta que se ofrece ya es la del cajón activo.
      if (carpetaDeTextos) {
        const suya = carpetaDe.get(t.ref_id) || null;
        if (carpetaDeTextos === SIN_CARPETA ? suya : suya !== carpetaDeTextos) continue;
      }
      // El espacio filtra igual que la carpeta: las notas y los posts que están
      // adentro del caso que se está investigando.
      if (enEspacio && !enEspacio.has(t.ref_id)) continue;
      const destino = esNota ? notas : posts;
      for (const tramo of segmentar(t.texto || '', indice)) {
        if (!tramo.item) continue;
        // Se guarda dónde se nombró, no solo que se nombró: es lo que deja
        // contestar «¿de dónde salió este pin?» sin volver a leer todo.
        const ya = destino.get(tramo.item.id);
        if (ya) ya.donde.set(t.ref_id, t);
        else destino.set(tramo.item.id, { entidad: tramo.item, donde: new Map([[t.ref_id, t]]) });
      }
    }

    /**
     * Los lugares que el análisis ya resolvió.
     *
     * Un restaurante o un hotel no está en tu Codex ni en el catálogo de
     * fronteras, así que el índice de nombres nunca lo va a ver. El análisis
     * sí: le pregunta a Apple Maps y guarda nombre, dirección y coordenadas.
     * Acá solo se cosecha lo que ya está guardado — no se consulta nada.
     */
    const textoDe = new Map(textos.map((t) => [t.ref_id, t]));
    for (const d of duenos) {
      const suya = d.folder_id || null;
      if (carpetaDeTextos && (carpetaDeTextos === SIN_CARPETA ? suya : suya !== carpetaDeTextos)) continue;
      if (enEspacio && !enEspacio.has(d.id)) continue;

      const t = textoDe.get(d.id);
      if (!t || t.fuente !== 'post') continue;

      for (const m of Array.isArray(d.analisis?.menciones) ? d.analisis.menciones : []) {
        const ident = m?.identidad;
        if (!ident || ident.material !== 'place') continue;
        const lat = Number(ident.lat);
        const lng = Number(ident.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        // Por el id de Apple cuando hay: dos posts que nombran el mismo café
        // son dos menciones de un pin, no dos pines encimados.
        const id = 'place:' + (ident.id || normalizar(ident.titulo || m.texto));
        const ya = posts.get(id);
        if (ya) {
          ya.donde.set(t.ref_id, t);
          continue;
        }
        posts.set(id, {
          entidad: {
            id,
            name: ident.titulo || m.texto,
            centroid: { lat, lng },
            nivel: 'lugar',
            // La misma forma que usa un lugar guardado a mano, para que la
            // ficha muestre dirección y acciones sin aprender un caso nuevo.
            geo: {
              spatial_role: 'location',
              geometry: { type: 'Point', coordinates: [lng, lat] },
              lugar: {
                fuente: 'apple',
                id: ident.id || null,
                address: ident.direccion || null,
                category: ident.categoria || null,
              },
            },
          },
          donde: new Map([[t.ref_id, t]]),
        });
      }
    }

    return { notas, posts };
  }, [textos, territorios, bordes, duenos, carpetaDeTextos, enEspacio]);

  /**
   * Lo mencionado, como puntos.
   *
   * Si una nota habla de Mixco, lo que se quiere ver es **dónde queda**, no su
   * polígono: el borde es la capa de límites, que contesta otra pregunta. Por
   * eso una mención se pincha en el ancla del territorio aunque el territorio
   * sea una forma — y por eso 35 de las 36 menciones, que son municipios y
   * departamentos, aparecen igual que aparecería un restaurante.
   */
  const pinesMencionados = useMemo(() => {
    const cuales = procedencia === 'notas' ? menciones.notas : procedencia === 'posts' ? menciones.posts : null;
    if (!cuales) return [];

    const porId = new Map(itemsPanel.map((t) => [t.id, t]));

    return [...cuales.entries()]
      .map(([id, { entidad, donde }]) => {
        const mio = porId.get(id);
        const coordinates = mio
          ? mio.coordinates || coordenadasDe(mio.original?.geo)
          : entidad.centroid && Number.isFinite(Number(entidad.centroid.lat))
            ? { lat: Number(entidad.centroid.lat), lng: Number(entidad.centroid.lng) }
            : null;

        return {
          ...(mio || { id, name: entidad.name, folder_id: null, original: entidad.geo ? { geo: entidad.geo } : null }),
          clase: 'pin',
          coordinates,
          // De dónde salió el pin y dónde se lo nombra: lo lee la ficha.
          // Un lugar de Apple no es «del catálogo»: tiene ficha propia.
          delCatalogo: !mio && !entidad.geo,
          nivelCatalogo: mio ? null : entidad.nivel,
          donde: [...donde.values()],
        };
      })
      .filter((t) => t.coordinates);
  }, [procedencia, menciones, itemsPanel]);

  /** Lo tuyo que es un lugar: los puntos y lo dibujado a mano, no las fronteras. */
  const lugaresPropios = useMemo(
    () => itemsPanel.filter((t) => t.rol !== 'frontier'),
    [itemsPanel]
  );

  /**
   * Las notas ubicadas, como puntos.
   *
   * Índigo, que en este mapa es el color de **vos** —tu punto, lo que estás
   * trazando— y no el de los datos: una nota es lo que escribiste, no un sitio
   * que exista sin vos. Así se distingue de un ojo del ámbar de tus lugares y
   * del verde de las fronteras.
   */
  const pinesDeNotas = useMemo(
    () =>
      notasUbicadas
        .map((n) => {
          const coordinates = coordenadasDe(n.geo);
          return coordinates
            ? { ...n, clase: 'pin', coordinates, esNota: true, rol: 'location', nivel: 'otro' }
            : null;
        })
        .filter(Boolean),
    [notasUbicadas]
  );

  const porMenciones = procedencia === 'notas' || procedencia === 'posts';

  const pasa = useCallback(
    (clase, item) => {
      if (ocultos.has(item.id)) return false;
      // El espacio se aplica siempre: mirando lo tuyo filtra el territorio,
      // mirando menciones ya se aplicó sobre los textos —y el lugar mencionado
      // no es un item del espacio, así que acá no se vuelve a pedir.
      if (enEspacio && !porMenciones && !enEspacio.has(item.id)) return false;
      // Con menciones la carpeta ya se aplicó en la consulta —sobre las notas—,
      // así que volver a filtrar por la carpeta del territorio dejaría fuera
      // justo lo que se fue a buscar.
      if (porMenciones) return true;
      if (carpetaFiltro === SIN_CARPETA) return !item.folder_id;
      if (carpetaFiltro) return item.folder_id === carpetaFiltro;
      return true;
    },
    [ocultos, carpetaFiltro, porMenciones, enEspacio]
  );

  const areas = useMemo(() => areasTodas.filter((a) => pasa('area', a)), [areasTodas, pasa]);

  /**
   * Los puntos que se dibujan.
   *
   * Mirando menciones son las menciones —cada territorio nombrado, pinchado en
   * su ancla— y no los puntos de siempre. Mirando lo tuyo son los lugares que
   * cargaste, sin las fronteras: el borde de un municipio es la capa de
   * límites, y dibujarlo además como un pin sería decir dos veces lo mismo.
   */
  const pines = useMemo(() => {
    const base = porMenciones ? pinesMencionados : lugaresPropios.filter((p) => p.clase === 'pin');
    // Las notas ubicadas salen en «todo» —son parte de lo que pusiste en el
    // mapa— y en «notas», donde conviven con lo que las notas mencionan. En
    // «mis lugares» no: ahí se pregunta por sitios, y una nota no lo es.
    const conNotas =
      procedencia === 'todo' || procedencia === 'notas' ? [...base, ...pinesDeNotas] : base;
    return conNotas.filter((p) => pasa('pin', p));
  }, [porMenciones, procedencia, pinesMencionados, lugaresPropios, pinesDeNotas, pasa]);
  const recorridos = useMemo(
    () => recorridosTodos.filter((r) => pasa('ruta', r)),
    [recorridosTodos, pasa]
  );

  /**
   * Las celdas descubiertas que caen en pantalla.
   *
   * Se recortan acá y no al dibujar por una razón de forma: `MapaCapas` recibe
   * listas ya resueltas —áreas, pines, recorridos— y no sabe nada del store.
   * La niebla sigue esa misma regla.
   *
   * El recorte recorre todas las celdas descubiertas, no solo las visibles. Es
   * lineal en cuánto llevás explorado, que es exactamente el orden de magnitud
   * que puede crecer; a cambio, un viewport de país entero no obliga a probar
   * millones de posiciones vacías, que es lo que costaría recorrer el rango.
   */
  const celdasNiebla = useMemo(() => {
    if (!nieblaActiva || !inicial) return [];
    const gradosPorPixelY = 360 / (256 * Math.pow(2, vista.zoom));
    // Un margen de media pantalla evita que el borde del velo entre a la vista
    // recién cuando ya se movió: durante la inercia se vería el recorte crudo.
    const margenLat = gradosPorPixelY * alto * 0.75;
    const margenLng = gradosPorPixelY * W * 0.75;
    const latMin = vista.lat - margenLat;
    const latMax = vista.lat + margenLat;
    const lngMin = vista.lng - margenLng;
    const lngMax = vista.lng + margenLng;

    const fuera = [];
    for (const k of celdasRaspadas) {
      const { cx, cy } = desdeClave(k);
      const lng = cx * CELDA;
      const lat = cy * CELDA;
      if (lat < latMin || lat > latMax || lng < lngMin || lng > lngMax) continue;
      fuera.push({ cx, cy });
    }
    return fuera;
  }, [celdasRaspadas, nieblaActiva, inicial, vista, alto, W]);

  // Memoizado porque `MapaCapas` reconstruye el path del velo cuando esta
  // referencia cambia: un objeto nuevo por render sería rearmar miles de
  // rectángulos en cada frame.
  const nieblaNivel = useMemo(
    () => ({ activa: nieblaActiva, celdas: celdasNiebla }),
    [nieblaActiva, celdasNiebla]
  );

  /**
   * El comercio detrás de un lugar elegido.
   *
   * Solo corre para lugares —lo dice `geo.lugar`— y solo mientras uno esté
   * abierto. Un territorio no tiene horario y un item del Codex tampoco, así
   * que preguntarlo sería una consulta por cada toque en el mapa a cambio de
   * nada.
   */
  // Cualquier punto que no sea frontera: los lugares guardados, los puntos
  // propios y las menciones que resolvieron a un sitio concreto. Una frontera
  // no tiene horario ni teléfono, así que preguntarlo sería una consulta por
  // cada toque a cambio de nada.
  const lugarElegido =
    elegido?.clase === 'pin' && elegido?.original?.geo?.spatial_role !== 'frontier' && !elegido?.delCatalogo
      ? elegido
      : null;
  const puntoElegido = lugarElegido?.coordinates;

  const { data: comercio } = useQuery({
    queryKey: ['comercio', lugarElegido?.id],
    enabled: Boolean(lugarElegido && puntoElegido),
    queryFn: () =>
      comercioDe({
        nombre: lugarElegido.name,
        lat: puntoElegido.lat,
        lng: puntoElegido.lng,
      }),
    // El catálogo es estático: una vez resuelto no cambia en toda la sesión.
    staleTime: Infinity,
  });

  const totalTerritorios = areasTodas.length + pinesTodos.length + recorridosTodos.length;
  const visiblesTerritorios = areas.length + pines.length + recorridos.length;


  const propiosDelEspacio = useMemo(
    () => (enEspacio ? lugaresPropios.filter((t) => enEspacio.has(t.id)) : lugaresPropios),
    [lugaresPropios, enEspacio]
  );

  const conteos = useMemo(
    () => ({
      // Las fronteras no se cuentan acá: son la capa de límites y se cuentan en
      // sus escalas. Contarlas dos veces decía «366 lugares» cuando lugares
      // tenés siete y el resto son bordes que vos vinculaste del catálogo.
      // Y el espacio también los recorta: si se está mirando un caso, «7
      // lugares» cuando dentro del caso hay dos es un número de otra pregunta.
      todo: propiosDelEspacio.length,
      items: propiosDelEspacio.length,
      notas: menciones.notas ? menciones.notas.size : null,
      posts: menciones.posts ? menciones.posts.size : null,
    }),
    [menciones, propiosDelEspacio]
  );

  // Sin escala automática por zoom: que la capa se encienda sola al acercarse
  // es exactamente lo que hacía que el mapa se sintiera fuera de control.

  // Los controles son overlays sobre el GestureDetector. La zona es algo más
  // amplia que cada control para incluir el hitSlop y evitar selecciones al
  // rozar sus bordes.
  /**
   * Dónde los controles ganan el toque.
   *
   * Los controles flotan **dentro** del detector de gestos del mapa, así que un
   * toque sobre un botón también le llega al mapa y los dos compiten. Estas
   * zonas son la respuesta: el mapa ignora lo que caiga adentro.
   *
   * La barra de herramientas se **mide** en vez de declararse. Antes era un
   * rectángulo fijo de 340 px de alto, y funcionó hasta que la barra creció:
   * los botones nuevos quedaron por debajo del área protegida y sus toques se
   * los tragaba el mapa —el modo no cambiaba, la niebla no se apagaba, y sin
   * ningún error de por medio. Un número escrito a mano que tiene que coincidir
   * con un layout se desincroniza en cuanto alguien agrega un botón; medirlo no
   * puede.
   */
  const [cajaHerramientas, setCajaHerramientas] = useState(null);
  const [cajaNiveles, setCajaNiveles] = useState(null);

  const zonasSinToque = useMemo(
    () => [
      cajaHerramientas || { x: W - 78, y: 0, ancho: 78, alto: 340 },
      cajaNiveles || { x: 0, y: alto / 2 - 100, ancho: 70, alto: 150 },
      { x: 0, y: alto - bottomInset - 142, ancho: W, alto: 142 },
    ],
    [W, alto, bottomInset, cajaHerramientas, cajaNiveles]
  );

  // Cuántos hay de cada nivel: la leyenda solo muestra los niveles que existen,
  // así que un mapa sin municipios no ofrece un interruptor que no hace nada.
  /**
   * Qué niveles administrativos existen en los datos.
   *
   * Se cuenta sobre **todas** las áreas, no sobre las filtradas. El selector de
   * niveles y el filtro contestan preguntas distintas —«a qué escala miro» y
   * «qué cosas quiero ver»— y atarlas hacía desaparecer el control: apagar la
   * familia de áreas en el filtro dejaba cero niveles disponibles, y el botón
   * de capas se esfumaba sin explicación. Un control que se va cuando cambiás
   * otra cosa parece un error, aunque su lógica cierre.
   */
  const porNivel = useMemo(() => {
    const cuenta = {};
    for (const a of areasTodas) cuenta[a.nivel] = (cuenta[a.nivel] || 0) + 1;
    return cuenta;
  }, [areasTodas]);

  /**
   * Las fronteras de los países, del catálogo y no de tus items.
   *
   * Los otros niveles se dibujan con lo que vos vinculaste —22 departamentos,
   * 336 municipios—, pero países no tenés ninguno cargado y la escala igual
   * tiene que existir: mirar el mundo es una pregunta legítima. Salen de
   * `map_boundaries`, ya simplificadas en la base (2.1 MB de Natural Earth
   * quedan en 761 kB, y a esta escala la diferencia no se ve).
   *
   * **Solo cuando se pide.** La consulta no corre hasta que alguien elige la
   * escala de países, y después queda en caché para siempre: las fronteras del
   * mundo no cambian entre dos aperturas del mapa.
   */
  const { data: paisesCatalogo = VACIO } = useQuery({
    queryKey: ['mapa-fronteras-pais'],
    enabled: nivel === 'pais',
    queryFn: async () => {
      const { data, error } = await supabase.rpc('map_paises_simplificados', { p_tolerancia: 0.05 });
      if (error) throw error;
      return (data || [])
        .filter((b) => b.geometry)
        .map((b) => ({
          id: b.boundary_id,
          name: b.name,
          folder_id: null,
          original: null,
          clase: 'area',
          nivel: 'pais',
          delCatalogo: true,
          geometry: b.geometry,
          caja: cajaDe(b.geometry),
          coordinates:
            b.centroid && Number.isFinite(Number(b.centroid.lat))
              ? { lat: Number(b.centroid.lat), lng: Number(b.centroid.lng) }
              : null,
        }));
    },
    staleTime: Infinity,
  });

  /**
   * La ventana por la que se está mirando, a saltos.
   *
   * Sirve para no construir el trazo de un polígono que cae fuera de la
   * pantalla: con la capa de países activa son 242 formas del mundo entero y
   * mirando Guatemala hacen falta cinco.
   *
   * **Se recalcula a saltos y no en cada cuadro.** Reconstruir la lista con
   * cada pixel del arrastre le cambiaría la identidad al array sesenta veces
   * por segundo, y `MapaCapas` volvería a armar todos los paths en cada una —
   * el remedio sería peor. La ventana se guarda con un margen de una pantalla
   * y media alrededor, y solo se vuelve a calcular cuando el centro se sale de
   * ese colchón o cambia el nivel de zoom.
   */
  const [ventana, setVentana] = useState(null);

  useEffect(() => {
    if (!inicial) return;
    const gradosPorPixel = 360 / (256 * Math.pow(2, vista.zoom));
    const margenLat = gradosPorPixel * alto * 0.75;
    const margenLng = gradosPorPixel * W * 0.75;
    const caja = {
      zoom: Math.round(vista.zoom),
      latMin: vista.lat - margenLat,
      latMax: vista.lat + margenLat,
      lngMin: vista.lng - margenLng,
      lngMax: vista.lng + margenLng,
    };

    setVentana((previa) => {
      if (
        previa &&
        previa.zoom === caja.zoom &&
        // Mientras el centro siga cómodo dentro de la ventana anterior —con la
        // mitad del colchón de sobra— no hace falta tocar nada.
        vista.lat > previa.latMin + margenLat * 0.5 &&
        vista.lat < previa.latMax - margenLat * 0.5 &&
        vista.lng > previa.lngMin + margenLng * 0.5 &&
        vista.lng < previa.lngMax - margenLng * 0.5
      ) {
        return previa;
      }
      return caja;
    });
  }, [vista, alto, W, inicial]);

  /** Si la caja de un territorio toca la ventana. Sin caja, se dibuja igual. */
  const enVentana = useCallback(
    (a) => {
      const c = a.caja;
      if (!ventana || !c) return true;
      return (
        c.lngMax >= ventana.lngMin &&
        c.lngMin <= ventana.lngMax &&
        c.latMax >= ventana.latMin &&
        c.latMin <= ventana.latMax
      );
    },
    [ventana]
  );

  const areasVisibles = useMemo(
    // Las áreas dibujadas por la persona no son un nivel administrativo y se
    // conservan visibles aunque se cambie de departamentos a municipios.
    () =>
      [
        ...areas.filter((a) => a.nivel === 'otro' || (nivel && a.nivel === nivel)),
        // Las del catálogo no pasan por `pasa`: no son items tuyos, así que no
        // tienen carpeta, ni espacio, ni interruptor en la lista de ocultos.
        ...(nivel === 'pais' ? paisesCatalogo : []),
      ].filter(enVentana),
    [areas, nivel, paisesCatalogo, enVentana]
  );

  // Solo los niveles que existen llegan al control: un mapa sin municipios no
  // ofrece una opción que no cambia nada.
  const nivelesDisponibles = useMemo(
    () =>
      // País va siempre, tenga o no items tuyos: sus fronteras salen del
      // catálogo. El resto de las escalas existe solo si tenés algo en ellas —
      // ofrecer «municipios» a quien no tiene ninguno es un control que no hace
      // nada.
      NIVELES.filter(({ clave }) => clave === 'pais' || porNivel[clave]).map(({ clave, etiqueta }) => ({
        clave,
        etiqueta,
        cuantos: clave === 'pais' ? porNivel.pais || 242 : porNivel[clave],
      })),
    [porNivel]
  );

  // La carga sale del aviso: ya no se dice con palabras. Ver `cargando`.
  const cargando = Boolean(userId) && isLoading;

  const aviso = !userId
    ? 'conectá tu cuenta para ver tu mapa.'
    : isLoading
      ? null
      : isError
        ? 'no se pudieron cargar tus territorios.'
        : areas.length === 0 && pines.length === 0 && recorridos.length === 0
          ? 'los territorios de tu Codex aparecen acá.'
          : null;

  const seleccionar = (punto) => {
    // Tocar tu propio punto es la tercera forma de marcar acá, y la más
    // directa: no hay que buscar una dirección ni apuntar con el dedo a dónde
    // ya estás parado.
    if (yo && cercaDe(punto, yo, vista.zoom)) {
      roce();
      setDecidiendo({ lat: yo.lat, lng: yo.lng, nombre: 'Donde estoy', direccion: null });
      return;
    }
    setElegido(loQueSeToco(punto, areasVisibles, pines, recorridos));
  };

  /**
   * Raspar.
   *
   * Llega por el mismo canal continuo que explorar —un arrastre que no mueve la
   * cámara— porque descubrir es un gesto de pintar, no de tocar: se pasa el
   * dedo y se va revelando. El estrangulado de ese canal (72 ms) también sirve
   * acá: a sesenta cuadros por segundo se estaría recalculando el pincel y
   * reconstruyendo el path del velo sin que se note ninguna diferencia.
   */
  const raspar = useCallback(
    (punto) => {
      if (punto.zoom < ZOOM_MINIMO_RASPADO) return;
      const gradosPorPixel = 360 / (256 * Math.pow(2, punto.zoom));
      const claves = celdasBajoPincel({ lat: punto.lat, lng: punto.lng, gradosPorPixel });
      // Solo vibra cuando algo se descubrió de verdad. Sin esto el teléfono
      // zumbaría todo el arrastre, incluso repasando lo ya revelado.
      if (rasparCeldas(claves) > 0) roce();
    },
    [rasparCeldas]
  );

  const tocarMapa = (punto) => {
    if (modo === 'navegar' || modo === 'raspar') {
      if (modo !== 'raspar') seleccionar(punto);
      return;
    }

    // Un punto no se coloca con el dedo: se apunta con la mira del centro y se
    // confirma. Ver `MiraPunto` — tocar el mapa acá no hace nada a propósito,
    // porque el dedo tapa justo el lugar que se está eligiendo.
    if (modo === 'punto') return;

    const tipo = modo;
    const coordenada = [punto.lng, punto.lat];
    setErrorEditor(null);
    setConfirmando(false);
    setBorrador((actual) => {
      if (tipo === 'punto') return { tipo, coordinates: [coordenada] };
      if (!actual || actual.tipo !== tipo) return { tipo, coordinates: [coordenada] };
      return { ...actual, coordinates: [...actual.coordinates, coordenada] };
    });
    roce();
  };

  /**
   * Mover un vértice del borrador.
   *
   * Llega desde el hilo de UI en cada cuadro del arrastre. Escribir estado de
   * React sesenta veces por segundo reconstruiría el path Skia otras tantas,
   * así que se reemplaza en su lugar y punto: el array es corto —los vértices
   * de un polígono dibujado a mano— y React reconcilia eso sin despeinarse. Lo
   * que sí se evita es crear un borrador nuevo cuando el índice no existe, que
   * pasaría si el gesto sobrevive a un borrado.
   */
  const moverVertice = useCallback((indice, lng, lat) => {
    setBorrador((actual) => {
      if (!actual?.coordinates || indice < 0 || indice >= actual.coordinates.length) return actual;
      const coordinates = actual.coordinates.slice();
      coordinates[indice] = [lng, lat];
      return { ...actual, coordinates };
    });
  }, []);

  /**
   * Ajustar un área o recorrido ya guardado.
   *
   * Reusa el borrador en vez de inventar un modo de edición aparte: para el
   * mapa, «un polígono con tiradores» es una sola cosa, se esté creando o
   * corrigiendo. Lo único que cambia es que lleva `editando` con el id, y eso
   * es lo que al guardar decide entre INSERT y UPDATE.
   *
   * Un anillo de polígono viene cerrado —el último punto repite el primero— y
   * ese punto duplicado se quita para editar: dejarlo pondría dos tiradores
   * encima y arrastrar uno movería medio borde. Al guardar, `geoDeArea` lo
   * vuelve a cerrar.
   */
  const ajustarElegido = (item) => {
    const g = item?.original?.geo?.geometry || item?.geometry;
    if (!g) return;

    let coordinates = null;
    let tipo = null;
    if (g.type === 'Polygon' && Array.isArray(g.coordinates?.[0])) {
      const anillo = g.coordinates[0].slice();
      const a = anillo[0];
      const z = anillo[anillo.length - 1];
      if (anillo.length > 3 && a?.[0] === z?.[0] && a?.[1] === z?.[1]) anillo.pop();
      coordinates = anillo;
      tipo = 'area';
    } else if (g.type === 'LineString' && Array.isArray(g.coordinates)) {
      coordinates = g.coordinates.slice();
      tipo = 'ruta';
    }
    if (!coordinates || coordinates.length < 2) return;

    // Un polígono importado puede traer cientos de vértices; con esa densidad
    // los tiradores se pisan y ajustar es imposible. Se avisa en vez de abrir
    // una pantalla inservible.
    if (coordinates.length > 60) {
      setErrorEditor('esta forma tiene demasiados vértices para ajustarla a mano.');
      return;
    }

    roce();
    setElegido(null);
    setModo(tipo);
    setBorrador({ tipo, coordinates, editando: item.original?.id || item.id, trazo: null });
    setNombreBorrador(item.name || '');
  };

  const cambiarModo = (siguiente) => {
    roce();
    setModo(siguiente);
    setElegido(null);
    setConfirmando(false);
    setErrorEditor(null);
    if (!['punto', 'area', 'ruta'].includes(siguiente)) setBorrador(null);
    else if (borrador?.tipo !== siguiente) setBorrador({ tipo: siguiente, coordinates: [] });
  };

  /**
   * El trazo por calles.
   *
   * Se recalcula cuando cambian los vértices de una ruta —al agregar uno o al
   * arrastrarlo— y no en cada cuadro: el efecto espera a que la mano pare. Sin
   * esa espera, arrastrar un vértice dispararía una petición facturable por
   * cuadro de animación.
   *
   * Mientras la respuesta no llega, se sigue viendo la línea recta. Es el
   * estado honesto: esos son los puntos que hay, y la calle es una mejora que
   * está en camino.
   */
  useEffect(() => {
    if (borrador?.tipo !== 'ruta') return undefined;
    const puntos = borrador.coordinates;
    if (!Array.isArray(puntos) || puntos.length < 2) {
      if (borrador.trazo) setBorrador((a) => (a ? { ...a, trazo: null } : a));
      return undefined;
    }

    const control = new AbortController();
    const t = setTimeout(async () => {
      const linea = await rutaPorCalles(puntos, { señal: control.signal });
      if (control.signal.aborted || !linea) return;
      setBorrador((a) => {
        // El borrador pudo cambiar de tipo o vaciarse mientras se esperaba la
        // respuesta; escribir el trazo encima resucitaría una ruta borrada.
        if (a?.tipo !== 'ruta' || a.coordinates.length !== puntos.length) return a;
        return { ...a, trazo: linea };
      });
    }, 420);

    return () => {
      control.abort();
      clearTimeout(t);
    };
    // `borrador.trazo` queda fuera a propósito: incluirlo haría que escribir el
    // trazo dispare el efecto que lo escribió.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borrador?.tipo, borrador?.coordinates]);

  const minimoBorrador = borrador?.tipo === 'area' ? 3 : borrador?.tipo === 'ruta' ? 2 : 1;
  const puedeGuardar = Boolean(borrador && borrador.coordinates.length >= minimoBorrador);

  /**
   * Marcar un lugar encontrado.
   *
   * Va a la misma tabla y con el mismo `tipo` que los territorios trazados
   * —`Territorio`— porque para el mapa son lo mismo: algo con `geo` que se
   * dibuja. Lo que los separa es el bloque `geo.lugar`, y esa distinción vive
   * en el dato, no en una columna nueva: una tabla aparte para lugares
   * obligaría a consultar dos veces y unir en el cliente para pintar una sola
   * capa.
   *
   * La dirección se guarda en `details` además de en `geo.lugar` a propósito:
   * en `geo` es parte de la identidad del lugar y no se edita; en `details` es
   * un campo más de la ficha, que la persona puede corregir si Apple la trae
   * mal.
   */
  const guardarLugar = async (sugerencia) => {
    if (!userId) return;
    setErrorEditor(null);
    try {
      const { error } = await supabase.from('codex_universe_items').insert({
        user_id: userId,
        name: sugerencia.name,
        tipo: 'Territorio',
        description: '',
        tags: [],
        aliases: [],
        details: {
          created_from: 'map_place_search',
          ...(sugerencia.address ? { direccion: sugerencia.address } : {}),
        },
        geo: geoDeLugar(sugerencia),
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['mapa-territorios', userId] });
      setBuscandoLugar(false);
      // Se lleva la cámara al lugar recién marcado: guardarlo y que no se vea
      // dónde quedó obliga a buscarlo a mano en el mapa.
      setDestino((d) => ({
        lat: sugerencia.lat,
        lng: sugerencia.lng,
        zoom: Math.max(vista.zoom, 15),
        n: (d?.n || 0) + 1,
      }));
      roce();
    } catch (error) {
      setErrorEditor(error?.message || 'no se pudo guardar el lugar.');
    }
  };

  /**
   * Los dos caminos de un punto marcado.
   *
   * Guardar el lugar reusa lo que ya existía: si el punto vino de la búsqueda
   * trae nombre y dirección de Apple y se guarda derecho; si lo marcaste con el
   * dedo no tiene nombre, así que pasa por el borrador —que es lo que pide uno—
   * en vez de inventarle «Punto sin título».
   */
  const elegirLugar = (punto) => {
    setDecidiendo(null);
    if (punto.sugerencia) {
      guardarLugar(punto.sugerencia);
      return;
    }
    setModo('punto');
    setBorrador({ tipo: 'punto', coordinates: [[punto.lng, punto.lat]] });
    setConfirmando(true);
  };

  const elegirNota = (punto) => {
    setDecidiendo(null);
    setNotaEnPunto(punto);
  };

  const guardarBorrador = async () => {
    const nombre = nombreBorrador.trim();
    if (!nombre || !puedeGuardar || !userId) return;
    setGuardando(true);
    setErrorEditor(null);
    try {
      const coordinates = borrador.coordinates;
      const geo =
        borrador.tipo === 'punto'
          ? geoDePunto({ lat: coordinates[0][1], lng: coordinates[0][0] })
          : borrador.tipo === 'area'
            // `base` conserva lo que la geometría ya sabía de sí misma —origen,
            // curación, nivel—: reconstruirla desde cero al mover un vértice
            // degradaría una frontera oficial a un dibujo a mano.
            ? geoDeArea({ coordinates, base: (await traerCompleto(borrador.editando).catch(() => null))?.geo })
            // Lo que se guarda de una ruta es el camino por calles, no los
            // puntos que se tocaron: los toques son andamiaje para construirlo.
            : geoDeRecorrido({ coordinates: borrador.trazo || coordinates });
      // Ajustar escribe encima; trazar crea. Es la misma pantalla y el mismo
      // gesto, y la diferencia la lleva el borrador: sin `editando`, un ajuste
      // guardaría un duplicado y dejaría el original intacto al lado.
      const { error } = borrador.editando
        ? await supabase
            .from('codex_universe_items')
            .update({ geo, updated_at: new Date().toISOString() })
            .eq('id', borrador.editando)
        : await supabase.from('codex_universe_items').insert({
            user_id: userId,
            name: nombre,
            tipo: 'Territorio',
            description: '',
            tags: [],
            aliases: [],
            details: { created_from: 'map_editor' },
            geo,
          });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['mapa-territorios', userId] });
      setBorrador(null);
      setConfirmando(false);
      setNombreBorrador('');
      setModo('navegar');
      roce();
    } catch (error) {
      setErrorEditor(error?.message || 'no se pudo guardar la geometría.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      {/* Un `Modal` de React Native abre una ventana aparte, y los gestos de
          `react-native-gesture-handler` no la cruzan: la raíz que los reparte
          quedó del otro lado. Sin esta, el mapa se dibuja perfecto y no
          responde a un solo dedo — que fue exactamente lo que pasó. */}
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: PAPEL }}>
        <View
          style={{
            height: CABEZAL,
            marginTop: topInset,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 18,
          }}
        >
          <Pressable onPress={onClose} hitSlop={12} style={{ padding: 6 }} accessibilityRole="button" accessibilityLabel="Cerrar el mapa">
            <X size={19} color={INK.faint} />
          </Pressable>

          {/* Donde antes decía «mapa» —una etiqueta que no hacía nada— ahora se
              busca. El cabezal es el único lugar de la pantalla que no compite
              con el mapa por el dedo, y buscar un lugar es la acción que más se
              repite cuando el mapa está lleno de niebla. */}
          <Pressable
            onPress={() => {
              roce();
              setBuscandoLugar(true);
            }}
            style={({ pressed }) => ({
              flex: 1,
              marginLeft: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
              paddingVertical: 6,
              opacity: pressed ? 0.5 : 1,
            })}
            accessibilityRole="search"
            accessibilityLabel="Buscar un lugar"
          >
            <Search size={13} color={INK.faint} />
            <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE }}>buscar un lugar</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              roce();
              setReinicio((n) => n + 1);
            }}
            hitSlop={12}
            style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.4 : 1 })}
            accessibilityRole="button"
            accessibilityLabel="Volver a Guatemala"
          >
            <Crosshair size={17} color={INK.faint} />
          </Pressable>
        </View>

        {/* El mapa espera a saber dónde estaba. Es una espera de milisegundos
            —leer una clave de AsyncStorage—, y evita el salto de cámara que se
            vería si montara en la capital y se corrigiera después. */}
        {inicial ? (
        <MapaVizta
          ancho={W}
          alto={alto}
          inicial={inicial}
          reinicio={reinicio}
          destino={destino}
          onMover={setVista}
          areas={areasVisibles}
          pines={pines}
          recorridos={recorridos}
          mostrarAreas={areasVisibles.length > 0}
          mostrarPines={pines.length > 0}
          mostrarCalor={mostrarCalor}
          borrador={borrador}
          onMoverVertice={['area', 'ruta'].includes(modo) ? moverVertice : null}
          niebla={nieblaNivel}
          yo={yo}
          nivel={nivel}
          elegido={elegido?.id}
          modo={modo}
          zonasSinToque={zonasSinToque}
          onTocar={tocarMapa}
          onExplorar={modo === 'raspar' ? raspar : null}
        >
          <View
            style={{ position: 'absolute', right: 12, top: 12 }}
            onLayout={(e) => {
              const { x, y, width, height } = e.nativeEvent.layout;
              // Un poco más ancha y alta que la barra: los botones tienen
              // hitSlop y el borde redondeado deja esquinas donde el dedo cae
              // «casi» encima. Sin el margen, rozar el filo selecciona algo del
              // mapa por debajo.
              setCajaHerramientas({ x: x - 8, y: y - 8, ancho: width + 16, alto: height + 16 });
            }}
          >
            <HerramientasMapa
              modo={modo}
              calor={mostrarCalor}
              niebla={nieblaActiva}
              onNiebla={() => {
                roce();
                setNieblaActiva((v) => !v);
              }}
              onModo={cambiarModo}
              onCalor={() => {
                roce();
                setMostrarCalor((v) => !v);
              }}
            />
          </View>

          {/* Los límites, en el borde izquierdo y a media altura: la ficha de
              lo que se toca sale de abajo, y ahí se taparían. Vive acá y no en
              el panel porque cambiar de escala es un gesto que se repite
              mirando el mapa —bajar a municipios, subir a países— y abrir un
              panel para cada paso convierte un toque en cuatro. */}
          {nivelesDisponibles.length ? (
            <View
              style={{ position: 'absolute', left: 14, top: alto / 2 - 90 }}
              onLayout={(e) => {
                const { x, y, width, height } = e.nativeEvent.layout;
                setCajaNiveles({ x: x - 8, y: y - 8, ancho: width + 16, alto: height + 16 });
              }}
            >
              <SelectorNiveles
                niveles={nivelesDisponibles}
                nivel={nivel}
                onCambiar={(siguiente) => {
                  elegirNivel(siguiente);
                  // Lo elegido puede pertenecer al nivel que se acaba de apagar;
                  // dejar la ficha abierta mostraría un municipio que ya no está
                  // dibujado y que no se puede volver a tocar para cerrarla.
                  setElegido(null);
                }}
              />
            </View>
          ) : null}

          {/* Dónde estoy. Debajo de las capas y en la misma columna: las dos
              contestan «qué veo en el mapa», y la mano que tocó una ya está
              donde aparece la otra.

              El segundo botón —descubrir al andar— solo existe cuando la
              ubicación ya está concedida: ofrecerlo a quien todavía no dijo que
              sí a nada es pedir la llave antes de saludar. */}
          <View style={{ position: 'absolute', left: 14, top: alto / 2 + 40, gap: 8 }}>
            <BotonMapa
              Icono={LocateFixed}
              activo={Boolean(yo)}
              etiqueta={permisoUbicacion === 'ninguno' ? 'Mostrar dónde estoy' : 'Centrar en mi ubicación'}
              onPress={async () => {
                roce();
                const aqui = await ubicar();
                if (!aqui) return;
                setDestino((d) => ({
                  lat: aqui.lat,
                  lng: aqui.lng,
                  zoom: Math.max(vista.zoom, 15),
                  n: (d?.n || 0) + 1,
                }));
              }}
            />
            {permisoUbicacion !== 'ninguno' ? (
              <BotonMapa
                Icono={Footprints}
                activo={explorando}
                etiqueta={explorando ? 'Dejar de descubrir el mapa al andar' : 'Descubrir el mapa al andar'}
                onPress={async () => {
                  roce();
                  const r = await alternarExploracion();
                  // Un botón que se toca y no hace nada visible parece roto. Si
                  // el sistema ya no va a preguntar más, el único camino es
                  // Ajustes y hay que decirlo una vez —no insistir, decir dónde
                  // está la llave. Un «no» de esta vez no se comenta: el botón
                  // sigue ahí y otro toque vuelve a preguntar.
                  if (r === 'negado') {
                    Alert.alert(
                      'El mapa se destapa solo desde Ajustes',
                      'Ahí podés permitirle a Vizta ver tu ubicación siempre, y el mapa se va descubriendo por donde andás.',
                      [
                        { text: 'Ahora no', style: 'cancel' },
                        { text: 'Ir a Ajustes', onPress: () => Linking.openSettings() },
                      ]
                    );
                  }
                }}
              />
            ) : null}
          </View>

          {/* Un solo control de visibilidad.
            *
            * Antes eran dos leyendas flotantes apiladas —pines y rutas—, cada
            * una con su interruptor, y el filtro de nivel vivía aparte en el
            * selector de capas. Tres controles repartidos que contestaban la
            * misma pregunta. Ahora hay uno: dice cuánto se ve de cuánto hay, y
            * abre el filtro completo.
            *
            * El contador es el que hace de aviso: si alguien dejó algo apagado
            * la semana pasada, «118 / 358» se lo recuerda sin tener que abrir
            * nada. Un interruptor apagado en una esquina no comunica eso. */}
          {totalTerritorios && !['punto', 'area', 'ruta'].includes(modo) && !confirmando ? (
            <View style={{ position: 'absolute', left: 14, bottom: bottomInset + 14 }}>
              <Leyenda>
                <Fila
                  simbolo={<SlidersHorizontal size={13} color={INK.meta} />}
                  texto="territorios"
                  cuantos={
                    visiblesTerritorios === totalTerritorios
                      ? totalTerritorios
                      : `${visiblesTerritorios}/${totalTerritorios}`
                  }
                  activo={visiblesTerritorios > 0}
                  onPress={() => {
                    roce();
                    setFiltrando(true);
                  }}
                />
              </Leyenda>
            </View>
          ) : null}

          {['area', 'ruta'].includes(modo) && !confirmando ? (
            <EditorBorrador
              tipo={modo}
              cuantos={borrador?.coordinates.length || 0}
              puedeGuardar={puedeGuardar}
              bottomInset={bottomInset}
              onDeshacer={() =>
                setBorrador((actual) =>
                  actual ? { ...actual, coordinates: actual.coordinates.slice(0, -1) } : actual
                )
              }
              onBorrar={() => setBorrador({ tipo: modo, coordinates: [] })}
              onFinalizar={() => {
                setNombreBorrador('');
                setConfirmando(true);
                roce();
              }}
            />
          ) : null}

          {modo === 'punto' && !confirmando && !decidiendo ? (
            <MiraPunto
              centro={vista}
              alto={alto}
              bottomInset={bottomInset}
              onCancelar={() => {
                setModo('navegar');
                roce();
              }}
              onListo={() => {
                roce();
                setDecidiendo({ lat: vista.lat, lng: vista.lng, nombre: null, direccion: null });
                setModo('navegar');
              }}
            />
          ) : null}

          {confirmando ? (
            <GuardarGeometria
              tipo={borrador?.tipo}
              nombre={nombreBorrador}
              onNombre={setNombreBorrador}
              guardando={guardando}
              error={errorEditor}
              bottomInset={bottomInset}
              onCancelar={() => setConfirmando(false)}
              onGuardar={guardarBorrador}
            />
          ) : null}

          {/* La carga del mapa.
            *
            * Es el mismo infinito que usa el resto de la app, y va en la
            * esquina donde después aparece el contador de territorios: el
            * espacio no cambia de dueño cuando termina de cargar, así que nada
            * salta de lugar. Mientras carga no hay territorios que contar, así
            * que los dos nunca coinciden.
            *
            * Reemplaza a «trayendo tus territorios…». Un texto centrado sobre
            * el mapa se lee como un error del que hay que enterarse; una figura
            * girando en la esquina se lee como trabajo en curso, que es lo que
            * es. */}
          {cargando ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 14,
                bottom: bottomInset + 14,
                paddingHorizontal: 12,
                paddingVertical: 9,
                borderRadius: RADIUS.md,
                backgroundColor: 'rgba(255,253,248,0.94)',
                borderWidth: 1,
                borderColor: 'rgba(28,43,34,0.12)',
              }}
            >
              <MorphingInfinity size={26} color={INK.meta} />
            </View>
          ) : null}

          {aviso ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 24,
                right: 24,
                bottom: bottomInset + 20,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: MONO,
                  fontSize: 11.5,
                  color: INK.body,
                  backgroundColor: 'rgba(255,253,248,0.92)',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                {aviso}
              </Text>
            </View>
          ) : null}

          {elegido && !confirmando ? (
            <Ficha
              item={elegido}
              comercio={comercio}
              bottomInset={bottomInset}
              onClose={() => setElegido(null)}
              onAjustar={
                // Solo áreas y recorridos propios: un punto no tiene forma que
                // ajustar, y una **frontera** tampoco debería tenerla acá. Un
                // límite oficial es un dato del catálogo, no un dibujo: moverle
                // un vértice a mano lo convertiría en una versión privada de
                // algo que existe para ser compartido, y nadie después sabría
                // que ese departamento ya no coincide con el real.
                (elegido.clase === 'area' || elegido.clase === 'ruta') &&
                elegido.original &&
                elegido.original?.geo?.spatial_role !== 'frontier'
                  ? () => ajustarElegido(elegido)
                  : null
              }
              onAbrir={
                elegido.original
                  ? async () => {
                      roce();
                      // El detalle escribe de vuelta, así que necesita el `geo`
                      // original y no el recortado para dibujar. Si la consulta
                      // falla se abre con lo que hay: leer la ficha sirve igual,
                      // y guardar sin geometría no la borra.
                      const completo = await traerCompleto(elegido.original.id).catch(() => null);
                      setDetalle(completo || elegido.original);
                    }
                  : null
              }
            />
          ) : null}
        </MapaVizta>
        ) : null}

        {/* El detalle va fuera de `MapaVizta` y último en el árbol: cubre el
          * mapa entero, y montarlo adentro lo dejaría bajo los controles y
          * atrapado por los gestos del mapa. */}
        <FiltroTerritorios
          visible={filtrando}
          onClose={() => setFiltrando(false)}
          items={itemsPanel}
          ocultos={ocultos}
          onAlternarOculto={alternarOculto}
          onMostrarTodo={mostrarTodo}
          procedencia={procedencia}
          onProcedencia={elegirProcedencia}
          conteos={conteos}
          cargandoMenciones={menciones.notas === null}
          carpetas={carpetas}
          espacios={espacios}
          espacioFiltro={espacioFiltro}
          onEspacioFiltro={setEspacioFiltro}
          carpetaFiltro={carpetaFiltro}
          onCarpetaFiltro={setCarpetaFiltro}
          {...(scopeCarpetas === TERRITORIO
            ? { onCrearCarpeta: crearCarpetaTerritorio, onMoverACarpeta: moverACarpeta }
            : null)}
        />

        <AccionEnPunto
          punto={decidiendo}
          bottomInset={bottomInset}
          onLugar={elegirLugar}
          onNota={elegirNota}
          onClose={() => setDecidiendo(null)}
        />

        {/* La nota se escribe **sobre el mapa**, sin salir: la ubicación es el
            contexto de lo que se está por escribir, y mandar a otra pantalla la
            haría perder. Al guardar vuelve al mapa, donde ya aparece su punto. */}
        {notaEnPunto ? (
          <CreateSnippetSheet
            ubicacion={notaEnPunto}
            topInset={topInset}
            bottomInset={bottomInset}
            onClose={() => setNotaEnPunto(null)}
            onCreated={() => {
              setNotaEnPunto(null);
              queryClient.invalidateQueries({ queryKey: ['mapa-notas-ubicadas', userId] });
            }}
          />
        ) : null}

        <BuscarLugar
          visible={buscandoLugar}
          centro={vista}
          onElegir={(sugerencia) => {
            setBuscandoLugar(false);
            setDecidiendo({
              lat: sugerencia.lat,
              lng: sugerencia.lng,
              nombre: sugerencia.name || null,
              direccion: sugerencia.address || null,
              sugerencia,
            });
          }}
          onClose={() => setBuscandoLugar(false)}
        />

        {detalle ? (
          <ItemDetailSheet
            item={detalle}
            bottomInset={bottomInset}
            onClose={() => setDetalle(null)}
            onSaved={(guardado) => {
              setDetalle((prev) => (prev ? { ...prev, ...guardado } : prev));
              // Lo editado en el detalle cambia lo que el mapa dibuja —nombre,
              // geo, tipo—, así que la consulta de items tiene que volver a
              // correr. Sin esto, se guarda y el pin sigue con el nombre viejo.
              queryClient.invalidateQueries({ queryKey: ['mapa-territorios', userId] });
            }}
          />
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

// ─── Piezas ───────────────────────────────────────────────────────────────────

const MODOS_MAPA = [
  { clave: 'navegar', etiqueta: 'Navegar', Icono: Hand },
  // Segundo botón, justo después de la mano: es el que quita la niebla
  // tocando el mapa. El de «explorar territorios» se quitó de la barra —
  // tocar un territorio en modo Navegar ya abre su ficha, así que el modo
  // aparte no tenía ninguna acción propia que el otro no cubriera.
  { clave: 'raspar', etiqueta: 'Descubrir el mapa', Icono: Eraser },
  { clave: 'punto', etiqueta: 'Crear punto', Icono: MapPinPlus },
  { clave: 'area', etiqueta: 'Crear área', Icono: Pentagon },
  { clave: 'ruta', etiqueta: 'Crear ruta manual', Icono: Route },
];

function HerramientasMapa({ modo, calor, niebla, onModo, onCalor, onNiebla }) {
  return (
    <View
      style={{
        gap: 5,
        padding: 5,
        borderRadius: 24,
        backgroundColor: 'rgba(255,253,248,0.94)',
        borderWidth: 1,
        borderColor: 'rgba(28,43,34,0.12)',
      }}
    >
      {MODOS_MAPA.map(({ clave, etiqueta, Icono }) => {
        const activo = modo === clave;
        return (
          <Pressable
            key={clave}
            onPress={() => onModo(clave)}
            accessibilityRole="button"
            accessibilityState={{ selected: activo }}
            accessibilityLabel={etiqueta}
            style={({ pressed }) => ({
              width: 39,
              height: 39,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              // La herramienta activa va en tinta, no en un azul propio: el control no
              // compite con el mapa, y el color queda libre para los datos.
              backgroundColor: activo ? INK.title : pressed ? 'rgba(28,43,34,0.08)' : 'transparent',
            })}
          >
            <Icono size={18} color={activo ? PAPEL : INK.body} strokeWidth={activo ? 2.4 : 1.8} />
          </Pressable>
        );
      })}
      <View style={{ height: 1, backgroundColor: 'rgba(28,43,34,0.10)', marginHorizontal: 7 }} />
      <Pressable
        onPress={onCalor}
        accessibilityRole="switch"
        accessibilityState={{ checked: calor }}
        accessibilityLabel="Mapa de calor"
        style={({ pressed }) => ({
          width: 39,
          height: 39,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: calor ? '#C2410C' : pressed ? 'rgba(28,43,34,0.08)' : 'transparent',
        })}
      >
        <Flame size={18} color={calor ? PAPEL : INK.body} strokeWidth={calor ? 2.4 : 1.8} />
      </Pressable>

      {/* Apagar la niebla.
        *
        * No es una preferencia sino una consulta: a veces hace falta ver el
        * terreno completo —buscar algo, ubicarse— sin perder lo descubierto.
        * Va junto al mapa de calor porque las dos son capas que se prenden y
        * apagan, no modos que cambian lo que hace el dedo.
        *
        * Va en tinta cuando está encendida, como el resto de lo activo; el
        * naranja del calor es la excepción y se queda porque ahí el color es
        * el dato. */}
      <Pressable
        onPress={onNiebla}
        accessibilityRole="switch"
        accessibilityState={{ checked: niebla }}
        accessibilityLabel={niebla ? 'Ocultar la niebla' : 'Mostrar la niebla'}
        style={({ pressed }) => ({
          width: 39,
          height: 39,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: niebla ? INK.title : pressed ? 'rgba(28,43,34,0.08)' : 'transparent',
        })}
      >
        <CloudFog size={18} color={niebla ? PAPEL : INK.body} strokeWidth={niebla ? 2.4 : 1.8} />
      </Pressable>
    </View>
  );
}

/**
 * La mira para poner un punto.
 *
 * **El pin se queda quieto y el mapa se mueve debajo**, como en Uber o en la
 * app de Mapas. Es lo contrario de lo que hacía antes —tocar donde va el
 * punto— y es mejor por una razón física: el dedo tapa exactamente el lugar
 * que se está eligiendo, así que marcar con precisión obligaba a tocar, mirar
 * dónde quedó, arrastrar el vértice y volver a mirar. Con la mira, lo que se
 * ajusta es el mapa, que se ve entero mientras se mueve.
 *
 * El punto **no se guarda al confirmar**: confirmar abre la pregunta de qué es
 * —lugar o nota—, que es la decisión que sigue. Ver `AccionEnPunto`.
 */
function MiraPunto({ centro, alto, bottomInset, onCancelar, onListo }) {
  const [moviendo, setMoviendo] = useState(false);

  // El pin se levanta mientras el mapa se mueve y se posa al detenerse, con la
  // sombra achicándose: es la señal de que el punto es el de abajo y no el
  // dibujo que flota. Se detecta por quietud —no hay evento de «soltó»— con
  // una ventana corta.
  useEffect(() => {
    setMoviendo(true);
    const t = setTimeout(() => setMoviendo(false), 240);
    return () => clearTimeout(t);
  }, [centro.lat, centro.lng, centro.zoom]);

  return (
    <>
      {/* La mira, clavada en el centro de la parte visible del mapa. Sin
          `pointerEvents`: el gesto tiene que llegar al mapa de abajo. */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: alto, alignItems: 'center', justifyContent: 'center' }}
      >
        <Animated.View style={{ alignItems: 'center', transform: [{ translateY: moviendo ? -46 : -38 }] }}>
          <MapPin size={34} color={AMBAR} fill={PAPEL} strokeWidth={1.8} />
        </Animated.View>
        {/* La sombra queda en el suelo, donde de verdad cae el punto. */}
        <View
          style={{
            position: 'absolute',
            width: moviendo ? 7 : 10,
            height: moviendo ? 3 : 4,
            borderRadius: 5,
            backgroundColor: 'rgba(28,43,34,0.28)',
            transform: [{ translateY: -4 }],
          }}
        />
      </View>

      <Animated.View
        entering={FadeInDown.springify().damping(19).stiffness(180)}
        style={{
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: bottomInset + 18,
          backgroundColor: PAPEL,
          borderRadius: RADIUS.md,
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          shadowColor: '#14201A',
          shadowOpacity: 0.14,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, color: INK.title }}>Mové el mapa hasta el lugar</Text>
          <Text style={{ fontFamily: MONO, fontSize: 11, color: INK.meta, marginTop: 3 }}>
            {centro.lat.toFixed(5)}, {centro.lng.toFixed(5)}
          </Text>
        </View>

        <Pressable
          onPress={onCancelar}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Cancelar"
          style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.5 : 1 })}
        >
          <X size={17} color={INK.faint} />
        </Pressable>

        <Pressable
          onPress={onListo}
          accessibilityRole="button"
          accessibilityLabel="Marcar acá"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            paddingHorizontal: 15,
            paddingVertical: 11,
            borderRadius: RADIUS.pill,
            backgroundColor: pressed ? 'rgba(58,96,73,0.85)' : '#3A6049',
          })}
        >
          <Check size={15} color={PAPEL} />
          <Text style={{ fontFamily: MONO, fontSize: 12.5, color: PAPEL }}>acá</Text>
        </Pressable>
      </Animated.View>
    </>
  );
}

function EditorBorrador({ tipo, cuantos, puedeGuardar, bottomInset, onDeshacer, onBorrar, onFinalizar }) {
  const instruccion =
    tipo === 'punto'
      ? 'tocá el lugar del punto'
      : tipo === 'area'
        ? 'tocá al menos 3 vértices del área'
        : 'tocá al menos 2 puntos del recorrido';
  return (
    <View
      style={{
        position: 'absolute',
        left: 14,
        right: 72,
        bottom: bottomInset + 14,
        minHeight: 62,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(28,43,34,0.12)',
        backgroundColor: 'rgba(255,253,248,0.96)',
      }}
    >
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={{ fontFamily: MONO, fontSize: 10.5, color: INK.title }}>{instruccion}</Text>
        <Text style={{ fontFamily: MONO, fontSize: 9.5, color: TENUE, marginTop: 4 }}>
          {cuantos} {cuantos === 1 ? 'punto' : 'puntos'}
        </Text>
      </View>
      <BotonEditor etiqueta="Deshacer" onPress={onDeshacer} disabled={cuantos === 0}>
        <Undo2 size={16} color={INK.body} />
      </BotonEditor>
      <BotonEditor etiqueta="Borrar borrador" onPress={onBorrar} disabled={cuantos === 0}>
        <Trash2 size={16} color={INK.body} />
      </BotonEditor>
      <BotonEditor etiqueta="Finalizar geometría" onPress={onFinalizar} disabled={!puedeGuardar} primario>
        <Check size={17} color={PAPEL} />
      </BotonEditor>
    </View>
  );
}

function BotonEditor({ etiqueta, onPress, disabled, primario, children }) {
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        roce();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        marginLeft: 5,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        // El mismo índigo del borrador que está confirmando. Antes era un
        // morado propio, el último que quedaba fuera de la paleta.
        backgroundColor: primario ? '#4B4FA6' : 'rgba(28,43,34,0.06)',
        opacity: disabled ? 0.28 : pressed ? 0.55 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

function GuardarGeometria({ tipo, nombre, onNombre, guardando, error, bottomInset, onCancelar, onGuardar }) {
  const etiqueta = tipo === 'area' ? 'área' : tipo === 'ruta' ? 'ruta' : 'punto';
  return (
    <View
      style={{
        position: 'absolute',
        left: 14,
        right: 14,
        bottom: bottomInset + 14,
        padding: 14,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: 'rgba(28,43,34,0.14)',
        backgroundColor: PAPEL,
      }}
    >
      <Text style={{ fontFamily: MONO, fontSize: 10.5, color: TENUE }}>guardar {etiqueta} en el Codex</Text>
      <TextInput
        autoFocus
        value={nombre}
        onChangeText={onNombre}
        onSubmitEditing={onGuardar}
        placeholder={`Nombre de ${etiqueta}`}
        placeholderTextColor="rgba(28,43,34,0.28)"
        returnKeyType="done"
        style={{
          height: 42,
          marginTop: 9,
          paddingHorizontal: 11,
          borderWidth: 1,
          borderColor: 'rgba(28,43,34,0.14)',
          borderRadius: 6,
          fontFamily: MONO,
          fontSize: 12,
          color: INK.title,
          backgroundColor: 'rgba(255,255,255,0.42)',
        }}
      />
      {error ? <Text style={{ fontFamily: MONO, fontSize: 9.5, color: '#B42318', marginTop: 7 }}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
        <Pressable onPress={onCancelar} disabled={guardando} style={{ paddingHorizontal: 12, paddingVertical: 9 }}>
          <Text style={{ fontFamily: MONO, fontSize: 10.5, color: INK.body }}>volver</Text>
        </Pressable>
        <Pressable
          onPress={onGuardar}
          disabled={guardando || !nombre.trim()}
          accessibilityRole="button"
          accessibilityLabel={`Guardar ${etiqueta}`}
          style={({ pressed }) => ({
            minWidth: 92,
            minHeight: 36,
            paddingHorizontal: 13,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1F5EA8',
            opacity: guardando || !nombre.trim() ? 0.3 : pressed ? 0.6 : 1,
          })}
        >
          {guardando ? <ActivityIndicator size="small" color={PAPEL} /> : <Text style={{ fontFamily: MONO, fontSize: 10.5, color: PAPEL }}>guardar</Text>}
        </Pressable>
      </View>
    </View>
  );
}

/**
 * La leyenda es el interruptor.
 *
 * Un mapa con dos capas necesita decir qué significa cada símbolo, y necesita
 * dejar apagarlas. Son la misma fila: el cuadrito verde a la izquierda es lo que
 * vas a ver dibujado, y tocarlo lo enciende o lo apaga. Separarlo en una leyenda
 * y una botonera aparte es ocupar dos veces el mismo rincón.
 */
function Leyenda({ children }) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(255,253,248,0.94)',
        borderWidth: 1,
        borderColor: 'rgba(28,43,34,0.10)',
        borderRadius: 4,
        paddingVertical: 4,
        paddingHorizontal: 4,
      }}
    >
      {children}
    </View>
  );
}

function Fila({ simbolo, texto, cuantos, activo, onPress }) {
  return (
    <Pressable
      onPress={() => {
        roce();
        onPress();
      }}
      hitSlop={6}
      accessibilityRole="switch"
      accessibilityState={{ checked: activo }}
      accessibilityLabel={`${texto}: ${activo ? 'visibles' : 'ocultos'}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 6,
        paddingHorizontal: 7,
        opacity: pressed ? 0.55 : activo ? 1 : 0.34,
      })}
    >
      <View style={{ width: 13, alignItems: 'center' }}>{simbolo}</View>
      <Text style={{ fontFamily: MONO, fontSize: 11.5, color: INK.title }}>{texto}</Text>
      <Text style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(28,43,34,0.32)' }}>{cuantos}</Text>
    </Pressable>
  );
}

/** La ficha de lo que tocaste. Papel sobre el mapa, con el nombre en serif. */
/**
 * La ficha de lo que se toca en el mapa.
 *
 * **Hoja inferior, no tarjeta flotante.** La forma es la de una ficha de lugar
 * de mapa —tirador arriba, título grande, pastillas de acción, y el cuerpo que
 * sube— porque es la que ya sabe leer cualquiera que haya abierto un mapa en un
 * teléfono. Lo que estaba antes era una tarjeta chica con todo comprimido: no
 * daba lugar a la dirección, ni al horario, ni a de dónde salió el pin.
 *
 * **Lo primero es qué es esto; de dónde salió se lee subiendo.** Las menciones
 * van al final del scroll y su número va arriba, en la esquina: el contador
 * explica por qué el pin está ahí sin obligar a bajar, y la lista contesta
 * cuáles cuando alguien la busca.
 *
 * La tipografía es la de la app —la serif para el nombre, la monoespaciada para
 * los datos— y no la del sistema operativo: la estructura se copia, la voz no.
 */
function Ficha({ item, comercio, bottomInset, onClose, onAbrir, onAjustar }) {
  const lugar = item.original?.geo?.lugar || null;
  const esArea = item.clase === 'area';
  const esRuta = item.clase === 'ruta';

  const horario = comercio?.opening_hours ? estadoHorario(comercio.opening_hours) : null;
  const direccion = comercio?.address || lugar?.address || null;

  const rol = item.original?.geo?.spatial_role || null;
  const esFrontera = rol === 'frontier' || item.delCatalogo;

  const marca = lugar
    ? { Icono: Store, color: AMBAR }
    : esFrontera
      ? { Icono: Landmark, color: VERDE }
      : rol === 'route' || esRuta
        ? { Icono: Spline, color: VERDE }
        : rol === 'area' || esArea
          ? { Icono: Shapes, color: VERDE }
          : { Icono: MapPin, color: AMBAR };

  /**
   * Qué es esto, en una línea. `null` cuando no hay nada que no diga ya el ícono.
   */
  const subtitulo =
    direccion ||
    (item.delCatalogo
      ? null
      : esArea && item.nivel && item.nivel !== 'otro'
        ? item.nivel
        : esArea
          ? 'trazada a mano'
          : esRuta
            ? 'recorrido'
            : null);

  const donde = Array.isArray(item.donde) ? item.donde : [];

  return (
    <Animated.View
      key={item.id}
      entering={FadeInDown.springify().damping(19).stiffness(180)}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: PAPEL,
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: bottomInset + 18,
        shadowColor: '#14201A',
        shadowOpacity: 0.16,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: -6 },
        elevation: 12,
      }}
    >
      {/* El tirador. No arrastra —el cuerpo scrollea— pero es la señal de que
          acá adentro hay más de lo que se ve. */}
      <View
        style={{
          alignSelf: 'center',
          width: 38,
          height: 5,
          borderRadius: 3,
          backgroundColor: 'rgba(28,43,34,0.18)',
          marginBottom: 12,
        }}
      />

      {/* La insignia de menciones, pisando el borde de la hoja. Es lo que
          explica por qué este pin existe, y por eso sale antes que el nombre. */}
      {donde.length ? (
        <View
          style={{
            position: 'absolute',
            top: -16,
            right: 18,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            paddingHorizontal: 11,
            paddingVertical: 7,
            borderRadius: RADIUS.pill,
            backgroundColor: VERDE,
            shadowColor: '#14201A',
            shadowOpacity: 0.22,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 },
            elevation: 6,
          }}
          accessibilityLabel={donde.length === 1 ? 'Mencionado una vez' : 'Mencionado ' + donde.length + ' veces'}
        >
          <Quote size={11} color={PAPEL} />
          <Text style={{ fontFamily: MONO, fontSize: 12, color: PAPEL }}>{donde.length}</Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <Text style={{ flex: 1, fontFamily: SERIF, fontSize: 30, lineHeight: 35, color: INK.title }}>
          {item.name}
        </Text>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cerrar la ficha"
          style={{ marginTop: 6 }}
        >
          <X size={17} color={INK.faint} />
        </Pressable>
      </View>

      {/* Bajo el nombre, qué es y dónde.
          *
          * Solo si hay algo real que decir. Una frontera del catálogo no tiene
          * dirección ni nivel propio que agregue nada: escribir «frontera del
          * catálogo» es nombrarle a la persona la tabla de donde salió, no el
          * lugar. En ese caso el ícono ya lo dice y la línea no se dibuja. */}
      {subtitulo ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <marca.Icono
            size={13}
            color={marca.color}
            accessibilityLabel={ROLES.find((r) => r.clave === rol)?.etiqueta || 'punto'}
          />
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: INK.meta }}>
            {subtitulo}
          </Text>
        </View>
      ) : null}

      <ScrollView
        style={{ maxHeight: 250, marginTop: 12 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 4 }}
      >
        {item.description ? (
          <Text style={{ fontSize: 13.5, lineHeight: 20, color: INK.body }}>{item.description}</Text>
        ) : null}

        {/* El estado se afirma solo si el horario se pudo interpretar. Con un
            formato que no se entiende se muestra el texto crudo: decir
            «abierto» sin estar seguro es peor que no decir nada. */}
        {horario || comercio?.phone || comercio?.website ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {horario ? (
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  borderRadius: RADIUS.pill,
                  backgroundColor: horario.abierto ? ACCENT.green.tint : ACCENT.red.tint,
                }}
              >
                <Text
                  style={{ fontSize: 12, color: horario.abierto ? ACCENT.green.ink : ACCENT.red.ink }}
                >
                  {horario.abierto ? 'abierto' : 'cerrado'} · {horario.detalle}
                </Text>
              </View>
            ) : null}
            {comercio?.phone ? (
              <Pastilla
                Icono={Phone}
                texto="llamar"
                onPress={() => Linking.openURL(`tel:${String(comercio.phone).replace(/\s/g, '')}`)}
              />
            ) : null}
            {comercio?.website ? (
              <Pastilla Icono={Globe} texto="sitio" onPress={() => Linking.openURL(comercio.website)} />
            ) : null}
          </View>
        ) : comercio?.opening_hours ? (
          <Text style={{ fontFamily: MONO, fontSize: 10.5, color: INK.meta, marginTop: 10 }}>
            {comercio.opening_hours}
          </Text>
        ) : null}

        {/* ── Dónde se lo nombra ──
          *
          * Debajo del pliegue a propósito: lo primero es qué es este lugar; de
          * dónde salió se lee después, subiendo. Y sin recorte: si una nota lo
          * nombra doce veces, las doce importan cuando se vino a buscar eso. */}
        {donde.length ? (
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.08, color: INK.meta, marginBottom: 8 }}>
              MENCIONADO EN
            </Text>
            {donde.map((d) => (
              <View
                key={d.ref_id}
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  paddingVertical: 10,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: 'rgba(28,43,34,0.10)',
                }}
              >
                <View style={{ paddingTop: 2 }}>
                  {d.fuente === 'snippet' ? <Spline size={13} color={VERDE} /> : <Shapes size={13} color={AMBAR} />}
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13.5, color: INK.title }}>
                    {d.titulo || (d.fuente === 'snippet' ? 'nota sin título' : 'post sin título')}
                  </Text>
                  {/* El cuerpo, dos renglones. Un solo renglón cortado a la
                      mitad de la primera frase no dice en qué contexto se lo
                      nombra, que es justo lo que se vino a leer. */}
                  {d.texto ? (
                    <Text numberOfLines={2} style={{ fontSize: 12.5, lineHeight: 17, color: INK.meta }}>
                      {String(d.texto).replace(/\s+/g, ' ').trim()}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {onAjustar || onAbrir ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          {onAjustar ? (
            <Pastilla Icono={PenTool} texto="ajustar" onPress={onAjustar} />
          ) : null}
          {onAbrir ? <Pastilla Icono={ArrowUpRight} texto="abrir" onPress={onAbrir} /> : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

/** Una acción en pastilla: ícono y palabra, como en cualquier ficha de mapa. */
/**
 * Un botón cuadrado sobre el mapa, de la familia del selector de capas.
 *
 * Mismo tamaño, mismo papel y mismo borde: son controles hermanos y tienen que
 * leerse como una columna, no como dos widgets que se encontraron ahí.
 */
function BotonMapa({ Icono, activo, etiqueta, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ selected: Boolean(activo) }}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 4,
        backgroundColor: 'rgba(255,253,248,0.94)',
        borderWidth: 1,
        borderColor: activo ? 'rgba(75,79,166,0.45)' : 'rgba(28,43,34,0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icono size={18} color={activo ? '#4B4FA6' : INK.faint} />
    </Pressable>
  );
}

function Pastilla({ Icono, texto, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={texto}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: RADIUS.pill,
        backgroundColor: pressed ? 'rgba(28,43,34,0.10)' : 'rgba(28,43,34,0.055)',
      })}
    >
      <Icono size={14} color={INK.body} />
      <Text style={{ fontSize: 12.5, color: INK.body }}>{texto}</Text>
    </Pressable>
  );
}

function Accion({ Icono, texto, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={texto}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: 'rgba(28,43,34,0.14)',
        backgroundColor: pressed ? 'rgba(28,43,34,0.06)' : 'transparent',
      })}
    >
      <Icono size={13} color={INK.body} />
      <Text style={{ fontFamily: MONO, fontSize: 11, color: INK.body }}>{texto}</Text>
    </Pressable>
  );
}
