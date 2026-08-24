import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { INK, MOTION, RADIUS } from '../theme';
import { MONO } from './mono';
import { TYPE_ACCENT, normalizeTipo } from './tipos';
import { roce } from '../../utils/haptics';

/**
 * Panel de la nota — la página de la derecha.
 *
 * Dos cosas, en este orden: a quién nombraste y los datos de la nota.
 *
 * El orden no es casual. Las menciones son consecuencia de lo que escribiste —
 * aparecen solas, sin que las pidas— y por eso van arriba: es la parte que
 * informa. Los detalles son trabajo manual que casi nunca se hace, y ponerlos
 * primero convertiría el panel en un formulario.
 *
 * Acá viven los campos que antes estaban detrás del enlace «+ detalles» dentro
 * de la hoja. Se movieron enteros: tenerlos en los dos lugares habría dejado dos
 * caminos para lo mismo, y la hoja debía quedar en blanco.
 */
export default function PanelSnippet({
  items,
  onAbrirItem,
  titulo,
  tituloPlaceholder,
  onTitulo,
  fuente,
  onFuente,
  tags,
  onTags,
  fecha,
  onFecha,
  topInset = 0,
  bottomInset = 0,
}) {
  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: topInset + 66, paddingBottom: bottomInset + 40, paddingHorizontal: 30 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ fontFamily: MONO, fontSize: 11.5, color: 'rgba(28,43,34,0.3)' }}>mencionados</Text>

      {items.length === 0 ? (
        <Text style={{ fontFamily: MONO, fontSize: 12.5, color: 'rgba(28,43,34,0.28)', lineHeight: 20, marginTop: 14 }}>
          nadie todavía. Los nombres de tu Codex se reconocen solos mientras escribís.
        </Text>
      ) : (
        <Animated.View
          layout={LinearTransition.springify().damping(22)}
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}
        >
          {items.map((item) => (
            <Chip key={item.id} item={item} onPress={() => { roce(); onAbrirItem?.(item); }} />
          ))}
        </Animated.View>
      )}

      <View style={{ height: 42 }} />

      <Text style={{ fontFamily: MONO, fontSize: 11.5, color: 'rgba(28,43,34,0.3)', marginBottom: 6 }}>
        detalles
      </Text>

      <Renglon
        etiqueta="título"
        value={titulo}
        onChangeText={onTitulo}
        placeholder={tituloPlaceholder || 'la primera línea'}
      />
      <Renglon etiqueta="fuente" value={fuente} onChangeText={onFuente} placeholder="https://" autoCapitalize="none" />
      <Renglon etiqueta="etiquetas" value={tags} onChangeText={onTags} placeholder="separá con comas" />
      <Renglon etiqueta="fecha" value={fecha} onChangeText={onFecha} placeholder="AAAA-MM-DD" />
    </ScrollView>
  );
}

/**
 * Un item mencionado.
 *
 * Con foto es un círculo de perfil y el nombre al lado; sin foto, solo el
 * nombre con el color de su tipo. Los dos son el mismo chip — cambia si hay o
 * no un círculo adelante, no la forma.
 *
 * Si la imagen falla (las fotos del Congreso son URLs externas que se caen), se
 * vuelve al chip sin foto en vez de dejar un cuadro roto.
 */
function Chip({ item, onPress }) {
  const [sinFoto, setSinFoto] = useState(false);
  const press = useSharedValue(0);

  const color = TYPE_ACCENT[normalizeTipo(item?.tipo)] || '#4B4FA6';
  const foto = sinFoto ? null : imagenDe(item);

  const animado = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.04 }],
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
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${normalizeTipo(item?.tipo)}`}
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            paddingLeft: foto ? 3 : 11,
            paddingRight: 11,
            paddingVertical: foto ? 3 : 6,
            borderRadius: RADIUS.pill,
            borderWidth: 1,
            borderColor: `${color}33`,
            backgroundColor: `${color}0D`,
          },
          animado,
        ]}
      >
        {foto ? (
          <Image
            source={{ uri: foto }}
            onError={() => setSinFoto(true)}
            style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: `${color}22` }}
          />
        ) : null}
        <Text style={{ fontFamily: MONO, fontSize: 12.5, color }}>{item.name}</Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * De dónde sale la foto.
 *
 * `thumbnail_url` es la columna oficial, pero hoy solo la llenan los Posts. Los
 * ~115 diputados que sí tienen retrato lo tienen en `details.foto`, cargado por
 * el scraper del Congreso. Se miran los dos, con la columna primero.
 */
function imagenDe(item) {
  const d = item?.details || {};
  const uri = item?.thumbnail_url || d.foto || d.Foto || null;
  return typeof uri === 'string' && /^https?:\/\//.test(uri) ? uri : null;
}

/** Renglón de detalle: etiqueta a la izquierda, campo a la derecha, sin cajas. */
function Renglon({ etiqueta, ...props }) {
  const foco = useSharedValue(0);

  const linea = useAnimatedStyle(() => ({
    backgroundColor: `rgba(28,43,34,${0.07 + foco.value * 0.13})`,
  }));

  return (
    <View style={{ paddingVertical: 9 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
        <Text style={{ fontFamily: MONO, fontSize: 11.5, color: 'rgba(28,43,34,0.3)', width: 78 }}>
          {etiqueta}
        </Text>
        <TextInput
          placeholderTextColor="rgba(28,43,34,0.22)"
          onFocus={() => {
            foco.value = withTiming(1, { duration: 160 });
          }}
          onBlur={() => {
            foco.value = withSpring(0, MOTION.tap);
          }}
          style={{ flex: 1, fontFamily: MONO, fontSize: 13, color: INK.title, padding: 0 }}
          {...props}
        />
      </View>
      <Animated.View style={[{ height: 1, marginTop: 8, borderRadius: RADIUS.sm }, linea]} />
    </View>
  );
}
