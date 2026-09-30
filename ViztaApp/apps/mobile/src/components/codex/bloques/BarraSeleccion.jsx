import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useStore } from 'zustand';
import * as Clipboard from 'expo-clipboard';
import { ArrowDown, ArrowUp, Check, Copy, Trash2 } from 'lucide-react-native';
import { MONO } from '../mono';
import { roce, toque } from '../../../utils/haptics';

const TINTA = 'rgba(28,43,34,0.72)';
const APAGADO = 'rgba(28,43,34,0.22)';

/**
 * Lo que se hace con los bloques elegidos. Aparece en lugar de la tira de
 * formato mientras se eligen: subir, bajar, copiar, borrar y salir.
 *
 * Arrastrar también mueve —desde la manija de cada bloque—; los botones son
 * para cuando hay que mover uno o dos lugares sin tener que apuntar.
 */
export default function BarraSeleccion({ editor }) {
  const cuantos = useStore(editor, (s) => s.seleccionados.length);
  const hay = cuantos > 0;
  const accion = (fn) => () => {
    if (!hay) return;
    roce();
    fn();
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      exiting={FadeOut.duration(110)}
      style={{
        marginHorizontal: 22,
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
        paddingHorizontal: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <Text style={{ fontFamily: MONO, fontSize: 11, color: APAGADO, marginRight: 4, minWidth: 18 }}>{cuantos || ''}</Text>
      <Boton Icono={ArrowUp} etiqueta="subir" activo={hay} onPress={accion(() => editor.getState().moverSeleccion(-1))} />
      <Boton Icono={ArrowDown} etiqueta="bajar" activo={hay} onPress={accion(() => editor.getState().moverSeleccion(1))} />
      <Boton
        Icono={Copy}
        etiqueta="copiar"
        activo={hay}
        onPress={accion(async () => {
          await Clipboard.setStringAsync(editor.getState().copiarSeleccion());
          toque();
        })}
      />
      <Boton Icono={Trash2} etiqueta="borrar" activo={hay} onPress={accion(() => editor.getState().borrarSeleccion())} />
      <View style={{ flex: 1 }} />
      <Boton
        Icono={Check}
        etiqueta="listo"
        activo
        onPress={() => {
          roce();
          editor.getState().salirSeleccion();
        }}
      />
    </Animated.View>
  );
}

function Boton({ Icono, etiqueta, onPress, activo }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!activo}
      style={({ pressed }) => ({ minWidth: 44, height: 40, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.45 : 1 })}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
    >
      <Icono size={16} color={activo ? TINTA : APAGADO} />
    </Pressable>
  );
}
