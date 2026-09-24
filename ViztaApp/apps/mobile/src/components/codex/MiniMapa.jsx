import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { MapPin } from 'lucide-react-native';
import { INK, RADIUS } from '../theme';
import { MONO } from './mono';

const MAPBOX = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
const INDIGO = '4b4fa6';

/**
 * Dónde pasó esto, en una estampa.
 *
 * **Una imagen y no un mapa de verdad.** Un mapa interactivo dentro de una nota
 * compite por el gesto con la nota misma: arrastrar para leer arrastraría el
 * mapa. Además son teselas, caché y un lienzo Skia de más en una pantalla que
 * ya carga fotos y audios. La API estática de Mapbox devuelve exactamente lo
 * que hace falta —el recorte alrededor del punto, con su alfiler— en una sola
 * petición que se cachea como cualquier imagen.
 *
 * El toque no hace zoom: abre las opciones. Dentro de una nota, la pregunta
 * nunca es «¿qué hay alrededor?» sino «¿es acá o no?».
 *
 * Sin token de Mapbox se dibuja igual, con la coordenada sobre papel liso: la
 * nota sabe dónde pasó aunque no haya con qué mostrarlo.
 */
export default function MiniMapa({ ubicacion, onPress, compacto = false }) {
  const [falloLaImagen, setFalloLaImagen] = useState(false);

  /**
   * La estampa se encoge cuando la nota tiene más cosas.
   *
   * Sola en la hoja puede ocupar su tamaño cómodo; con fotos arriba, el mismo
   * alto empuja el texto fuera de la pantalla. Se anima en vez de saltar
   * porque el cambio lo dispara otra cosa —adjuntar una foto— y un salto sin
   * transición se lee como un error de dibujo.
   */
  const alto = useSharedValue(compacto ? 84 : 132);
  useEffect(() => {
    alto.value = withTiming(compacto ? 84 : 132, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [compacto, alto]);

  const estiloAlto = useAnimatedStyle(() => ({ height: alto.value }));

  if (!ubicacion || !Number.isFinite(Number(ubicacion.lat))) return null;

  const lat = Number(ubicacion.lat);
  const lng = Number(ubicacion.lng);
  const etiqueta =
    ubicacion.nombre || ubicacion.direccion || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

  // 600×300 al doble de densidad: es el ancho de la columna de la nota en
  // cualquier teléfono, y pedir más sería pagar píxeles que nadie ve.
  const url =
    MAPBOX && !falloLaImagen
      ? `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/pin-s+${INDIGO}(${lng},${lat})/${lng},${lat},14.5,0/600x300@2x?access_token=${MAPBOX}`
      : null;

  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)}>
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ubicación de la nota: ${etiqueta}. Tocá para cambiarla`}
      style={({ pressed }) => ({ marginTop: 14, opacity: pressed ? 0.85 : 1 })}
    >
      <Animated.View
        style={[estiloAlto, {
          borderRadius: RADIUS.sm,
          overflow: 'hidden',
          backgroundColor: 'rgba(28,43,34,0.05)',
          borderWidth: 1,
          borderColor: 'rgba(28,43,34,0.10)',
          alignItems: 'center',
          justifyContent: 'center',
        }]}
      >
        {url ? (
          <Image
            source={{ uri: url }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            onError={() => setFalloLaImagen(true)}
          />
        ) : (
          <MapPin size={20} color="rgba(75,79,166,0.55)" />
        )}
      </Animated.View>

      {/* El nombre va afuera y no encima de la imagen: sobre un mapa, cualquier
          texto cae sobre calles y se vuelve ilegible en la mitad de los casos. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 }}>
        <MapPin size={12} color="rgba(75,79,166,0.75)" />
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: MONO, fontSize: 11.5, color: INK.meta }}>
          {etiqueta}
        </Text>
      </View>
    </Pressable>
    </Animated.View>
  );
}
