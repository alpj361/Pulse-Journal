import { useEffect, useState } from 'react';
import { View, Text, Platform, Pressable } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { BookOpen } from 'lucide-react-native';
import { INK, CARD_SHADOW } from '../theme';
import MorphingInfinity from '../MorphingInfinity';

const RESORTE = { damping: 20, stiffness: 250, mass: 0.5 };

/**
 * Puerta de acceso al Codex.
 *
 * El acceso con Apple crea cuentas de solo móvil (`user_type: 'phone'`). El
 * acceso con Portal Web sigue existiendo para quienes ya tienen cuenta ahí:
 * son dos puertas a lo mismo, no dos productos.
 *
 * El botón de Apple usa el componente nativo, no uno propio: las Human
 * Interface Guidelines exigen su tipografía, proporciones y contraste exactos,
 * y una imitación es motivo de rechazo en revisión.
 */
export default function CodexAccessGate({ onApple, onPortal, conectando, error }) {
  const [appleDisponible, setAppleDisponible] = useState(false);

  useEffect(() => {
    let vivo = true;
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => vivo && setAppleDisponible(ok))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 }}>
      <Animated.View
        entering={FadeInDown.duration(420).springify().damping(18)}
        style={{
          width: 72,
          height: 72,
          borderRadius: 26,
          backgroundColor: 'rgba(28,43,34,0.05)',
          borderWidth: 1,
          borderColor: 'rgba(28,43,34,0.08)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 22,
        }}
      >
        <BookOpen size={32} color={INK.title} />
      </Animated.View>

      <Animated.Text
        entering={FadeInDown.delay(70).duration(400)}
        style={{
          fontSize: 22,
          fontWeight: '800',
          color: INK.title,
          textAlign: 'center',
          marginBottom: 8,
          letterSpacing: -0.4,
        }}
      >
        Registrate o iniciá sesión
      </Animated.Text>

      <Animated.Text
        entering={FadeInDown.delay(120).duration(400)}
        style={{ fontSize: 14.5, color: INK.meta, textAlign: 'center', lineHeight: 21, marginBottom: 30 }}
      >
        Tu Codex y tu Wiki personal, guardados en tu cuenta.
      </Animated.Text>

      {conectando ? (
        <MorphingInfinity size={30} color={INK.meta} style={{ marginBottom: 24 }} />
      ) : (
        <Animated.View entering={FadeInDown.delay(170).duration(400)} style={{ width: '100%' }}>
          {appleDisponible ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={14}
              style={{ width: '100%', height: 50 }}
              onPress={onApple}
            />
          ) : null}

          <Separador visible={appleDisponible} />

          <BotonPortal onPress={onPortal} />
        </Animated.View>
      )}

      {error ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={{
            marginTop: 18,
            paddingHorizontal: 14,
            paddingVertical: 11,
            borderRadius: 12,
            backgroundColor: 'rgba(220,38,38,0.08)',
            borderWidth: 1,
            borderColor: 'rgba(220,38,38,0.18)',
          }}
        >
          <Text style={{ fontSize: 12.5, color: '#B91C1C', textAlign: 'center' }}>{error}</Text>
        </Animated.View>
      ) : null}

      <Text style={{ fontSize: 11, color: INK.faint, textAlign: 'center', marginTop: 22, lineHeight: 16 }}>
        Las cuentas creadas con Apple son de uso en la app.
      </Text>
    </View>
  );
}

function Separador({ visible }) {
  if (!visible) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(28,43,34,0.09)' }} />
      <Text style={{ fontSize: 11, color: INK.faint, fontWeight: '600' }}>o</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(28,43,34,0.09)' }} />
    </View>
  );
}

function BotonPortal({ onPress }) {
  const press = useSharedValue(0);
  const estilo = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.025 }],
    opacity: interpolate(press.value, [0, 1], [1, 0.85]),
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withTiming(1, { duration: 80 });
      }}
      onPressOut={() => {
        press.value = withSpring(0, RESORTE);
      }}
    >
      <Animated.View
        style={[
          {
            height: 50,
            borderRadius: 14,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: 'rgba(28,43,34,0.09)',
            alignItems: 'center',
            justifyContent: 'center',
            ...CARD_SHADOW,
            shadowOpacity: 0.06,
          },
          estilo,
        ]}
      >
        <Text style={{ fontSize: 15, fontWeight: '700', color: INK.title }}>Entrar con Portal Web</Text>
      </Animated.View>
    </Pressable>
  );
}
