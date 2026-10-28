import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { INK, MOTION, SERIF } from '../theme';
import { roce } from '../../utils/haptics';
import { buscarPersonas, empezarConPersona } from './api';
import { Avatar, TONO } from './piezas';
import MorphingInfinity from '../MorphingInfinity';

/** Lo escrito, un momento después de dejar de escribir. */
function useEnPausa(valor, ms = 300) {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}

/**
 * Buscar a una persona por su nombre o usuario y empezar un chat con ella.
 * Al tocarla se abre la conversación y queda entre tus colaboradores.
 */
export default function BuscarPersona({ bottomInset = 0, onCerrar, onListo }) {
  const [texto, setTexto] = useState('');
  const q = useEnPausa(texto.trim());
  const [abriendo, setAbriendo] = useState(null);
  const [fallo, setFallo] = useState(false);

  const resultados = useQuery({
    queryKey: ['colab-personas', q],
    queryFn: () => buscarPersonas(q),
    enabled: q.length >= 2,
    staleTime: 1000 * 30,
    retry: false,
  });

  const elegir = async (p) => {
    if (abriendo) return;
    roce();
    setAbriendo(p.id);
    setFallo(false);
    try {
      onListo(await empezarConPersona(p));
    } catch {
      setFallo(true);
      setAbriendo(null);
    }
  };

  const lista = resultados.data || [];

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
              minHeight: '50%',
              maxHeight: '86%',
              paddingTop: 10,
              paddingHorizontal: 24,
              paddingBottom: bottomInset + 18,
              gap: 14,
            }}
          >
            <View style={{ alignSelf: 'center', width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(28,43,34,0.18)' }} />
            <Text style={{ fontFamily: SERIF, fontSize: 28, color: INK.title }} accessibilityRole="header">
              Buscar una persona
            </Text>
            <TextInput
              value={texto}
              onChangeText={setTexto}
              placeholder="nombre o usuario"
              placeholderTextColor={INK.faint}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel="Nombre o usuario"
              style={{
                height: 46,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: TONO.borde,
                backgroundColor: '#FFFFFF',
                paddingHorizontal: 12,
                fontSize: 15.5,
                color: INK.title,
              }}
            />
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 2 }}>
              {resultados.isFetching && !lista.length ? (
                <MorphingInfinity size={20} color={INK.meta} style={{ marginVertical: 12, alignSelf: 'center' }} />
              ) : null}
              {lista.map((p) => {
                const nombre = p.nombre || p.usuario || 'Sin nombre';
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => elegir(p)}
                    disabled={!!abriendo}
                    accessibilityRole="button"
                    accessibilityLabel={`Escribirle a ${nombre}`}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, opacity: pressed ? 0.6 : 1 })}
                  >
                    {p.avatar_url ? (
                      <Image source={{ uri: p.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} accessible={false} />
                    ) : (
                      <Avatar tipo="humano" nombre={nombre} size={40} />
                    )}
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: INK.title }} numberOfLines={1}>
                        {nombre}
                      </Text>
                      {p.usuario && p.usuario !== nombre ? (
                        <Text style={{ fontSize: 12.5, color: INK.meta }} numberOfLines={1}>
                          @{p.usuario}
                        </Text>
                      ) : null}
                    </View>
                    {abriendo === p.id ? <MorphingInfinity size={16} color={INK.meta} /> : null}
                  </Pressable>
                );
              })}
              {q.length >= 2 && !resultados.isFetching && !lista.length && !resultados.error ? (
                <Text style={{ fontSize: 13.5, color: INK.body, paddingVertical: 10 }}>Nadie con ese nombre.</Text>
              ) : null}
              {resultados.error || fallo ? (
                <Text style={{ fontSize: 13, color: TONO.rojo, paddingVertical: 10 }}>No se pudo buscar. Probá de nuevo.</Text>
              ) : null}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
