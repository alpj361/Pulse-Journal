import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Check,
  CloudFog,
  Crosshair,
  Eraser,
  Flame,
  Hand,
  MapPinPlus,
  Pentagon,
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
import { ACCENT, INK, RADIUS, SERIF, chipStyle } from '../theme';
import { MONO } from '../codex/mono';
import { PAPEL } from '../codex/Papel';
import MorphingInfinity from '../MorphingInfinity';
import MapaVizta, { CENTRO_INICIAL } from './MapaVizta';
import SelectorNiveles from './SelectorNiveles';
import BuscarLugar from './BuscarLugar';
import { crearCarpeta, listarCarpetas, moverItem, SIN_CARPETA, TERRITORIO } from '../../utils/carpetas';
import FiltroTerritorios from './FiltroTerritorios';
import { geoDeLugar } from '../../services/lugares';
import { rutaPorCalles } from '../../services/rutas';
import { comercioDe, estadoHorario } from '../../services/comercio';
import { ROLES } from '../codex/geo';
import ItemDetailSheet from '../codex/ItemDetailSheet';
import { supabase } from '../../utils/supabase';
import { usePulseConnectionStore } from '../../state/pulseConnectionStore';
import { useMapaStore, useCamaraLista } from '../../state/mapaStore';
import { useNieblaStore } from '../../state/nieblaStore';
import { CELDA, desdeClave, celdasBajoPincel, ZOOM_MINIMO_RASPADO } from './niebla';
import { roce } from '../../utils/haptics';
import { geoDeArea, geoDePunto, geoDeRecorrido } from '../codex/geo';

const CABEZAL = 46;

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
  return null;
}

/**
 * Los niveles administrativos que se pueden prender y apagar por separado.
 *
 * El orden es de grande a chico y es el que se ve en la leyenda: primero el
 * nivel que contiene, después el contenido.
 */
const NIVELES = [
  { clave: 'departamento', etiqueta: 'departamentos' },
  { clave: 'municipio', etiqueta: 'municipios' },
  { clave: 'otro', etiqueta: 'otros' },
];

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
  if (crudo === 'departamento' || crudo === 'municipio') return crudo;
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
  const [mostrarLimites, setMostrarLimites] = useState(true);
  const [nivelPreferido, setNivelPreferido] = useState(null);
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
  const [nieblaActiva, setNieblaActiva] = useState(true);
  const [buscandoLugar, setBuscandoLugar] = useState(false);
  const [destino, setDestino] = useState(null);
  const [avisoNivel, setAvisoNivel] = useState(null);
  const celdasRaspadas = useNieblaStore((s) => s.celdas);
  const ocultos = useMapaStore((s) => s.ocultos);
  const clases = useMapaStore((s) => s.clases);
  const alternarOculto = useMapaStore((s) => s.alternarOculto);
  const ocultarLote = useMapaStore((s) => s.ocultarLote);
  const alternarClase = useMapaStore((s) => s.alternarClase);
  const mostrarTodo = useMapaStore((s) => s.mostrarTodo);
  const [filtrando, setFiltrando] = useState(false);

  /**
   * Carpetas de territorio.
   *
   * Mismo mecanismo que ya usan las notas y los posts —`post_folders`, con
   * `scope` para no mezclar los tres espacios— así que mover un territorio a
   * una carpeta es una fila más en una tabla que ya existía, no una tabla
   * nueva que aprender.
   */
  const { data: carpetas = [] } = useQuery({
    queryKey: ['mapa-carpetas', userId],
    enabled: Boolean(userId),
    queryFn: () => listarCarpetas(TERRITORIO),
    staleTime: 1000 * 60,
  });

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

  const alto = H - topInset - CABEZAL - bottomInset;

  const { data: territorios = [], isLoading, isError } = useQuery({
    queryKey: ['mapa-territorios', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      // Sin `.eq('user_id', …)`: la política de RLS ya devuelve solo lo tuyo, y
      // repetir el filtro del lado del cliente solo agrega una forma de que los
      // dos no coincidan.
      // La proyección tiene que ser completa, no la mínima para dibujar.
      //
      // El mapa solo necesita `name` y `geo` para pintar un polígono, pero
      // desde la ficha se abre el detalle, y el detalle **escribe de vuelta**:
      // al guardar hace UPDATE de name, description, tags, aliases, geo y
      // details. Un campo que no se trajo llega como `undefined`, y del otro
      // lado `tags ?? []` lo convierte en un array vacío: guardar un cambio de
      // nombre borraría las etiquetas y los alias sin decir nada.
      //
      // `tipo` va por otra razón: acá se filtra por él, así que todos son
      // Territorio, pero si no viaja el detalle lo resuelve como «Otros» y no
      // encuentra su preset de campos.
      const { data, error } = await supabase
        .from('codex_universe_items')
        .select('id, name, tipo, description, tags, aliases, details, geo, folder_id')
        .eq('tipo', 'Territorio')
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
   * En qué carpeta mirar.
   *
   * `null` es «todas», el string especial `SIN_CARPETA` es «sin carpeta
   * asignada», y cualquier otro valor es el id de una carpeta real. No se
   * persiste junto al resto del filtro: mirar una carpeta es una consulta de
   * paso, no una preferencia — la próxima vez que se abra el mapa tiene más
   * sentido ver todo que recordar en qué carpeta se había quedado.
   */
  const [carpetaFiltro, setCarpetaFiltro] = useState(null);

  /**
   * Lo que el filtro deja pasar.
   *
   * Se aplica una sola vez y arriba de todo, para que el resto del archivo
   * —niveles, leyendas, lo que se puede tocar— trabaje sobre una única
   * respuesta a «qué está visible». Repartir esa decisión en cada consumidor es
   * como terminan existiendo tres filtros que no coinciden.
   */
  const pasa = useCallback(
    (clase, item) => {
      if (!clases[clase] || ocultos.has(item.id)) return false;
      if (carpetaFiltro === SIN_CARPETA) return !item.folder_id;
      if (carpetaFiltro) return item.folder_id === carpetaFiltro;
      return true;
    },
    [clases, ocultos, carpetaFiltro]
  );

  const areas = useMemo(() => areasTodas.filter((a) => pasa('area', a)), [areasTodas, pasa]);
  const pines = useMemo(() => pinesTodos.filter((p) => pasa('pin', p)), [pinesTodos, pasa]);
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
  const lugarElegido = elegido?.original?.geo?.lugar ? elegido : null;
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

  const nivelAutomatico = vista.zoom < 9.75 ? 'departamento' : 'municipio';
  const nivel = mostrarLimites ? nivelPreferido || nivelAutomatico : null;

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
      cajaNiveles || { x: 0, y: alto / 2 - 100, ancho: 190, alto: 160 },
      cajaHerramientas || { x: W - 78, y: 0, ancho: 78, alto: 340 },
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

  const areasVisibles = useMemo(
    // Las áreas dibujadas por la persona no son un nivel administrativo y se
    // conservan visibles aunque se cambie de departamentos a municipios.
    () => areas.filter((a) => a.nivel === 'otro' || (nivel && a.nivel === nivel)),
    [areas, nivel]
  );

  // Solo los niveles que existen llegan al control: un mapa sin municipios no
  // ofrece una opción que no cambia nada.
  const nivelesDisponibles = useMemo(
    () =>
      NIVELES.filter(({ clave }) => porNivel[clave]).map(({ clave, etiqueta }) => ({
        clave,
        etiqueta,
        cuantos: porNivel[clave],
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

  const seleccionar = (punto) =>
    setElegido(loQueSeToco(punto, areasVisibles, pines, recorridos));

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
            ? geoDeArea({ coordinates, base: territorios.find((t) => t.id === borrador.editando)?.geo })
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

          {/* El interruptor de límites, a media altura del borde izquierdo: la
              ficha de lo que se toca sale de abajo, y ahí se taparían. */}
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
                  if (!siguiente) {
                    setMostrarLimites(false);
                    setNivelPreferido(null);
                  } else {
                    setMostrarLimites(true);
                    setNivelPreferido(siguiente);
                    // El nombre del nivel se anuncia arriba y se va. Ver
                    // `AvisoNivel`: es información de transición, no un rótulo.
                    const etiqueta = nivelesDisponibles.find((n) => n.clave === siguiente)?.etiqueta;
                    setAvisoNivel(etiqueta ? { texto: etiqueta, n: Date.now() } : null);
                  }
                  // Lo elegido puede pertenecer al nivel que se acaba de apagar;
                  // dejar la ficha abierta mostraría un municipio que ya no está
                  // dibujado y que no se puede volver a tocar para cerrarla.
                  setElegido(null);
                }}
              />
            </View>
          ) : null}

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

          {['punto', 'area', 'ruta'].includes(modo) && !confirmando ? (
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
                  ? () => {
                      roce();
                      setDetalle(elegido.original);
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
        <AvisoNivel aviso={avisoNivel} topInset={topInset + CABEZAL} onFin={() => setAvisoNivel(null)} />

        <FiltroTerritorios
          visible={filtrando}
          onClose={() => setFiltrando(false)}
          areas={areasTodas}
          pines={pinesTodos}
          recorridos={recorridosTodos}
          ocultos={ocultos}
          clases={clases}
          onAlternarOculto={alternarOculto}
          onOcultarLote={ocultarLote}
          onAlternarClase={alternarClase}
          onMostrarTodo={mostrarTodo}
          carpetas={carpetas}
          carpetaFiltro={carpetaFiltro}
          onCarpetaFiltro={setCarpetaFiltro}
          onCrearCarpeta={crearCarpetaTerritorio}
          onMoverACarpeta={moverACarpeta}
        />

        <BuscarLugar
          visible={buscandoLugar}
          centro={vista}
          onElegir={guardarLugar}
          onClose={() => setBuscandoLugar(false)}
        />

        {detalle ? (
          <ItemDetailSheet
            item={detalle}
            bottomInset={bottomInset}
            onClose={() => setDetalle(null)}
            onSaved={() => {
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
 * La ficha de lo que se tocó.
 *
 * **Tres cosas distintas comparten esta caja**, y la diferencia importa:
 *
 * - un **lugar guardado** —vino de Apple Places— sabe su dirección;
 * - un **item del Codex** con ubicación sabe su tipo y a qué se conecta;
 * - un **territorio** trazado sabe su nivel y su forma.
 *
 * Mostrar los tres igual fue la versión anterior, y el resultado era que la
 * ficha no decía nada: «tipo · nombre · tres líneas» sirve para cualquiera y
 * por eso no ayuda con ninguno. Acá cada uno trae el dato que solo él tiene, y
 * el encabezado dice de cuál se trata antes de que haya que deducirlo.
 *
 * Lo que **no** cambia entre los tres es la estructura —marca, encabezado,
 * título, cuerpo, una acción— para que cambiar de uno a otro no obligue a
 * reaprender dónde está cada cosa.
 */
/**
 * El nombre del nivel, arriba y de paso.
 *
 * Reemplaza a la lista que vivía fija en la esquina. La diferencia no es de
 * estilo: «en qué nivel estoy» solo se pregunta justo después de cambiarlo, y
 * el resto del tiempo la respuesta es ruido sobre el mapa. Aparece, se lee, se
 * va.
 *
 * Se remonta con `key` en cada cambio para que la animación de entrada vuelva a
 * correr aunque el aviso anterior siguiera en pantalla; sin eso, subir dos
 * niveles seguidos cambia el texto sin ningún movimiento y no se percibe que
 * pasó algo.
 */
function AvisoNivel({ aviso, topInset, onFin }) {
  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(onFin, 1400);
    return () => clearTimeout(t);
  }, [aviso, onFin]);

  if (!aviso) return null;

  return (
    <Animated.View
      key={aviso.n}
      entering={FadeInDown.duration(200)}
      exiting={FadeOut.duration(260)}
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: topInset + 10,
        left: 0,
        right: 0,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          paddingHorizontal: 13,
          paddingVertical: 7,
          borderRadius: RADIUS.pill,
          backgroundColor: 'rgba(255,253,248,0.94)',
          borderWidth: 1,
          borderColor: 'rgba(28,43,34,0.12)',
        }}
      >
        <Text style={{ fontFamily: MONO, fontSize: 11, color: INK.body, letterSpacing: 0.3 }}>
          {aviso.texto}
        </Text>
      </View>
    </Animated.View>
  );
}

/**
 * La ficha de lo que se tocó.
 *
 * **Tres cosas comparten esta caja y no deben verse igual.**
 *
 * - Un **lugar** —vino de Apple Places— es un comercio: lo que se busca al
 *   tocarlo es dónde queda, si está abierto y cómo llamar.
 * - Un **área** es una forma: lo que importa es qué nivel es y poder
 *   corregirla.
 * - Un **item del Codex** es una ficha: importa su tipo y llegar al detalle.
 *
 * La versión anterior mostraba los tres con «tipo · nombre · tres líneas», que
 * sirve para cualquiera y por eso no ayuda con ninguno. Lo que se conserva
 * entre los tres es el esqueleto —marca, encabezado, título, cuerpo, acciones—
 * para que cambiar de uno a otro no obligue a reaprender dónde está cada cosa.
 *
 * **La entrada es un resorte corto, no un fundido.** La ficha aparece porque
 * alguien tocó un punto, y un resorte que sube desde abajo conecta el toque con
 * lo que apareció; un fundido deja la duda de si ya estaba ahí. Se remonta con
 * `key` en cada selección para que tocar otro punto vuelva a animar en vez de
 * cambiar el texto en silencio.
 */
function Ficha({ item, comercio, bottomInset, onClose, onAbrir, onAjustar }) {
  const lugar = item.original?.geo?.lugar || null;
  const esArea = item.clase === 'area';
  const esRuta = item.clase === 'ruta';

  const horario = comercio?.opening_hours ? estadoHorario(comercio.opening_hours) : null;
  const direccion = comercio?.address || lugar?.address || null;

  /**
   * Qué es esto, dicho con un ícono.
   *
   * Antes iba escrito —«punto», «área», «frontera»— y ocupaba la línea
   * completa del encabezado para decir algo que una forma dice más rápido. El
   * vocabulario es el mismo que ya usa `GeoTerritorio` para los mismos roles:
   * dos pantallas que muestran la misma cosa no deberían dibujarla distinto.
   *
   * El color sigue la familia de la paleta —ámbar lo puntual, verde lo que
   * tiene extensión— así que el ícono dice *qué* y el color dice *de qué
   * clase*, sin repetirse.
   */
  const rol = item.original?.geo?.spatial_role || null;
  const esFrontera = rol === 'frontier';

  const marca = lugar
    ? { Icono: Store, color: AMBAR }
    : esFrontera
      ? { Icono: Landmark, color: VERDE }
      : rol === 'route' || esRuta
        ? { Icono: Spline, color: VERDE }
        : rol === 'area' || esArea
          ? { Icono: Shapes, color: VERDE }
          : { Icono: MapPin, color: AMBAR };

  return (
    <Animated.View
      key={item.id}
      entering={FadeInDown.springify().damping(18).stiffness(190)}
      style={{
        position: 'absolute',
        left: 14,
        right: 14,
        bottom: bottomInset + 14,
        backgroundColor: PAPEL,
        borderWidth: 1,
        borderColor: 'rgba(28,43,34,0.12)',
        borderRadius: RADIUS.md,
        paddingHorizontal: 16,
        paddingTop: 13,
        paddingBottom: 15,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* El ícono lleva la etiqueta accesible: quien no ve la forma necesita
            que alguien le diga qué es, y ese alguien ya no es el texto. */}
        <marca.Icono
          size={15}
          color={marca.color}
          accessibilityLabel={ROLES.find((r) => r.clave === rol)?.etiqueta || 'punto'}
        />
        <View style={{ flex: 1 }} />
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar la ficha">
          <X size={15} color={INK.faint} />
        </Pressable>
      </View>

      <Text style={{ fontFamily: SERIF, fontSize: 22, color: INK.title, marginTop: 9, lineHeight: 27 }}>
        {item.name}
      </Text>

      {/* ── Lugar: el comercio ── */}
      {lugar ? (
        <>
          {direccion ? (
            <Text numberOfLines={2} style={{ fontSize: 12.5, color: INK.meta, marginTop: 5, lineHeight: 18 }}>
              {direccion}
            </Text>
          ) : null}

          {/* El estado se afirma solo si el horario se pudo interpretar. Con un
              formato que no se entiende se muestra el texto crudo: decir
              «abierto» sin estar seguro es peor que no decir nada. */}
          {horario ? (
            <View style={{ flexDirection: 'row', marginTop: 11 }}>
              <View
                style={chipStyle(
                  horario.abierto ? ACCENT.green.tint : ACCENT.red.tint,
                  horario.abierto ? 'rgba(22,163,74,0.22)' : 'rgba(220,38,38,0.22)'
                )}
              >
                <Text style={{ fontSize: 10.5, color: horario.abierto ? ACCENT.green.ink : ACCENT.red.ink }}>
                  {horario.abierto ? 'abierto' : 'cerrado'} · {horario.detalle}
                </Text>
              </View>
            </View>
          ) : comercio?.opening_hours ? (
            <Text style={{ fontFamily: MONO, fontSize: 10.5, color: INK.meta, marginTop: 10 }}>
              {comercio.opening_hours}
            </Text>
          ) : null}

          {comercio?.phone || comercio?.website ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 13 }}>
              {comercio.phone ? (
                <Accion
                  Icono={Phone}
                  texto="llamar"
                  onPress={() => Linking.openURL(`tel:${String(comercio.phone).replace(/\s/g, '')}`)}
                />
              ) : null}
              {comercio.website ? (
                <Accion Icono={Globe} texto="sitio" onPress={() => Linking.openURL(comercio.website)} />
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}

      {/* ── Área: la forma ── */}
      {esArea && !lugar ? (
        <Text style={{ fontFamily: MONO, fontSize: 10.5, color: INK.meta, marginTop: 7 }}>
          {item.nivel === 'otro' ? 'trazada a mano' : `nivel ${item.nivel}`}
        </Text>
      ) : null}

      {item.description ? (
        <>
          <View style={{ height: 1, backgroundColor: 'rgba(28,43,34,0.09)', marginTop: 12 }} />
          <Text numberOfLines={3} style={{ fontSize: 13, lineHeight: 20, color: INK.body, marginTop: 11 }}>
            {item.description}
          </Text>
        </>
      ) : null}

      {/* Las acciones, en ícono y en fila.
        *
        * Escritas ocupaban dos renglones enteros de la ficha para dos verbos
        * que un ícono dice igual de bien. En fila además se leen como lo que
        * son —dos cosas que se pueden hacer con esto— en vez de dos botones
        * apilados donde el de abajo parece menos importante.
        *
        * La etiqueta accesible se conserva completa: quitar el texto es una
        * decisión visual, no una excusa para dejar de nombrar el botón. */}
      {onAjustar || onAbrir ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          {onAjustar ? (
            <BotonIcono
              Icono={PenTool}
              etiqueta={`Ajustar la forma de ${item.name}`}
              onPress={onAjustar}
            />
          ) : null}
          {onAbrir ? (
            <BotonIcono
              Icono={ArrowUpRight}
              etiqueta={`Abrir ${item.name}`}
              onPress={onAbrir}
            />
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

/** Una acción de la ficha reducida a su ícono. */
function BotonIcono({ Icono, etiqueta, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      // Cuadrado y de 44: sin texto que le dé ancho, el área táctil tiene que
      // declararse a mano o queda del tamaño del dibujo.
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: 'rgba(28,43,34,0.14)',
        backgroundColor: pressed ? 'rgba(28,43,34,0.06)' : 'transparent',
      })}
    >
      <Icono size={16} color={INK.body} />
    </Pressable>
  );
}

/** Una acción corta de la ficha: llamar, abrir el sitio. */
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
