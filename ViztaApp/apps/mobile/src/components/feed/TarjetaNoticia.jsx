import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { INK, MOTION, SERIF } from '../theme';
import { categoriaDe, paletaDe } from './temas';
import Pegatina from './Pegatina';
import { lineaDeCard } from './encuadres';

/**
 * El ámbar del aviso.
 *
 * No es rojo a propósito: que las fuentes no coincidan es un **hallazgo**, no un
 * error. Rojo diría que algo se rompió; el ámbar dice que hay algo que mirar,
 * que es exactamente lo que pasa.
 */
const ALERTA = '#B45309';

/**
 * Una noticia del día.
 *
 * **Sin caja.** Antes cada noticia era un rectángulo con lavado de color y
 * esquinas redondeadas. Se veía prolijo, pero se leía como una app: una lista
 * de tarjetas. En las referencias editoriales no hay cajas — hay columnas
 * separadas por una línea de un pelo, y lo que ordena la página es la
 * tipografía, no los contenedores. Diez rectángulos de colores pálidos uno
 * abajo del otro además compiten entre sí: ninguno parece más importante.
 *
 * Ahora el titular va en serif, que es el gesto que más hace por que algo se
 * lea como prensa, y el color se retira casi por completo: queda solo en la
 * etiqueta del tema. La línea de abajo separa sin encerrar.
 *
 * Las entidades pasaron de globos a **enlaces subrayados**. Un globo con borde
 * pide ser tocado como un botón de acción; un nombre subrayado dentro de un
 * texto se lee como lo que es — una referencia a otra cosa.
 */
export default function TarjetaNoticia({ card, onPress, onEntidad, style }) {
  const press = useSharedValue(0);
  const categoria = categoriaDe(card);
  const p = paletaDe(categoria);

  const animado = useAnimatedStyle(() => ({
    opacity: 1 - press.value * 0.35,
  }));

  const entidades = Array.isArray(card?.entidades) ? card.entidades.filter(Boolean) : [];

  const linea = lineaDeCard(card);

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
      accessibilityLabel={card?.titulo}
      style={style}
    >
      <Animated.View style={animado}>
        <Pegatina categoria={categoria} id={card?.id} style={{ marginBottom: 13 }} />

        <Text
          style={{
            fontFamily: SERIF,
            fontSize: 23,
            color: INK.title,
            lineHeight: 28,
            letterSpacing: -0.2,
          }}
        >
          {card?.titulo}
        </Text>

        {card?.resumen ? (
          <Text numberOfLines={3} style={{ fontSize: 14, color: INK.body, lineHeight: 22, marginTop: 9 }}>
            {card.resumen}
          </Text>
        ) : null}

        {/* La capa de medios, en una línea.

            Es lo único que este análisis se gana en el feed. El feed sirve para
            barrer «qué pasó hoy», y de todo lo que trae —narrativas, encuadres
            por tweet, evidencia— lo único que cambia si te detenés a leer una
            card es que las fuentes no coincidan. El resto es material de
            lectura y vive en el detalle.

            `lineaDeCard` devuelve null cuando la historia tiene una sola casa
            editorial, y entonces la card queda **exactamente** como antes: sin
            sección vacía y sin placeholder. Una card que muestra el hueco donde
            iría el análisis se lee como que algo falló, cuando lo que pasa es
            que con una fuente no había nada que contrastar. */}
        {linea ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 11 }}>
            {/* El punto solo aparece cuando hay conflicto. Ponerlo siempre lo
                volvería decoración y dejaría de avisar nada. */}
            {linea.alerta ? (
              <View
                style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: ALERTA }}
              />
            ) : null}
            <Text
              numberOfLines={1}
              style={{
                fontSize: 11.5,
                color: linea.alerta ? ALERTA : 'rgba(28,43,34,0.38)',
                letterSpacing: -0.1,
                flex: 1,
              }}
            >
              {linea.texto}
            </Text>
          </View>
        ) : null}

        {entidades.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
            {entidades.slice(0, 3).map((e, i) => (
              <Pressable
                key={i}
                onPress={(ev) => {
                  // Sin esto, tocar una entidad abre su ficha Y la noticia detrás.
                  ev.stopPropagation();
                  onEntidad?.(e);
                }}
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, marginRight: 14 })}
              >
                <Text
                  style={{
                    fontSize: 12.5,
                    color: p.tinta,
                    textDecorationLine: 'underline',
                    textDecorationColor: `${p.tinta}55`,
                  }}
                >
                  {e}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Separa sin encerrar. */}
        <View style={{ height: 1, backgroundColor: 'rgba(28,43,34,0.09)', marginTop: 20 }} />
      </Animated.View>
    </Pressable>
  );
}
