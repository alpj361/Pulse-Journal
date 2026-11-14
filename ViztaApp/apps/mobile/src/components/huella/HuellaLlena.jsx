import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Fingerprint } from 'lucide-react-native';
import { TONOS } from './tonos';

/**
 * La huella grande que se llena de abajo hacia arriba según `llenado` (0 a 1).
 * Son dos íconos iguales: el de fondo, tenue, y el de color recortado por una
 * caja que crece desde abajo.
 */
export default function HuellaLlena({ llenado = 0, size = 72, tono = 'verde' }) {
  const t = TONOS[tono] || TONOS.verde;
  const alto = useSharedValue(0);
  useEffect(() => {
    alto.value = withTiming(size * Math.max(0, Math.min(1, llenado)), { duration: 900 });
  }, [llenado, size, alto]);
  const recorte = useAnimatedStyle(() => ({ height: alto.value }));

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Huella llena al ${Math.round(llenado * 100)} por ciento`}
    >
      <Fingerprint size={size} color="rgba(28,43,34,0.13)" strokeWidth={1.5} />
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' }, recorte]}>
        <View style={{ position: 'absolute', left: 0, bottom: 0, width: size, height: size }}>
          <Fingerprint size={size} color={t.tinta} strokeWidth={1.5} />
        </View>
      </Animated.View>
    </View>
  );
}
