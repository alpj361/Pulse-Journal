import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { INK, MOTION, SERIF } from '../theme';
import { roce } from '../../utils/haptics';
import { avisosDeAgente, cambiarAvisosDeAgente, desconectarAvisosDeAgente } from './api';
import { EVENTOS_DE_AGENTE, HORAS_PARA_ELEGIR, MAX_HORAS, alternarHora, horaLegible, horasEnPalabras } from './logica';
import { ROTULO, TONO } from './piezas';

/**
 * Los controles de avisos: a qué horas mira un tema, y qué le llega a un
 * agente que se enteró solo (uno que corre en su propio servidor y se conectó
 * a sus avisos por MCP). Nada de esto se llama webhook en pantalla, y no hay
 * textos que expliquen cómo funciona: solo los controles.
 */

/**
 * A qué horas mira un tema. Solo se abre si el backend deja elegirlas
 * (`horas`). Lo demás —«avisame si pasa tal cosa», «si sube de intensidad»—
 * se le pide al agente en el chat y él lo configura.
 */
export function HorasDelTema({ seguimiento: s, bottomInset, onCambiar, onCerrar }) {
  const [horas, setHoras] = useState(s.horas || []);

  const tocarHora = async (h) => {
    const siguiente = alternarHora(horas, h);
    if (siguiente.join() === horas.join()) {
      if (horas.length >= MAX_HORAS && !horas.includes(h)) Alert.alert(`Hasta ${MAX_HORAS} horas por tema`);
      return;
    }
    roce();
    const antes = horas;
    setHoras(siguiente);
    const ok = await onCambiar({ horas: siguiente });
    if (!ok) setHoras(antes);
  };

  const opciones = [...new Set([...HORAS_PARA_ELEGIR, ...horas])].sort();

  return (
    <Modal visible transparent animationType="none" onRequestClose={onCerrar}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View entering={FadeIn.duration(180)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(28,43,34,0.35)' }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} accessibilityRole="button" accessibilityLabel="Cerrar" />
        </Animated.View>
        <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
          <Animated.View
            entering={FadeInDown.springify().damping(MOTION.enter.damping).stiffness(MOTION.enter.stiffness)}
            style={{
              backgroundColor: '#FBFAF6',
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingTop: 10,
              paddingHorizontal: 24,
              paddingBottom: bottomInset + 22,
              gap: 16,
            }}
          >
            <View style={{ alignSelf: 'center', width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(28,43,34,0.18)' }} />
            <View style={{ gap: 4 }}>
              <Text style={{ fontFamily: SERIF, fontSize: 28, color: INK.title }} accessibilityRole="header">
                Cuándo mira
              </Text>
              <Text style={{ fontSize: 13.5, lineHeight: 19, color: INK.body }} numberOfLines={2}>
                {s.tema}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {opciones.map((h) => {
                const si = horas.includes(h);
                return (
                  <Pressable
                    key={h}
                    onPress={() => tocarHora(h)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: si }}
                    style={({ pressed }) => ({
                      height: 38,
                      minWidth: 74,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: si ? INK.title : '#FFFFFF',
                      borderWidth: si ? 0 : 1,
                      borderColor: TONO.borde,
                      transform: [{ scale: pressed ? 0.95 : 1 }],
                    })}
                  >
                    <Text style={{ fontSize: 13.5, fontWeight: '600', color: si ? '#FFFFFF' : INK.body }}>{horaLegible(h)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ fontSize: 12.5, color: INK.meta }}>
              Todos los días {horasEnPalabras(horas)}, hora de Guatemala. Hasta {MAX_HORAS}.
            </Text>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Qué le avisamos a un agente conectado, en su ficha. Si no se conectó (o el
 * backend todavía no lo tiene), no se muestra nada.
 */
export function AvisosDelAgente({ colaborador, nombre }) {
  const queryClient = useQueryClient();
  const clave = ['colab-avisos-agente', colaborador.id];
  const consulta = useQuery({
    queryKey: clave,
    queryFn: () => avisosDeAgente(colaborador.id),
    staleTime: 1000 * 30,
    retry: false,
  });
  const estado = consulta.data;
  if (!estado?.conectado) return null;

  const cambiar = async (cambios) => {
    const antes = estado;
    queryClient.setQueryData(clave, { ...estado, ...cambios });
    try {
      const r = await cambiarAvisosDeAgente(colaborador.id, cambios);
      if (r && typeof r === 'object' && 'conectado' in r) queryClient.setQueryData(clave, r);
    } catch {
      queryClient.setQueryData(clave, antes);
      Alert.alert('No se pudo cambiar', 'Revisá la conexión y probá de nuevo.');
    }
  };

  const alternarEvento = (ev, valor) => {
    roce();
    const actuales = new Set(estado.eventos || []);
    if (valor) actuales.add(ev);
    else actuales.delete(ev);
    cambiar({ eventos: [...actuales] });
  };

  const desconectar = () => {
    Alert.alert(`¿Dejar de avisarle a ${nombre}?`, null, [
      { text: 'cancelar', style: 'cancel' },
      {
        text: 'dejar de avisarle',
        style: 'destructive',
        onPress: async () => {
          try {
            await desconectarAvisosDeAgente(colaborador.id);
            queryClient.invalidateQueries({ queryKey: clave });
          } catch {
            Alert.alert('No se pudo cambiar', 'Revisá la conexión y probá de nuevo.');
          }
        },
      },
    ]);
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={ROTULO}>LE AVISAMOS</Text>
      <View style={{ backgroundColor: 'rgba(255,255,255,0.78)', borderWidth: 1, borderColor: 'rgba(28,43,34,0.08)', borderRadius: 18, overflow: 'hidden' }}>
        {EVENTOS_DE_AGENTE.map((ev, i) => (
          <Animated.View
            key={ev.clave}
            entering={FadeIn.duration(220)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 11,
              paddingHorizontal: 16,
              borderTopWidth: i ? 1 : 0,
              borderTopColor: 'rgba(28,43,34,0.06)',
            }}
          >
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: INK.title }}>{ev.texto}</Text>
              <Text style={{ fontSize: 12.5, color: INK.meta }}>{ev.meta}</Text>
            </View>
            <Switch
              value={(estado.eventos || []).includes(ev.clave)}
              onValueChange={(v) => alternarEvento(ev.clave, v)}
              trackColor={{ true: TONO.verde, false: 'rgba(28,43,34,0.14)' }}
              ios_backgroundColor="rgba(28,43,34,0.14)"
              accessibilityLabel={ev.texto}
            />
          </Animated.View>
        ))}
      </View>
      {estado.ultimo_error ? (
        <Text style={{ fontSize: 12.5, color: TONO.ladrillo }}>No le están llegando: revisá que {nombre} siga prendido.</Text>
      ) : null}
      <Pressable onPress={desconectar} hitSlop={8} accessibilityRole="button" style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.5 : 1 })}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: INK.meta }}>dejar de avisarle</Text>
      </Pressable>
    </View>
  );
}
