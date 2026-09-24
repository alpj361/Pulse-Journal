import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MapPin, NotebookPen, X } from 'lucide-react-native';
import { INK, RADIUS, SERIF } from '../theme';
import { MONO } from '../codex/mono';
import { PAPEL } from '../codex/Papel';
import { roce } from '../../utils/haptics';

const VERDE = '#3A6049';
const AMBAR = '#B45309';

/**
 * Qué hacer con un punto del mapa.
 *
 * **Un lugar y una nota no son lo mismo, y el mapa no puede adivinar cuál
 * querés.** Marcar un punto contesta «acá», no «qué es esto»: puede ser un
 * sitio que querés guardar —con sus fotos, su dirección, lo que viste— o puede
 * ser dónde pasó algo que vas a escribir. Son dos objetos distintos que
 * comparten la coordenada, así que el paso intermedio no es fricción: es la
 * pregunta que evita guardar la cosa equivocada.
 *
 * La hoja muestra primero **qué punto es** —su nombre y su dirección cuando los
 * hay, las coordenadas cuando no— porque la decisión depende de eso: no es lo
 * mismo elegir sobre «Atte for Coffee» que sobre un cruce sin nombre.
 */
export default function AccionEnPunto({ punto, bottomInset = 0, onLugar, onNota, onClose }) {
  if (!punto) return null;

  const coordenadas = `${Number(punto.lat).toFixed(5)}, ${Number(punto.lng).toFixed(5)}`;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(20,28,22,0.4)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        <Animated.View
          entering={FadeInDown.springify().damping(19).stiffness(180)}
          style={{
            backgroundColor: PAPEL,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: bottomInset + 18,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 38,
              height: 5,
              borderRadius: 3,
              backgroundColor: 'rgba(28,43,34,0.18)',
              marginBottom: 14,
            }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: SERIF, fontSize: 26, lineHeight: 31, color: INK.title }}>
                {punto.nombre || 'Este punto'}
              </Text>
              <Text numberOfLines={1} style={{ fontFamily: MONO, fontSize: 11.5, color: INK.meta, marginTop: 4 }}>
                {punto.direccion || coordenadas}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              style={{ marginTop: 4 }}
            >
              <X size={17} color={INK.faint} />
            </Pressable>
          </View>

          <View style={{ gap: 10, marginTop: 18 }}>
            <Camino
              Icono={MapPin}
              color={AMBAR}
              titulo="Guardar el lugar"
              ayuda="Queda marcado en el mapa, con sus fotos y lo que viste ahí."
              onPress={() => {
                roce();
                onLugar(punto);
              }}
            />
            <Camino
              Icono={NotebookPen}
              color={VERDE}
              titulo="Escribir una nota acá"
              ayuda="Una nota tuya, con este punto como dónde pasó."
              onPress={() => {
                roce();
                onNota(punto);
              }}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * Cada camino con una línea de qué hace.
 *
 * La ayuda no es decorativa: «lugar» y «nota» suenan parecido hasta que se
 * explica que uno es el sitio y la otra es lo que escribiste. Es la única vez
 * que se dice; después el mapa ya los distingue solo.
 */
function Camino({ Icono, color, titulo, ayuda, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        paddingVertical: 14,
        paddingHorizontal: 15,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: 'rgba(28,43,34,0.12)',
        backgroundColor: pressed ? 'rgba(28,43,34,0.05)' : 'transparent',
      })}
    >
      <Icono size={19} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, color: INK.title }}>{titulo}</Text>
        <Text style={{ fontSize: 12.5, lineHeight: 17, color: INK.meta, marginTop: 2 }}>{ayuda}</Text>
      </View>
    </Pressable>
  );
}
