import { useMemo, useState } from 'react';
import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { INK, MOTION, RADIUS, SERIF } from '../theme';
import { PAPEL, EsquinaDoblada, inclinacion } from '../codex/Papel';
import { paletaDe, temaDe } from './temas';
import { roce } from '../../utils/haptics';

/**
 * Las revistas del fondo.
 *
 * Collages de material de prensa —negativos, papel sin imprimir, rodillo de
 * tinta, cinta de casete— generados para esto y empaquetados en 196 KB. **No
 * llevan una sola letra**, y es a propósito: cualquier texto ahí sería texto
 * inventado, y un titular falso de fondo en una app de periodismo es
 * exactamente lo que no puede pasar. Son textura, no contenido.
 *
 * Dos archivos para tres hojas: la tercera reusa el primero espejado. A este
 * tamaño —tapadas casi por completo— nadie las reconoce como la misma, y son
 * 87 KB menos.
 */
const REVISTAS = [
  require('../../../assets/images/collage/prensa-1.jpg'),
  require('../../../assets/images/collage/prensa-3.jpg'),
];

/**
 * La portada del día, como un collage de papeles.
 *
 * Antes esto era el título en una sans grande sobre el fondo. Funcionaba, pero
 * no se leía como periodismo: se leía como una app.
 *
 * Ahora es una pila de papeles ligeramente girados, con el título en serif
 * encima del de adelante. Lo importante es que **los papeles no son decoración**:
 * cada uno toma el lavado de un tema real del día (`temas_subiendo[].categoria`).
 * Si hoy manda Política y Seguridad, esos son los colores que asoman por los
 * bordes. La pila *es* la agenda, no una textura.
 *
 * Sin fotos por delante — `news_cards` no trae imágenes y las de Instagram
 * caducan — el papel y la tipografía son lo que hace el trabajo que en una
 * revista haría una foto a sangre.
 *
 * La rotación sale de `inclinacion(id)`, un hash estable: con `Math.random()`
 * los papeles bailarían en cada render, que es el detalle que delata que algo
 * es generado y no impreso.
 *
 * Loop largo (reducción progresiva): la pista «leer el análisis» aparece las
 * primeras tres sesiones y después no vuelve. Quien ya aprendió el gesto no
 * necesita que se lo recuerden.
 */
export default function PortadaDia({ narrativa, fecha }) {
  const { width: W } = useWindowDimensions();
  const [abierta, setAbierta] = useState(false);
  const press = useSharedValue(0);


  const estilo = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.012 }],
  }));

  const giro = useAnimatedStyle(() => ({
    transform: [{ rotate: withSpring(abierta ? '180deg' : '0deg', MOTION.tap) }],
  }));

  // Los papeles de atrás: los temas del día, de menor a mayor importancia, para
  // que el más fuerte quede más cerca del frente.
  const dorsos = useMemo(() => {
    const temas = Array.isArray(narrativa?.temas_subiendo) ? narrativa.temas_subiendo : [];
    const vistos = new Set();
    const salida = [];
    for (const t of temas) {
      const canon = temaDe(t?.categoria);
      if (vistos.has(canon)) continue; // dos papeles del mismo color no se distinguen
      vistos.add(canon);
      salida.push({ canon, paleta: paletaDe(t?.categoria) });
      if (salida.length === 3) break;
    }
    return salida.reverse();
  }, [narrativa]);

  if (!narrativa?.titulo) return null;

  const dia = (fecha || narrativa.generated_at || '').slice(0, 10);
  const id = narrativa.id || dia || 'portada';

  // La hoja de adelante manda la altura; las de atrás asoman por los bordes.
  const ancho = W - 48;
  const titulo = String(narrativa.titulo);
  // El cuerpo se achica cuando el titular es largo: un título de 90 caracteres
  // al mismo tamaño que uno de 40 desborda la hoja y se come el aire de abajo.
  const tam = titulo.length > 78 ? 27 : titulo.length > 52 ? 31 : 35;

  return (
    <Animated.View layout={LinearTransition.springify().damping(22)} style={{ paddingHorizontal: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 30 }}>
        <Text style={{ fontSize: 10, fontWeight: '800', color: INK.faint, letterSpacing: 1.2 }}>HOY</Text>
        {dia ? <Text style={{ fontSize: 10.5, color: 'rgba(28,43,34,0.28)' }}>{dia}</Text> : null}
      </View>

      <Pressable
        onPress={() => {
          roce();
          setAbierta((v) => !v);
        }}
        onPressIn={() => {
          press.value = withTiming(1, MOTION.press);
        }}
        onPressOut={() => {
          press.value = withSpring(0, MOTION.tap);
        }}
        accessibilityRole="button"
        accessibilityLabel={abierta ? 'Ocultar el análisis del día' : 'Leer el análisis del día'}
      >
        <Animated.View style={estilo}>
          <View style={{ alignItems: 'center' }}>
            {/* Papeles de atrás. Cada uno un tema del día. */}
            {dorsos.map((d, i) => (
              // Dos nodos a propósito: el de afuera gira, el de adentro entra.
              // Las animaciones de entrada de Reanimated escriben `transform`
              // en su propio nodo, así que una rotación estática puesta ahí la
              // pisa `FadeInDown` y las hojas quedan derechas — se ven como un
              // borde grueso en vez de una pila.
              <View
                key={d.canon}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  alignSelf: 'center',
                  // Las hojas de atrás son **más grandes** que la de adelante,
                  // no más chicas: si son más angostas quedan escondidas y no
                  // se ve ninguna pila. Fue exactamente el primer error.
                  width: ancho + 10 - i * 5,
                  height: '103%',
                  top: -3,
                  borderRadius: RADIUS.sm,
                  // El lavado del tema es tan pálido como el fondo de la app, y
                  // a este tamaño desaparecía. Se usa la marca del tema —su
                  // color pleno— rebajada: se reconoce el tema sin que la pila
                  // le gane al titular.
                  // Alternadas: todas para el mismo lado se leen como una sombra
                  // mal hecha, no como papeles sueltos.
                  transform: [
                    { rotate: `${(i % 2 === 0 ? 1 : -1) * (4.5 + i * 1.8)}deg` },
                    { translateX: (i % 2 === 0 ? 1 : -1) * (4 + i * 3) },
                  ],
                }}
              >
                <Animated.View
                  entering={FadeInDown.duration(420).delay(i * 70).springify().damping(20)}
                  style={{
                    flex: 1,
                    borderRadius: RADIUS.sm,
                    overflow: 'hidden',
                    backgroundColor: `${d.paleta.marca}30`,
                  }}
                >
                  <Image
                    source={REVISTAS[i % REVISTAS.length]}
                    resizeMode="cover"
                    style={{
                      width: '100%',
                      height: '100%',
                      // La tercera hoja es la primera espejada.
                      transform: i >= REVISTAS.length ? [{ scaleX: -1 }] : undefined,
                    }}
                  />
                  {/* El tinte del tema por encima. Sin esto la pila sería bonita
                      pero muda: el color es lo único que ata cada hoja a un tema
                      real del día. Va bajo para que la revista se siga leyendo. */}
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 0,
                      bottom: 0,
                      backgroundColor: `${d.paleta.marca}55`,
                    }}
                  />
                </Animated.View>
              </View>
            ))}

            {/* Hoja de adelante: la que lleva el título. */}
            <Animated.View
              entering={FadeInDown.duration(460).delay(dorsos.length * 70).springify().damping(19)}
              style={{
                width: ancho,
                backgroundColor: PAPEL,
                borderRadius: RADIUS.sm,
                borderTopRightRadius: 0, // la esquina doblada necesita el ángulo vivo
                paddingHorizontal: 24,
                paddingTop: 30,
                paddingBottom: 34,
                transform: [{ rotate: `${inclinacion(id, 1.1)}deg` }],
                shadowColor: '#1E3326',
                shadowOpacity: 0.1,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 8 },
                elevation: 4,
              }}
            >
              <EsquinaDoblada size={22} mesa={PAPEL} />

              <Text
                style={{
                  fontFamily: SERIF,
                  fontSize: tam,
                  color: INK.title,
                  lineHeight: tam * 1.14,
                  letterSpacing: -0.4,
                }}
              >
                {titulo}
              </Text>

              {abierta ? (
                <Animated.View entering={FadeIn.duration(240)}>
                  <Text style={{ fontSize: 15, color: INK.body, lineHeight: 24, marginTop: 18 }}>
                    {narrativa.narrativa}
                  </Text>
                  {narrativa.intencion_predominante ? (
                    <View
                      style={{
                        marginTop: 18,
                        paddingLeft: 14,
                        borderLeftWidth: 2,
                        borderLeftColor: 'rgba(28,43,34,0.14)',
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '800', color: INK.faint, letterSpacing: 1, marginBottom: 5 }}>
                        LECTURA
                      </Text>
                      <Text style={{ fontSize: 14, color: INK.body, lineHeight: 21 }}>
                        {narrativa.intencion_predominante}
                      </Text>
                    </View>
                  ) : null}
                </Animated.View>
              ) : null}
            </Animated.View>
          </View>

          {/* El botón vive fuera del papel, como el pie de una lámina.
              Un chevrón en vez de la frase: dice «hay más abajo» sin que haya
              que leer nada, y al girar muestra en qué estado está — cosa que el
              texto solo podía decir cambiando de palabra. */}
          <View style={{ alignItems: 'center', marginTop: 18 }}>
            <Animated.View
              style={[
                {
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  borderWidth: 1,
                  borderColor: 'rgba(28,43,34,0.16)',
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                giro,
              ]}
            >
              <ChevronDown size={18} color={INK.body} />
            </Animated.View>

          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
