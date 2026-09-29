import { useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView } from 'react-native';
import Animated, {
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  Bold,
  Italic,
  Highlighter,
  Code,
  Heading1,
  Heading2,
  ChevronDown,
  Type,
  List,
  ListOrdered,
  ListTodo,
  ListCollapse,
  Quote,
  IndentIncrease,
  IndentDecrease,
  Undo2,
  Redo2,
} from 'lucide-react-native';
import { MONO } from './mono';
import { roce } from '../../utils/haptics';

const TENUE = 'rgba(28,43,34,0.34)';
const TINTA = 'rgba(28,43,34,0.72)';

/**
 * Cómo se ve lo que se escribe.
 *
 * Aparece **solo mientras se escribe** y en el mismo lugar que la bandeja de
 * fotos y la grabadora: sobre el teclado, debajo del renglón en curso. Las tres
 * se excluyen —ocupan el mismo hueco— y ninguna tapa la nota.
 *
 * Los botones no abren menús ni submenús: son siete y caben en una tira. Un
 * selector de «estilo de párrafo» con desplegable sería un toque más para algo
 * que se usa a mitad de frase, con el pulgar y sin mirar.
 *
 * Cada uno es un interruptor: tocar negrita sobre texto ya en negrita lo
 * devuelve a normal, y tocar H1 sobre un título lo devuelve a cuerpo. Por eso
 * no hace falta un botón «quitar formato» — salvo para el párrafo, donde
 * «cuerpo» es el destino natural desde cualquiera de los dos títulos.
 */

/** Un botón de la tira. Glifo arriba, nombre abajo solo donde el glifo no basta. */
function Boton({ Icono, etiqueta, onPress, ancho = 44 }) {
  return (
    <Pressable
      onPress={() => {
        roce();
        onPress();
      }}
      style={({ pressed }) => ({
        minWidth: ancho,
        height: 40,
        paddingHorizontal: 10,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        // Sin fondo propio: dentro de una píldora, siete rectángulos teñidos
        // compiten entre sí. El toque se siente en el glifo, no en una caja.
        opacity: pressed ? 0.45 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
    >
      <Icono size={16} color={TINTA} />
    </Pressable>
  );
}

/**
 * `bloques`: con el editor de bloques la tira suma lo que ese editor sabe
 * hacer y la nota vieja no —listas, to-do, toggle, cita, sangría, deshacer—.
 * Es provisoria: la barra de tres filas llega con la F2.
 */
export default function BarraFormato({ onAccion, onCerrar, bloques = false }) {
  /**
   * Cómo entra.
   *
   * Sube unos milímetros, se abre de 0.96 a 1 y aparece, todo junto y en menos
   * de un cuarto de segundo. La mezcla es lo que la hace sentir material: un
   * fundido solo la deja apareciendo de la nada, y un deslizamiento largo la
   * vuelve el centro de atención de una pantalla donde lo importante es el
   * texto. El resorte está amortiguado para que no rebote — un rebote acá sería
   * una barra de herramientas llamando la atención sobre sí misma.
   */
  const entrada = useSharedValue(0);

  useEffect(() => {
    entrada.value = withSpring(1, { damping: 22, stiffness: 320, mass: 0.7 });
  }, [entrada]);

  const aparecer = useAnimatedStyle(() => ({
    opacity: withTiming(entrada.value, { duration: 140 }),
    transform: [
      { translateY: (1 - entrada.value) * 12 },
      { scale: 0.96 + entrada.value * 0.04 },
    ],
  }));

  return (
    <Animated.View
      exiting={FadeOut.duration(110)}
      style={[
        {
          marginHorizontal: 22,
          // Píldora, igual que la cápsula de acciones que tiene debajo: son la
          // misma familia de herramienta flotante y tienen que leerse así.
          borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(28,43,34,0.08)',
          shadowColor: '#14201A',
          shadowOpacity: 0.1,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
          paddingVertical: 6,
          paddingLeft: 6,
          paddingRight: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        aparecer,
      ]}
    >
      {/* Bajar la barra. Mismo chevron que la cámara y la galería: lo que está
          sobre el teclado baja, no se cierra. */}
      <Pressable
        onPress={() => {
          roce();
          onCerrar?.();
        }}
        hitSlop={10}
        style={{ padding: 6 }}
        accessibilityRole="button"
        accessibilityLabel="Bajar el formato"
      >
        <ChevronDown size={18} color={TENUE} />
      </Pressable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{ gap: 6, alignItems: 'center' }}
      >
        <Boton Icono={Heading1} etiqueta="Título grande" onPress={() => onAccion('h1')} />
        <Boton Icono={Heading2} etiqueta="Título" onPress={() => onAccion('h2')} />
        <Boton Icono={Type} etiqueta="Cuerpo" onPress={() => onAccion('cuerpo')} />

        {/* El corte entre lo que afecta al renglón entero y lo que afecta a lo
            seleccionado. Una línea y no un espacio: el espacio se lee como
            descuido y la línea, como que son dos familias. */}
        <View style={{ width: 1, height: 22, backgroundColor: 'rgba(28,43,34,0.10)', marginHorizontal: 2 }} />

        <Boton Icono={Bold} etiqueta="Negrita" onPress={() => onAccion('negrita')} />
        <Boton Icono={Italic} etiqueta="Cursiva" onPress={() => onAccion('cursiva')} />
        <Boton Icono={Highlighter} etiqueta="Resaltar" onPress={() => onAccion('resaltado')} />
        <Boton Icono={Code} etiqueta="Código" onPress={() => onAccion('codigo')} />

        {bloques ? (
          <>
            <View style={{ width: 1, height: 22, backgroundColor: 'rgba(28,43,34,0.10)', marginHorizontal: 2 }} />
            <Boton Icono={List} etiqueta="Viñetas" onPress={() => onAccion('vineta')} />
            <Boton Icono={ListOrdered} etiqueta="Numerada" onPress={() => onAccion('numerada')} />
            <Boton Icono={ListTodo} etiqueta="Por hacer" onPress={() => onAccion('todo')} />
            <Boton Icono={ListCollapse} etiqueta="Plegable" onPress={() => onAccion('toggle')} />
            <Boton Icono={Quote} etiqueta="Foco" onPress={() => onAccion('cita')} />
            <Boton Icono={IndentDecrease} etiqueta="Menos sangría" onPress={() => onAccion('desangrar')} />
            <Boton Icono={IndentIncrease} etiqueta="Más sangría" onPress={() => onAccion('sangrar')} />
            <View style={{ width: 1, height: 22, backgroundColor: 'rgba(28,43,34,0.10)', marginHorizontal: 2 }} />
            <Boton Icono={Undo2} etiqueta="Deshacer" onPress={() => onAccion('deshacer')} />
            <Boton Icono={Redo2} etiqueta="Rehacer" onPress={() => onAccion('rehacer')} />
          </>
        ) : null}
      </ScrollView>
    </Animated.View>
  );
}
