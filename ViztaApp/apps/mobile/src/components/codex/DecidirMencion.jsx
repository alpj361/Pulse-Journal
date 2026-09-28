import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { INK } from '../theme';
import { MONO } from './mono';
import { PAPEL } from './Papel';
import { TYPE_ACCENT, normalizeTipo } from './tipos';
import { supabase } from '../../utils/supabase';
import { roce, toque, falla } from '../../utils/haptics';

const TENUE = 'rgba(28,43,34,0.42)';
const colorDe = (item) => TYPE_ACCENT[normalizeTipo(item?.tipo)] || TYPE_ACCENT.Artefacto;

/**
 * ¿Es esta ficha? Tres respuestas: sí, es otra, no es nadie.
 *
 * Se abre sobre una mención dudosa —en una nota o en «por confirmar» de una
 * ficha—. La respuesta se guarda con el lugar donde se dijo, así que vuelve a
 * valer si la nota se edita en otra parte; y después del segundo «no» a la
 * misma frase («a viva voz»), deja de preguntarse en todos los textos.
 *
 * `mencion`: { candidatos: [item], escrito, contexto?, firma, firmaCorta }
 */
export default function DecidirMencion({ mencion, bottomInset = 0, onDecidido, onClose }) {
  const [otra, setOtra] = useState(false);
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setOtra(false);
    setQ('');
    setResultados([]);
    setError(null);
  }, [mencion?.firma]);

  useEffect(() => {
    const t = q.trim();
    if (!otra || t.length < 2) {
      setResultados([]);
      return undefined;
    }
    let vivo = true;
    const reloj = setTimeout(async () => {
      const { data } = await supabase.rpc('buscar_codex_para_referencia', { p_q: t, p_limite: 8 });
      if (vivo) setResultados(data || []);
    }, 260);
    return () => {
      vivo = false;
      clearTimeout(reloj);
    };
  }, [q, otra]);

  if (!mencion) return null;
  const candidatos = mencion.candidatos || [];

  const decidir = async (llamadas, resultado) => {
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      for (const args of llamadas) {
        const { error: e } = await supabase.rpc('codex_mencion_decidir', {
          p_firma: mencion.firma,
          p_firma_corta: mencion.firmaCorta,
          p_otro: null,
          ...args,
        });
        if (e) throw e;
      }
      toque();
      onDecidido?.(resultado);
    } catch {
      falla();
      setError('No se pudo guardar. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const esEsta = (item) => decidir([{ p_item: item.id, p_veredicto: 'si' }], { veredicto: 'si', item });
  const noEsNadie = () =>
    decidir(
      candidatos.map((c) => ({ p_item: c.id, p_veredicto: 'no' })),
      { veredicto: 'no' }
    );
  const esOtra = (elegida) =>
    decidir([{ p_item: candidatos[0]?.id, p_veredicto: 'no', p_otro: elegida.id }], { veredicto: 'si', item: elegida });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(20,28,22,0.35)' }} onPress={onClose} />
      <Animated.View
        entering={FadeInDown.duration(220).springify().damping(22)}
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          backgroundColor: PAPEL, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingTop: 22, paddingHorizontal: 24, paddingBottom: bottomInset + 22,
        }}
      >
        {mencion.contexto ? (
          <Contexto texto={mencion.contexto} escrito={mencion.escrito} />
        ) : null}

        {!otra ? (
          <View style={{ gap: 8, marginTop: mencion.contexto ? 18 : 0 }}>
            {candidatos.map((c) => (
              <Opcion key={c.id} onPress={() => esEsta(c)} disabled={enviando}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colorDe(c) }} />
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, color: INK.title }}>
                  es {c.name}
                </Text>
              </Opcion>
            ))}
            <Opcion onPress={() => { roce(); setOtra(true); }} disabled={enviando}>
              <Text style={{ flex: 1, fontSize: 15, color: INK.body }}>es otra ficha…</Text>
            </Opcion>
            <Opcion onPress={noEsNadie} disabled={enviando}>
              <Text style={{ flex: 1, fontSize: 15, color: INK.body }}>no es nadie</Text>
            </Opcion>
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(160)} style={{ marginTop: mencion.contexto ? 18 : 0 }}>
            <TextInput
              value={q}
              onChangeText={setQ}
              autoFocus
              placeholder="¿quién es?"
              placeholderTextColor="rgba(28,43,34,0.3)"
              autoCorrect={false}
              style={{
                fontFamily: MONO, fontSize: 14, color: INK.title,
                paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
                borderWidth: 1, borderColor: 'rgba(28,43,34,0.12)',
              }}
              accessibilityLabel="Buscar la ficha correcta"
            />
            <ScrollView style={{ maxHeight: 240, marginTop: 6 }} keyboardShouldPersistTaps="always">
              {resultados
                .filter((r) => !candidatos.some((c) => c.id === r.id))
                .map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => esOtra(r)}
                    disabled={enviando}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: 10,
                      paddingVertical: 11, paddingHorizontal: 4, opacity: pressed ? 0.5 : 1,
                    })}
                    accessibilityRole="button"
                    accessibilityLabel={`Es ${r.name}`}
                  >
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colorDe(r) }} />
                    <Text numberOfLines={1} style={{ flex: 1, fontFamily: MONO, fontSize: 13, color: INK.title }}>
                      {r.name}
                    </Text>
                  </Pressable>
                ))}
            </ScrollView>
          </Animated.View>
        )}

        {enviando ? <ActivityIndicator style={{ marginTop: 12 }} color={INK.faint} /> : null}
        {error ? <Text style={{ fontSize: 12.5, color: '#B91C1C', marginTop: 10 }}>{error}</Text> : null}
      </Animated.View>
    </Modal>
  );
}

function Opcion({ children, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingVertical: 13, paddingHorizontal: 16, borderRadius: 14,
        backgroundColor: pressed ? 'rgba(28,43,34,0.08)' : 'rgba(28,43,34,0.04)',
        opacity: disabled ? 0.5 : 1,
      })}
      accessibilityRole="button"
    >
      {children}
    </Pressable>
  );
}

/** La frase donde aparece, con el nombre marcado. */
function Contexto({ texto, escrito }) {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
  const i = escrito ? limpio.toLowerCase().indexOf(String(escrito).toLowerCase()) : -1;
  if (i < 0) {
    return (
      <Text numberOfLines={3} style={{ fontSize: 14, lineHeight: 21, color: TENUE }}>
        {limpio}
      </Text>
    );
  }
  const desde = Math.max(0, i - 90);
  const hasta = Math.min(limpio.length, i + escrito.length + 90);
  return (
    <Text numberOfLines={4} style={{ fontSize: 14, lineHeight: 21, color: TENUE }}>
      {desde > 0 ? '…' : ''}
      {limpio.slice(desde, i)}
      <Text style={{ color: INK.title, fontWeight: '700' }}>{limpio.slice(i, i + escrito.length)}</Text>
      {limpio.slice(i + escrito.length, hasta)}
      {hasta < limpio.length ? '…' : ''}
    </Text>
  );
}
