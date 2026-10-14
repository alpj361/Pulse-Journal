import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, X } from 'lucide-react-native';
import { INK } from '../theme';
import { RAYA, Rotulo, TINTA, Titulo } from '../feed/TarjetasCongreso';
import IconoCC from './IconoCC';
import { contraQuien, quienPidio, tonoDe, traerResolucion } from './observatorio';

/**
 * Una resolución de la Corte, abierta.
 *
 * Lo que dice la fila más lo que la Corte resolvió y por qué: el problema que
 * planteaba el caso, el criterio con que lo decidió, quién lo redactó, si
 * alguien votó en contra y cuánto tardó. Abajo, la sentencia en el sitio de la
 * CC. Los nombres van como los guardó el monitor.
 */
export default function DetalleCC({ resolucion, onClose }) {
  const insets = useSafeAreaInsets();
  const { data: d } = useQuery({
    queryKey: ['cc-resolucion', resolucion?.expediente],
    queryFn: () => traerResolucion(resolucion.expediente),
    enabled: !!resolucion,
    staleTime: 3600e3,
  });
  if (!resolucion) return null;
  const r = { ...resolucion, ...(d || {}) };
  const quien = quienPidio(r);
  const contra = contraQuien(r);
  const varios = r.solicitante_clase === 'VARIOS' && !r.materia_protegida ? r.solicitante_nombre : null;
  const provisional = r.cautelar === 'OTORGADO' || r.cautelar === 'DECRETADA';

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(20,32,26,0.42)', justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={{ maxHeight: '90%', backgroundColor: '#FBFAF6', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Math.max(insets.bottom, 18) }}>
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            <View style={{ width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(28,43,34,0.18)' }} />
          </View>
          <Pressable onPress={onClose} hitSlop={14} accessibilityRole="button" accessibilityLabel="Cerrar" style={{ position: 'absolute', right: 20, top: 20, zIndex: 2 }}>
            <X size={20} color={INK.meta} />
          </Pressable>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingTop: 20, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, paddingRight: 30 }}>
              <IconoCC codigo={r.materia} size={44} />
              <View style={{ flex: 1 }}>
                <Rotulo>{[r.materia_etiqueta, r.via_etiqueta].filter(Boolean).join(' · ').toUpperCase()}</Rotulo>
                <Text style={{ fontSize: 11.5, color: INK.faint }}>
                  Expediente {r.expediente}
                  {r.fecha ? ` · ${r.fecha}` : ''}
                </Text>
              </View>
            </View>
            <Titulo>{r.titulo}</Titulo>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <IconoCC codigo={r.resultado} size={30} />
              <Text style={{ fontSize: 15, fontWeight: '700', color: tonoDe(r.resultado) }}>{r.resultado_etiqueta}</Text>
            </View>
            {provisional ? <Text style={{ fontSize: 12.5, color: INK.faint, marginTop: 4 }}>Con amparo provisional</Text> : null}

            {r.resumen ? <Text style={{ fontSize: 15.5, color: INK.title, lineHeight: 24, marginTop: 16 }}>{r.resumen}</Text> : null}

            <Seccion>
              <Dato nombre="QUIÉN PIDIÓ">
                {quien.reservado ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <IconoCC codigo="NOMBRE_RESERVADO" size={22} />
                    <Text style={{ fontSize: 14.5, color: INK.title, fontStyle: 'italic' }}>Nombre reservado</Text>
                  </View>
                ) : (
                  <Texto>{varios || quien.texto}</Texto>
                )}
              </Dato>
              {contra ? (
                <Dato nombre="CONTRA">
                  <Texto>{contra}</Texto>
                </Dato>
              ) : null}
              {r.tema_etiqueta ? (
                <Dato nombre="TEMA">
                  <Texto>{r.tema_etiqueta}</Texto>
                </Dato>
              ) : null}
            </Seccion>

            {r.problema_juridico ? (
              <Seccion>
                <Dato nombre="LO QUE HABÍA QUE DECIDIR">
                  <Texto>{r.problema_juridico}</Texto>
                </Dato>
              </Seccion>
            ) : null}
            {r.criterio_juridico ? (
              <Seccion>
                <Dato nombre="CÓMO LO DECIDIÓ LA CORTE">
                  <Texto>{r.criterio_juridico}</Texto>
                </Dato>
              </Seccion>
            ) : null}

            {(r.ponentes || []).length || r.n_magistrados || r.dias_total ? (
              <Seccion>
                {(r.ponentes || []).length ? (
                  <Dato nombre={r.ponentes.length > 1 ? 'PONENTES' : 'PONENTE'}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <IconoCC codigo="MAGISTRADO" size={22} />
                      <Texto>{r.ponentes.join(', ')}</Texto>
                    </View>
                  </Dato>
                ) : null}
                {(r.disidentes || []).length ? (
                  <Dato nombre="VOTARON EN CONTRA">
                    <Texto>{r.disidentes.join(', ')}</Texto>
                  </Dato>
                ) : r.n_magistrados ? (
                  <Text style={{ fontSize: 13, color: INK.body }}>Sin votos en contra · {r.n_magistrados} magistrados</Text>
                ) : null}
                {r.dias_total ? <Text style={{ fontSize: 13, color: INK.body }}>{r.dias_total.toLocaleString('es-GT')} días desde que empezó el caso</Text> : null}
              </Seccion>
            ) : null}

            {r.enlace_oficial ? (
              <Pressable
                onPress={() => Linking.openURL(r.enlace_oficial).catch(() => {})}
                accessibilityRole="link"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 24, paddingVertical: 6 }}
              >
                <Text style={{ fontSize: 13.5, fontWeight: '600', color: TINTA }}>La sentencia en la CC</Text>
                <ArrowUpRight size={15} color={TINTA} />
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Seccion({ children }) {
  return <View style={{ marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: RAYA, gap: 12 }}>{children}</View>;
}

function Dato({ nombre, children }) {
  return (
    <View>
      <Rotulo color={INK.faint}>{nombre}</Rotulo>
      {children}
    </View>
  );
}

function Texto({ children }) {
  return <Text style={{ fontSize: 14.5, color: INK.title, lineHeight: 21 }}>{children}</Text>;
}
