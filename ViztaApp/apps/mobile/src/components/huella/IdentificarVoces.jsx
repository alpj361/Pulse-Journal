import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { Check, FileVideo, Search, UserRound, X } from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import { PAPEL } from '../codex/Papel';
import { falla, listo, roce } from '../../utils/haptics';
import { supabase } from '../../utils/supabase';
import { Boton, ROTULO, TONO } from '../colaboradores/piezas';
import PostDetailSheet from '../posts/PostDetailSheet';
import { TONOS } from './tonos';
import { MOTIVOS_VOZ, MOTIVO_MAX, OPCIONES_VOZ, fechaPublicacion, motivoDeError, quienHabla, revisionDeVoz } from './logica';

const CAMPOS_POST = 'id, name, tipo, description, tags, thumbnail_url, details, aliases, created_at, folder_id';
const capital = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);

/**
 * Identificar las voces de las publicaciones, de a una.
 *
 * Por cada voz se muestra lo que sirve para reconocerla —la publicación, cómo
 * la describe el análisis de audio y sus frases— y se pregunta quién habla. Lo
 * que se responde queda registrado con su motivo (`identidad/voz`) y la huella
 * se vuelve a calcular. Si es una persona del Codex, queda vinculada a su
 * ficha (`persona_item_id`); que sume a la huella de esa persona lo hace el
 * servidor.
 *
 * Las marcas internas de cada voz (H1, H2…) no se muestran: no le dicen nada a
 * quien identifica.
 */
export default function IdentificarVoces({ voces, identidad, personas = {}, revisar, bottomInset = 0, onClose }) {
  const [paso, setPaso] = useState(0);
  const [guardadas, setGuardadas] = useState(0);
  const [postAbierto, setPostAbierto] = useState(null);
  const ids = useMemo(() => [...new Set(voces.map((v) => v.post_id))].sort(), [voces]);

  const posts = useQuery({
    queryKey: ['huella-voces-posts', ids.join(',')],
    enabled: ids.length > 0,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase.from('codex_universe_items').select('id, name, thumbnail_url, voces:details->voces').in('id', ids);
      if (error) throw error;
      return Object.fromEntries((data || []).map((p) => [p.id, p]));
    },
  });

  const abrirPost = async (postId) => {
    roce();
    const { data } = await supabase.from('codex_universe_items').select(CAMPOS_POST).eq('id', postId).maybeSingle();
    if (data) setPostAbierto(data);
  };

  const voz = voces[paso] || null;
  const terminado = !voz;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: PAPEL }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 16, paddingHorizontal: 18 }}>
          <Text style={[ROTULO, { flex: 1 }]}>{terminado ? 'VOCES' : `VOZ ${paso + 1} DE ${voces.length}`}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar" style={{ padding: 6 }}>
            <X size={19} color={INK.faint} />
          </Pressable>
        </View>

        {terminado ? (
          <Animated.View entering={FadeIn.duration(200)} style={{ flex: 1, paddingHorizontal: 22, paddingTop: 12, gap: 14 }}>
            <Text style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 34, color: INK.title }} accessibilityRole="header">
              {guardadas ? 'Listo' : 'Sin cambios'}
            </Text>
            <Text style={{ fontSize: 15.5, lineHeight: 22, color: INK.body }}>
              {guardadas
                ? `${guardadas === 1 ? 'Quedó identificada una voz' : `Quedaron identificadas ${guardadas} voces`}. La huella se vuelve a calcular con lo que respondiste.`
                : 'No se identificó ninguna voz. Puedes volver cuando sepas quién habla.'}
            </Text>
            <Boton texto="cerrar" primario onPress={onClose} />
          </Animated.View>
        ) : (
          <PasoVoz
            key={voz.clave}
            voz={voz}
            post={posts.data?.[voz.post_id] || null}
            revision={revisionDeVoz(identidad, voz.post_id, voz.voz)}
            personas={personas}
            revisar={revisar}
            bottomInset={bottomInset}
            onAbrirPost={() => abrirPost(voz.post_id)}
            onListo={() => {
              setGuardadas((n) => n + 1);
              setPaso((n) => n + 1);
            }}
            onSaltar={() => setPaso((n) => n + 1)}
          />
        )}

        {postAbierto ? <PostDetailSheet post={postAbierto} bottomInset={bottomInset} onClose={() => setPostAbierto(null)} /> : null}
      </View>
    </Modal>
  );
}

/** Una voz: lo que hay para reconocerla y la pregunta. */
function PasoVoz({ voz, post, revision, personas, revisar, bottomInset, onAbrirPost, onListo, onSaltar }) {
  const [opcion, setOpcion] = useState(null);
  const [persona, setPersona] = useState(null);
  const [motivo, setMotivo] = useState(null);
  const [nota, setNota] = useState('');
  const [mandando, setMandando] = useState(false);
  const [error, setError] = useState(null);
  const [sinPortada, setSinPortada] = useState(false);

  const o = OPCIONES_VOZ.find((x) => x.id === opcion) || null;
  const descripcion = (Array.isArray(post?.voces) ? post.voces : []).find((v) => v?.id === voz.voz)?.descripcion || null;
  const titulo = String(post?.name || 'Publicación').replace(/^@[^—]+—\s*/, '').split('\n')[0];
  const textoMotivo = [motivo, nota.trim()].filter(Boolean).join('. ');
  const completo = !!o && (!o.ficha || !!persona) && textoMotivo.length >= 8;
  const ahora = revision ? quienHabla(null, revision, personas) : null;

  const mandar = async (operacion) => {
    setMandando(true);
    setError(null);
    try {
      await revisar(operacion, {
        post_id: voz.post_id,
        voz: voz.voz,
        rol: o?.rol,
        relacion: o?.relacion,
        persona_item_id: o?.ficha ? persona?.id : undefined,
        motivo: textoMotivo,
      });
      listo();
      onListo();
    } catch (e) {
      falla();
      setError(motivoDeError(e));
    } finally {
      setMandando(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: bottomInset + 32, gap: 20 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 34, color: INK.title }} accessibilityRole="header">
          ¿Quién habla?
        </Text>

        {/* La publicación: abrirla para ver y escuchar. */}
        <Pressable onPress={onAbrirPost} accessibilityRole="button" accessibilityHint="Abre la publicación" style={({ pressed }) => ({ flexDirection: 'row', gap: 12, alignItems: 'center', opacity: pressed ? 0.7 : 1 })}>
          <View style={{ width: 64, height: 64, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(28,43,34,0.06)', alignItems: 'center', justifyContent: 'center' }}>
            {post?.thumbnail_url && !sinPortada ? (
              <Image source={{ uri: post.thumbnail_url }} style={{ width: 64, height: 64 }} contentFit="cover" onError={() => setSinPortada(true)} />
            ) : (
              <FileVideo size={20} color={INK.meta} />
            )}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: INK.title }} numberOfLines={2}>
              {titulo}
            </Text>
            <Text style={{ fontSize: 13, color: INK.meta }}>{`${fechaPublicacion(voz.fecha)} · ver publicación`}</Text>
          </View>
        </Pressable>

        {descripcion ? (
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: INK.meta }}>Cómo la describe el análisis</Text>
            <Text style={{ fontSize: 15, lineHeight: 21, color: INK.title }}>{capital(descripcion)}</Text>
          </View>
        ) : null}

        {voz.citas.length ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: INK.meta }}>Lo que dice</Text>
            {voz.citas.slice(0, 3).map((c) => (
              <View key={c} style={{ borderLeftWidth: 3, borderLeftColor: 'rgba(28,43,34,0.3)', paddingLeft: 10 }}>
                <Text style={{ fontSize: 14.5, lineHeight: 20, color: INK.title }} numberOfLines={4}>{`«${c}»`}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {ahora ? <Text style={{ fontSize: 13.5, color: INK.meta }}>{`Ahora: ${ahora.texto.toLowerCase()}.`}</Text> : null}

        <View style={{ gap: 4 }}>
          {OPCIONES_VOZ.map((x) => (
            <Opcion
              key={x.id}
              texto={x.texto}
              activa={opcion === x.id}
              onPress={() => {
                roce();
                setOpcion(x.id);
              }}
            />
          ))}
        </View>

        {o?.ficha ? <BuscarPersona elegida={persona} onElegir={setPersona} /> : null}

        {o ? (
          <Animated.View entering={FadeIn.duration(160)} style={{ gap: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: INK.title }}>¿Cómo lo sabes?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {MOTIVOS_VOZ.map((m) => {
                const on = motivo === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setMotivo(on ? null : m)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: on ? INK.title : 'rgba(28,43,34,0.06)' }}
                  >
                    <Text style={{ fontSize: 13.5, fontWeight: '600', color: on ? '#FFFFFF' : INK.body }}>{m}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={nota}
              onChangeText={setNota}
              placeholder="algo más (opcional)"
              placeholderTextColor={INK.faint}
              multiline
              maxLength={MOTIVO_MAX - 40}
              accessibilityLabel="Algo más sobre cómo lo sabes"
              style={{ minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: TONO.borde, backgroundColor: '#FFFFFF', padding: 12, fontSize: 15, color: INK.title }}
            />
          </Animated.View>
        ) : null}

        {error ? <Text style={{ fontSize: 13, color: TONO.rojo }}>{error}</Text> : null}

        <View style={{ gap: 8 }}>
          <Boton texto="guardar" primario cargando={mandando} disabled={!completo} onPress={() => mandar('voz')} />
          <Boton texto="no sé, siguiente" alto={42} onPress={onSaltar} />
          {revision ? <Boton texto="quitar lo identificado" alto={42} cargando={mandando} disabled={textoMotivo.length < 8} onPress={() => mandar('quitar_voz')} /> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Opcion({ texto, activa, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: activa }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: activa ? INK.title : 'rgba(28,43,34,0.25)', alignItems: 'center', justifyContent: 'center' }}>
        {activa ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: INK.title }} /> : null}
      </View>
      <Text style={{ fontSize: 15.5, color: INK.title }}>{texto}</Text>
    </Pressable>
  );
}

/** Buscar a la persona entre los Actores del Codex. */
function BuscarPersona({ elegida, onElegir }) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);

  useEffect(() => {
    const texto = q.trim().replace(/[%_,()*]/g, '');
    if (texto.length < 2) {
      setResultados([]);
      return undefined;
    }
    let vivo = true;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('codex_universe_items')
        .select('id, name')
        .eq('tipo', 'Actor')
        .or('is_profile.is.null,is_profile.eq.false')
        .ilike('name', `%${texto}%`)
        .order('name')
        .limit(8);
      if (vivo) setResultados(data || []);
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [q]);

  if (elegida) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: TONOS.verde.fondo, borderRadius: 12, padding: 12 }}>
        <Check size={16} color={TONOS.verde.tinta} strokeWidth={2.4} />
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: TONOS.verde.tinta }}>{elegida.name}</Text>
        <Pressable onPress={() => onElegir(null)} hitSlop={8} accessibilityRole="button">
          <Text style={{ fontSize: 13.5, fontWeight: '600', color: TONOS.verde.tinta }}>cambiar</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: TONO.borde, backgroundColor: '#FFFFFF', paddingHorizontal: 12 }}>
        <Search size={16} color={INK.meta} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="buscar en tu Codex"
          placeholderTextColor={INK.faint}
          autoFocus
          accessibilityLabel="Buscar a la persona en tu Codex"
          style={{ flex: 1, paddingVertical: 11, fontSize: 15, color: INK.title }}
        />
      </View>
      {resultados.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => {
            roce();
            onElegir(p);
          }}
          accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, opacity: pressed ? 0.6 : 1 })}
        >
          <UserRound size={16} color={INK.meta} />
          <Text style={{ fontSize: 15, color: INK.title }}>{p.name}</Text>
        </Pressable>
      ))}
      {q.trim().length >= 2 && !resultados.length ? <Text style={{ fontSize: 13.5, color: INK.meta }}>No hay nadie con ese nombre en tu Codex.</Text> : null}
    </View>
  );
}
