import { View, Text, Pressable, Modal, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { MONO } from './mono';
import MorphingInfinity from '../MorphingInfinity';
import { roce } from '../../utils/haptics';

const HUECO = 7;
const RADIO = 11;

/**
 * Las fotos de la nota.
 *
 * Van **debajo del texto**, no intercaladas entre los renglones. No es una
 * preferencia: la nota es un solo `TextInput` con los tramos de mención
 * pintados adentro, y de eso dependen el resaltado del Codex, el autocompletado,
 * el toque en un nombre para abrir su ficha y el modo chat de Vizta. Meter
 * imágenes entre el texto obliga a cambiar esa superficie por un editor de
 * bloques, y las cuatro cosas hay que rehacerlas. Abajo, todo eso sigue
 * funcionando igual y las fotos se ven completas.
 *
 * Cada una arranca con la copia local mientras sube. Esperar a tener la URL
 * remota para mostrarla dejaría un hueco gris de varios segundos justo después
 * de tocar la foto — el momento en que la persona necesita ver que registró.
 */
export default function Adjuntas({ fotos, onQuitar, onVer }) {
  const { width: W } = useWindowDimensions();

  if (!fotos?.length) return null;

  // Tres por renglón dentro de la medida de la hoja. La columna de la nota es
  // angosta a propósito; sacar la cuenta del ancho real y no de la pantalla es
  // lo que evita que la última foto se salga del papel.
  const columna = Math.min(W, 420) - 60;
  const lado = (columna - HUECO * 2) / 3;

  return (
    <Animated.View entering={FadeIn.duration(220)} style={{ marginTop: 26 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: HUECO }}>
        {fotos.map((f) => (
          <Animated.View
            key={f.id}
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(140)}
          >
            <Pressable
              onPress={() => {
                // Una que todavía sube no tiene nada más grande que mostrar.
                if (f.subiendo) return;
                roce();
                onVer?.(f);
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
              accessibilityRole="button"
              accessibilityLabel="Ver la foto"
            >
              <Image
                source={{ uri: f.url || f.local }}
                style={{
                  width: lado,
                  height: lado,
                  borderRadius: RADIO,
                  backgroundColor: 'rgba(28,43,34,0.06)',
                }}
                contentFit="cover"
                transition={140}
              />

              {/* Mientras sube, velo y latido. El velo no es decoración: sin él
                  la foto se ve idéntica a una ya guardada, y cerrar la nota en
                  ese momento la perdería sin que nada lo hubiera advertido. */}
              {f.subiendo ? (
                <View
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      borderRadius: RADIO,
                      backgroundColor: 'rgba(255,253,248,0.62)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                  ]}
                >
                  <MorphingInfinity size={16} color="#1C2B22" />
                </View>
              ) : null}

              {/* Falló la subida. Se dice en la foto misma y no en un cartel
                  arriba: con cuatro adjuntas, un error suelto no dice cuál. */}
              {f.error ? (
                <View
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      borderRadius: RADIO,
                      backgroundColor: 'rgba(185,28,28,0.16)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 6,
                    },
                  ]}
                >
                  <Text
                    style={{ fontFamily: MONO, fontSize: 9, color: '#B91C1C', textAlign: 'center' }}
                  >
                    no subió
                  </Text>
                </View>
              ) : null}
            </Pressable>

            <Pressable
              onPress={() => {
                roce();
                onQuitar?.(f);
              }}
              hitSlop={10}
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                width: 21,
                height: 21,
                borderRadius: 11,
                backgroundColor: '#1C2B22',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="Quitar esta foto de la nota"
            >
              <X size={11} color="#FFF" />
            </Pressable>
          </Animated.View>
        ))}
      </View>

    </Animated.View>
  );
}

/**
 * La foto, entera.
 *
 * Vive suelto y no dentro de `Adjuntas` porque se abre desde dos lugares —la
 * hoja y la sección media del panel— y tiene que ser el mismo: dos copias del
 * visor se desincronizan a la primera que se toque.
 *
 * Fondo negro y nada más encima que la salida: una foto a pantalla completa no
 * necesita interfaz.
 */
export function VisorFoto({ foto, onCerrar }) {
  return (
    <Modal visible={!!foto} transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable
        onPress={onCerrar}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center' }}
      >
        {foto ? (
          <Image
            source={{ uri: foto.url || foto.local }}
            style={{ width: '100%', height: '80%' }}
            contentFit="contain"
            transition={160}
          />
        ) : null}

        <Text
          style={{
            fontFamily: MONO,
            fontSize: 11,
            color: 'rgba(255,255,255,0.4)',
            textAlign: 'center',
            position: 'absolute',
            bottom: 44,
            left: 0,
            right: 0,
          }}
        >
          tocá para cerrar
        </Text>
      </Pressable>
    </Modal>
  );
}
