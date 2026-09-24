import { useEffect } from 'react';
import { View, Text } from 'react-native';
import Svg, { Rect, Path, Circle, Defs, Mask, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { MONO } from '../codex/mono';

const RectAnimado = Animated.createAnimatedComponent(Rect);

/**
 * Escaneando.
 *
 * Es la re-creación en React Native del `AnalyzingImage` de loading-ui. **No es
 * ese componente**: el original es web —shadcn, utilidades `size-*` de
 * Tailwind, una máscara CSS y `currentColor`— y nada de eso existe acá. No hay
 * `npx shadcn add` que sirva en una app nativa; lo que se puede portar es la
 * animación, y eso es lo que está.
 *
 * La forma es la misma: el marco de una imagen que se queda quieto mientras su
 * contenido —el sol y la montaña— se revela y se vuelve a ocultar bajo una
 * línea que barre de arriba abajo. Acá la máscara es un `<Mask>` de SVG con un
 * rectángulo cuya altura anima, en vez de un `mask-image` de CSS.
 *
 * Se usa mientras el servidor analiza un post. La espera es de varios segundos
 * y puede sobrevivir a que cierres la app, así que necesita decir «esto está
 * pasando» y no «esperá un momento»: un spinner genérico se lee como una
 * pantalla trabada.
 */
export default function AnalizandoImagen({ size = 22, color = '#1C2B22' }) {
  // 0 = todo oculto, 1 = todo revelado. Ida y vuelta, sin pausa.
  const barrido = useSharedValue(0);

  useEffect(() => {
    barrido.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.cubic) })
      ),
      -1,
      false
    );
  }, [barrido]);

  // El rectángulo de la máscara: crece desde el borde de arriba del marco.
  const mascara = useAnimatedProps(() => ({
    height: interpolate(barrido.value, [0, 1], [0, 18]),
  }));

  // La línea del escáner, pegada al filo de la máscara. Se desvanece en los dos
  // extremos: quieta en el borde, al dar la vuelta, se vería como un subrayado.
  const linea = useAnimatedProps(() => ({
    y: 3 + interpolate(barrido.value, [0, 1], [0, 18]),
    opacity: interpolate(barrido.value, [0, 0.12, 0.88, 1], [0, 1, 1, 0]),
  }));

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <Mask id="barrido">
          {/* Blanco revela, negro oculta. */}
          <RectAnimado x={3} y={3} width={18} fill="#fff" animatedProps={mascara} />
        </Mask>
      </Defs>

      {/* El marco, siempre visible: es lo que hace que se lea «imagen» aunque
          el contenido esté a medio revelar. */}
      <Rect
        x={3}
        y={3}
        width={18}
        height={18}
        rx={2.5}
        stroke={color}
        strokeWidth={1.8}
        fill="none"
      />

      {/* El contenido, bajo la máscara. */}
      <G mask="url(#barrido)">
        <Circle cx={8.8} cy={9.2} r={1.6} stroke={color} strokeWidth={1.8} fill="none" />
        <Path
          d="M20 15.5l-3.6-3.6a1.6 1.6 0 0 0-2.3 0L5.2 20.8"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </G>

      <RectAnimado x={3} width={18} height={1.1} rx={0.55} fill={color} animatedProps={linea} />
    </Svg>
  );
}

/**
 * El rótulo que acompaña al ícono.
 *
 * Late en opacidad en vez de quedarse fijo. Es lo mismo que hace el `TextShimmer`
 * del original —que el texto se sienta activo, no impreso— resuelto con lo que
 * hay: un degradado animado sobre texto necesitaría enmascarar tipografía, y en
 * React Native eso pide una librería más para un renglón de doce caracteres.
 */
export function TextoAnalizando({ children, color = 'rgba(28,43,34,0.5)' }) {
  const latido = useSharedValue(0);

  useEffect(() => {
    latido.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [latido]);

  const animado = useAnimatedStyle(() => ({
    opacity: interpolate(latido.value, [0, 1], [0.42, 1]),
  }));

  return (
    <Animated.Text style={[{ fontFamily: MONO, fontSize: 12, color }, animado]}>
      {children}
    </Animated.Text>
  );
}

/** Ícono y rótulo juntos, que es como se usa casi siempre. */
export function Analizando({ children = 'analizando…', color = '#1C2B22' }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <AnalizandoImagen size={20} color={color} />
      <TextoAnalizando>{children}</TextoAnalizando>
    </View>
  );
}
