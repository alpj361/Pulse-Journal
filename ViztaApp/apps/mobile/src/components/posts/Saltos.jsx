import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { BookMarked, CircleCheck, Hash, UserRound } from 'lucide-react-native';
import { RADIUS } from '../theme';
import { MONO } from '../codex/mono';
import { roce } from '../../utils/haptics';

/**
 * Las referencias entre secciones del análisis.
 *
 * Una pieza —una cifra, un hecho, una fuente, una persona— se muestra entera en
 * una sola sección. En las demás va un chip con el ícono de esa sección: al
 * tocarlo, la ficha baja hasta la pieza y la resalta un instante.
 */

const Ctx = createContext(null);

const CLASE = {
  cifras: { Icono: Hash, color: '#0F766E' },
  hechos: { Icono: CircleCheck, color: '#1C2B22' },
  apoyo: { Icono: BookMarked, color: '#6A5433' },
  quien: { Icono: UserRound, color: '#4B4FA6' },
};

/**
 * @param scroll    ref del ScrollView de la ficha
 * @param contenido ref de la vista que envuelve todo su contenido
 * @param porId     `Map` id → { clase, etiqueta } de las piezas que existen
 */
export function Saltos({ scroll, contenido, porId, children }) {
  const nodos = useRef(new Map());
  const [resaltada, setResaltada] = useState(null);

  const registrar = useCallback((id, nodo) => {
    if (nodo) nodos.current.set(id, nodo);
    else nodos.current.delete(id);
  }, []);

  const ir = useCallback(
    (id) => {
      const nodo = nodos.current.get(id);
      if (!nodo || !contenido.current) return;
      roce();
      nodo.measureLayout(
        contenido.current,
        (x, y) => {
          scroll.current?.scrollTo({ y: Math.max(0, y - 110), animated: true });
          // Se resalta de nuevo aunque sea la misma: tocar dos veces el mismo
          // chip tiene que volver a señalarla.
          setResaltada({ id, vez: Date.now() });
        },
        () => {}
      );
    },
    [scroll, contenido]
  );

  const valor = useMemo(() => ({ registrar, ir, resaltada, porId }), [registrar, ir, resaltada, porId]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/** Envuelve una pieza en su sección dueña: es a donde llegan las referencias. */
export function Pieza({ id, style, children }) {
  const ctx = useContext(Ctx);
  const luz = useSharedValue(0);
  const vez = ctx?.resaltada?.id === id ? ctx.resaltada.vez : null;

  useEffect(() => {
    if (!vez) return;
    luz.value = withSequence(withTiming(1, { duration: 180 }), withTiming(0, { duration: 1100 }));
  }, [vez, luz]);

  const animado = useAnimatedStyle(() => ({ backgroundColor: `rgba(75,79,166,${luz.value * 0.12})` }));

  return (
    <Animated.View
      ref={(n) => ctx?.registrar(id, n)}
      collapsable={false}
      style={[{ borderRadius: RADIUS.sm }, style, animado]}
    >
      {children}
    </Animated.View>
  );
}

/** La referencia a una pieza que vive en otra sección. */
export function ChipRef({ para }) {
  const ctx = useContext(Ctx);
  const pieza = ctx?.porId?.get(para);
  if (!pieza) return null;
  const { Icono, color } = CLASE[pieza.clase] || CLASE.hechos;
  return (
    <Pressable
      onPress={() => ctx.ir(para)}
      hitSlop={6}
      style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
      accessibilityRole="button"
      accessibilityLabel={`Ir a ${pieza.etiqueta}`}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: 9,
          paddingVertical: 4,
          borderRadius: RADIUS.pill,
          backgroundColor: 'rgba(28,43,34,0.05)',
        }}
      >
        <Icono size={11} color={color} strokeWidth={2} />
        <Text numberOfLines={1} style={{ fontFamily: MONO, fontSize: 11.5, color, maxWidth: 190 }}>
          {pieza.etiqueta}
        </Text>
      </View>
    </Pressable>
  );
}

/** Una fila de referencias; no se dibuja si ninguna existe. */
export function Refs({ ids, arriba = 8 }) {
  const ctx = useContext(Ctx);
  const vivos = [...new Set(ids || [])].filter((id) => ctx?.porId?.has(id));
  if (!vivos.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: arriba }}>
      {vivos.map((id) => (
        <ChipRef key={id} para={id} />
      ))}
    </View>
  );
}
