import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn } from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { MONO } from '../codex/mono';
import { RADIUS } from '../theme';
import { roce } from '../../utils/haptics';

/**
 * Las imágenes de un post, todas.
 *
 * Un carrusel de Instagram llega entero —el extractor devuelve
 * `extracted_images` y se guarda en `details.images`— pero hasta ahora la hoja
 * pintaba solo la primera. Las demás estaban en la base sin ninguna forma de
 * verlas: traídas, guardadas, invisibles.
 *
 * Se desliza en horizontal con `pagingEnabled`, como el carrusel original. No
 * hay librería detrás por la misma razón que en la hoja de la nota: con un
 * `ScrollView` alcanza, y una dependencia más para esto solo agrega peso.
 *
 * **El contador va arriba a la izquierda y los puntos abajo.** Los puntos solos
 * no alcanzan pasadas cinco o seis imágenes —se vuelven una fila de motas
 * indistinguibles— y el contador solo no dice dónde estás parado. Juntos, uno
 * te ubica y el otro te dice cuánto falta.
 */
export default function CarruselPost({ imagenes, alto, esVideo, insignia }) {
  const { width: W } = useWindowDimensions();
  const [actual, setActual] = useState(0);
  const [abierta, setAbierta] = useState(null);
  const [rotas, setRotas] = useState({});

  const total = imagenes.length;

  /**
   * El ancho de página se **mide**, no se calcula.
   *
   * Estaba puesto como `W - 36`, adivinando el margen de la hoja, y el
   * contenedor real resultó más angosto: cada página quedaba corrida y se veía
   * una franja de la imagen anterior asomando al costado. `onLayout` da el
   * ancho que el contenedor tiene de verdad, sea cual sea el margen de quien lo
   * use.
   *
   * Arranca en `W` y no en 0 para que el primer cuadro —antes de que
   * `onLayout` dispare— no apile las cuatro imágenes en una columna de ancho
   * cero.
   */
  const [ancho, setAncho] = useState(W);

  return (
    <>
      <View
        onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
        style={{ height: alto, borderRadius: RADIUS.lg, overflow: 'hidden' }}
      >
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const p = Math.round(e.nativeEvent.contentOffset.x / ancho);
            if (p !== actual) {
              setActual(p);
              roce();
            }
          }}
        >
          {imagenes.map((uri, i) => (
            <Pressable
              key={`${uri}-${i}`}
              onPress={() => {
                if (rotas[i]) return;
                roce();
                setAbierta(i);
              }}
              style={{ width: ancho, height: alto }}
            >
              {rotas[i] ? (
                /* Las URLs de Instagram están firmadas y caducan en días, así
                   que esto no es el caso raro. Se dice cuál falló en vez de
                   dejar un hueco: con seis imágenes, un rectángulo gris no
                   distingue «esta venció» de «todavía carga». */
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(28,43,34,0.06)' }}>
                  <Text style={{ fontFamily: MONO, fontSize: 10.5, color: 'rgba(28,43,34,0.3)' }}>
                    esta imagen ya no está
                  </Text>
                </View>
              ) : (
                <Image
                  source={{ uri }}
                  onError={() => setRotas((r) => ({ ...r, [i]: true }))}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  transition={140}
                />
              )}
            </Pressable>
          ))}
        </ScrollView>

        {/* Cuántas son y en cuál vas. */}
        {total > 1 ? (
          <View
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              paddingHorizontal: 8,
              paddingVertical: 3.5,
              borderRadius: 999,
              backgroundColor: 'rgba(12,20,15,0.45)',
            }}
          >
            <Text style={{ fontFamily: MONO, fontSize: 10.5, color: '#fff' }}>
              {actual + 1}/{total}
            </Text>
          </View>
        ) : null}

        {insignia}

        {total > 1 ? (
          <View
            style={{
              position: 'absolute',
              bottom: 10,
              left: 0,
              right: 0,
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            {imagenes.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === actual ? 14 : 5,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: i === actual ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)',
                }}
              />
            ))}
          </View>
        ) : null}
      </View>

      {/* A pantalla completa, desde donde la abriste. Arranca en esa imagen y
          se sigue deslizando: entrar al visor y perder en cuál estabas obliga a
          contar de nuevo desde la primera. */}
      <Modal visible={abierta !== null} transparent animationType="fade" onRequestClose={() => setAbierta(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (abierta || 0) * W, y: 0 }}
          >
            {imagenes.map((uri, i) => (
              <View key={i} style={{ width: W, height: '100%', justifyContent: 'center' }}>
                <Image
                  source={{ uri }}
                  style={{ width: '100%', height: '82%' }}
                  contentFit="contain"
                  transition={160}
                />
              </View>
            ))}
          </ScrollView>

          <Pressable
            onPress={() => setAbierta(null)}
            hitSlop={14}
            style={{ position: 'absolute', top: 58, left: 20, padding: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <X size={22} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

/** Cuántas imágenes trae, para la tarjeta de la grilla. */
export function MarcaCarrusel({ cuantas }) {
  if (!cuantas || cuantas < 2) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: 'rgba(12,20,15,0.45)',
      }}
    >
      <Text style={{ fontFamily: MONO, fontSize: 9.5, color: '#fff' }}>{cuantas}</Text>
    </Animated.View>
  );
}
