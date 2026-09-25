import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { FileText, X } from 'lucide-react-native';
import { INK } from '../theme';
import { MONO } from './mono';

const TENUE = 'rgba(28,43,34,0.42)';

function peso(bytes) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Lo que se dice debajo del nombre. En una nota normal, solo el peso: el
 * documento es apoyo y no se lee. En una historia se dice lo que importa de la
 * lectura, y solo cuando hay algo que decir: que entró una parte —el límite de
 * páginas—, o que no tenía texto. Que se leyó entero no se anuncia.
 */
function detalle(doc, esHistoria) {
  if (doc.subiendo) return 'subiendo…';
  if (doc.error === 'subida') return 'no se pudo subir';
  if (esHistoria && doc.estado === 'listo' && doc.paginas && doc.paginas_leidas < doc.paginas) {
    return `se leyeron ${doc.paginas_leidas} de ${doc.paginas} páginas`;
  }
  if (esHistoria && doc.estado === 'error') {
    return doc.error === 'sin_texto' ? 'no tiene texto para leer' : 'no se pudo leer';
  }
  return peso(doc.tamano);
}

/**
 * Los documentos de una nota, uno debajo del otro. Tocar uno lo abre; la X lo
 * quita de la nota.
 */
export default function DocumentosNota({ documentos, esHistoria, onAbrir, onQuitar }) {
  if (!documentos?.length) return null;

  return (
    <View style={{ marginTop: 18, gap: 8 }}>
      {documentos.map((doc) => {
        const linea = detalle(doc, esHistoria);
        return (
          <Animated.View
            key={doc.clave}
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(140)}
            layout={LinearTransition.springify().damping(22)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(28,43,34,0.12)',
            }}
          >
            <Pressable
              onPress={() => onAbrir?.(doc)}
              disabled={doc.subiendo || !doc.storage_path}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 11,
                paddingVertical: 11,
                paddingLeft: 14,
                opacity: pressed ? 0.5 : 1,
              })}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${doc.nombre}`}
            >
              {doc.subiendo ? (
                <ActivityIndicator size="small" color={INK.faint} />
              ) : (
                <FileText size={18} color="rgba(28,43,34,0.6)" strokeWidth={1.7} />
              )}
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 14.5, color: INK.body }}>
                  {doc.nombre}
                </Text>
                {linea ? (
                  <Text numberOfLines={1} style={{ fontFamily: MONO, fontSize: 11, color: TENUE, marginTop: 2 }}>
                    {linea}
                  </Text>
                ) : null}
              </View>
            </Pressable>
            <Pressable
              onPress={() => onQuitar?.(doc)}
              hitSlop={8}
              style={({ pressed }) => ({ padding: 12, opacity: pressed ? 0.5 : 1 })}
              accessibilityRole="button"
              accessibilityLabel={`Quitar ${doc.nombre} de la nota`}
            >
              <X size={15} color={TENUE} />
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}
