import { useMemo } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { INK } from '../theme';
import { normalizeTipo, TYPE_ACCENT } from './tipos';

/**
 * El Codex completo como lista de palabras.
 *
 * Tipografía grande, orden alfabético, y el foco marcado por contraste en vez de
 * por un recuadro: lo que está cerca de la línea de lectura se oscurece y lo
 * lejano se apaga. Es una lista, no una rueda — no engancha ni imanta, solo
 * resalta dónde está el ojo.
 *
 * Virtualizada desde el principio: acá entran los ~1.800 elementos del universo,
 * y con altura de fila fija se puede dar `getItemLayout` para que el salto sea
 * inmediato en vez de medir mil filas.
 */

const ALTO = 46;

export default function WordSelector({ items, onOpenItem, topPad = 0, bottomPad = 0 }) {
  const { height: H } = useWindowDimensions();
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const ordenados = useMemo(
    () =>
      [...items].sort((a, b) =>
        (a.name || a.titulo || '').localeCompare(b.name || b.titulo || '', 'es', { sensitivity: 'base' })
      ),
    [items]
  );

  // La línea de lectura no va al centro exacto: un poco arriba se siente más
  // natural, porque el pulgar y la mano tapan la mitad inferior.
  const foco = H * 0.34;

  if (!ordenados.length) {
    return (
      <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 48 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: INK.title, marginBottom: 6, textAlign: 'center' }}>
          Tu Codex está vacío
        </Text>
        <Text style={{ fontSize: 13, color: INK.meta, textAlign: 'center', lineHeight: 19 }}>
          Los actores, entidades y territorios que guardes aparecerán acá.
        </Text>
      </View>
    );
  }

  return (
    <Animated.FlatList
      data={ordenados}
      keyExtractor={(it) => it.id}
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      getItemLayout={(_, i) => ({ length: ALTO, offset: ALTO * i, index: i })}
      initialNumToRender={16}
      maxToRenderPerBatch={16}
      windowSize={11}
      removeClippedSubviews
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad + H * 0.5 }}
      renderItem={({ item, index }) => (
        <Palabra item={item} index={index} scrollY={scrollY} foco={foco} topPad={topPad} onPress={() => onOpenItem?.(item)} />
      )}
    />
  );
}

function Palabra({ item, index, scrollY, foco, topPad, onPress }) {
  const tipo = normalizeTipo(item.tipo || item.subcategory);
  const accent = TYPE_ACCENT[tipo] || INK.meta;

  const estilo = useAnimatedStyle(() => {
    // Posición de esta fila en la pantalla, ya descontado el scroll.
    const y = topPad + index * ALTO + ALTO / 2 - scrollY.value;
    const d = Math.abs(y - foco);

    const cerca = interpolate(d, [0, ALTO * 2.6], [1, 0], Extrapolation.CLAMP);
    return {
      color: interpolateColor(cerca, [0, 1], ['rgba(138,150,141,0.55)', INK.title]),
      transform: [{ translateX: interpolate(cerca, [0, 1], [0, 4], Extrapolation.CLAMP) }],
    };
  });

  const punto = useAnimatedStyle(() => {
    const y = topPad + index * ALTO + ALTO / 2 - scrollY.value;
    const cerca = interpolate(Math.abs(y - foco), [0, ALTO * 2.6], [1, 0], Extrapolation.CLAMP);
    return { opacity: cerca };
  });

  return (
    <Pressable onPress={onPress} style={{ height: ALTO, justifyContent: 'center', paddingHorizontal: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        {/* El punto del tipo solo aparece cerca del foco: con 1.800 filas, una
            columna de puntos de colores a lo largo de todo el scroll es ruido. */}
        <Animated.View
          style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }, punto]}
        />
        <Animated.Text
          numberOfLines={1}
          style={[{ flex: 1, fontSize: 25, fontWeight: '700', letterSpacing: -0.7 }, estilo]}
        >
          {item.name || item.titulo || 'Sin nombre'}
        </Animated.Text>
      </View>
    </Pressable>
  );
}
