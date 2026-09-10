import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { parsear, largoVisible, recortarA } from './markdown';
import TextoMarkdown from './TextoMarkdown';

/**
 * Cada cuánto se agrega texto.
 *
 * 16ms es un frame. Más rápido no se ve más rápido —la pantalla no refresca
 * más— y solo gasta renders.
 */
const TIC = 16;

/**
 * Cuánto tarda en escribirse todo, sin importar el largo.
 *
 * Es un tiempo fijo y no una velocidad fija por letra, y esa es la decisión: a
 * velocidad constante, una respuesta de dos mil caracteres tardaría medio
 * minuto en aparecer. Se escriben más letras por tic cuando el texto es largo,
 * así que el efecto se siente igual y la espera no crece con la respuesta.
 */
const DURACION = 2200;

/**
 * La respuesta de Vizta, escribiéndose.
 *
 * El texto ya llegó completo —no hay streaming— así que esto es puro efecto. No
 * es decorado: sin él, un párrafo de doscientas palabras aparece de golpe y hay
 * que buscar dónde empezaba. Escribiéndose, la vista ya está en la primera
 * línea cuando llega la segunda.
 *
 * **Se anima el markdown ya parseado, no el texto crudo.** Animar lo crudo
 * mostraría los asteriscos durante dos segundos y recién después los
 * convertiría en negrita — o sea, dos segundos enseñando la sintaxis que
 * justamente hay que esconder.
 *
 * Tocarlo lo completa de una. Quien lee más rápido que la animación no tiene
 * por qué esperarla.
 */
export default function RespuestaVizta({ texto, color, size }) {
  const lineas = useMemo(() => parsear(texto), [texto]);
  const total = useMemo(() => largoVisible(lineas), [lineas]);

  const [n, setN] = useState(0);
  const listo = n >= total;

  useEffect(() => {
    setN(0);
    if (!total) return;

    // Cuántas letras por tic para que el total dé `DURACION`.
    const paso = Math.max(1, Math.ceil(total / (DURACION / TIC)));

    const reloj = setInterval(() => {
      setN((previo) => {
        const siguiente = previo + paso;
        if (siguiente >= total) {
          clearInterval(reloj);
          return total;
        }
        return siguiente;
      });
    }, TIC);

    return () => clearInterval(reloj);
  }, [total]);

  const visibles = useMemo(
    () => (listo ? lineas : recortarA(lineas, n)),
    [lineas, n, listo]
  );

  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <Pressable
        onPress={() => {
          if (!listo) setN(total);
        }}
        accessibilityRole="text"
        // Lo que lee un lector de pantalla es la respuesta entera, no el trozo
        // que la animación alcanzó a mostrar: el efecto es para la vista.
        accessibilityLabel={texto}
      >
        <TextoMarkdown lineas={visibles} color={color} size={size} />
      </Pressable>
    </Animated.View>
  );
}
