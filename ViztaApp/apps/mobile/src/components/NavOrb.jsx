import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

const AnimatedView = Animated.View;

/**
 * Esfera verde centrada sobre la tab bar (acceso a Orbit).
 * Cuerpo + brillo cálido + rim light en SVG, con tres capas de movimiento:
 *  · respiración lenta continua cuando el tab está activo
 *  · squash al presionar y rebote al soltar
 *  · halo que se expande y se desvanece en cada tap
 */
export default function NavOrb({ size = 68, focused = false, onPress }) {
  const r = size / 2;

  const press = useRef(new Animated.Value(1)).current;
  const idle = useRef(new Animated.Value(1)).current;
  const ripple = useRef(new Animated.Value(0)).current;

  // Respiración: solo mientras el orbe es el tab activo.
  useEffect(() => {
    if (!focused) {
      idle.stopAnimation(() => idle.setValue(1));
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idle, {
          toValue: 1.035,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(idle, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [focused]);

  const handlePressIn = () => {
    Animated.spring(press, {
      toValue: 0.88,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(press, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 14,
    }).start();
  };

  const handlePress = () => {
    ripple.setValue(0);
    Animated.timing(ripple, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    onPress?.();
  };

  const scale = Animated.multiply(press, idle);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Orbit"
      accessibilityState={{ selected: focused }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Halo del tap — vive fuera del clip del orbe */}
      <AnimatedView
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: r,
          borderWidth: 2,
          borderColor: '#5C8A6B',
          opacity: ripple.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.45, 0] }),
          transform: [
            { scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.75] }) },
          ],
        }}
      />

      <AnimatedView
        style={{
          width: size,
          height: size,
          borderRadius: r,
          transform: [{ scale }],
          shadowColor: '#1E3326',
          shadowOpacity: focused ? 0.34 : 0.22,
          shadowRadius: focused ? 16 : 11,
          shadowOffset: { width: 0, height: 6 },
          elevation: focused ? 10 : 6,
        }}
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
      </AnimatedView>
    </Pressable>
  );
}
