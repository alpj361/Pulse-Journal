import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Layers } from 'lucide-react-native';
import { INK } from '../theme';
import { MONO } from '../codex/mono';
import { roce } from '../../utils/haptics';

/**
 * El interruptor de capas administrativas.
 *
 * **Los límites no viven pegados al mapa: se piden.** Antes las 358 fronteras
 * estaban siempre encima, y el mapa de abajo —calles, nombres, relieve— se leía
 * a través de una reja. Acá el mapa arranca limpio y las fronteras aparecen
 * cuando alguien las pide, que es cuando le sirven. El botón cerrado es «sin
 * límites»; no hay un tercer estado escondido que haya que ir a buscar.
 *
 * **Un nivel a la vez, no dos interruptores.** Departamento y municipio son la
 * misma frontera a dos escalas: los 336 municipios encima de los 22
 * departamentos dibujan dos veces cada borde exterior y tapan justo la forma que
 * uno está tratando de leer. Elegir uno es lo que casi siempre se quiere, y lo
 * que evita el estado feo por defecto.
 *
 * **El panel se despliega hacia abajo desde el botón.** Sale de donde se tocó,
 * así que la mano ya está donde aparecen las opciones y no hay que ir a
 * buscarlas a otra esquina.
 */

const ANCHO_BOTON = 44;
const FILA = 34;
const ANCHO_PANEL = 158;
const PAPEL = 'rgba(255,253,248,0.94)';
const LINEA = 'rgba(28,43,34,0.10)';
const VERDE_VIVO = '#3A6049';

export default function SelectorNiveles({ niveles, nivel, onCambiar }) {
  const abierto = Boolean(nivel);

  // El pulgar detrás de la fila activa. Es un solo valor que resbala entre
  // posiciones: la transición cuenta de dónde a dónde se fue, cosa que dos
  // fondos apareciendo y desapareciendo no puede decir.
  const indice = Math.max(0, niveles.findIndex((n) => n.clave === nivel));
  const pulgar = useSharedValue(indice);

  useEffect(() => {
    pulgar.value = withSpring(indice, { damping: 15, stiffness: 180 });
  }, [indice, pulgar]);

  const estiloPulgar = useAnimatedStyle(() => ({
    transform: [{ translateY: pulgar.value * FILA }],
  }));

  // El icono se inclina al abrir. Es un grado de giro, no una vuelta: alcanza
  // para que el botón se sienta accionado sin llamar la atención sobre sí mismo.
  const giro = useSharedValue(0);
  useEffect(() => {
    giro.value = withTiming(abierto ? 1 : 0, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [abierto, giro]);

  const estiloIcono = useAnimatedStyle(() => ({
    transform: [{ rotate: `${giro.value * -8}deg` }, { scale: 1 + giro.value * 0.06 }],
  }));

  const alternar = () => {
    roce();
    // Cerrado es «sin límites». Al abrir se entra por el nivel más grande: es el
    // que orienta —22 formas que uno reconoce— y desde ahí bajar a municipio es
    // un toque más.
    onCambiar(abierto ? null : niveles[0]?.clave || null);
  };

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

      {abierto ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(140)}
          style={{
            marginTop: 6,
            width: ANCHO_PANEL,
            backgroundColor: PAPEL,
            borderWidth: 1,
            borderColor: LINEA,
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: 0,
                right: 0,
                height: FILA,
                backgroundColor: 'rgba(58,96,73,0.12)',
              },
              estiloPulgar,
            ]}
          />

          {niveles.map(({ clave, etiqueta, cuantos }, i) => {
            const activo = clave === nivel;
            return (
              <Pressable
                key={clave}
                onPress={() => {
                  if (activo) return;
                  roce();
                  onCambiar(clave);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: activo }}
                style={({ pressed }) => ({
                  height: FILA,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 10,
                  opacity: pressed ? 0.55 : 1,
                })}
              >
                {/* El trazo dice la jerarquía sin depender de leer: el nivel que
                    contiene es el grueso, el contenido el fino. */}
                <View
                  style={{
                    width: 13,
                    height: i === 0 ? 2.5 : 1,
                    backgroundColor: activo ? VERDE_VIVO : 'rgba(28,43,34,0.3)',
                  }}
                />
                <Text
                  style={{
                    fontFamily: MONO,
                    fontSize: 11.5,
                    color: activo ? INK.title : 'rgba(28,43,34,0.5)',
                    flex: 1,
                  }}
                >
                  {etiqueta}
                </Text>
                <Text style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(28,43,34,0.32)' }}>
                  {cuantos}
                </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      ) : null}
    </View>
  );
}
