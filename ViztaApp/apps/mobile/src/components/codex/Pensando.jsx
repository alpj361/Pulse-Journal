import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { MONO } from './mono';
import { TYPE_ACCENT } from './tipos';

/**
 * La paleta de los tipos del Codex, en el orden en que se recorre.
 *
 * No son colores nuevos: son los mismos con los que la app pinta actores,
 * territorios, eventos y evidencias. Que la espera use esa paleta dice, sin
 * escribirlo, que lo que está pasando es una consulta al Codex.
 */
const COLORES = [
  TYPE_ACCENT.Actor,
  TYPE_ACCENT.Territorio,
  TYPE_ACCENT.Evento,
  TYPE_ACCENT.Evidencia,
  TYPE_ACCENT.Entidad,
];

const PALABRA = 'Thinking';

/** Cuánto tarda una letra en dar la vuelta completa a la paleta. */
const CICLO = 2600;

/**
 * Cuánto se atrasa cada letra respecto de la anterior.
 *
 * Es lo único que convierte «ocho letras cambiando de color» en una onda que
 * recorre la palabra. Con cero, las ocho parpadearían al unísono y se leería
 * como un error de render.
 */
const RETRASO = 110;

/**
 * Vizta pensando.
 *
 * Una consulta con herramientas puede tardar varios segundos —cada ronda es un
 * viaje más al modelo— y no hay streaming que ir mostrando. Así que la espera
 * tiene que sostenerse sola: si fuera un texto quieto que dice «cargando», a
 * los cuatro segundos se lee como que se colgó.
 *
 * El color se anima letra por letra y no como un degradado con máscara. El
 * degradado se ve mejor en una captura, pero necesita `MaskedView` sobre texto,
 * que en iOS obliga a medir el texto y a remontar el árbol en cada cambio de
 * tamaño. Ocho letras con ocho animaciones en el hilo de UI cuestan menos y no
 * dependen de que la medición salga bien.
 */
export default function Pensando() {
  return (
    <View style={{ flexDirection: 'row' }}>
      {PALABRA.split('').map((letra, i) => (
        <Letra key={i} letra={letra} indice={i} />
      ))}
    </View>
  );
}

function Letra({ letra, indice }) {
  // Va de 0 a 1 y vuelve a empezar; el color se saca de esa posición.
  const fase = useSharedValue(0);

  useEffect(() => {
    // El retraso se aplica como desfase inicial en vez de con un `setTimeout`:
    // así todas las letras corren en el mismo reloj y la onda no se desarma si
    // el arranque de alguna se atrasa un frame.
    const desfase = ((indice * RETRASO) % CICLO) / CICLO;
    fase.value = desfase;
    fase.value = withRepeat(
      withTiming(desfase + 1, { duration: CICLO, easing: Easing.linear }),
      -1,
      false
    );
  }, [indice]);

  const estilo = useAnimatedStyle(() => {
    // El primer color se repite al final para que el ciclo cierre sin salto.
    const paleta = [...COLORES, COLORES[0]];
    const tramos = paleta.map((_, i) => i / (paleta.length - 1));
    const p = fase.value % 1;

    return { color: interpolateColor(p, tramos, paleta) };
  });

  return (
    <Animated.Text
      style={[
        {
          fontFamily: MONO,
          fontSize: 15,
          lineHeight: 27,
          letterSpacing: 0.3,
        },
        estilo,
      ]}
    >
      {letra}
    </Animated.Text>
  );
}
