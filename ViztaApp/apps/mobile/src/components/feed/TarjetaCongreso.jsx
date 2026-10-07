import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Play } from 'lucide-react-native';
import { INK, MOTION, RADIUS, SERIF } from '../theme';
import { inclinacion } from '../codex/Papel';
import { origen, titular } from './congreso';

// El color del Congreso en el feed: un azul institucional apagado, para que la
// etiqueta se lea como de otro lado que las de las noticias del país.
const TINTA = '#2F4A7A';
const LAVADO = 'rgba(47,74,122,0.10)';

/** La etiqueta de papel, como la de las noticias, con lo que la tarjeta es. */
function Etiqueta({ texto, id }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: LAVADO,
        borderRadius: 2.5,
        paddingHorizontal: 8,
        paddingVertical: 3.5,
        marginBottom: 12,
        transform: [{ rotate: `${inclinacion(`${id}-cong`, 2.6)}deg` }],
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.9, color: TINTA }}>{texto}</Text>
    </View>
  );
}

function Foto({ uri, ancho, alto, video = false }) {
  const [rota, setRota] = useState(false);
  if (!uri || rota) return null;
  return (
    <View style={{ width: ancho, height: alto, borderRadius: RADIUS.sm, overflow: 'hidden', backgroundColor: 'rgba(28,43,34,0.06)' }}>
      <Image source={{ uri }} onError={() => setRota(true)} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
      {video ? (
        <View style={{ position: 'absolute', left: 12, bottom: 12, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(12,20,15,0.55)', alignItems: 'center', justifyContent: 'center' }}>
          <Play size={16} color="#fff" fill="#fff" />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Una tarjeta del feed del Congreso.
 *
 * Sigue a la noticia del país —sin caja, titular en serif, una línea que
 * separa— pero es otra cosa y se nota: lleva la foto que publicó el Congreso,
 * su etiqueta en azul, y abajo de dónde sale en vez de qué medios la cubren.
 *
 * El noticiero legislativo va distinto: la imagen entera con el botón de
 * reproducir, porque es un video y no una nota.
 *
 * Si la noticia habla de una iniciativa de ley, lleva su número: es por donde
 * después se va a poder seguirla.
 */
export default function TarjetaCongreso({ item, onPress, style }) {
  const press = useSharedValue(0);
  const animado = useAnimatedStyle(() => ({ opacity: 1 - press.value * 0.35 }));
  const esNoticiero = item.tipo === 'noticiero';
  const titulo = titular(item.titulo);

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
      accessibilityLabel={titulo}
      style={style}
    >
      <Animated.View style={animado}>
        {esNoticiero ? (
          <>
            <Etiqueta texto="NOTICIERO" id={item.id} />
            <Foto uri={item.thumbnail_url} ancho="100%" alto={190} video />
            <Text style={{ fontFamily: SERIF, fontSize: 21, color: INK.title, lineHeight: 26, letterSpacing: -0.2, marginTop: 13 }}>
              {titulo}
            </Text>
          </>
        ) : (
          <>
            <Etiqueta texto={item.iniciativa_numero ? `INICIATIVA ${item.iniciativa_numero}` : 'CONGRESO'} id={item.id} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: SERIF, fontSize: 21, color: INK.title, lineHeight: 26, letterSpacing: -0.2 }}>{titulo}</Text>
                {item.iniciativa_titulo ? (
                  <Text numberOfLines={2} style={{ fontSize: 13.5, color: INK.body, lineHeight: 20, marginTop: 7 }}>
                    {item.iniciativa_titulo}
                  </Text>
                ) : null}
              </View>
              <Foto uri={item.thumbnail_url} ancho={92} alto={70} />
            </View>
          </>
        )}

        <Text numberOfLines={1} style={{ fontSize: 11.5, color: 'rgba(28,43,34,0.38)', letterSpacing: -0.1, marginTop: 11 }}>
          {[origen(item), item.iniciativa_estado, item.norma_decreto ? `Decreto ${item.norma_decreto}` : null].filter(Boolean).join(' · ')}
        </Text>

        {/* Separa sin encerrar, igual que en las noticias. */}
        <View style={{ height: 1, backgroundColor: 'rgba(28,43,34,0.09)', marginTop: 20 }} />
      </Animated.View>
    </Pressable>
  );
}
