import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { MONO } from './codex/mono';
import { roce, toque } from '../utils/haptics';

const AV = Animated.View;

// Cuánto se puede empujar el orbe, y desde dónde cuenta como «arriba».
const TOPE_Y = 78; // recorrido máximo hacia arriba
const TOPE_X = 26; // lo poco que cede a los lados
const UMBRAL = 46; // a partir de acá, soltar abre Posts

/**
 * Esfera verde centrada sobre la tab bar.
 *
 * Cuerpo + brillo cálido + rim light en SVG, con cuatro capas de movimiento:
 *  · respiración lenta continua cuando está activo
 *  · squash al presionar y rebote al soltar
 *  · halo que se expande y se desvanece en cada tap
 *  · palanca: se deja empujar con el pulgar y vuelve sola
 *
 * **La palanca** (`onArriba`) convierte al orbe en el control de un mando: se
 * arrastra con el dedo y, si se lo empuja hacia arriba más allá del umbral,
 * al soltar abre Posts. El recorrido está topado y la vuelta es un resorte, así
 * que el orbe nunca queda «suelto» en la pantalla.
 *
 * Toque y arrastre no compiten: van en `Race`, y como el toque no tolera
 * movimiento, un toque limpio siempre gana y un arrastre siempre lo gana a él.
 * El umbral se avisa con un háptico y con la etiqueta de arriba, que recién ahí
 * se pone sólida — sin eso habría que adivinar cuánto es «suficiente».
 *
 * `etiqueta` es lo que anuncia VoiceOver. Va como prop porque el orbe ya cambió
 * de destino una vez —era Orbit, después el Codex, ahora una nota— y una
 * etiqueta escrita adentro se queda mintiendo en silencio.
 *
 * Nota sobre la reescritura: esto usaba `Animated` de React Native. La palanca
 * necesita leer el gesto en el hilo de UI para que el orbe no vaya un frame
 * atrás del dedo, y eso pide Reanimated. El SVG quedó igual; lo que cambió es
 * de dónde salen los números.
 */
export default function NavOrb({
  size = 68,
  focused = false,
  onPress,
  etiqueta = 'Orbit',
  onArriba,
  etiquetaArriba = 'posts',
}) {
  const r = size / 2;

  const press = useSharedValue(0);
  const idle = useSharedValue(0);
  const ripple = useSharedValue(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const armado = useSharedValue(0); // 1 = pasó el umbral

  // Respiración: solo mientras el orbe es el tab activo.
  useEffect(() => {
    if (!focused) {
      cancelAnimation(idle);
      idle.value = withTiming(0, { duration: 300 });
      return;
    }
    idle.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
    return () => cancelAnimation(idle);
  }, [focused, idle]);

  const disparar = () => {
    ripple.value = 0;
    ripple.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) });
    onPress?.();
  };

  const tap = Gesture.Tap()
    .maxDuration(400)
    .onBegin(() => {
      press.value = withSpring(1, { damping: 20, stiffness: 400 });
    })
    .onFinalize(() => {
      press.value = withSpring(0, { damping: 12, stiffness: 220 });
    })
    .onEnd(() => {
      runOnJS(disparar)();
    });

  const palanca = Gesture.Pan()
    .enabled(!!onArriba)
    .minDistance(6)
    .onBegin(() => {
      press.value = withSpring(1, { damping: 20, stiffness: 400 });
    })
    .onUpdate((e) => {
      // Hacia arriba cede bastante; hacia abajo casi nada. Un mando que baja
      // igual que sube invita a esperar algo abajo, y abajo no hay nada.
      ty.value = Math.max(-TOPE_Y, Math.min(14, e.translationY));
      tx.value = Math.max(-TOPE_X, Math.min(TOPE_X, e.translationX));

      const pasa = ty.value <= -UMBRAL ? 1 : 0;
      if (pasa !== armado.value) {
        armado.value = pasa;
        if (pasa) runOnJS(roce)();
      }
    })
    .onEnd(() => {
      const abre = ty.value <= -UMBRAL;
      if (abre && onArriba) {
        runOnJS(toque)();
        runOnJS(onArriba)();
      }
      ty.value = withSpring(0, { damping: 15, stiffness: 190 });
      tx.value = withSpring(0, { damping: 15, stiffness: 190 });
      armado.value = 0;
    })
    .onFinalize(() => {
      press.value = withSpring(0, { damping: 12, stiffness: 220 });
    });

  const gesto = Gesture.Race(palanca, tap);

  const cuerpo = useAnimatedStyle(() => {
    const escala = (1 - press.value * 0.12) * (1 + idle.value * 0.035);
    return {
      transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: escala }],
    };
  });

  const halo = useAnimatedStyle(() => ({
    opacity: interpolate(ripple.value, [0, 0.15, 1], [0, 0.45, 0]),
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: interpolate(ripple.value, [0, 1], [0.9, 1.75]) },
    ],
  }));

  // La etiqueta aparece al empujar y se afirma al pasar el umbral. Es la única
  // señal de que hay algo arriba: sin ella el gesto sería adivinanza.
  const rotulo = useAnimatedStyle(() => {
    const avance = interpolate(-ty.value, [8, UMBRAL], [0, 1], 'clamp');
    return {
      opacity: avance,
      transform: [{ translateY: interpolate(avance, [0, 1], [10, 0]) }, { scale: 0.9 + avance * 0.1 }],
    };
  });

  const rotuloFondo = useAnimatedStyle(() => ({
    backgroundColor: armado.value ? 'rgba(28,43,34,0.92)' : 'rgba(28,43,34,0.35)',
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Rótulo de destino. Vive fuera del orbe para no moverse con él. */}
      {onArriba ? (
        <AV
          pointerEvents="none"
          style={[{ position: 'absolute', bottom: size + 10, alignItems: 'center' }, rotulo]}
        >
          <AV style={[{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 }, rotuloFondo]}>
            <Text style={{ fontFamily: MONO, fontSize: 11.5, color: '#F7F6EF' }}>{etiquetaArriba}</Text>
          </AV>
        </AV>
      ) : null}

      {/* Halo del tap — vive fuera del clip del orbe */}
      <AV
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: r,
            borderWidth: 2,
            borderColor: '#5C8A6B',
          },
          halo,
        ]}
      />

      <GestureDetector gesture={gesto}>
        <AV
          accessibilityRole="button"
          accessibilityLabel={etiqueta}
          accessibilityHint={onArriba ? `Deslizá hacia arriba para abrir ${etiquetaArriba}` : undefined}
          accessibilityState={{ selected: focused }}
          style={[
            {
              width: size,
              height: size,
              borderRadius: r,
              shadowColor: '#1E3326',
              shadowOpacity: focused ? 0.34 : 0.22,
              shadowRadius: focused ? 16 : 11,
              shadowOffset: { width: 0, height: 6 },
              elevation: focused ? 10 : 6,
            },
            cuerpo,
          ]}
        >
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id="orbBody" cx="36%" cy="28%" r="82%">
                <Stop offset="0" stopColor="#CBD9B8" />
                <Stop offset="0.26" stopColor="#8FB183" />
                <Stop offset="0.55" stopColor="#3E6B4C" />
                <Stop offset="0.84" stopColor="#1F3F2C" />
                <Stop offset="1" stopColor="#132A1D" />
              </RadialGradient>
              <RadialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#FBF6DE" stopOpacity={focused ? 1 : 0.92} />
                <Stop offset="0.45" stopColor="#F2E9C4" stopOpacity="0.4" />
                <Stop offset="1" stopColor="#F0E7C6" stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="orbRim" cx="66%" cy="76%" r="58%">
                <Stop offset="0.6" stopColor="#9FBFA2" stopOpacity="0" />
                <Stop offset="1" stopColor="#9FBFA2" stopOpacity="0.35" />
              </RadialGradient>
            </Defs>

            <Circle cx={r} cy={r} r={r} fill="url(#orbBody)" />
            <Ellipse cx={r * 0.78} cy={r * 0.66} rx={r * 0.6} ry={r * 0.52} fill="url(#orbGlow)" />
            <Circle cx={r} cy={r} r={r} fill="url(#orbRim)" />
          </Svg>
        </AV>
      </GestureDetector>
    </View>
  );
}
