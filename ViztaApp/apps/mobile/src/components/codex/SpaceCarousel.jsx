import { useCallback, useRef, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Carousel from 'react-native-reanimated-carousel';
import Animated, {
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Layers, Plus } from 'lucide-react-native';
import { CARD_SHADOW, INK, MOTION, RADIUS } from '../theme';
import { roce, toque } from '../../utils/haptics';
import PortadaEspacio from './PortadaEspacio';

/**
 * Los espacios como coverflow.
 *
 * Cada tarjeta lleva su propio `perspective` en el transform. En CSS bastaría
 * poner la perspectiva en el contenedor con `transformStyle: preserve-3d`, que
 * RN no tiene — pero para un coverflow no hace falta un contexto 3D compartido:
 * cada carátula es hermana de las otras y se inclina sobre su propio eje. El
 * punto de fuga queda por tarjeta en vez de compartido, y a la vista no se
 * distingue.
 *
 * El nombre va DEBAJO del carrusel, no encima de la carátula: así la portada se
 * ve entera y el título se lee sobre fondo limpio.
 */

const PASO_REL = 0.56; // cuánto avanza cada tarjeta respecto a su ancho: solape

export default function SpaceCarousel({ spaces, onOpenSpace, onNewSpace }) {
  const { width: W } = useWindowDimensions();
  const carrusel = useRef(null);
  const [activo, setActivo] = useState(0);

  const CARTA = Math.min(232, Math.round(W * 0.56));
  const PASO = Math.round(CARTA * PASO_REL);

  const abrir = useCallback(
    (index, item) => {
      if (index !== activo) {
        // Tocar una carátula lateral la trae al centro; abrir algo que no está
        // enfocado sería abrir a ciegas.
        roce();
        carrusel.current?.scrollTo({ index, animated: true });
        return;
      }
      toque();
      onOpenSpace?.(item, null);
    },
    [activo, onOpenSpace]
  );

  if (!spaces.length) {
    return (
      <View style={{ alignItems: 'center', paddingTop: 50, paddingHorizontal: 48 }}>
        <View
          style={{
            width: 64, height: 64, borderRadius: 22, marginBottom: 16,
            backgroundColor: 'rgba(28,43,34,0.05)', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Layers size={26} color={INK.meta} />
        </View>
        <Text style={{ fontSize: 15, fontWeight: '700', color: INK.title, marginBottom: 6, textAlign: 'center' }}>
          Todavía no tienes espacios
        </Text>
        <Text style={{ fontSize: 13, color: INK.meta, textAlign: 'center', lineHeight: 19 }}>
          Un espacio agrupa los actores y documentos de una investigación.
        </Text>
        <Pressable
          onPress={onNewSpace}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18,
            paddingHorizontal: 18, paddingVertical: 12, borderRadius: RADIUS.md,
            backgroundColor: '#1C2B22',
          }}
        >
          <Plus size={15} color="#FFFFFF" />
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: '#FFFFFF' }}>Crear espacio</Text>
        </Pressable>
      </View>
    );
  }

  const actual = spaces[activo];
  const cuenta = actual?.itemIds?.length || 0;

  return (
    <View style={{ flex: 1 }}>
      <Carousel
        ref={carrusel}
        data={spaces}
        // Ancho de pantalla, no del paso: el slot activo queda centrado y el
        // solape lo produce `translateX` en customAnimation. Con width={PASO} el
        // slot era angosto y la carátula enfocada se cortaba contra el borde.
        width={W}
        height={CARTA + 40}
        style={{ width: W, height: CARTA + 40 }}
        loop={spaces.length > 2}
        defaultIndex={0}
        onSnapToItem={(i) => {
          setActivo(i);
          roce();
        }}
        // `value` llega como posición relativa al centro: 0 es la enfocada,
        // -1 la de la izquierda, 1 la de la derecha.
        customAnimation={(value) => {
          'worklet';
          const dist = Math.abs(value);
          const lado = value < 0 ? -1 : 1;
          // La inclinación se frena con la distancia (raíz en vez de lineal):
          // con rampa lineal la segunda carátula queda casi de canto.
          const rampa = Math.min(Math.sqrt(dist), 2);
          const giro = Math.min(rampa * 46, 74) * -lado;

          return {
            transform: [
              { perspective: CARTA * 3.4 },
              { translateX: value * PASO },
              { scale: Math.max(0.62, 1 - rampa * 0.17) },
              { rotateY: `${giro}deg` },
            ],
            opacity: Math.max(0, 1 - dist * 0.26),
            zIndex: Math.round(200 - dist * 20),
          };
        }}
        renderItem={({ item, index }) => (
          <Carta
            space={item}
            lado={CARTA}
            enfocada={index === activo}
            onPress={() => abrir(index, item)}
          />
        )}
      />

      {/* Rótulo del enfocado. Se remonta con la key para que cruce al cambiar.
          También abre el espacio: está fuera del carrusel, así que no compite con
          ningún gesto, y da un blanco grande para el pulgar. */}
      <Pressable
        onPress={() => {
          if (!actual) return;
          toque();
          onOpenSpace?.(actual, null);
        }}
        style={{ alignItems: 'center', paddingHorizontal: 32, marginTop: 6, paddingVertical: 6 }}
      >
        <Animated.View key={actual?.id} entering={FadeIn.duration(240)} style={{ alignItems: 'center' }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 19, fontWeight: '800', color: INK.title, letterSpacing: -0.4 }}
          >
            {actual?.name}
          </Text>
          <Text style={{ fontSize: 12.5, color: INK.meta, marginTop: 3 }}>
            {cuenta > 0 ? `${cuenta} ${cuenta === 1 ? 'elemento' : 'elementos'}` : 'Vacío'}
            {spaces.length > 1 ? `  ·  ${activo + 1} de ${spaces.length}` : ''}
          </Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

/**
 * Carátula. Se hunde al presionar; solo la enfocada lleva sombra plena.
 *
 * El toque va con `Gesture.Tap` de gesture-handler y no con el `Pressable` de
 * React Native. El carrusel envuelve todo en un PanGestureHandler, y el sistema
 * de responders de RN pierde contra él: el dedo se registraba como el comienzo
 * de un arrastre y el toque nunca llegaba. Dos gestos de gesture-handler sí
 * negocian entre ellos — el tap falla solo si el dedo se mueve, y ahí el pan
 * toma el control, que es exactamente lo que se quiere.
 */
function Carta({ space, lado, enfocada, onPress }) {
  const press = useSharedValue(0);

  const estilo = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.04 }],
  }));

  const tap = Gesture.Tap()
    .maxDuration(500)
    .maxDistance(14)
    .onBegin(() => {
      press.value = withTiming(1, MOTION.press);
    })
    .onFinalize(() => {
      press.value = withSpring(0, MOTION.tap);
    })
    .onEnd((_e, ok) => {
      if (ok) runOnJS(onPress)();
    });

  return (
    <GestureDetector gesture={tap}>
      <View
        accessibilityRole="button"
        accessibilityLabel={space?.name}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
      <Animated.View
        style={[
          CARD_SHADOW,
          {
            width: lado,
            height: lado,
            borderRadius: RADIUS.xl,
            shadowOpacity: enfocada ? 0.24 : 0.12,
            shadowRadius: enfocada ? 26 : 14,
          },
          estilo,
        ]}
      >
        <PortadaEspacio
          space={space}
          radius={RADIUS.xl}
          lado={lado}
          style={{ width: lado, height: lado }}
        />
      </Animated.View>
      </View>
    </GestureDetector>
  );
}
