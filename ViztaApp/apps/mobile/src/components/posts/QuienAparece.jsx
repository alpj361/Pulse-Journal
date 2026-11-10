import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Check, Search, UserPlus, UserRound, X } from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import { PAPEL } from '../codex/Papel';
import { MONO } from '../codex/mono';
import MorphingInfinity from '../MorphingInfinity';
import { MOTIVOS_VOZ } from '../huella/logica';
import { buscarPersonas } from './capaPost';
import { roce } from '../../utils/haptics';

const TENUE = 'rgba(28,43,34,0.35)';
const RAYA = 'rgba(28,43,34,0.08)';

/**
 * Decir quién aparece en un post: alguien que el análisis no detectó o, con
 * `voz`, quién es una voz sin nombre.
 *
 * Se busca en el Codex o se crea por su nombre. Para una voz se pide además
 * cómo se sabe (los mismos motivos que en la huella): queda con la revisión.
 * `onElegir({ persona, nombreNuevo, motivo })` guarda; la hoja se cierra al
 * terminar.
 */
export default function QuienAparece({ voz = null, sugeridos = [], onElegir, onClose, topInset = 0, bottomInset = 0 }) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [elegida, setElegida] = useState(null); // { persona } | { nombreNuevo }
  const [motivo, setMotivo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Se espera a que el dedo pare: sin esto sería una consulta por tecla.
    const t = setTimeout(async () => {
      if (q.trim().length < 2) return setResultados([]);
      setBuscando(true);
      try {
        setResultados(await buscarPersonas(q));
      } catch {
        setResultados([]);
      }
      setBuscando(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const nombre = q.trim();
  const yaExiste = resultados.some((r) => r.name.toLowerCase() === nombre.toLowerCase());
  const listo = !!elegida && (!voz || !!motivo);

  const guardar = async () => {
    if (!listo || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      await onElegir({ ...elegida, motivo });
      onClose();
    } catch (e) {
      setError(e?.message || 'No se pudo guardar.');
      setGuardando(false);
    }
  };

  const nombreElegido = elegida?.persona?.name || elegida?.nombreNuevo;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: PAPEL }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: Math.max(topInset, 12) + 4, paddingHorizontal: 18 }}>
          <Pressable onPress={onClose} hitSlop={12} style={{ padding: 6 }} accessibilityRole="button" accessibilityLabel="Cerrar">
            <X size={19} color={INK.faint} />
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: bottomInset + 32, gap: 16 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 34, color: INK.title }}>{voz ? '¿Quién es esta voz?' : '¿Quién más aparece?'}</Text>
            {voz ? (
              <Text style={{ fontSize: 14, lineHeight: 20, color: INK.body }}>
                {[voz.rolLegible, voz.descripcion].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>

          {elegida ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: 'rgba(21,128,61,0.07)' }}>
              <UserRound size={18} color="#15803D" />
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: INK.title }}>{nombreElegido}</Text>
              {elegida.nombreNuevo ? <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE }}>nueva en el Codex</Text> : null}
              <Pressable onPress={() => setElegida(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Elegir a otra persona">
                <X size={16} color={INK.meta} />
              </Pressable>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: RAYA, backgroundColor: '#FFFFFF' }}>
                <Search size={15} color={INK.meta} />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  autoFocus
                  placeholder="Nombre de la persona"
                  placeholderTextColor={INK.faint}
                  style={{ flex: 1, fontSize: 15, color: INK.title, padding: 0 }}
                  accessibilityLabel="Buscar a la persona en el Codex"
                />
                {buscando ? <MorphingInfinity size={16} color={INK.faint} /> : null}
              </View>
              {/* Antes de escribir: las personas del mismo post (el autor, los mencionados). */}
              {nombre.length < 2 && sugeridos.length ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE }}>en este post</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                    {sugeridos.map((x) => (
                      <Pressable key={x.name} onPress={() => { roce(); setElegida(x.id ? { persona: { id: x.id, name: x.name } } : { nombreNuevo: x.name }); }}
                        accessibilityRole="button" accessibilityLabel={`Elegir a ${x.name}`}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, borderWidth: 1, borderColor: RAYA, backgroundColor: '#FFFFFF' }}>
                        <UserRound size={14} color={INK.meta} />
                        <Text style={{ fontSize: 13.5, color: INK.title }}>{x.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
              <View>
                {resultados.map((r) => (
                  <Pressable key={r.id} onPress={() => { roce(); setElegida({ persona: r }); }} accessibilityRole="button" accessibilityLabel={`Elegir a ${r.name}`}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: RAYA, opacity: pressed ? 0.55 : 1 })}>
                    <UserRound size={17} color={INK.meta} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: INK.title }} numberOfLines={1}>{r.name}</Text>
                      {r.description ? <Text style={{ fontSize: 12.5, color: INK.meta }} numberOfLines={1}>{r.description}</Text> : null}
                    </View>
                  </Pressable>
                ))}
                {nombre.length >= 2 && !yaExiste && !buscando ? (
                  <Pressable onPress={() => { roce(); setElegida({ nombreNuevo: nombre }); }} accessibilityRole="button" accessibilityLabel={`Crear a ${nombre} en el Codex`}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, opacity: pressed ? 0.55 : 1 })}>
                    <UserPlus size={17} color={INK.title} />
                    <Text style={{ fontSize: 15, color: INK.title }}>
                      Crear <Text style={{ fontWeight: '700' }}>«{nombre}»</Text> en el Codex
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          )}

          {voz ? (
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE }}>cómo se sabe</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {MOTIVOS_VOZ.map((m) => {
                  const on = motivo === m;
                  return (
                    <Pressable key={m} onPress={() => { roce(); setMotivo(on ? null : m); }} accessibilityRole="button" accessibilityState={{ selected: on }}
                      style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, justifyContent: 'center', borderWidth: 1,
                        borderColor: on ? 'rgba(21,128,61,0.4)' : RAYA, backgroundColor: on ? 'rgba(21,128,61,0.08)' : 'transparent' }}>
                      <Text style={{ fontSize: 13, color: on ? '#15803D' : INK.body }}>{m}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {error ? <Text style={{ fontSize: 13, color: '#B91C1C' }}>{error}</Text> : null}

          <Pressable onPress={guardar} disabled={!listo || guardando} accessibilityRole="button" accessibilityLabel="Guardar quién aparece"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 24,
              backgroundColor: listo ? INK.title : 'rgba(28,43,34,0.08)', opacity: pressed ? 0.85 : 1 })}>
            {guardando ? <MorphingInfinity size={16} color="#FFFFFF" /> : <Check size={16} color={listo ? '#FFFFFF' : INK.faint} />}
            <Text style={{ fontSize: 15, fontWeight: '600', color: listo ? '#FFFFFF' : INK.faint }}>Guardar</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
