import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { ArrowUpRight, Play } from 'lucide-react-native';
import { INK, MOTION, RADIUS, SERIF } from '../theme';
import { nombreDelDia, titular } from './congreso';

// El color del Congreso en el feed: un azul institucional apagado, para que se
// lea como de otro lado que las noticias del país.
const TINTA = '#2F4A7A';
const LAVADO = 'rgba(47,74,122,0.08)';

/**
 * El noticiero legislativo: un punto para saltar a YouTube.
 *
 * No es una nota ni lleva su miniatura; es el video del día, y lo único que
 * hace falta es saber que está y poder ir a verlo.
 */
export function PinNoticiero({ item, onPress, style }) {
  const press = useSharedValue(0);
  const animado = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.value * 0.02 }], opacity: 1 - press.value * 0.25 }));
  const dia = nombreDelDia(item.digest_date);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withTiming(1, MOTION.press);
      }}
      onPressOut={() => {
        press.value = withSpring(0, MOTION.tap);
      }}
      accessibilityRole="link"
      accessibilityLabel={`Noticiero legislativo de ${dia}, en YouTube`}
      style={style}
    >
      <Animated.View
        style={[
          { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: LAVADO, borderRadius: RADIUS.md, paddingVertical: 11, paddingLeft: 11, paddingRight: 14 },
          animado,
        ]}
      >
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: TINTA, alignItems: 'center', justifyContent: 'center' }}>
          <Play size={14} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
        </View>
        <View style={{ flex: 1 }}>
          {/* El título del video repite «Noticiero Legislativo» y se corta;
              alcanza con decir qué es y de qué día. */}
          <Text style={{ fontSize: 14.5, fontWeight: '600', color: INK.title, letterSpacing: -0.1 }}>Noticiero legislativo</Text>
          <Text style={{ fontSize: 12, color: TINTA, marginTop: 1 }}>{dia.charAt(0).toUpperCase() + dia.slice(1)}</Text>
        </View>
        <ArrowUpRight size={17} color={TINTA} strokeWidth={2} />
      </Animated.View>
    </Pressable>
  );
}

/**
 * Lo que se vio en el Congreso, un título por renglón.
 *
 * No es una tarjeta y no lleva a ningún lado: es la lista de lo que pasó ese
 * día. Si el título habla de una iniciativa de ley, lleva su número arriba.
 */
export function TituloCongreso({ item, ultimo = false }) {
  return (
    <View style={{ paddingVertical: 13, borderBottomWidth: ultimo ? 0 : 1, borderBottomColor: 'rgba(28,43,34,0.09)' }}>
      {item.iniciativa_numero ? (
        <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.9, color: TINTA, marginBottom: 4 }}>
          INICIATIVA {item.iniciativa_numero}
        </Text>
      ) : null}
      <Text style={{ fontFamily: SERIF, fontSize: 19, color: INK.title, lineHeight: 24, letterSpacing: -0.2 }}>{titular(item.titulo)}</Text>
    </View>
  );
}
