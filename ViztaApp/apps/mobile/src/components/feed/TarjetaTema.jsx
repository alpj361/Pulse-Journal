import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { INK, MOTION, RADIUS } from '../theme';
import { impulsoDe, paletaDe, temaDe } from './temas';

/**
 * Un tema del día.
 *
 * Reemplaza las tarjetas de cristal con filete de color a la izquierda. Ese
 * filete es uno de los tics más reconocibles de interfaz generada, y encima no
 * servía para nada: el color del tema ya está en todo el lavado de la tarjeta.
 *
 * Tampoco lleva icono. Once temas necesitarían once iconos, y ninguno de los
 * genéricos dice «Movilidad» o «Violencia» mejor que la palabra.
 *
 * El degradado es pálido a propósito. El tema se reconoce por su tinte, no por
 * su saturación, y sobre un fondo claro un lavado suave se lee como papel
 * teñido — que es el registro que buscamos — mientras una losa oscura se lee
 * como un banner.
 */
export default function TarjetaTema({ tema, nombre, porQue, impulso, onPress, style }) {
  const press = useSharedValue(0);
  const p = paletaDe(tema);
  const canon = temaDe(tema);
  const imp = impulsoDe(impulso);

  const animado = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.018 }],
  }));

  // La saturación sube un punto al presionar: es la confirmación de que el dedo
  // registró, sin mover nada de lugar.
  const velo = useAnimatedStyle(() => ({
    opacity: press.value * 0.5,
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withTiming(1, MOTION.press);
      }}
      onPressOut={() => {
        press.value = withSpring(0, MOTION.tap);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${canon}: ${nombre}`}
      style={style}
    >
      <Animated.View
        style={[
          { borderRadius: RADIUS.lg, overflow: 'hidden' },
          animado,
        ]}
      >
        <LinearGradient
          colors={p.lavado}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{ paddingHorizontal: 18, paddingVertical: 17 }}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: p.lavado[1] },
              velo,
            ]}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 9 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: p.marca }} />
            <Text style={{ fontSize: 10, fontWeight: '800', color: p.tinta, letterSpacing: 1 }}>
              {canon.toUpperCase()}
            </Text>
            <View style={{ flex: 1 }} />
            {/* El impulso va en palabras, no en flechas: «subiendo fuerte» dice
                más que un triángulo, y no se confunde con un control. */}
            <Text style={{ fontSize: 10.5, color: p.tinta, opacity: 0.7 }}>{imp.label}</Text>
          </View>

          <Text style={{ fontSize: 17.5, fontWeight: '700', color: INK.title, lineHeight: 24, letterSpacing: -0.3 }}>
            {nombre}
          </Text>

          {porQue ? (
            <Text numberOfLines={3} style={{ fontSize: 13, color: INK.body, lineHeight: 19.5, marginTop: 7 }}>
              {porQue}
            </Text>
          ) : null}
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}
