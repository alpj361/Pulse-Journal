import { Pressable, ScrollView, Text } from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';
import { INK } from '../theme';

/**
 * Filtros cortos compartidos por las noticias y el Congreso.
 *
 * `tenue` es un tema que la persona ocultó de su feed: sigue a mano, más
 * apagado. `onAjustar` agrega al final el chip que abre el ajuste del feed.
 */
export default function FiltroChips({ opciones, valor, onCambiar, onAjustar }) {
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
      {onAjustar ? (
        <Pressable onPress={onAjustar} accessibilityRole="button" accessibilityLabel="Ajustar tu feed"
          style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, borderRadius: 14,
            backgroundColor: 'rgba(28,43,34,0.04)', opacity: pressed ? 0.6 : 1 })}>
          <SlidersHorizontal size={13} color={INK.meta} strokeWidth={2.2} />
          <Text style={{ fontSize: 12, color: INK.meta, fontWeight: '500' }}>ajustar</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
