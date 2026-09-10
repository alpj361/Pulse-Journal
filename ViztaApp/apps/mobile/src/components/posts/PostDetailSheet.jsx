import { useMemo, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { X, Eye, ExternalLink, Play } from 'lucide-react-native';
import { INK, MOTION, RADIUS } from '../theme';
import { PAPEL } from '../codex/Papel';
import { MONO } from '../codex/mono';
import { TYPE_ACCENT } from '../codex/tipos';
import MorphingInfinity from '../MorphingInfinity';
import analizarPost from './analizarPost';
import { anotarTexto } from './anotar';
import { roce, toque, falla } from '../../utils/haptics';
import { EV, evento } from '../../utils/analitica';

const COLOR_ACTOR = TYPE_ACCENT.Actor;
const COLOR_ENTIDAD = TYPE_ACCENT.Entidad;

/**
 * Ficha de un post.
 *
 * Un post no es un item del Codex como los demás y por eso no usa
 * `ItemDetailSheet`. Aquel muestra campos: nombre, tipo de dato, progresiones,
 * relaciones. Un post no tiene campos — tiene un video, lo que dice el video y
 * lo que se puede sacar de eso. Meterlo en la ficha genérica dejaba la
 * transcripción escondida entre «detalles» junto a la URL del thumbnail.
 *
 * Así que acá hay tres cosas y en este orden: qué se ve, qué dice, y qué se
 * puede sacar. El botón del ojo es lo tercero — abre la extracción con IA, que
 * lee la transcripción y devuelve actores, entidades y contexto.
 *
 * El resultado se puede mirar de dos formas: **anotado**, el texto original con
 * lo reconocido pintado encima, y **organizado**, las mismas cosas en listas.
 * Anotado sirve para verificar (¿de dónde sacó eso?); organizado, para copiar.
 * Ninguna de las dos sola alcanza.
 */
export default function PostDetailSheet({ post, onClose, onActualizado, topInset = 0, bottomInset = 0 }) {
  const { width: W } = useWindowDimensions();

  const [rota, setRota] = useState(false);
  const [analisis, setAnalisis] = useState(post?.details?.analysis || null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [vista, setVista] = useState('anotado');
  const [verTodo, setVerTodo] = useState(false);

  const d = post?.details || {};
  const uri = post?.thumbnail_url || d.thumbnail_url || d.images?.[0];
  const autor = d.author_name || d.author || (post?.name || '').match(/^@([^—]+)/)?.[1]?.trim();
  const esVideo = post?.tags?.includes('reel') || post?.tags?.includes('video') || d.is_reel;
  const transcripcion = d.transcription;

  // El caption sin el «@autor — » que el nombre trae adelante.
  const descripcion = (post?.description || '').replace(/^@[^—]+—\s*/, '').trim();

  // El texto que se anota es el mismo que se manda a analizar.
  const textoBase = transcripcion || descripcion;

  const tramos = useMemo(
    () => (analisis ? anotarTexto(textoBase, analisis.actores, analisis.entidades) : []),
    [analisis, textoBase]
  );

  const extraer = async () => {
    if (cargando) return;
    if (analisis) {
      roce();
      setVista((v) => (v === 'anotado' ? 'organizado' : 'anotado'));
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const r = await analizarPost(post);
      setAnalisis(r);
      // Cuántas cosas sacó, no cuáles.
      evento(EV.POST_ANALIZADO, {
        actores: r.actores?.length || 0,
        entidades: r.entidades?.length || 0,
        con_transcripcion: !!transcripcion,
      });
      toque();
      onActualizado?.({ ...post, details: { ...d, analysis: r } });
    } catch (e) {
      falla();
      setError(e.message || 'No se pudo extraer');
    } finally {
      setCargando(false);
    }
  };

  const fecha = post?.created_at
    ? new Date(post.created_at).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: PAPEL }}>
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

          {d.source_url ? (
            <Pressable
              onPress={() => Linking.openURL(d.source_url).catch(() => {})}
              hitSlop={12}
              style={{ padding: 6, marginRight: 2 }}
              accessibilityRole="button"
              accessibilityLabel="Abrir el original"
            >
              <ExternalLink size={17} color={INK.faint} />
            </Pressable>
          ) : null}

          <OjoBoton onPress={extraer} cargando={cargando} activo={!!analisis} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 30, paddingTop: 18, paddingBottom: bottomInset + 44 }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              width: '100%',
              height: Math.min(W * 0.9, 340),
              borderRadius: RADIUS.lg,
              overflow: 'hidden',
              backgroundColor: 'rgba(28,43,34,0.06)',
              borderWidth: 1,
              borderColor: 'rgba(28,43,34,0.08)',
            }}
          >
            {uri && !rota ? (
              <Image source={{ uri }} onError={() => setRota(true)} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: MONO, fontSize: 42, color: 'rgba(28,43,34,0.14)' }}>
                  {(autor || '?').trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {esVideo ? (
              <View
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: 'rgba(12,20,15,0.45)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Play size={12} color="#fff" fill="#fff" />
              </View>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 }}>
            {autor ? (
              <Text style={{ fontFamily: MONO, fontSize: 13, color: INK.title }}>{autor}</Text>
            ) : null}
            {fecha ? (
              <Text style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(28,43,34,0.3)' }}>· {fecha}</Text>
            ) : null}
          </View>

          {descripcion ? (
            <Bloque titulo="descripción">
              <Text style={{ fontFamily: MONO, fontSize: 13, color: INK.body, lineHeight: 21 }}>
                {descripcion}
              </Text>
            </Bloque>
          ) : null}

          {transcripcion ? (
            <Bloque titulo="transcripción">
              <Text
                numberOfLines={verTodo ? undefined : 8}
                style={{ fontFamily: MONO, fontSize: 13, color: INK.body, lineHeight: 21 }}
              >
                {transcripcion}
              </Text>
              {transcripcion.length > 340 ? (
                <Pressable onPress={() => setVerTodo((v) => !v)} hitSlop={8} style={{ marginTop: 8 }}>
                  <Text style={{ fontFamily: MONO, fontSize: 12, color: 'rgba(28,43,34,0.35)' }}>
                    {verTodo ? '— menos' : '+ todo'}
                  </Text>
                </Pressable>
              ) : null}
            </Bloque>
          ) : null}

          {error ? (
            <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: 22 }}>
              <Text style={{ fontFamily: MONO, fontSize: 12.5, color: '#B91C1C', lineHeight: 19 }}>{error}</Text>
            </Animated.View>
          ) : null}

          {analisis ? (
            <Animated.View layout={LinearTransition.springify().damping(22)} entering={FadeIn.duration(260)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 34, marginBottom: 4 }}>
                <Solapa activa={vista === 'anotado'} onPress={() => { roce(); setVista('anotado'); }}>
                  anotado
                </Solapa>
                <Solapa activa={vista === 'organizado'} onPress={() => { roce(); setVista('organizado'); }}>
                  organizado
                </Solapa>
              </View>

              {vista === 'anotado' ? (
                <View style={{ marginTop: 14 }}>
                  <Text style={{ fontFamily: MONO, fontSize: 13, lineHeight: 23 }}>
                    {tramos.map((t, i) => (
                      <Text
                        key={i}
                        style={{
                          color: t.tipo === 'actor' ? COLOR_ACTOR : t.tipo === 'entidad' ? COLOR_ENTIDAD : INK.body,
                        }}
                      >
                        {t.texto}
                      </Text>
                    ))}
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 18 }}>
                    <Leyenda color={COLOR_ACTOR}>actores</Leyenda>
                    <Leyenda color={COLOR_ENTIDAD}>entidades</Leyenda>
                  </View>
                </View>
              ) : (
                <View style={{ marginTop: 14 }}>
                  {analisis.resumen ? (
                    <Text style={{ fontFamily: MONO, fontSize: 13, color: INK.title, lineHeight: 21, marginBottom: 18 }}>
                      {analisis.resumen}
                    </Text>
                  ) : null}

                  <Lista titulo="actores" items={analisis.actores} color={COLOR_ACTOR} />
                  <Lista titulo="entidades" items={analisis.entidades} color={COLOR_ENTIDAD} />
                  <Lista titulo="temas" items={analisis.temas} color="#6A5433" />

                  {analisis.contexto ? (
                    <Bloque titulo="contexto">
                      <Text style={{ fontFamily: MONO, fontSize: 13, color: INK.body, lineHeight: 21 }}>
                        {analisis.contexto}
                      </Text>
                    </Bloque>
                  ) : null}
                </View>
              )}
            </Animated.View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

/**
 * El ojo.
 *
 * Sin análisis, invita a extraer. Con análisis, ya no hay nada que extraer, así
 * que cambia de trabajo: alterna entre las dos vistas. Se marca con un punto
 * para que se note que ya se usó — un ojo idéntico antes y después haría pensar
 * que no pasó nada.
 */
function OjoBoton({ onPress, cargando, activo }) {
  const press = useSharedValue(0);

  const animado = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.08 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withTiming(1, MOTION.press);
      }}
      onPressOut={() => {
        press.value = withSpring(0, MOTION.tap);
      }}
      hitSlop={12}
      disabled={cargando}
      accessibilityRole="button"
      accessibilityLabel={activo ? 'Cambiar de vista del análisis' : 'Extraer detalles con IA'}
    >
      <Animated.View
        style={[
          {
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: activo ? 'rgba(75,79,166,0.12)' : 'rgba(28,43,34,0.06)',
            borderWidth: 1,
            borderColor: activo ? 'rgba(75,79,166,0.28)' : 'rgba(28,43,34,0.09)',
          },
          animado,
        ]}
      >
        {cargando ? (
          <MorphingInfinity size={16} color={INK.title} />
        ) : (
          <Eye size={16} color={activo ? COLOR_ACTOR : INK.title} />
        )}
      </Animated.View>
    </Pressable>
  );
}

function Bloque({ titulo, children }) {
  return (
    <View style={{ marginTop: 28 }}>
      <Text style={{ fontFamily: MONO, fontSize: 11.5, color: 'rgba(28,43,34,0.3)', marginBottom: 10 }}>
        {titulo}
      </Text>
      {children}
    </View>
  );
}

function Solapa({ activa, onPress, children }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text
        style={{
          fontFamily: MONO,
          fontSize: 12.5,
          color: activa ? INK.title : 'rgba(28,43,34,0.3)',
        }}
      >
        {children}
      </Text>
      <View
        style={{
          height: 1,
          marginTop: 5,
          backgroundColor: activa ? 'rgba(28,43,34,0.5)' : 'transparent',
        }}
      />
    </Pressable>
  );
}

function Leyenda({ color, children }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(28,43,34,0.35)' }}>{children}</Text>
    </View>
  );
}

function Lista({ titulo, items, color }) {
  const limpios = (items || []).filter(Boolean);
  if (!limpios.length) return null;

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontFamily: MONO, fontSize: 11.5, color: 'rgba(28,43,34,0.3)', marginBottom: 9 }}>
        {titulo}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        {limpios.map((t, i) => (
          <View
            key={i}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: RADIUS.pill,
              borderWidth: 1,
              borderColor: `${color}33`,
              backgroundColor: `${color}0D`,
            }}
          >
            <Text style={{ fontFamily: MONO, fontSize: 12, color }}>{String(t)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
