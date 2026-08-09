import { useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  LinearTransition,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { INK, MOTION, RADIUS } from '../theme';
import MorphingInfinity from '../MorphingInfinity';
import { PAPEL } from './Papel';
import { toque } from '../../utils/haptics';
import { supabase } from '../../utils/supabase';

// Sin fuentes propias cargadas en la app, la monoespaciada es la del sistema.
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

/**
 * Escribir un fragmento.
 *
 * Un Snippet no se llena: se escribe. Así que esto no es una hoja con campos, es
 * una superficie de escritura — pantalla completa, papel, monoespaciada y mucho
 * aire. Todo el cromo que se pueda esconder, está escondido: los detalles
 * (fuente, clasificación, fecha) viven detrás de un enlace de texto, y el botón
 * de guardar solo aparece cuando hay algo que guardar.
 *
 * Una nota sobre la referencia: ahí el texto va centrado, y acá no. Centrado se
 * ve precioso en una carta estática, pero al escribir el cursor salta de lugar
 * con cada tecla y se pierde el renglón. Lo que da la sensación de carta no es la
 * centradura sino la medida angosta, el interlineado alto y la monoespaciada —
 * eso sí está. La columna entera va centrada en la pantalla; el texto, alineado
 * a la izquierda dentro de ella.
 *
 * Se guarda como los Snippets que ya existen en la base: el cuerpo va en
 * `description` —con su markdown si lo trae— y el título en `name`. El preset
 * nominal pone el cuerpo en `details.Contenido`, pero ningún registro real lo
 * usa así, y romper esa consistencia dejaría los fragmentos del teléfono
 * invisibles para lo que ya lee la web.
 */
export default function CreateSnippetSheet({ onClose, onCreated, bottomInset = 0, topInset = 0 }) {
  const [titulo, setTitulo] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [fuente, setFuente] = useState('');
  const [tags, setTags] = useState('');
  const [fecha, setFecha] = useState('');
  const [detalles, setDetalles] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const campo = useRef(null);

  // El título se deduce del cuerpo mientras no se escriba uno propio.
  const [tituloTocado, setTituloTocado] = useState(false);
  const tituloEfectivo = tituloTocado
    ? titulo
    : (cuerpo.split('\n').find((l) => l.trim()) || '').replace(/^#+\s*/, '').slice(0, 70);

  const puedeGuardar = cuerpo.trim().length > 0 && tituloEfectivo.trim().length > 0;

  const guardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) throw new Error('Sin sesión activa');

      const details = {};
      if (fuente.trim()) details['Fuente'] = fuente.trim();
      if (fecha.trim()) details['Fecha de captura'] = fecha.trim();

      const etiquetas = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const { data, error: insertError } = await supabase
        .from('codex_universe_items')
        .insert({
          user_id: userId,
          tipo: 'Snippet',
          name: tituloEfectivo.trim(),
          description: cuerpo.trim(),
          ...(etiquetas.length ? { tags: etiquetas } : {}),
          details,
        })
        .select('id, name, tipo, description, tags, aliases, details, created_at')
        .single();

      if (insertError) throw insertError;
      toque();
      onCreated?.(data);
      onClose();
    } catch (e) {
      setError(e.message || 'No se pudo guardar');
      setGuardando(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: PAPEL }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {/* Barra mínima. Guardar aparece solo cuando hay algo que guardar: un
              botón permanentemente apagado es ruido que nunca sirve. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingTop: topInset + 12,
              paddingHorizontal: 18,
              paddingBottom: 4,
            }}
          >
            <Pressable onPress={onClose} hitSlop={12} style={{ padding: 6 }}>
              <X size={19} color={INK.faint} />
            </Pressable>
            <View style={{ flex: 1 }} />
            {puedeGuardar ? (
              <Animated.View entering={FadeIn.duration(200)}>
                <Pressable onPress={guardar} disabled={guardando} hitSlop={12} style={{ padding: 6 }}>
                  {guardando ? (
                    <MorphingInfinity size={18} color={INK.title} />
                  ) : (
                    <Text style={{ fontFamily: MONO, fontSize: 14, color: INK.title, letterSpacing: -0.2 }}>
                      guardar
                    </Text>
                  )}
                </Pressable>
              </Animated.View>
            ) : null}
          </View>

          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingBottom: bottomInset + 24 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {/* Aire antes del primer renglón. Es lo único que separa la barra del
                texto: la página arranca en blanco y el cursor es lo primero que
                se ve. */}
            <View style={{ height: 54 }} />

            {/* Medida angosta y centrada en la pantalla; el texto, a la izquierda
                dentro de la columna. */}
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 420, paddingHorizontal: 30 }}>
              {/* Toda la zona vacía enfoca el campo: la página entera se siente
                  escribible, no solo el renglón donde está el cursor. */}
              <Pressable onPress={() => campo.current?.focus()} style={{ flex: 1 }}>
                <TextInput
                  ref={campo}
                  value={cuerpo}
                  onChangeText={setCuerpo}
                  placeholder="escribí lo que quieras…"
                  placeholderTextColor="rgba(28,43,34,0.22)"
                  multiline
                  autoFocus
                  scrollEnabled={false}
                  style={{
                    fontFamily: MONO,
                    fontSize: 15,
                    lineHeight: 27,
                    color: INK.title,
                    minHeight: 260,
                    textAlignVertical: 'top',
                    padding: 0,
                  }}
                />
              </Pressable>

              {/* Detalles: un enlace de texto, no una fila de chips. Mientras
                  escribís no deberías tener tres botones mirándote. */}
              <Animated.View layout={LinearTransition.springify().damping(22)} style={{ marginTop: 30 }}>
                {!detalles ? (
                  <Pressable onPress={() => setDetalles(true)} hitSlop={10} style={{ alignSelf: 'flex-start' }}>
                    <Text style={{ fontFamily: MONO, fontSize: 12.5, color: 'rgba(28,43,34,0.32)' }}>
                      + detalles
                    </Text>
                  </Pressable>
                ) : (
                  <Animated.View entering={FadeIn.duration(220)} style={{ gap: 2 }}>
                    <Renglon
                      etiqueta="título"
                      value={tituloTocado ? titulo : tituloEfectivo}
                      onChangeText={(t) => {
                        setTituloTocado(true);
                        setTitulo(t);
                      }}
                      placeholder={tituloEfectivo || 'la primera línea'}
                    />
                    <Renglon
                      etiqueta="fuente"
                      value={fuente}
                      onChangeText={setFuente}
                      placeholder="https://"
                      autoCapitalize="none"
                    />
                    <Renglon
                      etiqueta="etiquetas"
                      value={tags}
                      onChangeText={setTags}
                      placeholder="separá con comas"
                    />
                    <Renglon
                      etiqueta="fecha"
                      value={fecha}
                      onChangeText={setFecha}
                      placeholder="AAAA-MM-DD"
                    />
                  </Animated.View>
                )}
              </Animated.View>

              {error ? (
                <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: 22 }}>
                  <Text style={{ fontFamily: MONO, fontSize: 12.5, color: '#B91C1C', lineHeight: 19 }}>
                    {error}
                  </Text>
                </Animated.View>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/**
 * Renglón de detalle: etiqueta a la izquierda y campo a la derecha, sin cajas.
 * Un formulario con recuadros rompería la página; una lista de renglones se lee
 * como parte del mismo texto.
 */
function Renglon({ etiqueta, ...props }) {
  const foco = useSharedValue(0);

  const linea = useAnimatedStyle(() => ({
    // La línea se marca al enfocar. Es la única señal que necesita: no hace
    // falta un borde alrededor para saber dónde estás escribiendo.
    backgroundColor: `rgba(28,43,34,${0.07 + foco.value * 0.13})`,
  }));

  return (
    <View style={{ paddingVertical: 9 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
        <Text style={{ fontFamily: MONO, fontSize: 11.5, color: 'rgba(28,43,34,0.3)', width: 78 }}>
          {etiqueta}
        </Text>
        <TextInput
          placeholderTextColor="rgba(28,43,34,0.22)"
          onFocus={() => {
            foco.value = withTiming(1, { duration: 160 });
          }}
          onBlur={() => {
            foco.value = withSpring(0, MOTION.tap);
          }}
          style={{
            flex: 1,
            fontFamily: MONO,
            fontSize: 13,
            color: INK.title,
            padding: 0,
          }}
          {...props}
        />
      </View>
      <Animated.View style={[{ height: 1, marginTop: 8, borderRadius: RADIUS.sm }, linea]} />
    </View>
  );
}
