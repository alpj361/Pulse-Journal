import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Image as Foto } from 'expo-image';
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
import usePortada from '../../utils/portada';

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
  /**
   * Los nombres que la nota no sabe si son ellos («Vamos» ¿el partido?).
   * Van aparte y apagados; tocarlos pregunta.
   */
  porConfirmar = [],
  onDecidir,
  titulo,
  tituloPlaceholder,
  onTitulo,
  fuente,
  onFuente,
  tags,
  onTags,
  fecha,
  onFecha,
  /** Dónde pasó, y cómo cambiarlo. Ver `OpcionesUbicacion` en la hoja. */
  ubicacion = null,
  onUbicacion,
  /**
   * Reemplaza la mitad de abajo —los detalles del snippet— dejando intacta la
   * de arriba.
   *
   * En modo chat ahí van las instrucciones de Vizta, pero los **mencionados**
   * se quedan: nombrar a un actor es nombrarlo se esté escribiendo una nota o
   * preguntándole algo, así que esa mitad no depende del modo. Sustituir el
   * panel entero, como estaba, borraba los items de la conversación.
   */
  detalles = null,
  /**
   * Las fotos de la nota.
   *
   * Van **debajo de detalles y no en su lugar**: son de la nota igual que el
   * título o la fuente, y en la hoja ya se ven junto al texto. Acá el panel
   * hace lo que hace con todo lo demás — mostrarlo junto, fuera del camino de
   * la escritura.
   */
  fotos = [],
  onVerFoto,
  /** Lo que va antes de los mencionados: la tabla de una historia datasheet. */
  arriba = null,
  topInset = 0,
  bottomInset = 0,
}) {
  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: topInset + 66, paddingBottom: bottomInset + 40, paddingHorizontal: 30 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {arriba}
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

      {porConfirmar.length ? (
        <Animated.View layout={LinearTransition.springify().damping(22)} style={{ marginTop: 22 }}>
          <Text style={{ fontFamily: MONO, fontSize: 11.5, color: 'rgba(28,43,34,0.3)' }}>¿son ellos?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {porConfirmar.map((m) => (
              <Pressable
                key={m.firma}
                onPress={() => onDecidir?.(m)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999,
                  borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(28,43,34,0.22)',
                  opacity: pressed ? 0.5 : 1,
                })}
                accessibilityRole="button"
                accessibilityLabel={`¿${m.escrito} es ${m.candidatos[0]?.name}?`}
              >
                <View
                  style={{
                    width: 6, height: 6, borderRadius: 3,
                    backgroundColor: TYPE_ACCENT[normalizeTipo(m.candidatos[0]?.tipo)] || TYPE_ACCENT.Artefacto,
                    opacity: 0.6,
                  }}
                />
                <Text numberOfLines={1} style={{ fontFamily: MONO, fontSize: 12, color: 'rgba(28,43,34,0.6)', maxWidth: 180 }}>
                  {m.escrito}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      ) : null}

      <View style={{ height: 42 }} />

      {detalles || (
        <>
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

          {/* El lugar no se escribe: se busca.
            *
            * Es el único detalle que no es texto libre — una dirección tecleada
            * a mano no tiene coordenadas, y sin coordenadas la nota no puede
            * aparecer en el mapa, que es para lo que sirve tener un lugar. Por
            * eso el renglón es un botón que abre el buscador de Apple. */}
          {onUbicacion ? (
            <Pressable
              onPress={() => {
                roce();
                onUbicacion();
              }}
              accessibilityRole="button"
              accessibilityLabel={ubicacion ? 'Cambiar dónde pasó' : 'Poner dónde pasó'}
              style={{ paddingVertical: 9 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                <Text style={{ fontFamily: MONO, fontSize: 11.5, color: 'rgba(28,43,34,0.3)', width: 78 }}>
                  lugar
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    fontFamily: MONO,
                    fontSize: 13,
                    color: ubicacion ? INK.title : 'rgba(28,43,34,0.22)',
                  }}
                >
                  {ubicacion
                    ? ubicacion.nombre ||
                      ubicacion.direccion ||
                      `${Number(ubicacion.lat).toFixed(4)}, ${Number(ubicacion.lng).toFixed(4)}`
                    : 'buscá dónde pasó'}
                </Text>
              </View>
              <View
                style={{
                  height: 1,
                  marginTop: 8,
                  borderRadius: RADIUS.sm,
                  backgroundColor: 'rgba(28,43,34,0.07)',
                }}
              />
            </Pressable>
          ) : null}

          {/* Media. Aparece solo si hay algo: un rótulo «media» sobre un hueco
              vacío anuncia una función que no se está usando, en un panel que
              ya es una columna angosta. */}
          {fotos.length ? (
            <View style={{ marginTop: 34 }}>
              <Text style={{ fontFamily: MONO, fontSize: 11.5, color: 'rgba(28,43,34,0.3)', marginBottom: 14 }}>
                media
              </Text>

              <Animated.View
                layout={LinearTransition.springify().damping(22)}
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}
              >
                {fotos.map((f) => (
                  <Pressable
                    key={f.id}
                    onPress={() => {
                      if (f.subiendo) return;
                      roce();
                      onVerFoto?.(f);
                    }}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    accessibilityRole="button"
                    accessibilityLabel="Ver la foto"
                  >
                    <Foto
                      source={{ uri: f.url || f.local }}
                      style={{
                        width: 62,
                        height: 62,
                        borderRadius: 10,
                        backgroundColor: 'rgba(28,43,34,0.06)',
                      }}
                      contentFit="cover"
                      transition={140}
                    />
                  </Pressable>
                ))}
              </Animated.View>

              {/* Cuántas hay. El panel es la vista de conjunto de la nota, y
                  con seis miniaturas de 62 px contarlas a ojo cuesta. */}
              <Text style={{ fontFamily: MONO, fontSize: 10.5, color: 'rgba(28,43,34,0.28)', marginTop: 12 }}>
                {fotos.length === 1 ? '1 foto' : `${fotos.length} fotos`}
              </Text>
            </View>
          ) : null}
        </>
      )}
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
  // Una nota tiene su portada privada y hay que firmarla; un retrato del
  // Congreso o un post, un enlace público. `usePortada` resuelve los dos.
  const portada = usePortada(item);
  const foto = sinFoto ? null : portada;

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
