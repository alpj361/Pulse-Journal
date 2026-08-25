import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Check,
  Crosshair,
  Flame,
  Hand,
  MapPinPlus,
  Pentagon,
  Route,
  ScanSearch,
  Trash2,
  Undo2,
  X,
} from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import { MONO } from '../codex/mono';
import { PAPEL } from '../codex/Papel';
import MapaVizta, { CENTRO_INICIAL } from './MapaVizta';
import SelectorNiveles from './SelectorNiveles';
import ItemDetailSheet from '../codex/ItemDetailSheet';
import { supabase } from '../../utils/supabase';
import { usePulseConnectionStore } from '../../state/pulseConnectionStore';
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
function loQueSeToco({ lat, lng, zoom }, areas, pines, recorridos, verPines, verRecorridos) {
  if (verPines) {
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

  if (verRecorridos) {
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
  const [vista, setVista] = useState(CENTRO_INICIAL);
  const [verPines, setVerPines] = useState(true);
  const [verRecorridos, setVerRecorridos] = useState(true);
  const [mostrarCalor, setMostrarCalor] = useState(false);
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
        .select('id, name, tipo, description, tags, aliases, details, geo')
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

  const { areas, pines, recorridos } = useMemo(() => repartir(territorios), [territorios]);

  const nivelAutomatico = vista.zoom < 9.75 ? 'departamento' : 'municipio';
  const nivel = mostrarLimites ? nivelPreferido || nivelAutomatico : null;

  // Los controles son overlays sobre el GestureDetector. La zona es algo más
  // amplia que cada control para incluir el hitSlop y evitar selecciones al
  // rozar sus bordes.
  const zonasSinToque = useMemo(
    () => [
      { x: 0, y: alto / 2 - 100, ancho: 190, alto: 160 },
      { x: W - 78, y: 0, ancho: 78, alto: 340 },
      { x: 0, y: alto - bottomInset - 142, ancho: W, alto: 142 },
    ],
    [W, alto, bottomInset]
  );

  // Cuántos hay de cada nivel: la leyenda solo muestra los niveles que existen,
  // así que un mapa sin municipios no ofrece un interruptor que no hace nada.
  const porNivel = useMemo(() => {
    const cuenta = {};
    for (const a of areas) cuenta[a.nivel] = (cuenta[a.nivel] || 0) + 1;
    return cuenta;
  }, [areas]);

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

  const aviso = !userId
    ? 'conectá tu cuenta para ver tu mapa.'
    : isLoading
      ? 'trayendo tus territorios…'
      : isError
        ? 'no se pudieron cargar tus territorios.'
        : areas.length === 0 && pines.length === 0 && recorridos.length === 0
          ? 'los territorios de tu Codex aparecen acá.'
          : null;

  const seleccionar = (punto) =>
    setElegido(loQueSeToco(punto, areasVisibles, pines, recorridos, verPines, verRecorridos));

  const tocarMapa = (punto) => {
    if (modo === 'navegar' || modo === 'explorar') {
      seleccionar(punto);
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

  const cambiarModo = (siguiente) => {
    roce();
    setModo(siguiente);
    setElegido(null);
    setConfirmando(false);
    setErrorEditor(null);
    if (!['punto', 'area', 'ruta'].includes(siguiente)) setBorrador(null);
    else if (borrador?.tipo !== siguiente) setBorrador({ tipo: siguiente, coordinates: [] });
  };

  const minimoBorrador = borrador?.tipo === 'area' ? 3 : borrador?.tipo === 'ruta' ? 2 : 1;
  const puedeGuardar = Boolean(borrador && borrador.coordinates.length >= minimoBorrador);

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
            ? geoDeArea({ coordinates })
            : geoDeRecorrido({ coordinates });
      const { error } = await supabase.from('codex_universe_items').insert({
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

          <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, marginLeft: 10, flex: 1 }}>
            mapa
          </Text>

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

        <MapaVizta
          ancho={W}
          alto={alto}
          inicial={CENTRO_INICIAL}
          reinicio={reinicio}
          onMover={setVista}
          areas={areasVisibles}
          pines={pines}
          recorridos={verRecorridos ? recorridos : []}
          mostrarAreas={areasVisibles.length > 0}
          mostrarPines={verPines}
          mostrarCalor={mostrarCalor}
          borrador={borrador}
          nivel={nivel}
          elegido={elegido?.id}
          modo={modo}
          zonasSinToque={zonasSinToque}
          onTocar={tocarMapa}
          onExplorar={modo === 'explorar' ? seleccionar : null}
        >
          <View style={{ position: 'absolute', right: 12, top: 12 }}>
            <HerramientasMapa
              modo={modo}
              calor={mostrarCalor}
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
            <View style={{ position: 'absolute', left: 14, top: alto / 2 - 90 }}>
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
                  }
                  // Lo elegido puede pertenecer al nivel que se acaba de apagar;
                  // dejar la ficha abierta mostraría un municipio que ya no está
                  // dibujado y que no se puede volver a tocar para cerrarla.
                  setElegido(null);
                }}
              />
            </View>
          ) : null}

          {pines.length && !['punto', 'area', 'ruta'].includes(modo) && !confirmando ? (
            <View style={{ position: 'absolute', left: 14, bottom: bottomInset + 14 }}>
              <Leyenda>
                <Fila
                  simbolo={<View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: AMBAR }} />}
                  texto="pines"
                  cuantos={pines.length}
                  activo={verPines}
                  onPress={() => setVerPines((v) => !v)}
                />
              </Leyenda>
            </View>
          ) : null}

          {recorridos.length && !['punto', 'area', 'ruta'].includes(modo) && !confirmando ? (
            <View style={{ position: 'absolute', left: 14, bottom: bottomInset + (pines.length ? 62 : 14) }}>
              <Leyenda>
                <Fila
                  simbolo={<View style={{ width: 13, height: 3, borderRadius: 2, backgroundColor: '#315E9E' }} />}
                  texto="rutas"
                  cuantos={recorridos.length}
                  activo={verRecorridos}
                  onPress={() => setVerRecorridos((v) => !v)}
                />
              </Leyenda>
            </View>
          ) : null}

          {modo === 'explorar' && !elegido ? (
            <AyudaModo bottomInset={bottomInset} texto="deslizá el dedo para identificar territorios" />
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
              bottomInset={bottomInset}
              onClose={() => setElegido(null)}
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

        {/* El detalle va fuera de `MapaVizta` y último en el árbol: cubre el
          * mapa entero, y montarlo adentro lo dejaría bajo los controles y
          * atrapado por los gestos del mapa. */}
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
  { clave: 'explorar', etiqueta: 'Explorar territorios', Icono: ScanSearch },
  { clave: 'punto', etiqueta: 'Crear punto', Icono: MapPinPlus },
  { clave: 'area', etiqueta: 'Crear área', Icono: Pentagon },
  { clave: 'ruta', etiqueta: 'Crear ruta manual', Icono: Route },
];

function HerramientasMapa({ modo, calor, onModo, onCalor }) {
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
              backgroundColor: activo ? '#1F5EA8' : pressed ? 'rgba(28,43,34,0.08)' : 'transparent',
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
    </View>
  );
}

function AyudaModo({ texto, bottomInset }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 36, right: 80, bottom: bottomInset + 18, alignItems: 'center' }}>
      <Text
        style={{
          fontFamily: MONO,
          fontSize: 10.5,
          color: INK.body,
          backgroundColor: 'rgba(255,253,248,0.94)',
          borderWidth: 1,
          borderColor: 'rgba(28,43,34,0.10)',
          borderRadius: 18,
          paddingHorizontal: 12,
          paddingVertical: 8,
          overflow: 'hidden',
        }}
      >
        {texto}
      </Text>
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
        backgroundColor: primario ? '#6941C6' : 'rgba(28,43,34,0.06)',
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
function Ficha({ item, bottomInset, onClose, onAbrir }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: 14,
        right: 14,
        bottom: bottomInset + 14,
        backgroundColor: PAPEL,
        borderWidth: 1,
        borderColor: 'rgba(28,43,34,0.12)',
        borderRadius: 6,
        paddingHorizontal: 16,
        paddingTop: 13,
        paddingBottom: 15,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={
            item.clase === 'pin'
              ? { width: 7, height: 7, borderRadius: 4, backgroundColor: AMBAR }
              : { width: 13, height: 2, backgroundColor: VERDE }
          }
        />
        <Text style={{ fontFamily: MONO, fontSize: 10.5, color: TENUE, marginLeft: 8, flex: 1 }}>
          {String(item.tipo || '').toLowerCase()}
        </Text>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar la ficha">
          <X size={15} color={INK.faint} />
        </Pressable>
      </View>

      <Text style={{ fontFamily: SERIF, fontSize: 22, color: INK.title, marginTop: 9, lineHeight: 27 }}>
        {item.name}
      </Text>

      {item.description ? (
        <>
          <View style={{ height: 1, backgroundColor: 'rgba(28,43,34,0.09)', marginTop: 12 }} />
          <Text numberOfLines={3} style={{ fontSize: 13, lineHeight: 20, color: INK.body, marginTop: 11 }}>
            {item.description}
          </Text>
        </>
      ) : null}

      {/* La salida de la ficha.
        *
        * Sin esto el mapa era un callejón: se tocaba un punto, se leían tres
        * líneas y no había a dónde ir. El resumen es una promesa de que hay
        * más —tipo, nombre, un recorte de la descripción— y esta es la puerta
        * que la cumple.
        *
        * Solo aparece si el item trae su original: los territorios dibujados a
        * mano que todavía no son un item del Codex no tienen detalle que
        * abrir, y un botón que no lleva a ningún lado es peor que ninguno. */}
      {onAbrir ? (
        <Pressable
          onPress={onAbrir}
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${item.name}`}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 14,
            paddingVertical: 10,
            borderRadius: 5,
            borderWidth: 1,
            borderColor: 'rgba(28,43,34,0.14)',
            // El press se siente sin animación: el fondo se hunde un tono.
            backgroundColor: pressed ? 'rgba(28,43,34,0.06)' : 'transparent',
          })}
        >
          <Text style={{ fontFamily: MONO, fontSize: 11, color: INK.body, letterSpacing: 0.3 }}>
            abrir ficha
          </Text>
          <ArrowUpRight size={13} color={INK.body} style={{ marginLeft: 6 }} />
        </Pressable>
      ) : null}
    </View>
  );
}
