import { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { INK, GLASS, CARD_SHADOW, RIM } from '../theme';
import { MONO } from './mono';
import { PAPEL } from './Papel';
import { TYPE_ACCENT, normalizeTipo } from './tipos';
import { claveDe } from './menciones';
import { aplanar, buscar, palabraEnCursor } from './buscarCodex';
import { roce, toque } from '../../utils/haptics';

const TENUE = 'rgba(28,43,34,0.34)';

/**
 * Alto máximo del panel: cuatro filas y pico.
 *
 * El «y pico» es a propósito — una fila cortada por la mitad abajo es lo que
 * dice que hay más y que se puede desplazar. Con un corte limpio el panel
 * parece completo y nadie lo intenta.
 */
const ALTO = 190;

/**
 * Lo que se está escribiendo, buscado en vivo en el Codex.
 *
 * No es una pantalla de búsqueda: la nota sigue ahí, entera y editable, y esto
 * flota encima como flota el autocompletado de un teclado. Se escribe normal y
 * las coincidencias aparecen; se sigue escribiendo y se achican; se termina la
 * palabra y se van.
 *
 * La consulta sale del cursor, no de un campo aparte. Eso es lo que lo hace
 * autocompletado y no búsqueda: no hay que dejar de escribir para preguntar.
 *
 * Dos gestos sobre cada resultado:
 *
 *  · **toque** — completa el nombre en la nota. Es lo que uno viene a hacer:
 *    estaba escribiéndolo y el panel lo termina, con la ortografía y las tildes
 *    del Codex, que es lo que después hace que el resaltado lo reconozca.
 *  · **sostenido** — abre la ficha. Es la otra pregunta, la de «¿quién es
 *    este?», y va en el gesto secundario porque se hace mucho menos seguido.
 */
export default function AutocompletarCodex({
  indice,
  texto,
  cursor,
  onCompletar,
  onAbrirItem,
  bottomInset = 0,
}) {
  const terminos = useMemo(() => aplanar(indice), [indice]);

  const consulta = useMemo(() => palabraEnCursor(texto, cursor), [texto, cursor]);
  const resultados = useMemo(() => buscar(terminos, consulta), [terminos, consulta]);

  // Sin nada que ofrecer, el panel no existe: un recuadro vacío flotando sobre
  // la nota le comería el espacio de escribir a cambio de nada.
  if (!resultados.length) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(200).springify().damping(22)}
      exiting={FadeOut.duration(130)}
      style={[
        CARD_SHADOW,
        {
          maxHeight: ALTO,
          borderRadius: 16,
          // El papel de la nota, no un color nuevo: el panel es parte de la
          // misma hoja, solo que levantado.
          backgroundColor: PAPEL,
          overflow: 'hidden',
          boxShadow: RIM,
        },
      ]}
    >
      <BlurView intensity={GLASS.blur} tint="light" style={StyleSheet.absoluteFill} />

      {/* El sostenido es invisible: sin decirlo, nadie lo encuentra. Va una
          sola línea, arriba, y no repite lo que el toque ya hace evidente por
          sí mismo — lo que hace falta anunciar es el otro gesto. */}
      <Text
        style={{
          fontFamily: MONO,
          fontSize: 9.5,
          color: TENUE,
          paddingHorizontal: 16,
          paddingTop: 9,
          paddingBottom: 3,
          letterSpacing: 0.2,
        }}
      >
        mantené para abrir la ficha
      </Text>

      <ScrollView
        // El teclado no se baja al tocar: bajarlo movería la nota entera justo
        // cuando se está por completar o por abrir una ficha encima.
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 4 }}
      >
        {resultados.map((r) => (
          <Fila
            key={r.item.id}
            item={r.item}
            clave={r.clave}
            onPress={() => {
              roce();
              onCompletar?.(r.item);
            }}
            onLongPress={() => {
              toque();
              onAbrirItem?.(r.item);
            }}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

/**
 * Un resultado.
 *
 * El tipo va como punto de color y no escrito: la paleta ya es la que usa toda
 * la app para los tipos, y el nombre del tipo al lado de cada fila repetiría en
 * cada renglón algo que el color ya dice.
 */
function Fila({ item, clave, onPress, onLongPress }) {
  const tipo = normalizeTipo(item.tipo);
  const color = TYPE_ACCENT[tipo] || TYPE_ACCENT.Artefacto;

  // Si lo que coincidió no fue el nombre sino un alias, se muestra. Sin esto la
  // fila parece un resultado que no viene al caso — escribir «MP» y que salga
  // «Ministerio Público» se lee como un error hasta que se ve por qué.
  const porAlias = claveDe(item.name) !== clave;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: pressed ? 'rgba(28,43,34,0.05)' : 'transparent',
      })}
      accessibilityRole="button"
      accessibilityLabel={`Completar con ${item.name}`}
      accessibilityHint="Mantené presionado para abrir la ficha"
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text
        numberOfLines={1}
        style={{ flex: 1, fontFamily: MONO, fontSize: 12.5, color: INK.title }}
      >
        {item.name}
      </Text>
      {porAlias ? (
        <Text
          numberOfLines={1}
          style={{ fontFamily: MONO, fontSize: 10, color: TENUE, maxWidth: 96 }}
        >
          {clave}
        </Text>
      ) : null}
    </Pressable>
  );
}
