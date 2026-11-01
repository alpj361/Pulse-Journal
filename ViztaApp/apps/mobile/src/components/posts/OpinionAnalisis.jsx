import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Lightbulb, RotateCcw, ThumbsDown, ThumbsUp, X } from 'lucide-react-native';
import { INK, RADIUS, SERIF } from '../theme';
import { PAPEL } from '../codex/Papel';
import { Boton, ROTULO } from '../colaboradores/piezas';
import { falla, listo, roce } from '../../utils/haptics';
import { EV, evento } from '../../utils/analitica';
import opinarAnalisis from './opinarAnalisis';

const VERDE = '#2F6B45';
const LADRILLO = '#9A3B2E';

// Las dos clases de «no»: lo que el modelo corrige solo y lo que hay que construir.
const TIPOS = [
  {
    clave: 'modelo',
    Icono: RotateCcw,
    nombre: 'Se equivocó',
    explica: 'Lo vuelvo a analizar con lo que me digas, y lo tengo en cuenta en tus próximos posts.',
    pista: 'Ej.: no es su opinión, es una escena de una película',
    accion: 'corregir',
  },
  {
    clave: 'funcion',
    Icono: Lightbulb,
    nombre: 'Le falta algo a Vizta',
    explica: 'Algo que no sabe leer todavía. Le llega a quien hace Vizta.',
    pista: 'Ej.: no entiende los memes con texto encima',
    accion: 'enviar',
  },
];

/**
 * El pulgar arriba o abajo al pie del análisis.
 *
 * El voto queda en el post (`details.analysis_feedback`): al volver a abrirlo
 * se ve cuál se marcó. Corregir pone el post a analizarse de nuevo; eso ya lo
 * muestra la hoja, así que acá no se anuncia nada más.
 */
export default function OpinionAnalisis({ post, bottomInset = 0, onCorrigiendo }) {
  const previo = post?.details?.analysis_feedback || null;
  const [voto, setVoto] = useState(previo?.voto || null);
  const [abierta, setAbierta] = useState(false);

  const arriba = async () => {
    if (voto === 'arriba') return;
    roce();
    const antes = voto;
    setVoto('arriba');
    try {
      await opinarAnalisis(post, { voto: 'arriba' });
      evento(EV.POST_OPINION, { voto: 'arriba' });
    } catch {
      falla();
      setVoto(antes);
    }
  };

  return (
    <View style={{ marginTop: 32, paddingTop: 18, borderTopWidth: 1, borderTopColor: 'rgba(28,43,34,0.07)', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={{ flex: 1, fontSize: 14, color: INK.body }}>¿Te sirvió este análisis?</Text>
      <Pulgar Icono={ThumbsUp} activo={voto === 'arriba'} color={VERDE} etiqueta="Me sirvió" onPress={arriba} />
      <Pulgar
        Icono={ThumbsDown}
        activo={voto === 'abajo'}
        color={LADRILLO}
        etiqueta="No me sirvió"
        onPress={() => {
          roce();
          setAbierta(true);
        }}
      />
      <HojaQuePaso
        visible={abierta}
        post={post}
        bottomInset={bottomInset}
        onClose={() => setAbierta(false)}
        onEnviado={(tipo) => {
          setVoto('abajo');
          setAbierta(false);
          if (tipo === 'modelo') onCorrigiendo?.();
        }}
      />
    </View>
  );
}

function Pulgar({ Icono, activo, color, etiqueta, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ selected: activo }}
      style={({ pressed }) => ({
        width: 42,
        height: 42,
        borderRadius: RADIUS.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: activo ? `${color}1A` : 'rgba(28,43,34,0.05)',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icono size={19} color={activo ? color : INK.meta} fill={activo ? `${color}33` : 'transparent'} />
    </Pressable>
  );
}

function HojaQuePaso({ visible, post, bottomInset, onClose, onEnviado }) {
  const [tipo, setTipo] = useState('modelo');
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const elegido = TIPOS.find((t) => t.clave === tipo);

  const enviar = async () => {
    if (enviando || texto.trim().length < 3) return;
    setEnviando(true);
    setError(null);
    try {
      await opinarAnalisis(post, { voto: 'abajo', tipo, texto: texto.trim() });
      listo();
      evento(EV.POST_OPINION, { voto: 'abajo', tipo });
      setTexto('');
      onEnviado(tipo);
    } catch (e) {
      falla();
      setError(e.message || 'No se pudo enviar');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: PAPEL }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 16, paddingHorizontal: 18 }}>
          <Text style={[ROTULO, { flex: 1 }]}>EL ANÁLISIS</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar" style={{ padding: 6 }}>
            <X size={19} color={INK.faint} />
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 6, paddingBottom: bottomInset + 32, gap: 18 }}>
          <Text style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 34, color: INK.title }} accessibilityRole="header">
            ¿Qué pasó?
          </Text>

          <View style={{ gap: 10 }} accessibilityRole="radiogroup">
            {TIPOS.map((t) => {
              const activo = t.clave === tipo;
              return (
                <Pressable
                  key={t.clave}
                  onPress={() => {
                    roce();
                    setTipo(t.clave);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: activo }}
                  style={{
                    flexDirection: 'row',
                    gap: 12,
                    padding: 14,
                    borderRadius: RADIUS.lg,
                    borderWidth: activo ? 1.5 : 1,
                    borderColor: activo ? INK.title : 'rgba(28,43,34,0.12)',
                    backgroundColor: activo ? '#FFFFFF' : 'transparent',
                  }}
                >
                  <t.Icono size={20} color={activo ? INK.title : INK.meta} style={{ marginTop: 1 }} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: INK.title }}>{t.nombre}</Text>
                    <Text style={{ fontSize: 13.5, lineHeight: 19, color: INK.body }}>{t.explica}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder={elegido.pista}
            placeholderTextColor={INK.faint}
            multiline
            maxLength={2000}
            accessibilityLabel="Qué pasó"
            style={{
              minHeight: 110,
              padding: 14,
              borderRadius: RADIUS.md,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: 'rgba(28,43,34,0.12)',
              fontSize: 15,
              lineHeight: 21,
              color: INK.title,
              textAlignVertical: 'top',
            }}
          />
          {error ? <Text style={{ fontSize: 13.5, color: LADRILLO }}>{error}</Text> : null}
          <Boton texto={elegido.accion} primario cargando={enviando} disabled={texto.trim().length < 3} onPress={enviar} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
