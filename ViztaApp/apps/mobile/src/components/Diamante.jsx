import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

/**
 * El diamante de píxeles: ocho cuadritos en rombo que se encienden uno tras
 * otro y se apagan despacio, como una vuelta. Es el «Diamond» de loading-ui
 * (MIT) pasado a nativo: grilla de 5 × 5, una vuelta cada 0,8 s y cada
 * cuadrito 0,1 s detrás del anterior.
 *
 * Dice que algo está en marcha (un agente trabajando). Para «cargando» la app
 * sigue usando `MorphingInfinity`.
 */
const VUELTA = 800;
// Arriba, y en el sentido del reloj: [columna, fila] en la grilla de 5.
const PIXELES = [[2, 0], [3, 1], [4, 2], [3, 3], [2, 4], [1, 3], [0, 2], [1, 1]];

export default function Diamante({ size = 14, color = '#1C2B22', style, accessibilityLabel = 'trabajando' }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: VUELTA, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [t]);
  const celda = size / 5;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel} style={[{ width: size, height: size }, style]}>
      {PIXELES.map(([x, y], i) => (
        <Pixel key={i} t={t} indice={i} style={{ position: 'absolute', left: x * celda, top: y * celda, width: celda, height: celda, backgroundColor: color }} />
      ))}
    </View>
  );
}

const suave = Easing.inOut(Easing.ease);

function Pixel({ t, indice, style }) {
  const animado = useAnimatedStyle(() => {
    // Cuánto de la vuelta pasó desde que se encendió este cuadrito.
    const fase = (t.value - indice / PIXELES.length + 1) % 1;
    return { opacity: 1 - suave(fase) };
  });
  return <Animated.View style={[style, animado]} />;
}
