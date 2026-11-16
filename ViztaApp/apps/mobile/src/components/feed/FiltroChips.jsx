import { Pressable, ScrollView, Text } from 'react-native';
import { INK } from '../theme';

/**
 * Filtros cortos compartidos por las noticias y el Congreso.
 *
 * `tenue` es un tema que la persona ocultó de su feed: sigue a mano, más
 * apagado.
 */
export default function FiltroChips({ opciones, valor, onCambiar }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 8 }} style={{ flexGrow: 0, marginVertical: 6 }}>
      {opciones.map(({ clave, nombre, cuenta, tenue }) => (
        <Pressable key={clave} onPress={() => onCambiar(clave)} accessibilityRole="button"
          accessibilityLabel={`${nombre}${cuenta == null ? '' : `, ${cuenta}`}${tenue ? ', oculto de tu feed' : ''}`}
          accessibilityState={{ selected: valor === clave }}
          style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 14,
            backgroundColor: valor === clave ? 'rgba(47,74,122,0.10)' : tenue ? 'transparent' : 'rgba(28,43,34,0.04)',
            borderWidth: tenue && valor !== clave ? 1 : 0, borderStyle: 'dashed', borderColor: 'rgba(28,43,34,0.14)',
            opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontSize: 12, color: valor === clave ? INK.title : tenue ? INK.faint : INK.meta, fontWeight: valor === clave ? '700' : '500' }}>
            {nombre.toLowerCase()}{cuenta == null ? '' : ` · ${cuenta}`}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
