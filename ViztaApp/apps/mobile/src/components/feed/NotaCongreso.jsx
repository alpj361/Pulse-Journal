import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, X } from 'lucide-react-native';
import { INK } from '../theme';
import { titular, traerNota } from './congreso';
import { AFavor, Camino, RAYA, Rotulo, TINTA, Titulo, cabezaDe, monto, rotuloDe } from './TarjetasCongreso';

/**
 * Una nota del Congreso, abierta.
 *
 * En el feed cada nota es un título y tres renglones. Acá va entera: el título
 * completo, el resumen sin cortar, quiénes aparecen y, cuando el monitor leyó
 * la nota, su texto. Lo que no se sabe no se muestra; abajo queda la puerta a
 * la nota en el sitio del Congreso.
 */
export default function NotaCongreso({ item, onClose }) {
  const insets = useSafeAreaInsets();
  const { data: nota } = useQuery({
    queryKey: ['congreso-nota', item?.id],
    queryFn: () => traerNota(item.id),
    enabled: !!item,
    staleTime: 60 * 60 * 1000,
  });

  if (!item) return null;

  const d = item.card_data || {};
  const numero = item.iniciativa_numero || d.iniciativa_numero || null;
  const rotulo = rotuloDe(item);
  const cabeza = cabezaDe(item);
  const entero = /\btuit\b/i.test(item.summary || '') ? null : item.summary;
  const cifra = item.card_type === 'cifra' ? monto(d.amount, d.unit) : null;
  // Con titular propio (la persona, el título entero de la página) el resumen
  // va completo; si el titular salió de su primera oración, va lo que sigue.
  const [titulo, resumen] =
    item.card_type === 'ficha' && d.name
      ? [d.name, entero]
      : nota?.tituloEntero
        ? [tituloLegible(nota.tituloEntero), entero]
        : cifra
          ? [titular(item.titulo), entero]
          : [cabeza.titulo, cabeza.resumen];
  const quienes = (nota?.actors || []).filter(Boolean);
  const destino = nota?.url || item.url;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(20,32,26,0.42)', justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={{
            maxHeight: '88%',
            backgroundColor: '#FBFAF6',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingBottom: Math.max(insets.bottom, 18),
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            <View style={{ width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(28,43,34,0.18)' }} />
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={14}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            style={{ position: 'absolute', right: 20, top: 20, zIndex: 2 }}
          >
            <X size={20} color={INK.meta} />
          </Pressable>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingTop: 22, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
            {rotulo ? <Rotulo>{rotulo}</Rotulo> : null}
            <View style={{ paddingRight: 26 }}>
              <Titulo>{titulo}</Titulo>
            </View>
            {item.card_type === 'ficha' && (d.role || d.result) ? (
              <Text style={{ fontSize: 14, color: INK.body, marginTop: 5 }}>{[d.role, d.result].filter(Boolean).join(' · ')}</Text>
            ) : null}

            {cifra ? (
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 32, fontWeight: '700', letterSpacing: -0.8, color: INK.title }}>{cifra}</Text>
                {d.subject ? <Text style={{ fontSize: 14, color: TINTA, lineHeight: 20, marginTop: 2 }}>{d.subject}</Text> : null}
              </View>
            ) : null}

            {item.card_type === 'timeline' && numero ? <Camino etapa={item.stage} /> : null}
            <AFavor cuantos={item.votes?.favor} />

            {resumen ? (
              <Text style={{ fontSize: 16, color: INK.title, lineHeight: 25, marginTop: 18 }}>{resumen}</Text>
            ) : null}

            {nota?.iniciativa_titulo || nota?.comision_name ? (
              <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: RAYA, gap: 12 }}>
                {nota.iniciativa_titulo ? <Dato nombre={numero ? `INICIATIVA ${numero}` : 'INICIATIVA'}>{nota.iniciativa_titulo}</Dato> : null}
                {nota.comision_name ? <Dato nombre="COMISIÓN">{nota.comision_name}</Dato> : null}
              </View>
            ) : null}

            {quienes.length ? (
              <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: RAYA }}>
                <Dato nombre="QUIÉNES">{quienes.join(' · ')}</Dato>
              </View>
            ) : null}

            {nota?.parrafos?.length ? (
              <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: RAYA }}>
                <Rotulo color={INK.faint}>LA NOTA</Rotulo>
                {nota.parrafos.map((parrafo, i) => (
                  <Text key={i} style={{ fontSize: 14.5, color: INK.body, lineHeight: 23, marginTop: i ? 12 : 4 }}>
                    {parrafo}
                  </Text>
                ))}
              </View>
            ) : null}

            {destino ? (
              <Pressable
                onPress={() => Linking.openURL(destino).catch(() => {})}
                accessibilityRole="link"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 24, paddingVertical: 6 }}
              >
                <Text style={{ fontSize: 13.5, fontWeight: '600', color: TINTA }}>En el sitio del Congreso</Text>
                <ArrowUpRight size={15} color={TINTA} />
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Dato({ nombre, children }) {
  return (
    <View>
      <Rotulo color={INK.faint}>{nombre}</Rotulo>
      <Text style={{ fontSize: 14.5, color: INK.title, lineHeight: 21 }}>{children}</Text>
    </View>
  );
}

/** El título sacado de la página viene en mayúsculas: se pasa a oración. */
function tituloLegible(t) {
  const letras = t.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '');
  if (letras !== letras.toUpperCase()) return t;
  const bajo = t.toLowerCase();
  return bajo.charAt(0).toUpperCase() + bajo.slice(1);
}
