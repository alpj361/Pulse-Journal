import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Crosshair, X } from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import { MONO } from '../codex/mono';
import { PAPEL } from '../codex/Papel';
import MapaVizta, { CENTRO_INICIAL } from './MapaVizta';
import SelectorNiveles from './SelectorNiveles';
import { supabase } from '../../utils/supabase';
import { usePulseConnectionStore } from '../../state/pulseConnectionStore';
import { roce } from '../../utils/haptics';

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

  for (const item of items || []) {
    const geo = item?.geo || {};
    const g = geo.geometry;
    const base = {
      id: item.id,
      name: item.name || 'Sin nombre',
      tipo: geo.boundary_type || item?.details?.boundary_type || 'territorio',
      description: item.description || null,
    };

    if (g?.type === 'Polygon' || g?.type === 'MultiPolygon') {
      areas.push({ ...base, geometry: g, clase: 'area', caja: cajaDe(g), nivel: nivelDe(item, geo) });
      continue;
    }

    const coordinates = coordenadasDe(geo);
    if (coordinates) pines.push({ ...base, coordinates, clase: 'pin' });
  }

  return { areas, pines };
}

const anillosDe = (g) =>
  g?.type === 'Polygon' ? g.coordinates : g?.type === 'MultiPolygon' ? g.coordinates.flat() : [];

/** Caja envolvente en grados. Se calcula una vez por territorio y no cambia. */
function cajaDe(g) {
  let lngMin = Infinity;
  let lngMax = -Infinity;
  let latMin = Infinity;
  let latMax = -Infinity;
  for (const anillo of anillosDe(g)) {
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
function loQueSeToco({ lat, lng, zoom }, areas, pines, verPines) {
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
  // Arranca sin límites: el mapa se ve entero y las fronteras se piden. Ver
  // `SelectorNiveles` para por qué es un nivel a la vez y no dos interruptores.
  const [nivel, setNivel] = useState(null);
  const [verPines, setVerPines] = useState(true);
  const [elegido, setElegido] = useState(null);

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
      const { data, error } = await supabase
        .from('codex_universe_items')
        .select('id, name, description, details, geo')
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

  const { areas, pines } = useMemo(() => repartir(territorios), [territorios]);

  // Cuántos hay de cada nivel: la leyenda solo muestra los niveles que existen,
  // así que un mapa sin municipios no ofrece un interruptor que no hace nada.
  const porNivel = useMemo(() => {
    const cuenta = {};
    for (const a of areas) cuenta[a.nivel] = (cuenta[a.nivel] || 0) + 1;
    return cuenta;
  }, [areas]);

  const areasVisibles = useMemo(
    () => (nivel ? areas.filter((a) => a.nivel === nivel) : []),
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
        : areas.length === 0 && pines.length === 0
          ? 'los territorios de tu Codex aparecen acá.'
          : null;

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
          areas={areasVisibles}
          pines={pines}
          mostrarAreas={areasVisibles.length > 0}
          mostrarPines={verPines}
          nivel={nivel}
          elegido={elegido?.id}
          onTocar={(punto) => setElegido(loQueSeToco(punto, areasVisibles, pines, verPines))}
        >
          {/* El interruptor de límites, a media altura del borde izquierdo: la
              ficha de lo que se toca sale de abajo, y ahí se taparían. */}
          {nivelesDisponibles.length ? (
            <View style={{ position: 'absolute', left: 14, top: alto / 2 - 90 }}>
              <SelectorNiveles
                niveles={nivelesDisponibles}
                nivel={nivel}
                onCambiar={(siguiente) => {
                  setNivel(siguiente);
                  // Lo elegido puede pertenecer al nivel que se acaba de apagar;
                  // dejar la ficha abierta mostraría un municipio que ya no está
                  // dibujado y que no se puede volver a tocar para cerrarla.
                  setElegido(null);
                }}
              />
            </View>
          ) : null}

          {pines.length ? (
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

          {elegido ? <Ficha item={elegido} bottomInset={bottomInset} onClose={() => setElegido(null)} /> : null}
        </MapaVizta>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ─── Piezas ───────────────────────────────────────────────────────────────────

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
function Ficha({ item, bottomInset, onClose }) {
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
    </View>
  );
}
