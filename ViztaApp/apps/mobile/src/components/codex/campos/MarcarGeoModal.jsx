import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useQuery } from '@tanstack/react-query';
import { Check, Trash2, Undo2, X } from 'lucide-react-native';
import { INK, RADIUS } from '../../theme';
import { MONO } from '../mono';
import { PAPEL } from '../Papel';
import MapaVizta, { CENTRO_INICIAL } from '../../mapa/MapaVizta';
import { supabase } from '../../../utils/supabase';
import { usePulseConnectionStore } from '../../../state/pulseConnectionStore';
import { roce } from '../../../utils/haptics';
import { geoDeArea, geoDePunto, geoDeRecorrido } from '../geo';

/**
 * Marcar geometría desde la ficha, sin salir a la pantalla completa del mapa.
 *
 * **Un solo propósito.** El mapa grande (`MapaSheet`) navega, explora, raspa
 * niebla y guarda directo a Supabase; acá no hay nada de eso. Se abre, se
 * marca, se confirma o se descarta con el cheque y la X de los costados, y el
 * `geo` resultante vuelve por `onConfirmar` — quien guarda es la ficha, no este
 * modal.
 *
 * **Los demás territorios se ven, pero no se tocan.** Sirven de referencia
 * mientras se dibuja —para no superponer un área nueva sobre una que ya
 * existe— y por eso van apagados y sin ficha propia: `onTocar` acá siempre cae
 * en el modo de dibujo, nunca en seleccionar lo que ya está.
 */

const CABEZAL = 46;

/** El `geo` existente, si lo hay, convertido al borrador que el mapa dibuja. */
function borradorDe(rol, geoActual) {
  const g = geoActual?.geometry;
  if (rol === 'location') {
    if (g?.type === 'Point' && Array.isArray(g.coordinates)) {
      return { tipo: 'punto', coordinates: [g.coordinates] };
    }
    return { tipo: 'punto', coordinates: [] };
  }
  if (rol === 'area') {
    if (g?.type === 'Polygon' && Array.isArray(g.coordinates?.[0])) {
      const anillo = g.coordinates[0].slice();
      const a = anillo[0];
      const z = anillo[anillo.length - 1];
      if (anillo.length > 3 && a?.[0] === z?.[0] && a?.[1] === z?.[1]) anillo.pop();
      return { tipo: 'area', coordinates: anillo };
    }
    return { tipo: 'area', coordinates: [] };
  }
  if (rol === 'route') {
    if (g?.type === 'LineString' && Array.isArray(g.coordinates)) {
      return { tipo: 'ruta', coordinates: g.coordinates.slice() };
    }
    return { tipo: 'ruta', coordinates: [] };
  }
  return { tipo: 'punto', coordinates: [] };
}

/** Desde dónde arranca la cámara: el centro de lo que ya había, o Guatemala. */
function centroDe(borrador) {
  const p = borrador.coordinates;
  if (!p.length) return CENTRO_INICIAL;
  const [lng, lat] = p[Math.floor(p.length / 2)];
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return CENTRO_INICIAL;
  return { lat: Number(lat), lng: Number(lng), zoom: borrador.tipo === 'punto' ? 15 : 13 };
}

export default function MarcarGeoModal({ visible, rol, geoActual, onConfirmar, onCancelar }) {
  const { width: W, height: H } = useWindowDimensions();
  const userId = usePulseConnectionStore((s) => s.connectedUser?.id);
  const [borrador, setBorrador] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setBorrador(borradorDe(rol, geoActual));
    // Solo al abrir: mientras el modal está abierto, el borrador lo maneja el
    // dedo, no el `geoActual` que va quedando desactualizado a propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Los demás territorios, de fondo y sin ficha. Misma tabla que `MapaSheet`,
  // pero acá alcanza con la geometría: no hay nada que abrir ni que editar.
  const { data: otros = [] } = useQuery({
    queryKey: ['mapa-territorios-referencia', userId],
    enabled: Boolean(userId && visible),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('codex_universe_items')
        .select('id, geo')
        .eq('tipo', 'Territorio')
        .not('geo', 'is', null);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const { areasRef, pinesRef, recorridosRef } = useMemo(() => {
    const areasRef = [];
    const pinesRef = [];
    const recorridosRef = [];
    for (const t of otros) {
      // El item que se está editando no debe verse dos veces: una vez como
      // referencia apagada y otra como lo que se está dibujando encima.
      if (geoActual?._itemId && t.id === geoActual._itemId) continue;
      const g = t.geo?.geometry;
      if (!g) continue;
      if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
        areasRef.push({ id: t.id, geometry: g, nivel: 'otro' });
      } else if (g.type === 'LineString' || g.type === 'MultiLineString') {
        recorridosRef.push({ id: t.id, geometry: g });
      } else if (g.type === 'Point' && Array.isArray(g.coordinates)) {
        pinesRef.push({ id: t.id, coordinates: { lat: g.coordinates[1], lng: g.coordinates[0] } });
      }
    }
    return { areasRef, pinesRef, recorridosRef };
  }, [otros, geoActual]);

  const alto = H - CABEZAL;
  const inicial = useMemo(() => centroDe(borradorDe(rol, geoActual)), [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const tocarMapa = useCallback((punto) => {
    const coordenada = [punto.lng, punto.lat];
    setBorrador((actual) => {
      if (!actual) return actual;
      if (actual.tipo === 'punto') return { ...actual, coordinates: [coordenada] };
      return { ...actual, coordinates: [...actual.coordinates, coordenada] };
    });
    roce();
  }, []);

  const moverVertice = useCallback((indice, lng, lat) => {
    setBorrador((actual) => {
      if (!actual?.coordinates || indice < 0 || indice >= actual.coordinates.length) return actual;
      const coordinates = actual.coordinates.slice();
      coordinates[indice] = [lng, lat];
      return { ...actual, coordinates };
    });
  }, []);

  const minimo = borrador?.tipo === 'area' ? 3 : borrador?.tipo === 'ruta' ? 2 : 1;
  const puedeConfirmar = Boolean(borrador && borrador.coordinates.length >= minimo);

  const confirmar = () => {
    if (!puedeConfirmar) return;
    const coordinates = borrador.coordinates;
    const geo =
      borrador.tipo === 'punto'
        ? geoDePunto({ lat: coordinates[0][1], lng: coordinates[0][0], base: geoActual })
        : borrador.tipo === 'area'
          ? geoDeArea({ coordinates, base: geoActual })
          : geoDeRecorrido({ coordinates, base: geoActual });
    roce();
    onConfirmar(geo);
  };

  if (!visible) return null;

  const instruccion =
    borrador?.tipo === 'punto'
      ? 'tocá el mapa para marcar el punto'
      : borrador?.tipo === 'area'
        ? 'tocá al menos 3 vértices del área'
        : 'tocá al menos 2 puntos del recorrido';

  return (
    <Modal visible animationType="slide" onRequestClose={onCancelar}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: PAPEL }}>
        <View
          style={{
            height: CABEZAL,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 14,
          }}
        >
          <BotonRedondo Icono={X} etiqueta="Descartar" onPress={onCancelar} tinta={INK.body} />
          <Text style={{ fontFamily: MONO, fontSize: 10.5, color: INK.meta, letterSpacing: 0.3 }}>
            {instruccion}
          </Text>
          <BotonRedondo
            Icono={Check}
            etiqueta="Confirmar"
            onPress={confirmar}
            disabled={!puedeConfirmar}
            primario
          />
        </View>

        {borrador ? (
          <MapaVizta
            ancho={W}
            alto={alto}
            inicial={inicial}
            areas={areasRef}
            pines={pinesRef}
            recorridos={recorridosRef}
            mostrarAreas={areasRef.length > 0}
            mostrarPines={pinesRef.length > 0}
            borrador={borrador}
            onMoverVertice={borrador.tipo !== 'punto' ? moverVertice : null}
            modo={borrador.tipo}
            onTocar={tocarMapa}
          >
            {borrador.tipo !== 'punto' ? (
              <View style={{ position: 'absolute', left: 14, bottom: 20 }}>
                <BarraDibujo
                  cuantos={borrador.coordinates.length}
                  onDeshacer={() =>
                    setBorrador((a) => (a ? { ...a, coordinates: a.coordinates.slice(0, -1) } : a))
                  }
                  onBorrar={() => setBorrador((a) => (a ? { ...a, coordinates: [] } : a))}
                />
              </View>
            ) : null}
          </MapaVizta>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

function BotonRedondo({ Icono, etiqueta, onPress, disabled, primario, tinta }) {
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        onPress();
      }}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primario ? INK.title : 'transparent',
        opacity: disabled ? 0.3 : pressed ? 0.55 : 1,
      })}
    >
      <Icono size={17} color={primario ? PAPEL : tinta || INK.body} strokeWidth={2.2} />
    </Pressable>
  );
}

function BarraDibujo({ cuantos, onDeshacer, onBorrar }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        padding: 5,
        borderRadius: 24,
        backgroundColor: 'rgba(255,253,248,0.94)',
        borderWidth: 1,
        borderColor: 'rgba(28,43,34,0.12)',
      }}
    >
      <Text style={{ fontFamily: MONO, fontSize: 10.5, color: INK.meta, paddingHorizontal: 8 }}>
        {cuantos} {cuantos === 1 ? 'punto' : 'puntos'}
      </Text>
      <BotonRedondo Icono={Undo2} etiqueta="Deshacer" onPress={onDeshacer} disabled={cuantos === 0} />
      <BotonRedondo Icono={Trash2} etiqueta="Borrar todo" onPress={onBorrar} disabled={cuantos === 0} />
    </View>
  );
}
