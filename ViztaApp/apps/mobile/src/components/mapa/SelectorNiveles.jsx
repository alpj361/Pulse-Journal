import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Layers, Minus, Plus } from 'lucide-react-native';
import { INK } from '../theme';
import { roce } from '../../utils/haptics';

/**
 * El interruptor de capas administrativas.
 *
 * **Los límites no viven pegados al mapa: se piden.** El mapa arranca limpio y
 * las fronteras aparecen cuando alguien las pide. El botón cerrado es «sin
 * límites»; no hay un tercer estado escondido.
 *
 * **Un nivel a la vez, no dos interruptores.** Departamento y municipio son la
 * misma frontera a dos escalas: los 336 municipios encima de los 22
 * departamentos dibujan dos veces cada borde exterior y tapan justo la forma
 * que uno intenta leer.
 *
 * **Ahora se sube y se baja, no se elige de una lista.**
 *
 * La lista anterior —«departamentos 22 / municipios 336 / otros 1»— ocupaba una
 * esquina entera del mapa de forma permanente y obligaba a leer tres filas para
 * hacer lo que casi siempre es un paso: bajar un nivel. Los niveles además no
 * son opciones sueltas sino una **escala ordenada**, de lo grande a lo chico, y
 * una lista no dice eso; dos botones de más y menos sí.
 *
 * El nombre del nivel no se queda escrito al lado: aparece arriba un momento
 * cuando cambia y se va. Es información de transición —«ahora estás en
 * municipios»— y dejarla fija es gastar espacio permanente en algo que solo
 * importa durante el segundo posterior al toque.
 */

const ANCHO_BOTON = 44;
const PAPEL = 'rgba(255,253,248,0.94)';
const LINEA = 'rgba(28,43,34,0.10)';
const VERDE_VIVO = '#3A6049';

export default function SelectorNiveles({ niveles, nivel, onCambiar }) {
  const abierto = Boolean(nivel);
  const indice = Math.max(0, niveles.findIndex((n) => n.clave === nivel));

  // El icono se inclina al abrir: alcanza para que el botón se sienta accionado
  // sin llamar la atención sobre sí mismo.
  const giro = useSharedValue(0);
  useEffect(() => {
    giro.value = withTiming(abierto ? 1 : 0, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [abierto, giro]);

  const estiloIcono = useAnimatedStyle(() => ({
    transform: [{ rotate: `${giro.value * -8}deg` }, { scale: 1 + giro.value * 0.06 }],
  }));

  const alternar = () => {
    roce();
    // Al abrir se entra por el nivel más grande: es el que orienta —22 formas
    // reconocibles— y desde ahí bajar es un toque.
    onCambiar(abierto ? null : niveles[0]?.clave || null);
  };

  const mover = (paso) => {
    const proximo = indice + paso;
    // Los topes no hacen nada en vez de dar la vuelta: pasar de «municipios» a
    // «departamentos» por seguir apretando el mismo botón desorienta, porque el
    // mapa salta a la escala opuesta sin que nadie lo pidiera.
    if (proximo < 0 || proximo >= niveles.length) return;
    roce();
    onCambiar(niveles[proximo].clave);
  };

  const hayAnterior = indice > 0;
  const haySiguiente = indice < niveles.length - 1;

  return (
    <View style={{ alignItems: 'flex-start' }}>
      <Pressable
        onPress={alternar}
        hitSlop={8}
        accessibilityRole="switch"
        accessibilityState={{ checked: abierto }}
        accessibilityLabel={abierto ? `límites: ${nivel}` : 'mostrar límites administrativos'}
        style={({ pressed }) => ({
          width: ANCHO_BOTON,
          height: ANCHO_BOTON,
          borderRadius: 4,
          backgroundColor: PAPEL,
          borderWidth: 1,
          borderColor: abierto ? 'rgba(58,96,73,0.45)' : LINEA,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Animated.View style={estiloIcono}>
          <Layers size={18} color={abierto ? VERDE_VIVO : INK.faint} />
        </Animated.View>
      </Pressable>

      {/* El escalón. Sale del botón hacia abajo, en la misma columna, así que la
          mano ya está donde aparece. Solo si hay más de un nivel: con uno solo,
          dos botones que no hacen nada son peor que ninguno. */}
      {abierto && niveles.length > 1 ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(140)}
          style={{
            marginTop: 6,
            width: ANCHO_BOTON,
            backgroundColor: PAPEL,
            borderWidth: 1,
            borderColor: LINEA,
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          {/* Más es «más detalle» —bajar a municipios—, no «más grande». Es la
              misma dirección que el zoom del mapa, y de las dos lecturas
              posibles conviene la que coincide con el gesto de al lado. */}
          <Paso
            Icono={Plus}
            activo={haySiguiente}
            onPress={() => mover(1)}
            etiqueta="Más detalle"
          />
          <View style={{ height: 1, backgroundColor: LINEA, marginHorizontal: 9 }} />
          <Paso
            Icono={Minus}
            activo={hayAnterior}
            onPress={() => mover(-1)}
            etiqueta="Menos detalle"
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

function Paso({ Icono, activo, onPress, etiqueta }) {
  return (
    <Pressable
      onPress={activo ? onPress : undefined}
      disabled={!activo}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: !activo }}
      style={({ pressed }) => ({
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
        // El tope se muestra apagado en vez de desaparecer: un botón que se va
        // mueve al otro de lugar, y la mano vuelve a un sitio donde ya no está
        // lo que buscaba.
        opacity: !activo ? 0.28 : pressed ? 0.5 : 1,
      })}
    >
      <Icono size={17} color={INK.body} strokeWidth={2} />
    </Pressable>
  );
}
