import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { INK } from '../theme';
import { roce } from '../../utils/haptics';
import { creditoDe } from './fotos';

/**
 * Las fotos de una noticia, dentro del modal.
 *
 * **La forma la decide cuántas hay.** Una sola foto en una grilla de dos
 * columnas queda coja, y cinco todas grandes convierten la nota en un álbum y
 * empujan el texto fuera de la pantalla. Son tres casos y cada uno se sostiene
 * solo: una grande; dos parejas; y de tres en adelante una grande con las demás
 * en fila abajo.
 *
 * **Tocar una miniatura la sube a grande.** Es la única interacción que hay, y
 * existe para que mirar las fotos no obligue a salir a otra pantalla: la nota
 * sigue debajo, el pulgar no se mueve. Sin esto las miniaturas serían tres
 * recortes de 90 píxeles donde no se distingue nada y no habría forma de verlos
 * mejor. La grande no responde al toque a propósito — no tiene a dónde ir, y un
 * elemento que se hunde al tocarlo promete algo que no va a pasar.
 *
 * **Las que no entran se cuentan, no se esconden.** Con más de cuatro, la última
 * miniatura lleva el resto encima: saber que hay tres más vale para decidir si
 * vale la pena mirarlas.
 *
 * **Cada foto se cae sola.** El bucket borra a los siete días, así que una nota
 * cacheada puede apuntar a fotos que ya no están. El fallo se guarda por URL y
 * la grilla se rearma con las que quedan: una foto vencida no deja un rectángulo
 * gris ni se lleva puestas a las demás.
 */

const HUECO = 6;
const RADIO = 5;

/** Escalón de la entrada escalonada, en milisegundos. */
const ESCALON = 70;

function Foto({ url, alto, ancho, extra, indice, onPress, onError }) {
  const press = useSharedValue(0);

  const animado = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.035 }],
    opacity: 1 - press.value * 0.12,
  }));

  const cuerpo = (
    <Animated.View
      entering={FadeIn.delay(indice * ESCALON).duration(300)}
      style={[
        {
          width: ancho,
          height: alto,
          borderRadius: RADIO,
          overflow: 'hidden',
          backgroundColor: 'rgba(28,43,34,0.06)',
        },
        animado,
      ]}
    >
      <Image
        source={{ uri: url }}
        recyclingKey={url}
        cachePolicy="memory-disk"
        contentFit="cover"
        transition={200}
        onError={onError}
        style={{ width: '100%', height: '100%' }}
      />
      {extra ? (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: 'rgba(16,24,19,0.55)', alignItems: 'center', justifyContent: 'center' },
          ]}
        >
          <Text style={{ color: '#FFFDF8', fontSize: 17, fontWeight: '700' }}>+{extra}</Text>
        </View>
      ) : null}
    </Animated.View>
  );

  if (!onPress) return cuerpo;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        press.value = withSpring(0, { damping: 14, stiffness: 260 });
      }}
      accessibilityRole="button"
      accessibilityLabel="Ver esta foto en grande"
    >
      {cuerpo}
    </Pressable>
  );
}

export default function GaleriaNoticia({ fotos, ancho }) {
  const [rotas, setRotas] = useState(() => new Set());
  // Qué foto va arriba. Se guarda la URL y no el índice: si una foto de más
  // arriba se rompe, la lista se corre y un índice apuntaría a otra distinta.
  const [heroUrl, setHeroUrl] = useState(null);

  const vivas = (fotos || []).filter((f) => !rotas.has(f.url));

  const marcarRota = (url) =>
    setRotas((prev) => {
      if (prev.has(url)) return prev;
      const siguiente = new Set(prev);
      siguiente.add(url);
      return siguiente;
    });

  // La grande entra con un resorte corto cada vez que cambia. Es lo que conecta
  // el toque en la miniatura con el resultado: sin eso la imagen se reemplaza de
  // golpe y no se lee como que subió, sino como que se rompió algo.
  const salto = useSharedValue(1);
  useEffect(() => {
    salto.value = 0.965;
    salto.value = withSpring(1, { damping: 13, stiffness: 220 });
  }, [heroUrl, salto]);

  const estiloSalto = useAnimatedStyle(() => ({ transform: [{ scale: salto.value }] }));

  if (!vivas.length) return null;

  // El orden de pantalla: la elegida primero, el resto como venía.
  const hero = vivas.find((f) => f.url === heroUrl) || vivas[0];
  const resto = vivas.filter((f) => f.url !== hero.url);

  const credito = creditoDe(vivas);
  const n = vivas.length;

  let cuerpo;

  if (n === 1) {
    cuerpo = (
      <Foto
        url={hero.url}
        ancho={ancho}
        alto={Math.round(ancho * 0.62)}
        indice={0}
        onError={() => marcarRota(hero.url)}
      />
    );
  } else if (n === 2) {
    const lado = Math.floor((ancho - HUECO) / 2);
    cuerpo = (
      <View style={{ flexDirection: 'row', gap: HUECO }}>
        {vivas.map((f, i) => (
          <Foto
            key={f.url}
            url={f.url}
            ancho={lado}
            alto={lado}
            indice={i}
            onError={() => marcarRota(f.url)}
          />
        ))}
      </View>
    );
  } else {
    const visibles = resto.slice(0, 3);
    const sobran = resto.length - visibles.length;
    const lado = Math.floor((ancho - HUECO * (visibles.length - 1)) / visibles.length);

    cuerpo = (
      <View style={{ gap: HUECO }}>
        <Animated.View style={estiloSalto}>
          <Foto
            url={hero.url}
            ancho={ancho}
            alto={Math.round(ancho * 0.56)}
            indice={0}
            onError={() => marcarRota(hero.url)}
          />
        </Animated.View>

        <View style={{ flexDirection: 'row', gap: HUECO }}>
          {visibles.map((f, i) => (
            <Foto
              key={f.url}
              url={f.url}
              ancho={lado}
              alto={Math.round(lado * 0.82)}
              indice={i + 1}
              extra={i === visibles.length - 1 && sobran > 0 ? sobran : null}
              onPress={() => {
                roce();
                setHeroUrl(f.url);
              }}
              onError={() => marcarRota(f.url)}
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 20 }}>
      {cuerpo}
      {credito ? (
        <Text style={{ fontSize: 11, color: INK.faint, marginTop: 8 }}>Fotos de {credito}</Text>
      ) : null}
    </View>
  );
}
