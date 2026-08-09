import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { CARD_SHADOW, GLASS, INK, MOTION, RADIUS, RIM, RIM_OSCURO } from './theme';
import { roce } from '../utils/haptics';

const OSCURO = '#1C2B22';

/**
 * Botón de cristal.
 *
 * El material sale de tres capas, no de un color: blur real del fondo, velo
 * lechoso encima, y el filete refractado (`RIM`) por dentro del borde. La
 * sombra exterior vive en el wrapper porque iOS la recorta si comparte View con
 * `overflow: hidden` — la misma razón que en GlassCard.
 *
 * El estado activo no cambia el icono de golpe: se cruzan dos copias, la clara
 * y la blanca, en el mismo tiempo que tarda el fondo en oscurecerse. Cambiarlo
 * de golpe deja el icono blanco sobre cristal claro por un cuarto de segundo,
 * o sea invisible justo cuando el usuario está mirando si registró.
 *
 * · `Icon`   componente de lucide-react-native
 * · `label`  si va, el botón crece a píldora; si no, queda cuadrado
 * · `activo` lo tiñe de tinta oscura (toggle encendido)
 * · `tono`   'cristal' | 'oscuro' — oscuro es el botón principal, sin blur
 */
export default function GlassButton({
  Icon,
  label,
  onPress,
  onLongPress,
  activo = false,
  tono = 'cristal',
  size = 42,
  radius = RADIUS.md,
  iconSize = 17,
  haptico = true,
  disabled = false,
  style,
  children,
}) {
  const press = useSharedValue(0);
  const on = useSharedValue(activo ? 1 : 0);
  const solido = tono === 'oscuro';

  useEffect(() => {
    on.value = withSpring(activo ? 1 : 0, MOTION.tap);
  }, [activo]);

  const caja = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.045 }],
    // La sombra se retrae al hundirse: el botón se acerca a la superficie.
    shadowOpacity: interpolate(press.value, [0, 1], [0.1, 0.04]),
  }));

  // El velo oscuro se monta encima del cristal en vez de reemplazarlo, así el
  // blur sigue trabajando debajo y el borde no salta.
  const velo = useAnimatedStyle(() => ({ opacity: on.value }));
  const iconoClaro = useAnimatedStyle(() => ({ opacity: 1 - on.value }));
  const iconoBlanco = useAnimatedStyle(() => ({ opacity: on.value }));

  const contenido = (color, animado) => (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: label ? 7 : 0,
        },
        label ? null : StyleSheet.absoluteFill,
        animado,
      ]}
    >
      {Icon ? <Icon size={iconSize} color={color} /> : null}
      {label ? (
        <Animated.Text style={{ fontSize: 13, fontWeight: '700', color }}>{label}</Animated.Text>
      ) : null}
    </Animated.View>
  );

  return (
    <Pressable
      onPress={
        onPress
          ? (e) => {
              if (haptico) roce();
              onPress(e);
            }
          : undefined
      }
      onLongPress={onLongPress}
      onPressIn={() => {
        press.value = withTiming(1, MOTION.press);
      }}
      onPressOut={() => {
        press.value = withSpring(0, MOTION.tap);
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label || undefined}
      accessibilityState={{ selected: activo, disabled }}
      // Los botones de 42px ya cumplen el mínimo táctil, pero los que van en
      // fila apretada agradecen el margen extra.
      hitSlop={8}
    >
      <Animated.View
        style={[
          CARD_SHADOW,
          { borderRadius: radius, opacity: disabled ? 0.45 : 1 },
          caja,
          style,
        ]}
      >
        <View
          style={{
            minWidth: size,
            height: size,
            paddingHorizontal: label ? 15 : 0,
            borderRadius: radius,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: solido ? OSCURO : 'transparent',
            boxShadow: solido ? RIM_OSCURO : RIM,
          }}
        >
          {solido ? null : (
            <>
              <BlurView intensity={GLASS.blur} tint="light" style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: GLASS.fill }]} />
              <Animated.View
                style={[StyleSheet.absoluteFill, { backgroundColor: OSCURO }, velo]}
              />
            </>
          )}

          {children ?? (
            <>
              {solido
                ? contenido('#FFFFFF')
                : (
                  <>
                    {contenido(INK.title, iconoClaro)}
                    {contenido('#FFFFFF', iconoBlanco)}
                  </>
                )}
            </>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}
