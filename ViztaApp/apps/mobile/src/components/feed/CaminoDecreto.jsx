import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react-native';
import { INK } from '../theme';
import { COLOR_VOTO } from './diputados';
import { caminoDelDecreto, conResolucion, traerResolucionesVeto } from './estadoDeLeyes';
import { PISTA, usePistasStore } from '../../state/pistasStore';

const TINTA = '#2F4A7A';
const RAYA = 'rgba(28,43,34,0.12)';
const ROJO = COLOR_VOTO.contra;
const GLOBO = 'rgba(28,43,34,0.92)';

/**
 * El estado de una ley o un decreto, en su pill. El veto va en rojo con letra
 * blanca, para que se vea antes que el título; los demás, en gris.
 */
export function PillEstado({ estado, children }) {
  const veto = estado === 'vetado' || /^vetad[ao]$/.test(String(children || ''));
  return (
    <View style={{
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
      backgroundColor: veto ? ROJO : 'rgba(28,43,34,0.06)',
    }}>
      <Text style={{ fontSize: 11, fontWeight: veto ? '700' : '500', color: veto ? '#FFFFFF' : INK.meta }}>{children}</Text>
    </View>
  );
}

const dia = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' });

/** Lo que el pleno resolvió de los vetos: una consulta para todos los decretos. */
function useResoluciones(activa) {
  const q = useQuery({ queryKey: ['resoluciones-veto'], queryFn: traerResolucionesVeto, staleTime: 30 * 60 * 1000, enabled: activa });
  return q.data;
}

/**
 * Por dónde va un decreto: aprobado, Ejecutivo, sancionado (o vetado y lo que
 * el Congreso resolvió), publicado y en vigor, en puntos que se llenan.
 *
 * La pantalla solo muestra los puntos y sus fechas. Lo que significa cada paso
 * va en su ayuda: se abre al tocar el paso y, la primera vez (`guia`), sola en
 * el paso en que va. Ver docs/DESIGN.md › El camino de un decreto.
 */
export default function CaminoDecreto({ decreto, eventos, estado, fechaVigencia, sinFicha = false, guia = false, style }) {
  const resoluciones = useResoluciones(estado === 'vetado');
  const { pasos, actual } = caminoDelDecreto({ eventos: conResolucion(eventos, decreto, resoluciones), estado, fechaVigencia, sinFicha });
  const pistaPendiente = usePistasStore((s) => !s.hechas[PISTA.CAMINO_DECRETO]);
  const marcar = usePistasStore((s) => s.marcar);
  const [abierto, setAbierto] = useState(guia && pistaPendiente ? actual : null);
  const primeraVez = guia && pistaPendiente;

  const tocar = (i) => {
    setAbierto((a) => (a === i ? null : i));
    marcar(PISTA.CAMINO_DECRETO);
  };
  const cerrar = () => { setAbierto(null); marcar(PISTA.CAMINO_DECRETO); };

  return (
    <View style={[{ marginTop: 12 }, style]}>
      <View style={{ flexDirection: 'row' }}>
        {pasos.map((p, i) => {
          const esta = i === actual;
          const color = p.veto ? ROJO : p.hecho ? TINTA : 'rgba(28,43,34,0.18)';
          // El tramo que llega a un paso toma su color: tinta si ya pasó, rojo si es el veto.
          const tramo = (j) => (pasos[j]?.hecho ? (pasos[j].veto ? ROJO : TINTA) : RAYA);
          return (
            <Pressable key={p.clave} onPress={() => tocar(i)} style={{ flex: 1, alignItems: 'center', paddingBottom: 4 }}
              accessibilityRole="button" accessibilityState={{ expanded: abierto === i }}
              accessibilityLabel={`${p.nombre}${p.fecha ? `, ${dia(p.fecha)}` : ''}${p.hecho ? '' : ', pendiente'}`}
              accessibilityHint="Abre qué significa este paso">
              <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', height: 13 }}>
                <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? 'transparent' : tramo(i) }} />
                <View style={{
                  width: esta ? 13 : 8, height: esta ? 13 : 8, borderRadius: 7,
                  backgroundColor: p.hecho ? color : 'transparent',
                  borderWidth: p.hecho ? 0 : 1.5, borderColor: color,
                }} />
                <View style={{ flex: 1, height: 2, backgroundColor: i === pasos.length - 1 ? 'transparent' : tramo(i + 1) }} />
              </View>
              <Text numberOfLines={1} style={{ fontSize: 10, marginTop: 5, color: p.veto ? ROJO : esta ? TINTA : p.hecho ? INK.meta : INK.faint, fontWeight: esta || abierto === i ? '700' : '400' }}>{p.nombre}</Text>
              {p.fecha ? <Text style={{ fontSize: 9.5, marginTop: 1, color: INK.faint }}>{dia(p.fecha)}</Text> : null}
            </Pressable>
          );
        })}
      </View>
      {abierto !== null && pasos[abierto] ? (
        <Ayuda texto={pasos[abierto].ayuda} lugar={(abierto + 0.5) / pasos.length} primeraVez={primeraVez} onCerrar={cerrar} />
      ) : null}
    </View>
  );
}

/** El globo de la ayuda, con su pico debajo del paso que explica. */
function Ayuda({ texto, lugar, primeraVez, onCerrar }) {
  const aparece = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    aparece.setValue(0);
    Animated.timing(aparece, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [texto, aparece]);
  return (
    <Animated.View style={{ marginTop: 8, opacity: aparece, transform: [{ translateY: aparece.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] }) }] }}>
      <View style={{ position: 'absolute', top: -5, left: `${lugar * 100}%`, marginLeft: -6, width: 12, height: 12, backgroundColor: GLOBO, transform: [{ rotate: '45deg' }] }} />
      <View style={{ backgroundColor: GLOBO, borderRadius: 12, paddingVertical: 11, paddingLeft: 13, paddingRight: 36 }} accessibilityLiveRegion="polite">
        <Text style={{ fontSize: 13, lineHeight: 19, color: '#FFFFFF' }}>{texto}</Text>
        {primeraVez ? <Text style={{ fontSize: 11.5, lineHeight: 16, color: 'rgba(255,255,255,0.68)', marginTop: 6 }}>Cada paso del camino se puede tocar para ver qué significa.</Text> : null}
        <Pressable onPress={onCerrar} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar la ayuda"
          style={{ position: 'absolute', top: 8, right: 8, padding: 4 }}>
          <X size={15} color="rgba(255,255,255,0.75)" />
        </Pressable>
      </View>
    </Animated.View>
  );
}
