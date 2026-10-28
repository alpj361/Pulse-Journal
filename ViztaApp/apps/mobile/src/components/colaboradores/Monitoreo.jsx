import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react-native';
import { INK, MOTION, SERIF } from '../theme';
import { falla, listo } from '../../utils/haptics';
import { usePulseConnectionStore } from '../../state/pulseConnectionStore';
import { listarColaboradores, monitoreoCompartido, usarMonitoreo } from './api';
import { cuandoMiraTexto, esContacto, visibles } from './logica';
import { Avatar, Boton, ROTULO, TONO, nombreDe } from './piezas';
import MorphingInfinity from '../MorphingInfinity';

const AVISA = { urgentes: 'Avisa solo lo urgente', todo: 'Avisa todo lo que encuentra', silencio: 'No avisa: se mira en «Sigue»' };

/**
 * Un monitoreo que te compartieron: qué sigue y cómo (en lectura), y
 * «seguirlo con…» uno de tus agentes. Compartir un monitoreo es compartir su
 * estructura: corre en tu cuenta y ves tus propios hallazgos.
 */
export default function Monitoreo({ id, bottomInset = 0, onCerrar }) {
  const queryClient = useQueryClient();
  const usuario = usePulseConnectionStore((s) => s.connectedUser);
  const consulta = useQuery({ queryKey: ['colab-monitoreo', id], queryFn: () => monitoreoCompartido(id), retry: false });
  const agentes = useQuery({
    queryKey: ['colab-lista', usuario?.id],
    queryFn: async () => visibles(await listarColaboradores(), usuario.id),
    enabled: !!usuario?.id,
    staleTime: 1000 * 30,
  });
  const mios = (agentes.data || []).filter((c) => c.cuenta_tipo === 'agente' && !esContacto(c));
  const [eligiendo, setEligiendo] = useState(false);
  const [usando, setUsando] = useState(null);
  const [listoCon, setListoCon] = useState(null);
  const [fallo, setFallo] = useState(false);

  const e = consulta.data?.estructura || {};
  const s = consulta.data?.seguimiento || {};
  const tema = e.tema || s.tema || s.titulo || 'Monitoreo';
  const palabras = Array.isArray(e.keywords) ? e.keywords : [];
  const fuentes = Array.isArray(e.fuentes) ? e.fuentes : [];

  const usar = async (agente) => {
    if (usando) return;
    setUsando(agente.id);
    setFallo(false);
    try {
      await usarMonitoreo(id, { agent_id: agente.cuenta_id });
      listo();
      setListoCon(agente);
      queryClient.invalidateQueries({ queryKey: ['colab-seguimientos', agente.id] });
    } catch {
      falla();
      setFallo(true);
    } finally {
      setUsando(null);
    }
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onCerrar}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View entering={FadeIn.duration(180)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(28,43,34,0.35)' }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} accessibilityRole="button" accessibilityLabel="Cerrar" />
        </Animated.View>
        <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
          <Animated.View
            entering={FadeInDown.springify().damping(MOTION.enter.damping).stiffness(MOTION.enter.stiffness)}
            style={{ backgroundColor: '#FBFAF6', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%', paddingTop: 10, paddingBottom: bottomInset + 18 }}
          >
            <View style={{ alignSelf: 'center', width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(28,43,34,0.18)' }} />
            {consulta.isLoading ? (
              <MorphingInfinity size={28} color={INK.meta} style={{ alignSelf: 'center', marginVertical: 40 }} />
            ) : consulta.error ? (
              <View style={{ padding: 24, gap: 12 }}>
                <Text style={{ fontSize: 15, color: INK.body }}>No se pudo abrir este monitoreo.</Text>
                <Boton texto="probar de nuevo" onPress={() => consulta.refetch()} />
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, gap: 16 }}>
                <Text style={{ fontFamily: SERIF, fontSize: 28, lineHeight: 32, color: INK.title }} accessibilityRole="header">
                  {tema}
                </Text>
                {e.descripcion ? <Text style={{ fontSize: 14.5, lineHeight: 21, color: INK.body }}>{e.descripcion}</Text> : null}

                {palabras.length ? (
                  <View style={{ gap: 8 }}>
                    <Text style={ROTULO}>PALABRAS</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {palabras.map((p) => (
                        <View key={p} style={{ backgroundColor: 'rgba(28,43,34,0.06)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 }}>
                          <Text style={{ fontSize: 13, color: INK.title }}>{p}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {fuentes.length ? (
                  <View style={{ gap: 6 }}>
                    <Text style={ROTULO}>FUENTES</Text>
                    <Text style={{ fontSize: 14, lineHeight: 20, color: INK.body }}>
                      {fuentes.map((f) => (typeof f === 'string' ? f : f?.nombre || f?.tipo || '')).filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                ) : null}

                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 14, color: INK.body }}>{cuandoMiraTexto({ horas: e.horas })}</Text>
                  {e.modo_aviso ? <Text style={{ fontSize: 14, color: INK.body }}>{AVISA[e.modo_aviso] || ''}</Text> : null}
                </View>

                {listoCon ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, justifyContent: 'center' }}>
                    <Check size={17} color={TONO.verde} strokeWidth={2.4} />
                    <Text style={{ fontSize: 14.5, fontWeight: '600', color: TONO.verde }}>Lo sigue {nombreDe(listoCon)}</Text>
                  </View>
                ) : eligiendo ? (
                  <View style={{ gap: 4 }}>
                    <Text style={ROTULO}>SEGUIRLO CON</Text>
                    {mios.map((c) => (
                      <Pressable
                        key={c.id}
                        onPress={() => usar(c)}
                        disabled={!!usando}
                        accessibilityRole="button"
                        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}
                      >
                        <Avatar tipo="agente" nombre={nombreDe(c)} size={36} />
                        <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: INK.title }}>{nombreDe(c)}</Text>
                        {usando === c.id ? <MorphingInfinity size={16} color={INK.meta} /> : null}
                      </Pressable>
                    ))}
                    {!mios.length ? <Text style={{ fontSize: 13.5, color: INK.body }}>Conectá un agente para que lo siga por vos.</Text> : null}
                  </View>
                ) : (
                  <Boton texto="seguirlo con…" primario onPress={() => setEligiendo(true)} />
                )}
                {fallo ? <Text style={{ fontSize: 13, color: TONO.rojo }}>No se pudo. Probá de nuevo.</Text> : null}
              </ScrollView>
            )}
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}
