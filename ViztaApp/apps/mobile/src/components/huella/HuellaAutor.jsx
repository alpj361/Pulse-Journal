import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  BadgeCheck,
  CalendarCheck,
  CalendarX,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleQuestionMark,
  Coins,
  FileVideo,
  Fingerprint,
  Hourglass,
  Info,
  Landmark,
  Newspaper,
  Palette,
  Plus,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sprout,
  Tags,
  Target,
  ThumbsDown,
  ThumbsUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import { PAPEL } from '../codex/Papel';
import { falla, listo, roce } from '../../utils/haptics';
import { supabase } from '../../utils/supabase';
import MorphingInfinity from '../MorphingInfinity';
import { Boton, EstadoCentro, ROTULO, TONO } from '../colaboradores/piezas';
import PostDetailSheet from '../posts/PostDetailSheet';
import useHuellaAutor, { useEvidencias } from './useHuellaAutor';
import GuiaHuella from './GuiaHuella';
import HuellaLlena from './HuellaLlena';
import { TONOS } from './tonos';
import {
  ATRIBUCION,
  CLASES,
  EJES,
  MAX_COMENTARIO,
  PERFIL,
  SENTIDOS,
  avanceTema,
  enfriamientoRestante,
  falta,
  fechaPublicacion,
  llenadoHuella,
  motivoDeError,
  nombreLectura,
  porClase,
  respaldoCorto,
  situacion,
} from './logica';

const capital = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const CAMPOS_POST = 'id, name, tipo, description, tags, thumbnail_url, details, aliases, created_at, folder_id';

const GUIA_VISTA = 'vizta-huella-guia-vista';
const ICONO_EJE = { politico: Landmark, economico: Coins, social: Users, cultural: Palette, especifico: Target };
const ICONO_SENTIDO = { a_favor: ThumbsUp, en_contra: ThumbsDown, informa: Info, mixto: Scale };
const ESTADO_PERFIL = {
  evidencia_insuficiente: { Icono: Hourglass, tono: 'neutro' },
  lectura_inicial: { Icono: Sprout, tono: 'ambar' },
  patron_respaldado: { Icono: BadgeCheck, tono: 'verde' },
};
/** Por qué una frase no cuenta como postura de la cuenta. */
const EXCLUSION = {
  sin_atribucion: 'No se sabe quién la dijo',
  tercero: 'La dijo otra persona',
  atribucion_probable: 'Probablemente suya, sin confirmar',
  cita_no_verificada: 'No aparece en el texto',
  cita_ambigua: 'Hablan varias personas a la vez',
  cita_sin_turno: 'No se distingue quién habla',
  audio_ajeno: 'Es audio de otra fuente o una canción',
  eje_incompleto: 'El análisis quedó incompleto',
};

/**
 * La huella de autor de una cuenta. Diseño tomado de la referencia hecha con
 * OpenUI (openui-demo/huella): la huella grande que se llena, etiquetas con
 * ícono, pestañas por clase de lectura y tarjetas con la cita.
 *
 * La pantalla solo muestra información. Lo que explica —qué es cada pestaña,
 * qué significa cada etiqueta, qué le falta para un patrón— vive en la guía
 * (GuiaHuella), que se abre sola la primera vez y después con el «?».
 *
 * `autorId` es el autor social (`post_analisis.autor_id` / `autores.id`), no
 * quien creó un registro del Codex.
 */
export default function HuellaAutor({ autorId, nombre, topInset = 0, bottomInset = 0, onClose }) {
  const h = useHuellaAutor(autorId);
  const [abierta, setAbierta] = useState(null);
  const [pidiendo, setPidiendo] = useState(false);
  const [errorAccion, setErrorAccion] = useState(null);
  const [postAbierto, setPostAbierto] = useState(null);
  const [guia, setGuia] = useState(false);

  const r = h.respuesta;
  const caso = h.consulta.error ? 'error' : situacion(r);
  const perfil = r?.huella?.perfil || null;
  const autor = perfil?.autor || r?.autor || null;
  const espera = enfriamientoRestante(h.ultimoPedido, h.ahora);
  const llenado = llenadoHuella(perfil);
  const tonoHuella = perfil?.estado === 'patron_respaldado' ? 'verde' : 'ambar';

  // La guía se abre sola la primera vez que se ve una huella; después, con el «?».
  useEffect(() => {
    if (caso !== 'vigente') return;
    AsyncStorage.getItem(GUIA_VISTA)
      .then((v) => {
        if (!v) setGuia(true);
      })
      .catch(() => {});
  }, [caso]);
  const cerrarGuia = () => {
    setGuia(false);
    AsyncStorage.setItem(GUIA_VISTA, '1').catch(() => {});
  };

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

  const abrirPost = async (postId) => {
    roce();
    const { data } = await supabase.from('codex_universe_items').select(CAMPOS_POST).eq('id', postId).maybeSingle();
    if (data) setPostAbierto(data);
  };

  // La lectura abierta, siempre la de la versión vigente (si cambió, se cierra).
  const lectura = abierta && perfil ? [...perfil.lecturas, ...perfil.descartadas].find((l) => l.clave === abierta) : null;
  const titulo = autor?.nombre || nombre || (autor?.usuario ? `@${autor.usuario}` : 'Autor');
  const subtitulo = [autor?.usuario ? `@${autor.usuario}` : null, autor?.plataforma].filter(Boolean).join(' · ');

  return (
    <Modal visible animationType="slide" onRequestClose={lectura ? () => setAbierta(null) : onClose}>
      <View style={{ flex: 1, backgroundColor: PAPEL }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: topInset + 12, paddingHorizontal: 18, paddingBottom: 4 }}>
          <Pressable
            onPress={lectura ? () => setAbierta(null) : onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={lectura ? 'Volver' : 'Cerrar'}
            style={{ padding: 6 }}
          >
            {lectura ? <ChevronLeft size={22} color={INK.title} /> : <X size={19} color={INK.faint} />}
          </Pressable>
          <Pressable
            onPress={() => {
              roce();
              setGuia(true);
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cómo leer la huella"
            style={{ padding: 6 }}
          >
            <CircleQuestionMark size={21} color={INK.meta} strokeWidth={1.8} />
          </Pressable>
        </View>

        {lectura ? (
          <Lectura autorId={autorId} huellaId={r.huella.id} lectura={lectura} corregir={h.corregir} bottomInset={bottomInset} onAbrirPost={abrirPost} />
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: bottomInset + 32, gap: 18 }}>
            <Cabecera
              titulo={titulo}
              subtitulo={subtitulo}
              perfil={perfil}
              autor={autor}
              llenado={llenado}
              tono={tonoHuella}
              onHuella={() => {
                roce();
                setGuia(true);
              }}
            />

            {caso === 'cargando' ? (
              <MorphingInfinity size={28} color={INK.meta} style={{ alignSelf: 'center', marginTop: 40 }} />
            ) : caso === 'error' ? (
              <EstadoCentro titulo="No se pudo abrir la huella" texto={motivoDeError(h.consulta.error)}>
                {[401, 403, 404, 422].includes(h.consulta.error?.status) ? null : <Boton texto="probar de nuevo" onPress={() => h.consulta.refetch()} />}
              </EstadoCentro>
            ) : caso === 'calculando' || caso === 'recalculando' ? (
              <Aviso Icono={RefreshCw} tono="azul" titulo={caso === 'recalculando' ? 'Actualizando con publicaciones nuevas' : 'Analizando sus publicaciones'}>
                Tarda unos segundos.
              </Aviso>
            ) : caso === 'sin_calcular' || caso === 'fallo' ? (
              <View style={{ gap: 12 }}>
                <Aviso Icono={caso === 'fallo' ? ShieldAlert : Fingerprint} tono={caso === 'fallo' ? 'rojo' : 'neutro'} titulo={caso === 'fallo' ? 'No se pudo crear la huella' : 'Esta cuenta todavía no tiene huella'}>
                  {caso === 'fallo' ? 'Se vuelve a intentar automáticamente.' : 'Se crea a partir de sus publicaciones ya analizadas.'}
                </Aviso>
                <Boton texto={espera ? `en ${espera} s` : caso === 'fallo' ? 'volver a intentar' : 'crear la huella'} primario cargando={pidiendo} disabled={!!espera} onPress={actualizar} />
              </View>
            ) : (
              <Vigente
                autorId={autorId}
                huellaId={r.huella.id}
                perfil={perfil}
                onAbrir={(l) => {
                  roce();
                  setAbierta(l.clave);
                }}
                onAbrirPost={abrirPost}
              />
            )}

            {caso === 'vigente' ? (
              <Boton texto={espera ? `actualizar en ${espera} s` : 'actualizar'} alto={42} cargando={pidiendo} disabled={!!espera} onPress={actualizar} />
            ) : null}
            {errorAccion ? <Text style={{ fontSize: 13, color: TONO.rojo }}>{errorAccion}</Text> : null}
          </ScrollView>
        )}

        {guia ? <GuiaHuella perfil={perfil} nombre={titulo} llenado={llenado} tono={tonoHuella} bottomInset={bottomInset} onClose={cerrarGuia} /> : null}
        {postAbierto ? <PostDetailSheet post={postAbierto} topInset={topInset} bottomInset={bottomInset} onClose={() => setPostAbierto(null)} /> : null}
      </View>
    </Modal>
  );
}

// ─── Piezas ────────────────────────────────────────────────────────────────

/** Etiqueta con ícono: estados, sentidos, ejes y lo que falta. */
function Etiqueta({ Icono, texto, tono = 'neutro', chica = false }) {
  const t = TONOS[tono] || TONOS.neutro;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: t.fondo,
        borderRadius: 8,
        paddingHorizontal: chica ? 7 : 9,
        paddingVertical: chica ? 3 : 5,
      }}
    >
      {Icono ? <Icono size={chica ? 12 : 14} color={t.tinta} strokeWidth={2} /> : null}
      <Text style={{ fontSize: chica ? 12 : 13.5, fontWeight: '600', color: t.tinta }}>{texto}</Text>
    </View>
  );
}

/** Caja con ícono, título y una línea: avisos y estados vacíos. */
function Aviso({ Icono, tono = 'azul', titulo, children }) {
  const t = TONOS[tono] || TONOS.neutro;
  return (
    <View style={{ flexDirection: 'row', gap: 12, backgroundColor: t.fondo, borderRadius: 14, padding: 14 }}>
      <Icono size={18} color={t.tinta} strokeWidth={2} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '700', color: t.tinta }}>{titulo}</Text>
        {children ? <Text style={{ fontSize: 13.5, lineHeight: 19, color: INK.body }}>{children}</Text> : null}
      </View>
    </View>
  );
}

/** Nombre de la cuenta con la huella grande al lado, que se llena con lo que hay. */
function Cabecera({ titulo, subtitulo, perfil, autor, llenado, tono, onHuella }) {
  const e = perfil ? ESTADO_PERFIL[perfil.estado] : null;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={ROTULO}>HUELLA DE AUTOR</Text>
          <Text style={{ fontFamily: SERIF, fontSize: 34, lineHeight: 38, color: INK.title }} accessibilityRole="header">
            {titulo}
          </Text>
          {subtitulo ? <Text style={{ fontSize: 14, color: INK.meta }}>{subtitulo}</Text> : null}
        </View>
        <Pressable onPress={onHuella} hitSlop={8} accessibilityRole="button" accessibilityHint="Abre la guía">
          <HuellaLlena llenado={llenado} tono={tono} size={78} />
        </Pressable>
      </View>
      {perfil ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Etiqueta Icono={e.Icono} texto={PERFIL[perfil.estado]} tono={e.tono} />
          {autor?.usuario_confirmado ? (
            <Etiqueta Icono={BadgeCheck} texto="Cuenta confirmada" tono="verde" />
          ) : (
            <Etiqueta Icono={ShieldAlert} texto="Cuenta sin confirmar" tono="ambar" />
          )}
        </View>
      ) : null}
    </View>
  );
}

/** Una cifra en su recuadro: ícono, el número grande y qué es. */
function Cifra({ Icono, tono = 'neutro', etiqueta, valor }) {
  const t = TONOS[tono] || TONOS.neutro;
  return (
    <View style={{ flex: 1, gap: 8, backgroundColor: TONO.tarjeta, borderWidth: 1, borderColor: TONO.raya, borderRadius: 14, padding: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: t.fondo, alignItems: 'center', justifyContent: 'center' }}>
          <Icono size={15} color={t.tinta} strokeWidth={1.9} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '800', color: INK.title }}>{valor}</Text>
      </View>
      <Text style={{ fontSize: 13.5, color: INK.body }}>{etiqueta}</Text>
    </View>
  );
}

/** Una pestaña sin contenido: una línea, sin caja. */
function Vacio({ children }) {
  return <Text style={{ fontSize: 15, color: INK.meta, paddingVertical: 8 }}>{children}</Text>;
}

/** Barra de avance hacia un umbral. */
function Barra({ avance, tono = 'verde' }) {
  const t = TONOS[tono] || TONOS.verde;
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(28,43,34,0.08)', overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(Math.max(0.04, avance) * 100)}%`, height: '100%', borderRadius: 3, backgroundColor: t.tinta }} />
    </View>
  );
}

// ─── Huella vigente ────────────────────────────────────────────────────────

function Vigente({ autorId, huellaId, perfil, onAbrir, onAbrirPost }) {
  const c = perfil.cobertura || {};
  const grupos = useMemo(() => Object.fromEntries(porClase(perfil.lecturas).map((g) => [g.clase, g.lecturas])), [perfil]);
  const temas = grupos.tema_editorial || [];
  const narrativas = grupos.narrativa_publicada || [];
  const posturas = grupos.postura_atribuida || [];
  const [pestana, setPestana] = useState(temas.length ? 'temas' : narrativas.length ? 'narrativas' : 'posturas');
  const excluidas = Object.entries(c.posturas_excluidas || {});

  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ gap: 18 }}>
      {/* Las cifras de lo que se leyó; cuántos temas, narrativas y posturas ya lo dicen las pestañas. */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Cifra Icono={Newspaper} etiqueta="publicaciones analizadas" valor={c.posts || 0} />
        <Cifra
          Icono={c.con_fecha < c.posts ? CalendarX : CalendarCheck}
          tono={c.con_fecha < c.posts ? 'ambar' : 'verde'}
          etiqueta="tienen fecha"
          valor={`${c.con_fecha || 0} de ${c.posts || 0}`}
        />
      </View>

      {/* Lecturas, por clase. */}
      <View style={{ flexDirection: 'row', gap: 18, borderBottomWidth: 1, borderBottomColor: TONO.raya }} accessibilityRole="tablist">
        {[
          ['temas', `Temas · ${temas.length}`],
          ['narrativas', `Narrativas · ${narrativas.length}`],
          ['posturas', `Posturas · ${posturas.length}`],
        ].map(([k, t]) => {
          const on = pestana === k;
          return (
            <Pressable
              key={k}
              onPress={() => setPestana(k)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={{ paddingBottom: 9, borderBottomWidth: 2, borderBottomColor: on ? INK.title : 'transparent', marginBottom: -1 }}
            >
              <Text style={{ fontSize: 15, fontWeight: on ? '700' : '500', color: on ? INK.title : INK.meta }}>{t}</Text>
            </Pressable>
          );
        })}
      </View>

      {pestana === 'temas' ? (
        temas.length ? (
          <View style={{ gap: 2 }}>
            {temas.map((t, i) => (
              <FilaTema key={t.clave} autorId={autorId} huellaId={huellaId} lectura={t} perfil={perfil} borde={i > 0} onAbrir={() => onAbrir(t)} onAbrirPost={onAbrirPost} />
            ))}
          </View>
        ) : (
          <Vacio>Todavía no aparece ningún tema.</Vacio>
        )
      ) : pestana === 'narrativas' ? (
        <View style={{ gap: 12 }}>
          {narrativas.map((n) => (
            <TarjetaNarrativa key={n.clave} autorId={autorId} huellaId={huellaId} lectura={n} onAbrir={() => onAbrir(n)} onAbrirPost={onAbrirPost} />
          ))}
        </View>
      ) : posturas.length ? (
        <View style={{ gap: 12 }}>
          {posturas.map((n) => (
            <TarjetaNarrativa key={n.clave} autorId={autorId} huellaId={huellaId} lectura={n} onAbrir={() => onAbrir(n)} onAbrirPost={onAbrirPost} />
          ))}
        </View>
      ) : (
        <Vacio>Todavía no hay opiniones confirmadas de la propia cuenta.</Vacio>
      )}

      {perfil.fuentes_citadas?.length ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: INK.title }}>Fuentes que cita</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {perfil.fuentes_citadas.map((f) => (
              <Etiqueta key={f.nombre} Icono={Newspaper} texto={`${f.nombre} · ${f.posts}`} tono="azul" />
            ))}
          </View>
        </View>
      ) : null}

      {excluidas.length ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: INK.title }}>Frases que no cuentan como suyas</Text>
          {excluidas.map(([k, n]) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
              <CircleQuestionMark size={16} color={TONOS.ambar.tinta} strokeWidth={1.9} />
              <Text style={{ flex: 1, fontSize: 14.5, color: INK.title }}>{EXCLUSION[k] || k}</Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: INK.title }}>{n}</Text>
            </View>
          ))}
        </View>
      ) : null}

    </Animated.View>
  );
}

/** Un tema: cuánto tiene hacia el umbral, qué le falta y, al abrirlo, de qué publicaciones sale. */
function FilaTema({ autorId, huellaId, lectura: l, perfil, borde, onAbrir, onAbrirPost }) {
  const [abierto, setAbierto] = useState(false);
  const a = avanceTema(l, perfil);
  const patron = l.estado === 'patron_respaldado';
  return (
    <View style={{ borderTopWidth: borde ? 1 : 0, borderTopColor: TONO.raya }}>
      <Pressable onPress={() => setAbierto((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: abierto }} style={{ paddingVertical: 13, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: INK.title }} numberOfLines={2}>
            {l.tema}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: patron ? TONOS.verde.tinta : INK.meta }}>{`${a.tiene} de ${a.meta} publicaciones`}</Text>
          <ChevronDown size={18} color={INK.meta} style={{ transform: [{ rotate: abierto ? '180deg' : '0deg' }] }} />
        </View>
        <Barra avance={a.avance} tono={patron ? 'verde' : 'azul'} />
      </Pressable>
      {abierto ? <DetalleTema autorId={autorId} huellaId={huellaId} lectura={l} onAbrir={onAbrir} onAbrirPost={onAbrirPost} /> : null}
    </View>
  );
}

function DetalleTema({ autorId, huellaId, lectura: l, onAbrir, onAbrirPost }) {
  const ev = useEvidencias(autorId, l.clave, huellaId);
  const evidencias = (ev.data?.pages || []).flatMap((p) => p.evidencias || []);
  const e = l.evidencia_necesaria || {};
  return (
    <Animated.View entering={FadeIn.duration(160)} style={{ gap: 10, paddingBottom: 14 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {l.estado === 'patron_respaldado' ? <Etiqueta chica Icono={BadgeCheck} texto="Patrón respaldado" tono="verde" /> : null}
        {e.posts_adicionales_minimos > 0 ? (
          <Etiqueta chica Icono={Plus} texto={`Faltan ${e.posts_adicionales_minimos} ${e.posts_adicionales_minimos === 1 ? 'publicación' : 'publicaciones'}`} tono="ambar" />
        ) : null}
        {e.requiere_fechas ? <Etiqueta chica Icono={CalendarX} texto="Falta la fecha" tono="ambar" /> : null}
        {e.requiere_cobertura_temporal ? <Etiqueta chica Icono={Hourglass} texto="Abarca poco tiempo" /> : null}
        {e.requiere_identidad ? <Etiqueta chica Icono={ShieldAlert} texto="Cuenta sin confirmar" tono="ambar" /> : null}
      </View>
      {ev.isLoading ? <MorphingInfinity size={18} color={INK.meta} /> : null}
      {evidencias.map((x, i) => (
        <Fuente key={`${x.post_id}-${i}`} evidencia={x} numero={i + 1} onPress={() => onAbrirPost(x.post_id)} />
      ))}
      <Pressable onPress={onAbrir} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'flex-start' }}>
        <Text style={{ fontSize: 13.5, fontWeight: '600', color: TONO.verde }}>ver detalle</Text>
      </Pressable>
    </Animated.View>
  );
}

/** Una publicación de donde sale una lectura. */
function Fuente({ evidencia: x, numero, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(28,43,34,0.06)', alignItems: 'center', justifyContent: 'center' }}>
        {numero ? <Text style={{ fontSize: 12.5, fontWeight: '700', color: INK.meta }}>{numero}</Text> : <FileVideo size={15} color={INK.meta} />}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontSize: 14, color: INK.title }} numberOfLines={1}>
          {String(x.titulo || 'Publicación').replace(/^@[^—]+—\s*/, '')}
        </Text>
        <Text style={{ fontSize: 12.5, color: INK.meta }}>{fechaPublicacion(x.publicado_en)}</Text>
      </View>
    </Pressable>
  );
}

/** Una narrativa (o postura): sentido, eje, la cita y de dónde sale. */
function TarjetaNarrativa({ autorId, huellaId, lectura: l, onAbrir, onAbrirPost }) {
  const ev = useEvidencias(autorId, l.clave, huellaId);
  const x = ev.data?.pages?.[0]?.evidencias?.[0] || null;
  const se = SENTIDOS[l.sentido] || null;
  const IconoSentido = ICONO_SENTIDO[l.sentido] || Info;
  const IconoEje = ICONO_EJE[l.eje] || Tags;
  const atribuida = l.clase === 'postura_atribuida';
  const igual = String(l.hacia || '').trim().toLowerCase() === String(l.tema || '').trim().toLowerCase();
  return (
    <Pressable
      onPress={onAbrir}
      accessibilityRole="button"
      style={({ pressed }) => ({ backgroundColor: TONO.tarjeta, borderWidth: 1, borderColor: TONO.raya, borderRadius: 16, padding: 14, gap: 10, opacity: pressed ? 0.85 : 1 })}
    >
      <View style={{ gap: 2 }}>
        <Text style={{ fontSize: 16.5, fontWeight: '800', color: INK.title }}>{l.tema}</Text>
        {l.hacia && !igual ? <Text style={{ fontSize: 13.5, color: INK.meta }}>{`hacia ${l.hacia}`}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {se ? <Etiqueta chica Icono={IconoSentido} texto={se.texto} tono={se.tono} /> : null}
        {l.eje ? <Etiqueta chica Icono={IconoEje} texto={capital(EJES[l.eje] || l.eje)} /> : null}
        {atribuida ? (
          <Etiqueta chica Icono={UserCheck} texto="Lo dijo el autor" tono="verde" />
        ) : (
          <Etiqueta chica Icono={CircleQuestionMark} texto="No se sabe quién lo dijo" tono="ambar" />
        )}
      </View>
      {x?.cita ? (
        <View style={{ backgroundColor: 'rgba(28,43,34,0.04)', borderRadius: 12, padding: 12 }}>
          <View style={{ borderLeftWidth: 3, borderLeftColor: 'rgba(28,43,34,0.35)', paddingLeft: 10 }}>
            <Text style={{ fontSize: 15, color: INK.title }}>{`«${x.cita}»`}</Text>
          </View>
        </View>
      ) : ev.isLoading ? (
        <MorphingInfinity size={18} color={INK.meta} />
      ) : null}
      {x?.postura ? <Text style={{ fontSize: 13.5, lineHeight: 19, color: INK.body }}>{x.postura}</Text> : null}
      {x ? <Fuente evidencia={x} onPress={() => onAbrirPost(x.post_id)} /> : null}
    </Pressable>
  );
}

// ─── Una lectura abierta: revisar y corregir ───────────────────────────────

function Lectura({ autorId, huellaId, lectura: l, corregir, bottomInset, onAbrirPost }) {
  const ev = useEvidencias(autorId, l.clave, huellaId);
  const evidencias = useMemo(() => (ev.data?.pages || []).flatMap((p) => p.evidencias || []), [ev.data]);
  const total = ev.data?.pages?.[0]?.total ?? l.evidencias_total ?? 0;
  const faltan = falta(l);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: bottomInset + 32, gap: 18 }}>
      <View style={{ gap: 8 }}>
        <Text style={ROTULO}>{(CLASES[l.clase]?.singular || '').toUpperCase()}</Text>
        <Text style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 34, color: INK.title }} accessibilityRole="header">
          {nombreLectura(l)}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Etiqueta Icono={l.estado === 'patron_respaldado' ? BadgeCheck : Sprout} texto={l.estado === 'patron_respaldado' ? 'Patrón respaldado' : 'Lectura inicial'} tono={l.estado === 'patron_respaldado' ? 'verde' : 'ambar'} />
          <Etiqueta Icono={Newspaper} texto={respaldoCorto(l.respaldo)} />
        </View>
        {faltan.length ? <Text style={{ fontSize: 13.5, color: INK.meta }}>{`Para considerarlo un patrón falta ${faltan.join(', ')}.`}</Text> : null}
      </View>

      <Correccion lectura={l} corregir={corregir} />

      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: INK.title }}>{`De dónde sale · ${total}`}</Text>
        {ev.isLoading ? <MorphingInfinity size={22} color={INK.meta} style={{ alignSelf: 'center', marginVertical: 12 }} /> : null}
        {ev.error ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13.5, color: INK.body }}>{motivoDeError(ev.error)}</Text>
            {ev.error?.status === 409 ? null : <Boton texto="probar de nuevo" alto={40} onPress={() => ev.refetch()} />}
          </View>
        ) : null}
        {evidencias.map((x, i) => (
          <View key={`${x.post_id}-${i}`} style={{ backgroundColor: TONO.tarjeta, borderWidth: 1, borderColor: TONO.raya, borderRadius: 14, padding: 12, gap: 8 }}>
            {x.cita ? <Text style={{ fontSize: 15, color: INK.title }}>{`«${x.cita}»`}</Text> : null}
            {x.postura ? <Text style={{ fontSize: 13.5, lineHeight: 19, color: INK.body }}>{x.postura}</Text> : null}
            {x.atribucion && x.atribucion !== 'publicacion_de_cuenta' ? (
              <Etiqueta chica Icono={x.atribucion === 'autor_segun_analisis' ? UserCheck : CircleQuestionMark} texto={ATRIBUCION[x.atribucion] || x.atribucion} tono={x.atribucion === 'autor_segun_analisis' ? 'verde' : 'ambar'} />
            ) : null}
            <Fuente evidencia={x} onPress={() => onAbrirPost(x.post_id)} />
          </View>
        ))}
        {ev.hasNextPage ? <Boton texto="ver más" alto={40} cargando={ev.isFetchingNextPage} onPress={() => ev.fetchNextPage()} /> : null}
      </View>
    </ScrollView>
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

  if (hecho) {
    return (
      <Aviso Icono={Check} tono="verde" titulo="Listo">
        La huella se recalcula con esta corrección.
      </Aviso>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ gap: 10 }}>
      {c?.comentario ? (
        <View style={{ borderLeftWidth: 3, borderLeftColor: 'rgba(28,43,34,0.18)', paddingLeft: 12 }}>
          <Text style={{ fontSize: 13.5, lineHeight: 19, color: INK.body }}>{c.comentario}</Text>
        </View>
      ) : null}
      {descartada ? (
        <Boton texto="volver a incluir" alto={42} cargando={mandando} onPress={() => mandar('aceptar')} />
      ) : descartando ? (
        <View style={{ gap: 8 }}>
          <TextInput
            value={comentario}
            onChangeText={setComentario}
            placeholder="por qué no es correcta (por ejemplo: lo dijo un invitado)"
            placeholderTextColor={INK.faint}
            multiline
            maxLength={MAX_COMENTARIO}
            autoFocus
            accessibilityLabel="Por qué no es correcta"
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
          <Boton texto="no es correcta" alto={42} style={{ flex: 1 }} onPress={() => setDescartando(true)} />
        </View>
      )}
      {error ? <Text style={{ fontSize: 13, color: TONO.rojo }}>{error}</Text> : null}
    </KeyboardAvoidingView>
  );
}
