import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { INK, MOTION } from '../theme';
import { PAPEL, PAPEL_DORSO, PildoraTipo } from './Papel';
import { toque } from '../../utils/haptics';

/**
 * Elegir qué se agrega.
 *
 * Tres objetos inclinados y superpuestos, cada uno con su etiqueta de tinta
 * encima, y el rótulo grande y claro abajo. La idea es que la elección se haga
 * mirando formas, no leyendo una lista: cada opción tiene un objeto propio y se
 * reconoce por su silueta antes que por su nombre.
 *
 * Los tres cubos, que son los que pidió el usuario:
 *  · snippet — una nota escrita a mano, sin campos que llenar
 *  · media   — un documento o archivo
 *  · item    — un actor, entidad, territorio… lo que lleva ficha con campos
 */

const OBJETO = 104;

export default function AgregarSheet({ onClose, onElegir, bottomInset = 0 }) {
  const elegir = (cual) => {
    toque();
    onElegir?.(cual);
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(180)} style={StyleSheet.absoluteFill}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,28,22,0.28)' }]} onPress={onClose} />
      </Animated.View>

      <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
        <Animated.View
          entering={FadeInDown.duration(320).springify().damping(20)}
          style={{
            backgroundColor: PAPEL,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            paddingBottom: bottomInset + 20,
            overflow: 'hidden',
          }}
        >
          {/* La mesa se apaga hacia abajo, como en la referencia: los objetos
              quedan flotando sobre luz y el rótulo cae en la sombra. */}
          <LinearGradient
            colors={['#FFFDF8', '#FFFDF8', '#EFEEE7']}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />

          <View style={{ alignItems: 'center', paddingTop: 12 }}>
            <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(28,43,34,0.13)' }} />
          </View>

          {/* Los objetos. Se montan con retardo escalonado y cada uno cae en su
              propio ángulo. El solape es a propósito: son cosas sobre una mesa,
              no celdas de una grilla. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingTop: 46,
              paddingBottom: 8,
            }}
          >
            <Objeto
              indice={0}
              rotacion={-7}
              etiqueta="Snippet"
              rotEtiqueta={-9}
              onPress={() => elegir('snippet')}
            >
              <PilaDePapel />
            </Objeto>

            <Objeto
              indice={1}
              rotacion={3}
              etiqueta="Media"
              rotEtiqueta={-3}
              offset={-20}
              onPress={() => elegir('media')}
            >
              <BlobMedia />
            </Objeto>

            <Objeto
              indice={2}
              rotacion={-3}
              etiqueta="Item"
              rotEtiqueta={4}
              offset={-22}
              onPress={() => elegir('item')}
            >
              <AnilloItem />
            </Objeto>
          </View>

          <Animated.Text
            entering={FadeInDown.delay(180).duration(320)}
            style={{
              fontSize: 30,
              fontWeight: '700',
              color: 'rgba(28,43,34,0.26)',
              textAlign: 'center',
              letterSpacing: -0.6,
              marginTop: 10,
              marginBottom: 6,
            }}
          >
            Añadir
          </Animated.Text>

          <Text
            style={{
              fontSize: 12.5,
              color: INK.faint,
              textAlign: 'center',
              paddingHorizontal: 44,
              lineHeight: 18,
            }}
          >
            Un snippet se escribe. Un media es un documento. Un item lleva ficha con campos.
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * Aviso mientras sube el archivo.
 *
 * No se puede cerrar a propósito: la subida ya empezó y cancelarla a media vía
 * dejaría un archivo a medias en el bucket. Solo informa qué está pasando.
 */
export function SubiendoDocumento({ nombre }) {
  return (
    <Modal visible transparent animationType="fade">
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(20,28,22,0.34)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 44,
        }}
      >
        <Animated.View
          entering={FadeInDown.duration(240).springify().damping(20)}
          style={{
            backgroundColor: PAPEL,
            borderRadius: 22,
            paddingVertical: 26,
            paddingHorizontal: 24,
            alignItems: 'center',
            width: '100%',
          }}
        >
          <PilaDePapel />
          <Text style={{ fontSize: 15, fontWeight: '800', color: INK.title, marginTop: 14 }}>
            Subiendo documento
          </Text>
          {nombre ? (
            <Text
              numberOfLines={1}
              style={{ fontSize: 12.5, color: INK.meta, marginTop: 4, maxWidth: '100%' }}
            >
              {nombre}
            </Text>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Objeto elegible: se levanta al presionar y se endereza un poco. */
function Objeto({ children, etiqueta, rotacion, rotEtiqueta, indice, offset = 0, onPress }) {
  const press = useSharedValue(0);

  const estilo = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + press.value * 0.07 },
      { translateY: -press.value * 6 },
      // Al tocarlo se endereza hacia la vertical: el objeto responde al dedo.
      { rotate: `${rotacion * (1 - press.value * 0.8)}deg` },
    ],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(indice * 70)
        .duration(420)
        .springify()
        .damping(15)}
      style={{ marginLeft: offset, zIndex: 10 - indice }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          press.value = withTiming(1, { duration: 110 });
        }}
        onPressOut={() => {
          press.value = withSpring(0, MOTION.tap);
        }}
        accessibilityRole="button"
        accessibilityLabel={etiqueta}
      >
        <Animated.View style={estilo}>
          <View style={{ paddingTop: 16 }}>
            {children}
            <PildoraTipo
              label={etiqueta}
              rotacion={rotEtiqueta}
              style={{ position: 'absolute', left: 4, top: 0, zIndex: 5 }}
            />
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** Snippet: una nota escrita. Papel apilado, con el doblez de siempre. */
function PilaDePapel() {
  return (
    <View style={{ width: OBJETO, height: OBJETO, justifyContent: 'center', alignItems: 'center' }}>
      {[2, 1, 0].map((capa) => (
        <View
          key={capa}
          style={{
            position: 'absolute',
            width: OBJETO - 26,
            height: OBJETO - 14,
            borderRadius: 11,
            backgroundColor: capa === 0 ? '#FFFFFF' : PAPEL,
            transform: [{ rotate: `${capa * 5 - 3}deg` }, { translateX: capa * 3 }],
            shadowColor: '#25332A',
            shadowOpacity: 0.1,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 5 },
          }}
        />
      ))}

      {/* La cara de arriba: renglones escritos y la esquina doblada. */}
      <View
        style={{
          position: 'absolute',
          width: OBJETO - 26,
          height: OBJETO - 14,
          borderRadius: 11,
          borderTopRightRadius: 0,
          backgroundColor: '#FFFFFF',
          overflow: 'hidden',
          paddingHorizontal: 12,
          paddingTop: 18,
          gap: 6,
        }}
      >
        {[1, 0.78, 0.92, 0.5].map((ancho, i) => (
          <View
            key={i}
            style={{
              height: 3,
              borderRadius: 2,
              width: `${ancho * 100}%`,
              backgroundColor: 'rgba(28,43,34,0.14)',
            }}
          />
        ))}
        <Svg width={17} height={17} style={{ position: 'absolute', right: 0, top: 0 }}>
          <Path d={`M0 0 L17 0 L17 17 Z`} fill={PAPEL_DORSO} />
          <Path d={`M0 0 L17 17 L0 17 Z`} fill={PAPEL_DORSO} />
        </Svg>
      </View>
    </View>
  );
}

/**
 * Media e Item son renders 3D, no vectores.
 *
 * Los dibujé primero con SVG — un círculo con degradado radial y un anillo — y a
 * este tamaño se veían planos: un degradado radial no tiene la especularidad ni
 * la oclusión que hacen que algo parezca un objeto. Estos son renders generados
 * con Higgsfield y recortados a PNG con alfa, a 312px (3x de los 104 en pantalla)
 * para no cargar un megabyte por icono.
 *
 * La sombra la pone RN, no la imagen: el recorte de fondo se llevó la sombra de
 * contacto del render, y ponerla acá deja que siga al objeto cuando se levanta.
 */
function ObjetoImagen({ fuente }) {
  return (
    <Image
      source={fuente}
      style={{
        width: OBJETO,
        height: OBJETO,
        shadowColor: '#25332A',
        shadowOpacity: 0.16,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
      }}
      contentFit="contain"
    />
  );
}

/** Media: un documento o archivo. */
function BlobMedia() {
  return <ObjetoImagen fuente={require('../../../assets/codex/obj-media.png')} />;
}

/** Item: la ficha con campos — una entidad con un centro. */
function AnilloItem() {
  return <ObjetoImagen fuente={require('../../../assets/codex/obj-item.png')} />;
}
