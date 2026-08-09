import { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SquarePen, Plus } from 'lucide-react-native';
import { INK, MOTION, RADIUS } from '../theme';
import MorphingInfinity from '../MorphingInfinity';
import GlassButton from '../GlassButton';
import SegmentedSlider from '../SegmentedSlider';
import { roce } from '../../utils/haptics';
import SpaceCarousel from './SpaceCarousel';
import WordSelector from './WordSelector';
import { normalizeTipo, TYPE_ACCENT, TYPE_ORDER } from './tipos';

const ORDERS = [
  { id: 'recent', label: 'Recientes' },
  { id: 'az', label: 'A–Z' },
];

/**
 * Nivel 1 del Codex. Dos formas de mirar lo mismo, deliberadamente distintas:
 *
 *  · Espacios — coverflow de carátulas. Son pocos, tienen identidad propia y se
 *    eligen por reconocimiento visual, así que se muestran como objetos.
 *  · Todo — el universo entero como lista alfabética de palabras. Son miles y no
 *    tienen carátula; lo que sirve ahí es recorrer nombres rápido.
 *
 * La pila de pills que había antes trataba los dos casos igual, y ninguno de los
 * dos quedaba bien servido: para los espacios era poca cosa, y para dos mil
 * elementos era un scroll interminable de tarjetas gruesas.
 */
export default function SpacesStack({
  spaces = [],
  universeItems = [],
  loading,
  mode,
  onModeChange,
  onOpenSpace,
  onOpenItem,
  onNewItem,
  onNewSpace,
  headerExtra,
}) {
  const [order, setOrder] = useState('recent');

  const espaciosOrdenados = useMemo(() => {
    const fn =
      order === 'az'
        ? (a, b) => (a.name || '').localeCompare(b.name || '', 'es')
        : (a, b) => new Date(b.updatedAt || b.created_at || 0) - new Date(a.updatedAt || a.created_at || 0);
    return [...spaces].sort(fn);
  }, [spaces, order]);

  const enEspacios = mode === 'espacios';

  return (
    <View style={{ flex: 1 }}>
      {headerExtra}

      <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <SegmentedSlider
              valor={mode}
              onChange={onModeChange}
              tabs={[
                { id: 'espacios', label: 'Espacios', accent: 'rgba(21,128,61,0.14)', ink: '#15803D' },
                { id: 'todo', label: 'Todo', accent: 'rgba(75,79,166,0.14)', ink: '#4B4FA6' },
              ]}
            />
          </View>

          {enEspacios ? (
            <GlassButton Icon={Plus} iconSize={19} radius={21} onPress={onNewSpace} />
          ) : null}
          <GlassButton Icon={SquarePen} iconSize={18} radius={21} onPress={onNewItem} />
        </View>

        {/* El orden solo aplica a los espacios: «Todo» es alfabético por
            definición, y un selector que no cambia nada es un control muerto. */}
        {enEspacios ? (
          <Animated.View entering={FadeIn.duration(200)} style={{ flexDirection: 'row', gap: 6 }}>
            {ORDERS.map((o) => (
              <ChipOrden
                key={o.id}
                label={o.label}
                activo={order === o.id}
                onPress={() => {
                  roce();
                  setOrder(o.id);
                }}
              />
            ))}
          </Animated.View>
        ) : null}
      </View>

      {/* Cargando: el cromo ya está arriba y solo falta el contenido.
          Antes esto reemplazaba la pantalla entera por una ruedita centrada, y
          durante los diez segundos que tarda traer mil doscientos elementos no
          había ni título ni pestañas — parecía que la app no había arrancado. Así
          la página existe desde el primer frame y lo único pendiente se ve
          pendiente. */}
      {loading ? (
        <Animated.View
          entering={FadeIn.duration(240)}
          style={{ flex: 1, alignItems: 'center', paddingTop: 70 }}
        >
          <MorphingInfinity size={58} color={INK.body} />
          <Text style={{ fontSize: 13, color: INK.faint, marginTop: 18 }}>
            {enEspacios ? 'Trayendo tus espacios' : 'Trayendo el Codex'}
          </Text>
        </Animated.View>
      ) : enEspacios ? (
        <SpaceCarousel spaces={espaciosOrdenados} onOpenSpace={onOpenSpace} onNewSpace={onNewSpace} />
      ) : (
        <WordSelector items={universeItems} onOpenItem={onOpenItem} topPad={8} bottomPad={40} />
      )}
    </View>
  );
}

/** Chip de orden. Antes no respondía al tacto; ahora se hunde como todo lo demás. */
function ChipOrden({ label, activo, onPress }) {
  const press = useSharedValue(0);
  const estilo = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.05 }],
    opacity: interpolate(press.value, [0, 1], [1, 0.7]),
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
    >
      <Animated.View
        style={[
          {
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: RADIUS.pill,
            borderWidth: 1,
            borderColor: activo ? 'transparent' : 'rgba(28,43,34,0.09)',
            backgroundColor: activo ? 'rgba(28,43,34,0.06)' : 'transparent',
          },
          estilo,
        ]}
      >
        <Text style={{ fontSize: 11.5, fontWeight: activo ? '700' : '600', color: activo ? INK.title : INK.meta }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// Reexportado por compatibilidad: SpaceView, FreeCanvas, StructuredView,
// y otros ya importan la taxonomía desde acá.
export { normalizeTipo, TYPE_ACCENT, TYPE_ORDER };
