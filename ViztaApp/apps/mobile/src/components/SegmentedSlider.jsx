import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Extrapolation,
} from 'react-native-reanimated';
import { GLASS, INK, MOTION, RADIUS, RIM } from './theme';
import { roce } from '../utils/haptics';

/**
 * Selector de segmentos con indicador deslizante.
 *
 * A diferencia de tres pastillas independientes, acá hay una sola pieza que
 * viaja: eso es lo que hace que se lea como un switch y no como tres botones.
 * El indicador es de cristal — está por encima de la pista, y es lo único
 * flotante del control, así que es donde el material tiene sentido.
 *
 * El tinte del indicador se interpola entre los acentos de cada segmento, así
 * que al viajar cambia de color en el camino en vez de saltar al llegar.
 *
 * `tabs`: [{ id, label, accent, ink }]
 */
// `onReselect` avisa cuando se toca la pestaña que ya estaba elegida. Sin él ese
// toque no hacía nada, y había controles que lo necesitaban para volver a
// plegarse sin cambiar de pestaña.
export default function SegmentedSlider({ tabs, valor, onChange, onReselect, style }) {
  const [ancho, setAncho] = useState(0);
  const indice = Math.max(0, tabs.findIndex((t) => t.id === valor));

  // Índice fraccionario: mientras el resorte corre, vale 1.4 y de ahí sale
  // tanto la posición como el color y el resaltado de las etiquetas.
  const pos = useSharedValue(indice);
  const press = useSharedValue(0);

  useEffect(() => {
    pos.value = withSpring(indice, MOTION.tap);
  }, [indice]);

  const segmento = ancho ? (ancho - 6) / tabs.length : 0;

  const paradas = tabs.map((_, i) => i);
  const tintes = tabs.map((t) => t.accent);

  const indicador = useAnimatedStyle(() => ({
    width: segmento,
    transform: [
      { translateX: pos.value * segmento },
      // Se comprime al presionar, como el control del sistema: confirma el
      // toque antes de que el dedo se levante.
      { scaleX: 1 - press.value * 0.05 },
      { scaleY: 1 - press.value * 0.07 },
    ],
    backgroundColor:
      tabs.length > 1 ? interpolateColor(pos.value, paradas, tintes) : tintes[0],
  }));

  return (
    <View
      onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
      style={[
        {
          flexDirection: 'row',
          padding: 3,
          borderRadius: RADIUS.pill,
          // Pista hundida y plana: no compite con el indicador.
          backgroundColor: 'rgba(28,43,34,0.055)',
        },
        style,
      ]}
    >
      {segmento > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 3,
              top: 3,
              bottom: 3,
              borderRadius: RADIUS.pill,
              overflow: 'hidden',
              boxShadow: RIM,
            },
            indicador,
          ]}
        >
          <BlurView intensity={GLASS.blur} tint="light" style={StyleSheet.absoluteFill} />
          {/* El velo lechoso va debajo del tinte para que el color no se lave. */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.52)' }]} />
        </Animated.View>
      ) : null}

      {tabs.map((t, i) => (
        <Segmento
          key={t.id}
          tab={t}
          indice={i}
          pos={pos}
          activo={t.id === valor}
          onPressIn={() => {
            press.value = withTiming(1, MOTION.press);
          }}
          onPressOut={() => {
            press.value = withSpring(0, MOTION.tap);
          }}
          onPress={() => {
            if (t.id === valor) {
              onReselect?.(t.id);
              return;
            }
            roce();
            onChange?.(t.id);
          }}
        />
      ))}
    </View>
  );
}

function Segmento({ tab, indice, pos, activo, onPress, onPressIn, onPressOut }) {
  // La etiqueta se tiñe según qué tan cerca está el indicador, no según el
  // booleano: así el color acompaña al viaje en vez de saltar al final.
  const texto = useAnimatedStyle(() => {
    const cerca = interpolate(Math.abs(pos.value - indice), [0, 1], [1, 0], Extrapolation.CLAMP);
    return { color: interpolateColor(cerca, [0, 1], [INK.meta, tab.ink]) };
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="tab"
      accessibilityState={{ selected: activo }}
      style={{ flex: 1, paddingVertical: 10, alignItems: 'center' }}
    >
      <Animated.Text style={[{ fontSize: 13.5, fontWeight: activo ? '800' : '600' }, texto]}>
        {tab.label}
      </Animated.Text>
    </Pressable>
  );
}
