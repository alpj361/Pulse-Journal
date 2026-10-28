import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ChevronDown, ChevronLeft, ChevronRight, Fingerprint, X } from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import { PAPEL } from '../codex/Papel';
import { falla, listo, roce } from '../../utils/haptics';
import { supabase } from '../../utils/supabase';
import MorphingInfinity from '../MorphingInfinity';
import { Boton, EstadoCentro, ROTULO, TONO } from '../colaboradores/piezas';
import PostDetailSheet from '../posts/PostDetailSheet';
import useHuellaAutor, { useEvidencias } from './useHuellaAutor';
import {
  ATRIBUCION,
  CLASES,
  MAX_COMENTARIO,
  PERFIL,
  enfriamientoRestante,
  falta,
  fechaPublicacion,
  motivoDeError,
  nombreLectura,
  porClase,
  respaldoCorto,
  situacion,
} from './logica';

const CAMPOS_POST = 'id, name, tipo, description, tags, thumbnail_url, details, aliases, created_at, folder_id';

/**
 * La huella de autor de una cuenta: de qué publica, qué narrativas aparecen en
 * lo que publica y qué posturas se le atribuyen, con la evidencia de cada una.
 * PROVISIONAL: solo para verificar el cableado con datos reales. El diseño
 * (presentación, textos, jerarquía) está pendiente de revisar con PJ.
 *
 * `autorId` es el autor social (`post_analisis.autor_id` / `autores.id`), no
 * quien creó un registro del Codex.
 */
export default function HuellaAutor({ autorId, nombre, topInset = 0, bottomInset = 0, onClose }) {
  const h = useHuellaAutor(autorId);
  const [abierta, setAbierta] = useState(null);
  const [verDescartadas, setVerDescartadas] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);
  const [errorAccion, setErrorAccion] = useState(null);

  const r = h.respuesta;
  const caso = h.consulta.error ? 'error' : situacion(r);
  const perfil = r?.huella?.perfil || null;
  const autor = perfil?.autor || r?.autor || null;
  const grupos = useMemo(() => porClase(perfil?.lecturas), [perfil]);
  const espera = enfriamientoRestante(h.ultimoPedido, h.ahora);

  const actualizar = async () => {
    if (pidiendo || espera) return;
    roce();
    setPidiendo(true);
    setErrorAccion(null);
    try {
      await h.actualizar();
    } catch (e) {
      falla();
      setErrorAccion(motivoDeError(e));
    } finally {
      setPidiendo(false);
    }
  };

  // La lectura abierta, siempre la de la versión vigente (si cambió, se cierra).
  const lectura = abierta && perfil ? [...perfil.lecturas, ...perfil.descartadas].find((l) => l.clave === abierta) : null;

  const titulo = autor?.nombre || nombre || (autor?.usuario ? `@${autor.usuario}` : 'Autor');
  const subtitulo = [autor?.usuario && autor?.nombre ? `@${autor.usuario}` : null, autor?.plataforma].filter(Boolean).join(' · ');

  return (
    <Modal visible animationType="slide" onRequestClose={lectura ? () => setAbierta(null) : onClose}>
      <View style={{ flex: 1, backgroundColor: PAPEL }}>
        <View style={{ paddingTop: topInset + 12, paddingHorizontal: 18, paddingBottom: 4, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable
            onPress={lectura ? () => setAbierta(null) : onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={lectura ? 'Volver' : 'Cerrar'}
            style={{ padding: 6 }}
          >
            {lectura ? <ChevronLeft size={22} color={INK.title} /> : <X size={19} color={INK.faint} />}
          </Pressable>
        </View>

        {lectura ? (
          <Lectura
            autorId={autorId}
            huellaId={r.huella.id}
            lectura={lectura}
            corregir={h.corregir}
            bottomInset={bottomInset}
            topInset={topInset}
          />
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingTop: 6, paddingBottom: bottomInset + 32, gap: 18 }}>
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Fingerprint size={16} color={INK.meta} strokeWidth={1.8} />
                <Text style={ROTULO}>HUELLA DE AUTOR</Text>
              </View>
              <Text style={{ fontFamily: SERIF, fontSize: 32, lineHeight: 36, color: INK.title }} accessibilityRole="header">
                {titulo}
              </Text>
              {subtitulo ? <Text style={{ fontSize: 13, color: INK.meta }}>{subtitulo}</Text> : null}
            </View>

            {caso === 'cargando' ? (
              <MorphingInfinity size={28} color={INK.meta} style={{ alignSelf: 'center', marginTop: 40 }} />
            ) : caso === 'error' ? (
              <EstadoCentro titulo="No se pudo abrir la huella" texto={motivoDeError(h.consulta.error)}>
                {[401, 403, 404, 422].includes(h.consulta.error?.status) ? null : <Boton texto="probar de nuevo" onPress={() => h.consulta.refetch()} />}
              </EstadoCentro>
            ) : caso === 'calculando' || caso === 'recalculando' ? (
              <View style={{ alignItems: 'center', gap: 12, marginTop: 30 }}>
                <MorphingInfinity size={28} color={INK.meta} />
                <Text style={{ fontSize: 14, color: INK.body, textAlign: 'center' }}>
                  {caso === 'recalculando' ? 'Hay publicaciones nuevas. Se está volviendo a leer.' : 'Se está leyendo lo que publicó.'}
                </Text>
                {!h.consulta.isFetching && h.consulta.data && !h.consulta.isRefetching ? (
                  <Boton texto="volver a mirar" alto={40} onPress={() => h.recargar()} />
                ) : null}
              </View>
            ) : caso === 'sin_calcular' || caso === 'fallo' ? (
              <View style={{ gap: 12, marginTop: 20 }}>
                <Text style={{ fontSize: 14.5, lineHeight: 21, color: INK.body }}>
                  {caso === 'fallo' ? 'No se pudo leer lo que publicó.' : 'Todavía no se leyó lo que publicó esta cuenta.'}
                </Text>
                <Boton texto={espera ? `en ${espera} s` : caso === 'fallo' ? 'volver a intentar' : 'leer sus publicaciones'} primario cargando={pidiendo} disabled={!!espera} onPress={actualizar} />
              </View>
            ) : (
              <Vigente
                perfil={perfil}
                grupos={grupos}
                verDescartadas={verDescartadas}
                onVerDescartadas={() => setVerDescartadas((v) => !v)}
                onAbrir={(l) => {
                  roce();
                  setAbierta(l.clave);
                }}
              />
            )}

            {caso === 'vigente' ? (
              <View style={{ gap: 8, marginTop: 6 }}>
                <Boton texto={espera ? `actualizar en ${espera} s` : 'actualizar'} alto={42} cargando={pidiendo} disabled={!!espera} onPress={actualizar} />
              </View>
            ) : null}
            {errorAccion ? <Text style={{ fontSize: 13, color: TONO.rojo }}>{errorAccion}</Text> : null}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function Vigente({ perfil, grupos, verDescartadas, onVerDescartadas, onAbrir }) {
  const c = perfil.cobertura || {};
  const rango = c.desde && c.hasta && c.desde !== c.hasta ? `${fechaPublicacion(c.desde)} – ${fechaPublicacion(c.hasta)}` : null;
  const sinFecha = (c.posts || 0) - (c.con_fecha || 0);
  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ gap: 20 }}>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: perfil.estado === 'patron_respaldado' ? TONO.verde : INK.title }}>{PERFIL[perfil.estado] || ''}</Text>
        </View>
        <Text style={{ fontSize: 13.5, color: INK.body }}>
          {[`${c.posts || 0} ${c.posts === 1 ? 'publicación' : 'publicaciones'}`, rango, sinFecha > 0 ? `${sinFecha} sin fecha` : null].filter(Boolean).join(' · ')}
        </Text>
      </View>

      {!grupos.length ? (
        <Text style={{ fontSize: 14.5, lineHeight: 21, color: INK.body }}>Con lo que hay todavía no se puede decir de qué publica. Hacen falta más publicaciones analizadas.</Text>
      ) : (
        grupos.map((g) => (
          <View key={g.clase} style={{ gap: 2 }}>
            <Text style={[ROTULO, { marginBottom: 6 }]}>{`${CLASES[g.clase]?.titulo || g.clase} · ${g.lecturas.length}`.toUpperCase()}</Text>
            {g.lecturas.map((l, i) => (
              <FilaLectura key={l.clave} lectura={l} borde={i > 0} onPress={() => onAbrir(l)} />
            ))}
          </View>
        ))
      )}

      {perfil.descartadas?.length ? (
        <View style={{ gap: 2 }}>
          <Pressable onPress={onVerDescartadas} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }}>
            <Text style={ROTULO}>{`DESCARTADAS · ${perfil.descartadas.length}`}</Text>
            <ChevronDown size={14} color={INK.faint} style={{ transform: [{ rotate: verDescartadas ? '180deg' : '0deg' }] }} />
          </Pressable>
          {verDescartadas ? perfil.descartadas.map((l, i) => <FilaLectura key={l.clave} lectura={l} borde={i > 0} onPress={() => onAbrir(l)} />) : null}
        </View>
      ) : null}

      {perfil.fuentes_citadas?.length ? (
        <View style={{ gap: 6 }}>
          <Text style={ROTULO}>FUENTES QUE CITA</Text>
          <Text style={{ fontSize: 14, lineHeight: 20, color: INK.body }}>{perfil.fuentes_citadas.map((f) => f.nombre).join(' · ')}</Text>
        </View>
      ) : null}

      {perfil.advertencias?.length ? (
        <View style={{ gap: 6 }}>
          {perfil.advertencias.map((a) => (
            <Text key={a} style={{ fontSize: 12.5, lineHeight: 18, color: INK.meta }}>
              {a}
            </Text>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

function FilaLectura({ lectura: l, borde, onPress }) {
  const faltan = falta(l);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 11,
        borderTopWidth: borde ? 1 : 0,
        borderTopColor: TONO.raya,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: INK.title }} numberOfLines={2}>
          {nombreLectura(l)}
        </Text>
        <Text style={{ fontSize: 12.5, color: INK.meta }} numberOfLines={2}>
          {[l.estado === 'patron_respaldado' ? 'patrón' : null, respaldoCorto(l.respaldo), faltan.length ? `falta ${faltan.join(', ')}` : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      <ChevronRight size={16} color={INK.meta} />
    </Pressable>
  );
}

/** Una lectura abierta: qué dice, qué le falta, su evidencia y la corrección. */
function Lectura({ autorId, huellaId, lectura: l, corregir, topInset, bottomInset }) {
  const ev = useEvidencias(autorId, l.clave, huellaId);
  const evidencias = useMemo(() => (ev.data?.pages || []).flatMap((p) => p.evidencias || []), [ev.data]);
  const total = ev.data?.pages?.[0]?.total ?? l.evidencias_total ?? 0;
  const [postAbierto, setPostAbierto] = useState(null);
  const faltan = falta(l);

  const abrirPost = async (postId) => {
    roce();
    const { data } = await supabase.from('codex_universe_items').select(CAMPOS_POST).eq('id', postId).maybeSingle();
    if (data) setPostAbierto(data);
  };

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingTop: 6, paddingBottom: bottomInset + 32, gap: 18 }}>
      <View style={{ gap: 6 }}>
        <Text style={ROTULO}>{(CLASES[l.clase]?.singular || '').toUpperCase()}</Text>
        <Text style={{ fontFamily: SERIF, fontSize: 28, lineHeight: 32, color: INK.title }} accessibilityRole="header">
          {nombreLectura(l)}
        </Text>
        <Text style={{ fontSize: 14.5, lineHeight: 21, color: INK.body }}>{l.texto}</Text>
        <Text style={{ fontSize: 13, color: INK.meta }}>
          {[l.estado === 'patron_respaldado' ? 'patrón respaldado' : 'lectura inicial', respaldoCorto(l.respaldo)].join(' · ')}
        </Text>
        {faltan.length ? <Text style={{ fontSize: 13, color: INK.meta }}>{`Para ser un patrón falta ${faltan.join(', ')}.`}</Text> : null}
      </View>

      <Correccion lectura={l} corregir={corregir} />

      <View style={{ gap: 4 }}>
        <Text style={[ROTULO, { marginBottom: 4 }]}>{`EVIDENCIA · ${total}`}</Text>
        {ev.isLoading ? <MorphingInfinity size={22} color={INK.meta} style={{ alignSelf: 'center', marginVertical: 12 }} /> : null}
        {ev.error ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13.5, color: INK.body }}>{motivoDeError(ev.error)}</Text>
            {ev.error?.status === 409 ? null : <Boton texto="probar de nuevo" alto={40} onPress={() => ev.refetch()} />}
          </View>
        ) : null}
        {evidencias.map((e, i) => (
          <Evidencia key={`${e.post_id}-${i}`} evidencia={e} borde={i > 0} onAbrir={() => abrirPost(e.post_id)} />
        ))}
        {ev.hasNextPage ? <Boton texto="ver más" alto={40} cargando={ev.isFetchingNextPage} onPress={() => ev.fetchNextPage()} /> : null}
      </View>

      {postAbierto ? <PostDetailSheet post={postAbierto} topInset={topInset} bottomInset={bottomInset} onClose={() => setPostAbierto(null)} /> : null}
    </ScrollView>
  );
}

function Evidencia({ evidencia: e, borde, onAbrir }) {
  return (
    <Pressable
      onPress={onAbrir}
      accessibilityRole="button"
      style={({ pressed }) => ({ paddingVertical: 12, gap: 6, borderTopWidth: borde ? 1 : 0, borderTopColor: TONO.raya, opacity: pressed ? 0.6 : 1 })}
    >
      <Text style={{ fontSize: 12, color: INK.meta }}>{[fechaPublicacion(e.publicado_en), ATRIBUCION[e.atribucion] || null].filter(Boolean).join(' · ')}</Text>
      {e.cita ? <Text style={{ fontSize: 14.5, lineHeight: 21, color: INK.title, fontStyle: 'italic' }}>{`«${e.cita}»`}</Text> : null}
      {e.postura ? <Text style={{ fontSize: 13.5, lineHeight: 19, color: INK.body }}>{e.postura}</Text> : null}
      {e.titulo ? (
        <Text style={{ fontSize: 13, color: INK.meta }} numberOfLines={2}>
          {e.titulo}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Aceptar o descartar la lectura. Descartar pide por qué; una descartada se puede volver a incluir. */
function Correccion({ lectura: l, corregir }) {
  const [descartando, setDescartando] = useState(false);
  const [comentario, setComentario] = useState('');
  const [mandando, setMandando] = useState(false);
  const [error, setError] = useState(null);
  const [hecho, setHecho] = useState(false);
  const c = l.correccion;
  const descartada = c?.decision === 'descartar';

  const mandar = async (decision) => {
    setMandando(true);
    setError(null);
    try {
      await corregir({ clave: l.clave, decision, comentario: decision === 'descartar' ? comentario : '' });
      listo();
      setHecho(true);
      setDescartando(false);
    } catch (e) {
      falla();
      setError(motivoDeError(e));
    } finally {
      setMandando(false);
    }
  };

  if (hecho) return <Text style={{ fontSize: 13.5, color: TONO.verde }}>Listo. La huella se vuelve a leer con tu corrección.</Text>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ gap: 10 }}>
      {c?.comentario ? <Text style={{ fontSize: 13.5, lineHeight: 19, color: INK.body }}>{`Tu nota: ${c.comentario}`}</Text> : null}
      {descartada ? (
        <Boton texto="volver a incluir" alto={42} cargando={mandando} onPress={() => mandar('aceptar')} />
      ) : descartando ? (
        <View style={{ gap: 8 }}>
          <TextInput
            value={comentario}
            onChangeText={setComentario}
            placeholder="por qué no es (por ejemplo, lo dijo el invitado)"
            placeholderTextColor={INK.faint}
            multiline
            maxLength={MAX_COMENTARIO}
            autoFocus
            accessibilityLabel="Por qué la descartás"
            style={{ minHeight: 70, borderRadius: 12, borderWidth: 1, borderColor: TONO.borde, backgroundColor: '#FFFFFF', padding: 12, fontSize: 15, color: INK.title }}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Boton texto="cancelar" alto={42} style={{ flex: 1 }} onPress={() => setDescartando(false)} />
            <Boton texto="descartar" alto={42} primario style={{ flex: 1 }} cargando={mandando} disabled={!comentario.trim()} onPress={() => mandar('descartar')} />
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {c?.decision === 'aceptar' ? null : <Boton texto="es correcta" alto={42} style={{ flex: 1 }} cargando={mandando} onPress={() => mandar('aceptar')} />}
          <Boton texto="no es" alto={42} style={{ flex: 1 }} onPress={() => setDescartando(true)} />
        </View>
      )}
      {error ? <Text style={{ fontSize: 13, color: TONO.rojo }}>{error}</Text> : null}
    </KeyboardAvoidingView>
  );
}
