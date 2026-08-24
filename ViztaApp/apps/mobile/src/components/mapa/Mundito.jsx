import { memo, useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, RadialGradient, Stop } from 'react-native-svg';
import { roce } from '../../utils/haptics';

const AElipse = Animated.createAnimatedComponent(Ellipse);
const AV = Animated.View;

const VUELTA = 16000; // ms por vuelta — lento a propósito

/** Continentes inventados: longitud de partida, latitud, y tamaño. */
const TIERRAS = [
  { lon: 0.0, cy: 0.42, rx: 0.40, ry: 0.26 },
  { lon: 2.1, cy: 0.66, rx: 0.30, ry: 0.20 },
  { lon: 3.6, cy: 0.30, rx: 0.26, ry: 0.15 },
  { lon: 4.9, cy: 0.58, rx: 0.34, ry: 0.17 },
];

/**
 * El mundito: la puerta al mapa, en la esquina del cabezal.
 *
 * **Es azul, y no por gusto.** La primera versión era verde y compartía el
 * material del orbe de la barra, con la idea de que se leyeran como hermanos.
 * En pantalla el efecto fue el contrario: dos esferas verdes a la vez se leen
 * como el mismo control repetido, y hay que detenerse a mirar cuál es cuál. El
 * océano resuelve las dos cosas de una — separa los dos botones a primera
 * vista, y dice qué hay del otro lado sin escribirlo.
 *
 * Lo que sí conserva del orbe es la **física de la luz**: el foco arriba a la
 * izquierda y el rim light abajo a la derecha. Eso es lo que hace que las dos
 * se sientan objetos del mismo mundo aunque no compartan color.
 *
 * **Gira de verdad.** Cada continente tiene una longitud, y de ahí sale todo lo
 * demás: aparece a `sin(λ)` del centro, se aplana con `cos(λ)` al acercarse al
 * borde, y se apaga cuando `cos(λ)` se vuelve negativo, que es cuando pasó al
 * otro lado del planeta. No hay tres dimensiones acá, solo la trigonometría de
 * una esfera — y alcanza.
 *
 * La vuelta dura dieciséis segundos. Un globo que gira rápido pide que lo miren,
 * y esto vive al lado del titular: tiene que estar vivo, no llamar.
 */
function Mundito({ size = 30, onPress }) {
  const r = size / 2;
  const fase = useSharedValue(0);
  const press = useSharedValue(0);

  useEffect(() => {
    fase.value = withRepeat(
      withTiming(Math.PI * 2, { duration: VUELTA, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(fase);
  }, [fase]);

  const cuerpo = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.1 }],
  }));

  return (
    <Pressable
      onPress={() => {
        roce();
        onPress?.();
      }}
      onPressIn={() => {
        press.value = withSpring(1, { damping: 20, stiffness: 400 });
      }}
      onPressOut={() => {
        press.value = withSpring(0, { damping: 12, stiffness: 220 });
      }}
      hitSlop={14}
      accessibilityRole="button"
      accessibilityLabel="Abrir el mapa"
    >
      <AV style={[{ width: size, height: size }, cuerpo]}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="oceano" cx="36%" cy="28%" r="84%">
              <Stop offset="0" stopColor="#BFDCEB" />
              <Stop offset="0.34" stopColor="#6FA6C6" />
              <Stop offset="0.70" stopColor="#2F6E93" />
              <Stop offset="1" stopColor="#1A4165" />
            </RadialGradient>
            <RadialGradient id="mundoBrillo" cx="33%" cy="25%" r="44%">
              <Stop offset="0" stopColor="#FBFDFF" stopOpacity="0.78" />
              <Stop offset="1" stopColor="#FBFDFF" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="mundoRim" cx="70%" cy="78%" r="54%">
              <Stop offset="0.62" stopColor="#CFE6DC" stopOpacity="0" />
              <Stop offset="1" stopColor="#CFE6DC" stopOpacity="0.55" />
            </RadialGradient>

            {/* Todo lo que gira vive recortado a la esfera: sin esto, un
                continente cerca del borde se sale del planeta. */}
            <ClipPath id="planeta">
              <Circle cx={r} cy={r} r={r - 0.5} />
            </ClipPath>
          </Defs>

          <Circle cx={r} cy={r} r={r - 0.5} fill="url(#oceano)" />

          <G clipPath="url(#planeta)">
            {TIERRAS.map((t, i) => (
              <Tierra key={i} t={t} r={r} fase={fase} />
            ))}
          </G>

          {/* El ecuador, apenas insinuado: da el eje sin convertir esto en un
              diagrama. */}
          <Ellipse
            cx={r}
            cy={r}
            rx={r * 0.88}
            ry={r * 0.26}
            fill="none"
            stroke="rgba(255,255,255,0.20)"
            strokeWidth={0.5}
          />

          <Circle cx={r} cy={r} r={r - 0.5} fill="url(#mundoBrillo)" />
          <Circle cx={r} cy={r} r={r - 0.5} fill="url(#mundoRim)" />
        </Svg>
      </AV>
    </Pressable>
  );
}

/**
 * Un continente.
 *
 * Su longitud avanza con la fase. De ahí salen las tres cosas que lo hacen
 * parecer pegado a una esfera: dónde está (`sin`), cuánto se aplasta al llegar
 * al borde (`cos`), y cuándo desaparece por detrás (`cos` negativo).
 */
function Tierra({ t, r, fase }) {
  const props = useAnimatedProps(() => {
    const lon = fase.value + t.lon;
    const c = Math.cos(lon);
    return {
      cx: r + Math.sin(lon) * r * 0.82,
      rx: Math.max(0.01, c) * r * t.rx,
      // El desvanecido de los últimos grados evita que un continente se corte
      // de golpe justo en el filo.
      opacity: c <= 0 ? 0 : Math.min(1, c * 3.2),
    };
  });

  return <AElipse animatedProps={props} cy={r * 2 * t.cy} ry={r * t.ry} fill="#5E9463" opacity={0} />;
}

/**
 * Memoizado porque gira para siempre. El cabezal del feed se vuelve a dibujar
 * cada vez que llegan noticias, y sin esto cada uno de esos dibujados reiniciaría
 * la vuelta — un globo que da un tirón cada tanto en vez de girar.
 */
export default memo(Mundito);
