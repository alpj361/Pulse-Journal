import { View, Text } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { MONO } from './codex/mono';
import { usePistasStore } from '../state/pistasStore';

/**
 * Una pista, una vez.
 *
 * Aparece flotando —no empujando el contenido— y desaparece en cuanto quien la
 * lee hace la acción que explica. No vuelve nunca más.
 *
 * Es un globo y no un renglón de texto suelto a propósito: un globo se lee como
 * algo pasajero, que va a irse. Un renglón fijo se lee como parte de la
 * pantalla, y por eso molestaba.
 *
 * No se muestra sola: quien la usa decide dónde va y llama a `marcar` desde la
 * acción. Ver `usePistasStore`.
 */
export default function Pista({ clave, children, style }) {
  const pendiente = usePistasStore((s) => !s.hechas[clave]);
  if (!pendiente) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(420).delay(500)}
      exiting={FadeOut.duration(180)}
      pointerEvents="none"
      style={[{ alignItems: 'center' }, style]}
    >
      <View
        style={{
          paddingHorizontal: 11,
          paddingVertical: 6.5,
          borderRadius: 999,
          backgroundColor: 'rgba(28,43,34,0.9)',
        }}
      >
        <Text style={{ fontFamily: MONO, fontSize: 10.5, color: '#FFF', textAlign: 'center' }}>
          {children}
        </Text>
      </View>
    </Animated.View>
  );
}
