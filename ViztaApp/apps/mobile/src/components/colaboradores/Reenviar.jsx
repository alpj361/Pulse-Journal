import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react-native';
import { INK, MOTION, SERIF } from '../theme';
import { listo, roce } from '../../utils/haptics';
import { usePulseConnectionStore } from '../../state/pulseConnectionStore';
import { abrirChat, enviarMensaje, listarColaboradores } from './api';
import { visibles } from './logica';
import { Avatar, Boton, TONO, nombreDe } from './piezas';
import Elemento from './Elemento';
import MorphingInfinity from '../MorphingInfinity';

/**
 * Reenviar, como en WhatsApp: algo que se compartió (un ítem, un dashboard) a
 * uno o varios colaboradores, con una línea opcional. Va como un mensaje con
 * el adjunto a cada chat; del otro lado se abre en lectura.
 *
 * `adjunto` es el mismo que lleva un mensaje: `{ tipo, ref_id, meta }`.
 */
export default function Reenviar({ adjunto, excluir = null, bottomInset = 0, onCerrar }) {
  const usuario = usePulseConnectionStore((s) => s.connectedUser);
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [elegidos, setElegidos] = useState([]);
  const [texto, setTexto] = useState('');
  const [mandando, setMandando] = useState(false);
  const [fallo, setFallo] = useState(false);

  const lista = useQuery({
    queryKey: ['colab-lista', usuario?.id],
    queryFn: async () => visibles(await listarColaboradores(), usuario.id),
    enabled: !!usuario?.id,
    staleTime: 1000 * 30,
  });
  const candidatos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (lista.data || [])
      .filter((c) => c.id !== excluir)
      .filter((c) => !q || nombreDe(c).toLowerCase().includes(q));
  }, [lista.data, busqueda, excluir]);

  const alternar = (c) => {
    roce();
    setElegidos((prev) => (prev.some((x) => x.id === c.id) ? prev.filter((x) => x.id !== c.id) : [...prev, c]));
  };

  const mandar = async () => {
    if (!elegidos.length || mandando) return;
    setMandando(true);
    setFallo(false);
    try {
      for (const c of elegidos) {
        const conv = await abrirChat(c);
        await enviarMensaje(conv, { texto, adjuntos: [adjunto] });
        queryClient.invalidateQueries({ queryKey: ['colab-mensajes', conv] });
      }
      queryClient.invalidateQueries({ queryKey: ['colab-lista'] });
      listo();
      onCerrar();
    } catch {
      setFallo(true);
      setMandando(false);
    }
  };

  const meta = adjunto?.meta || {};

  return (
    <Modal visible transparent animationType="none" onRequestClose={onCerrar}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View entering={FadeIn.duration(180)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(28,43,34,0.35)' }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} accessibilityRole="button" accessibilityLabel="Cerrar" />
        </Animated.View>
        <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none">
          <Animated.View
            entering={FadeInDown.springify().damping(MOTION.enter.damping).stiffness(MOTION.enter.stiffness)}
            style={{
              backgroundColor: '#FBFAF6',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              maxHeight: '86%',
              paddingTop: 10,
              paddingHorizontal: 24,
              paddingBottom: bottomInset + 18,
              gap: 14,
            }}
          >
            <View style={{ alignSelf: 'center', width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(28,43,34,0.18)' }} />
            <Text style={{ fontFamily: SERIF, fontSize: 28, color: INK.title }} accessibilityRole="header">
              Reenviar
            </Text>

            <Elemento titulo={meta.titulo} tipo={meta.clave || meta.tipo || adjunto?.tipo} imagen={meta.imagen} />

            <TextInput
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="buscar a quién"
              placeholderTextColor={INK.faint}
              autoCorrect={false}
              accessibilityLabel="Buscar a quién reenviar"
              style={{
                height: 44,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: TONO.borde,
                backgroundColor: '#FFFFFF',
                paddingHorizontal: 12,
                fontSize: 15,
                color: INK.title,
              }}
            />

            <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 2 }}>
              {lista.isLoading ? <MorphingInfinity size={20} color={INK.meta} style={{ marginVertical: 12, alignSelf: 'center' }} /> : null}
              {candidatos.map((c) => {
                const si = elegidos.some((x) => x.id === c.id);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => alternar(c)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: si }}
                    accessibilityLabel={nombreDe(c)}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}
                  >
                    <Avatar tipo={c.cuenta_tipo} nombre={nombreDe(c)} size={38} />
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: INK.title }} numberOfLines={1}>
                      {nombreDe(c)}
                    </Text>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        borderWidth: si ? 0 : 1.5,
                        borderColor: 'rgba(28,43,34,0.2)',
                        backgroundColor: si ? TONO.verde : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {si ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                    </View>
                  </Pressable>
                );
              })}
              {!lista.isLoading && !candidatos.length ? (
                <Text style={{ fontSize: 13.5, color: INK.body, paddingVertical: 10 }}>{busqueda.trim() ? 'Nadie con ese nombre.' : 'Todavía no tenés a quién.'}</Text>
              ) : null}
            </ScrollView>

            {elegidos.length ? (
              <TextInput
                value={texto}
                onChangeText={setTexto}
                placeholder="escribí algo"
                placeholderTextColor={INK.faint}
                accessibilityLabel="Mensaje"
                style={{
                  minHeight: 44,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: TONO.borde,
                  backgroundColor: '#FFFFFF',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontSize: 15,
                  color: INK.title,
                }}
                multiline
              />
            ) : null}

            {fallo ? <Text style={{ fontSize: 13, color: TONO.rojo }}>No se pudo mandar. Probá de nuevo.</Text> : null}

            <Boton
              texto={elegidos.length > 1 ? `mandar a ${elegidos.length}` : 'mandar'}
              primario
              cargando={mandando}
              disabled={!elegidos.length}
              onPress={mandar}
            />
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
