import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  interpolateColor,
  FadeInDown,
  FadeIn,
  LinearTransition,
} from 'react-native-reanimated';
import { Check, Plus, Type, Trash2, X } from 'lucide-react-native';
import { INK, CARD_SHADOW } from '../theme';
import { TYPE_ACCENT } from './SpacesStack';

const RESORTE = { damping: 20, stiffness: 240, mass: 0.5 };
const CERRADO = 3;

/**
 * Tarjeta del documento.
 *
 * Todo lo tocable responde: hunde al presionar, se levanta y gana un aro del
 * color de su tipo al quedar seleccionada, y entra escalonada según su posición
 * en la pila. El movimiento no es decorativo — es lo que dice si el dedo
 * registró, cosa que en una pila de tarjetas montadas no es obvio.
 */
function ItemCard({ item, index, accent, seleccionada, modoSeleccion, onPress, onLongPress, offsetLateral }) {
  const press = useSharedValue(0);
  const sel = useSharedValue(seleccionada ? 1 : 0);

  useEffect(() => {
    sel.value = withSpring(seleccionada ? 1 : 0, RESORTE);
  }, [seleccionada]);

  const tarjeta = useAnimatedStyle(() => {
    const escala = 1 - press.value * 0.03 + sel.value * 0.015;
    return {
      transform: [{ scale: escala }, { translateY: -sel.value * 3 }],
      borderColor: interpolateColor(sel.value, [0, 1], ['rgba(28,43,34,0.06)', accent]),
      borderWidth: interpolate(sel.value, [0, 1], [1, 1.5]),
      shadowOpacity: interpolate(press.value, [0, 1], [0.07, 0.03]) + sel.value * 0.06,
    };
  });

  const marca = useAnimatedStyle(() => ({
    opacity: sel.value,
    transform: [{ scale: interpolate(sel.value, [0, 1], [0.4, 1]) }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 45).duration(340).springify().damping(18)}
      layout={LinearTransition.springify().damping(20)}
    >
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={280}
        onPressIn={() => {
          press.value = withTiming(1, { duration: 90 });
        }}
        onPressOut={() => {
          press.value = withSpring(0, RESORTE);
        }}
      >
        <Animated.View
          style={[
            {
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              paddingVertical: 14,
              paddingHorizontal: 16,
              marginTop: index === 0 ? 0 : -6,
              marginHorizontal: offsetLateral,
              zIndex: 40 - index,
              shadowColor: '#25332A',
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 4,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 11,
            },
            tarjeta,
          ]}
        >
          {modoSeleccion ? (
            <Animated.View
              entering={FadeIn.duration(180)}
              style={{
                width: 21,
                height: 21,
                borderRadius: 11,
                borderWidth: seleccionada ? 0 : 1.5,
                borderColor: 'rgba(28,43,34,0.18)',
                backgroundColor: seleccionada ? accent : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 1,
              }}
            >
              <Animated.View style={marca}>
                <Check size={12} color="#FFFFFF" strokeWidth={3} />
              </Animated.View>
            </Animated.View>
          ) : null}

          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={{ fontSize: 14.5, fontWeight: '700', color: INK.title, lineHeight: 20 }}>
              {item.name || item.titulo}
            </Text>
            {item.description || item.descripcion ? (
              <Text numberOfLines={2} style={{ fontSize: 12.5, color: INK.body, lineHeight: 18, marginTop: 4 }}>
                {item.description || item.descripcion}
              </Text>
            ) : null}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** Bloque de texto libre. También responde al tacto. */
function NotaBloque({ nota, index, onPress }) {
  const press = useSharedValue(0);
  const estilo = useAnimatedStyle(() => ({
    opacity: interpolate(press.value, [0, 1], [1, 0.55]),
    transform: [{ scale: 1 - press.value * 0.008 }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(320)} layout={LinearTransition.springify()}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          press.value = withTiming(1, { duration: 90 });
        }}
        onPressOut={() => {
          press.value = withSpring(0, RESORTE);
        }}
      >
        <Animated.View style={[{ marginBottom: 18 }, estilo]}>
          <Text style={{ fontSize: 15.5, color: INK.title, lineHeight: 24 }}>{nota.content}</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Vista estructurada — el espacio como documento.
 *
 * El texto va suelto y los elementos apilados por tipo. Mantener presionada una
 * tarjeta entra en selección; de ahí se pueden quitar varias de una vez.
 */
export default function StructuredView({
  grupos,
  notas,
  busqueda = '',
  topInset,
  bottomInset,
  onOpenItem,
  onEditNote,
  onNuevaNota,
  onAddItems,
  onQuitarItems,
}) {
  const [abiertos, setAbiertos] = useState({});
  const [seleccion, setSeleccion] = useState(new Set());
  const [modoSeleccion, setModoSeleccion] = useState(false);

  const alternar = (id) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setModoSeleccion(false);
      return next;
    });
  };

  const salir = () => {
    setSeleccion(new Set());
    setModoSeleccion(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topInset + 80,
          paddingHorizontal: 22,
          paddingBottom: bottomInset + (modoSeleccion ? 110 : 40),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Al buscar por nombre las notas se ocultan: no tienen nombre y solo
            harían ruido entre los resultados. */}
        {!busqueda
          ? notas.map((n, i) => (
              <NotaBloque key={n.id} nota={n} index={i} onPress={() => onEditNote?.(n)} />
            ))
          : null}

        {grupos.map((sec) => {
          const accent = TYPE_ACCENT[sec.tipo] || INK.meta;
          const abierto = abiertos[sec.tipo];
          const visibles = abierto ? sec.data : sec.data.slice(0, CERRADO);
          const restantes = sec.data.length - visibles.length;

          return (
            <View key={sec.tipo} style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: accent, letterSpacing: 0.7 }}>
                  {sec.tipo.toUpperCase()}
                </Text>
                <Text style={{ fontSize: 11, color: INK.faint, fontWeight: '600' }}>{sec.data.length}</Text>
              </View>

              {visibles.map((it, i) => (
                <ItemCard
                  key={it.id}
                  item={it}
                  index={i}
                  accent={accent}
                  seleccionada={seleccion.has(it.id)}
                  modoSeleccion={modoSeleccion}
                  offsetLateral={abierto || modoSeleccion ? 0 : Math.min(i, 2) * 5}
                  onPress={() => (modoSeleccion ? alternar(it.id) : onOpenItem?.(it))}
                  onLongPress={() => {
                    setModoSeleccion(true);
                    alternar(it.id);
                  }}
                />
              ))}

              {sec.data.length > CERRADO ? (
                <TouchableOpacity
                  onPress={() => setAbiertos((p) => ({ ...p, [sec.tipo]: !p[sec.tipo] }))}
                  activeOpacity={0.7}
                  style={{ paddingTop: 12, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: INK.meta }}>
                    {abierto ? 'Apilar' : `Ver ${restantes} más`}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}

        {grupos.length === 0 && (busqueda || notas.length === 0) ? (
          <View style={{ alignItems: 'center', paddingTop: 40, paddingHorizontal: 30 }}>
            <Text style={{ fontSize: 14, color: INK.meta, textAlign: 'center', lineHeight: 20 }}>
              {busqueda
                ? `Ningún elemento se llama «${busqueda}».`
                : 'Espacio en blanco. Escribí una nota o agregá elementos.'}
            </Text>
          </View>
        ) : null}

        {!modoSeleccion && !busqueda ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <AccionPie Icon={Type} label="Escribir" onPress={onNuevaNota} />
            <AccionPie Icon={Plus} label="Elemento" onPress={onAddItems} />
          </View>
        ) : null}
      </ScrollView>

      {/* Barra de selección */}
      {modoSeleccion ? (
        <Animated.View
          entering={FadeInDown.duration(220).springify().damping(18)}
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: bottomInset + 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#1C2B22',
            borderRadius: 18,
            paddingVertical: 12,
            paddingHorizontal: 14,
            ...CARD_SHADOW,
            shadowOpacity: 0.24,
          }}
        >
          <TouchableOpacity onPress={salir} hitSlop={8} style={{ padding: 4 }}>
            <X size={17} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: '#FFFFFF' }}>
            {seleccion.size} {seleccion.size === 1 ? 'seleccionado' : 'seleccionados'}
          </Text>
          <TouchableOpacity
            onPress={() => {
              onQuitarItems?.([...seleccion]);
              salir();
            }}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.12)',
            }}
          >
            <Trash2 size={14} color="#FFFFFF" />
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#FFFFFF' }}>Quitar</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : null}
    </View>
  );
}

function AccionPie({ Icon, label, onPress }) {
  const press = useSharedValue(0);
  const estilo = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.035 }],
    opacity: interpolate(press.value, [0, 1], [1, 0.75]),
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        press.value = withSpring(0, RESORTE);
      }}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            paddingVertical: 14,
            borderRadius: 14,
            backgroundColor: 'rgba(28,43,34,0.05)',
          },
          estilo,
        ]}
      >
        <Icon size={15} color={INK.title} />
        <Text style={{ fontSize: 13, fontWeight: '700', color: INK.title }}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}
