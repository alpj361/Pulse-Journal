import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  StyleSheet,
  Modal,
  Pressable,
  Linking,
  useWindowDimensions,
} from "react-native";
import { useRef, useState, useCallback, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import GlassCard from "../../components/GlassCard";
import { INK, GLASS, chipStyle } from "../../components/theme";
import Grano from "../../components/feed/Grano";
import PortadaDia from "../../components/feed/PortadaDia";
import TarjetaNoticia from "../../components/feed/TarjetaNoticia";
import TarjetaCongreso from "../../components/feed/TarjetaCongreso";
import SelectorFeed from "../../components/feed/SelectorFeed";
import { nombreDelDia, traerCongreso } from "../../components/feed/congreso";
import GaleriaNoticia from "../../components/feed/GaleriaNoticia";
import { fotosDe } from "../../components/feed/fotos";
import { categoriaDe, temaDe } from "../../components/feed/temas";
import { SERIF } from "../../components/theme";
import Mundito from "../../components/mapa/Mundito";
import MapaSheet from "../../components/mapa/MapaSheet";
import { PAPEL } from "../../components/codex/Papel";
import Pegatina from "../../components/feed/Pegatina";
import { paletaDe } from "../../components/feed/temas";
import MediosNoticia, { MarcaTweet } from "../../components/feed/MediosNoticia";
import { marcaDe } from "../../components/feed/encuadres";
import { EV, evento } from "../../utils/analitica";
import {
  TrendingUp,
  Flame,
  BookOpen,
  MessageCircle,
  X,
  ChevronRight,
  Plus,
  Zap,
  BadgeCheck,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { useRouter } from 'expo-router';
import { Settings as SettingsIcon } from 'lucide-react-native';
import { useUltimoLugarStore, useRecordarLugar } from '../../state/ultimoLugarStore';

/** Lo único que el feed puede borrar del registro de «dónde me quedé». */
const TIPOS_MAPA = ['mapa'];

/** El ámbar de los puntos del mapa. No es un color nuevo: es el mismo acento
 *  que ya usa la app, puesto donde hacía falta que algo no fuera tinta. */
const TUERCA = '#B45309';
import * as Notifications from 'expo-notifications';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://qqshdccpmypelhmyqnut.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
// El feed público se estrena con Guatemala. El filtro vive en la consulta para
// que no lleguen al cliente registros generados para otros países.
const FEED_COUNTRY = 'gt';

async function supabaseFetch(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`);
  return res.json();
}

// ── Entity Wiki Modal ─────────────────────────────────────────────────────────

function EntityWikiModal({ entityName, onClose }) {
  const [loading, setLoading] = useState(true);
  const [wikiItem, setWikiItem] = useState(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const confirmTimer = useRef(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.auth.getSession(),
      supabase
        .from('wiki_items')
        .select('id, name, subcategory, description')
        .ilike('name', entityName)
        .limit(1),
    ]).then(([{ data: sessionData }, { data: wikiData }]) => {
      if (!active) return;
      setIsAuthenticated(!!sessionData?.session?.user);
      setWikiItem(wikiData?.[0] || null);
      setLoading(false);
    });
    return () => { active = false; };
  }, [entityName]);

  const handleCreateTap = () => {
    if (confirmPending) {
      clearTimeout(confirmTimer.current);
      setConfirmPending(false);
      createEntry();
    } else {
      setConfirmPending(true);
      confirmTimer.current = setTimeout(() => setConfirmPending(false), 1800);
    }
  };

  const createEntry = async () => {
    setCreating(true);
    console.log('[EntityWikiModal] createEntry START — entityName:', entityName);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    console.log('[EntityWikiModal] userId:', userId);
    const payload = { name: entityName, subcategory: 'person', relevance_score: 50, ...(userId ? { user_id: userId } : {}) };
    console.log('[EntityWikiModal] insert payload:', JSON.stringify(payload));
    const { data, error } = await supabase
      .from('wiki_items')
      .insert(payload)
      .select('id, name, subcategory, description')
      .single();
    console.log('[EntityWikiModal] insert result — data:', JSON.stringify(data), '| error:', error ? JSON.stringify(error) : null);
    if (data) { setWikiItem(data); setCreated(true); }
    if (error) console.warn('[EntityWikiModal] createEntry FAILED:', error.message, '| code:', error.code, '| details:', error.details, '| hint:', error.hint);
    setCreating(false);
  };

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      {/* Backdrop — toca afuera para cerrar */}
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', paddingHorizontal: 24 }}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={onClose}
          activeOpacity={1}
        />
        {/* Card content — encima del backdrop */}
        <View style={{
          backgroundColor: '#0d0f1e',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.12)',
          padding: 22,
        }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5, marginBottom: 4 }}>
                ACTOR / ENTIDAD
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>
                {entityName}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={14} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color="rgba(165,180,252,0.8)" style={{ marginVertical: 16 }} />
          ) : wikiItem ? (
            <View>
              <View style={{
                backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: 12, padding: 14,
                borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)', marginBottom: 16,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <BookOpen size={13} color="rgba(165,180,252,0.8)" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(165,180,252,0.8)', letterSpacing: 0.4 }}>
                    {created ? 'CREADO EN WIKI' : 'EN TU WIKI'}
                  </Text>
                </View>
                {wikiItem.subcategory && (
                  <Text style={{ fontSize: 11, color: 'rgba(165,180,252,0.6)', marginBottom: 6 }}>{wikiItem.subcategory}</Text>
                )}
                {wikiItem.description ? (
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 19 }} numberOfLines={3}>
                    {wikiItem.description}
                  </Text>
                ) : (
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>Sin descripción aún</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={{
                  backgroundColor: 'rgba(99,102,241,0.6)', borderRadius: 12, paddingVertical: 12,
                  alignItems: 'center', borderWidth: 1, borderColor: 'rgba(99,102,241,0.4)',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Ver en Codex →</Text>
              </TouchableOpacity>
            </View>
          ) : isAuthenticated ? (
            <TouchableOpacity
              onPress={handleCreateTap}
              disabled={creating}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                backgroundColor: creating
                  ? 'rgba(99,102,241,0.3)'
                  : confirmPending
                  ? 'rgba(16,185,129,0.6)'
                  : 'rgba(99,102,241,0.55)',
                borderRadius: 12, paddingVertical: 13,
                borderWidth: 1, borderColor: confirmPending ? 'rgba(16,185,129,0.5)' : 'rgba(99,102,241,0.4)',
              }}
            >
              {creating
                ? <ActivityIndicator size="small" color="#fff" />
                : <Plus size={15} color="#fff" />
              }
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                {creating ? 'Agregando...' : confirmPending ? 'Toca de nuevo para confirmar' : 'Agregar al Codex'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_GRADIENTS = {
  política: ['#1a1a3e', '#2d1b69'],
  deportes: ['#064e3b', '#065f46'],
  economía: ['#451a03', '#78350f'],
  internacional: ['#2e1065', '#4c1d95'],
  social: ['#4a0e4e', '#6b21a8'],
  tecnología: ['#0c4a6e', '#075985'],
  justicia: ['#1c1917', '#292524'],
  entretenimiento: ['#500724', '#881337'],
  otros: ['#1f2937', '#111827'],
};
const DEFAULT_GRADIENT = ['#1f2937', '#111827'];

function normCat(cat) {
  return (cat || '').toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u');
}

function getCatGradient(cat) {
  return CATEGORY_GRADIENTS[normCat(cat)] || DEFAULT_GRADIENT;
}

// Versión clara de CATEGORY_GRADIENTS: el color de categoría deja de teñir toda
// la card y pasa a vivir en el chip y en el filete lateral.
const CATEGORY_ACCENTS = {
  politica: { tint: 'rgba(76,29,149,0.10)', ink: '#4C1D95' },
  deportes: { tint: 'rgba(6,95,70,0.10)', ink: '#065F46' },
  economia: { tint: 'rgba(120,53,15,0.10)', ink: '#78350F' },
  internacional: { tint: 'rgba(91,33,182,0.10)', ink: '#5B21B6' },
  social: { tint: 'rgba(107,33,168,0.10)', ink: '#6B21A8' },
  tecnologia: { tint: 'rgba(7,89,133,0.10)', ink: '#075985' },
  justicia: { tint: 'rgba(41,37,36,0.09)', ink: '#3F3A38' },
  entretenimiento: { tint: 'rgba(136,19,55,0.10)', ink: '#881337' },
  otros: { tint: 'rgba(55,65,81,0.09)', ink: '#374151' },
};
const DEFAULT_ACCENT = { tint: 'rgba(55,65,81,0.09)', ink: '#374151' };

function getCatAccent(cat) {
  return CATEGORY_ACCENTS[normCat(cat)] || DEFAULT_ACCENT;
}


// Card con animación de press (scale spring)
function PressCard({ children, style, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 0.965,
      useNativeDriver: true,
      speed: 60,
      bounciness: 3,
    }).start();

  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 5,
    }).start();

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}


// ─── Modal de detalle de news card ───────────────────────────────────────────
/** Margen lateral de la columna del modal, a cada lado. */
const MARGEN_MODAL = 26;

function NewsCardModal({ card, onClose }) {
  const insets = useSafeAreaInsets();
  const { width: anchoPantalla } = useWindowDimensions();
  const [entityName, setEntityName] = useState(null);
  const [entityLoading, setEntityLoading] = useState(false);
  const [entityWikiItem, setEntityWikiItem] = useState(null);
  const [entityIsAuth, setEntityIsAuth] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const confirmTimer = useRef(null);

  useEffect(() => {
    if (!entityName) return;
    let active = true;
    setEntityLoading(true);
    setEntityWikiItem(null);
    setConfirmPending(false);
    setCreated(false);
    Promise.all([
      supabase.auth.getSession(),
      supabase.from('wiki_items').select('id, name, subcategory, description').ilike('name', entityName).limit(1),
    ]).then(([{ data: sessionData }, { data: wikiData }]) => {
      if (!active) return;
      setEntityIsAuth(!!sessionData?.session?.user);
      setEntityWikiItem(wikiData?.[0] || null);
      setEntityLoading(false);
    });
    return () => { active = false; };
  }, [entityName]);

  const handleCreateTap = () => {
    if (confirmPending) {
      clearTimeout(confirmTimer.current);
      setConfirmPending(false);
      createEntry();
    } else {
      setConfirmPending(true);
      confirmTimer.current = setTimeout(() => setConfirmPending(false), 1800);
    }
  };

  const createEntry = async () => {
    setCreating(true);
    console.log('[NewsCardModal] createEntry START — entityName:', entityName);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    console.log('[NewsCardModal] userId:', userId);
    const payload = { name: entityName, subcategory: 'person', relevance_score: 50, ...(userId ? { user_id: userId } : {}) };
    console.log('[NewsCardModal] insert payload:', JSON.stringify(payload));
    const { data, error } = await supabase
      .from('wiki_items')
      .insert(payload)
      .select('id, name, subcategory, description')
      .single();
    console.log('[NewsCardModal] insert result — data:', JSON.stringify(data), '| error:', error ? JSON.stringify(error) : null);
    if (data) { setEntityWikiItem(data); setCreated(true); }
    if (error) console.warn('[NewsCardModal] createEntry FAILED:', error.message, '| code:', error.code, '| details:', error.details, '| hint:', error.hint);
    setCreating(false);
  };

  if (!card) return null;

  const categoria = categoriaDe(card);
  const p = paletaDe(categoria);
  const fotos = fotosDe(card);
  // `Otro` es el descarte del generador, no una subcategoría: en la corrida
  // degradada de hoy le tocó a 20 de 24 cards.
  const crudaSub = (card.subcategoria || '').trim();
  const subcategoria = crudaSub && crudaSub.toLowerCase() !== 'otro' ? crudaSub : null;

  return (
    <Modal visible={!!card} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(20,32,26,0.42)', justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={entityName ? () => setEntityName(null) : onClose} />

        {/* La hoja es papel, no una lámina azul marino.
            Antes este modal era `#0a0c1e` con texto blanco y acentos índigo:
            tocabas una noticia impresa y caías en otra app. */}
        <View
          style={{
            backgroundColor: PAPEL,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            maxHeight: '92%',
            paddingBottom: insets.bottom + 20,
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 10, marginBottom: 2 }}>
            <View style={{ width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(28,43,34,0.14)' }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ paddingHorizontal: MARGEN_MODAL }} scrollEnabled={!entityName}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 12, marginBottom: 16 }}>
              {/* La subcategoría va al lado de la pegatina y no debajo del
                  titular: es lo mismo que la categoría pero más fino —
                  «Violencia · Capturas y operativos»— y separarlas obligaría a
                  leer dos veces para armar una sola idea. La fila ya tenía todo
                  el medio vacío entre la etiqueta y la cruz.

                  Se descarta «Otro» a propósito: es el valor que pone el
                  generador cuando no supo clasificar, y mostrarlo ocupa un
                  renglón para no decir nada. Sin subcategoría útil, la cabecera
                  queda como estaba. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1, marginRight: 12 }}>
                <Pegatina categoria={categoria} id={card.id} />
                {subcategoria ? (
                  <Text
                    numberOfLines={2}
                    style={{ fontSize: 12, color: p.tinta, opacity: 0.75, lineHeight: 16, flex: 1 }}
                  >
                    {subcategoria}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={12} style={{ padding: 4 }}>
                <X size={19} color={INK.faint} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontFamily: SERIF, fontSize: 27, color: INK.title, lineHeight: 33, letterSpacing: -0.3 }}>
              {card.titulo}
            </Text>

            {/* Las fotos van pegadas al titular y no al final: en la tarjeta se
                vieron desenfocadas detrás del título, así que es acá donde uno
                las viene a buscar cuando abre la nota. El ancho se pasa hecho —
                el modal tiene 26 de margen a cada lado— porque la galería reparte
                columnas y necesita el número, no un `flex`. */}
            <GaleriaNoticia fotos={fotos} ancho={anchoPantalla - MARGEN_MODAL * 2} />


            {card.resumen ? (
              <Text style={{ fontSize: 15.5, color: INK.body, lineHeight: 25 }}>{card.resumen}</Text>
            ) : null}

            {/* Dato clave sin filete: el rótulo en versalitas ya lo separa de
                la columna, y la línea de color sumaba un segundo marcador para
                decir lo mismo. */}
            {card.datos_relevantes ? (
              <View style={{ marginTop: 22 }}>
                <Text style={{ fontSize: 10, color: INK.faint, fontWeight: '800', letterSpacing: 1, marginBottom: 5 }}>DATO CLAVE</Text>
                <Text style={{ fontSize: 14.5, color: INK.body, lineHeight: 22 }}>{card.datos_relevantes}</Text>
              </View>
            ) : null}

            {card.entidades?.length > 0 && (
              <View style={{ marginTop: 26 }}>
                <Text style={{ fontSize: 10, color: INK.faint, fontWeight: '800', letterSpacing: 1, marginBottom: 11 }}>
                  ACTORES Y ENTIDADES
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                  {card.entidades.map((e, i) => (
                    <TouchableOpacity key={i} onPress={() => setEntityName(e)} activeOpacity={0.6} style={{ marginRight: 16, marginBottom: 8 }}>
                      <Text style={{ fontSize: 14, color: p.tinta, textDecorationLine: 'underline', textDecorationColor: `${p.tinta}55` }}>
                        {e}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <MediosNoticia card={card} />

            {card.perspectivas?.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <Text style={{ fontSize: 10, color: INK.faint, fontWeight: '800', letterSpacing: 1, marginBottom: 12 }}>PERSPECTIVAS</Text>
                {card.perspectivas.map((per, i) => (
                  <View key={i} style={{ marginBottom: 14 }}>
                    <Text style={{ fontSize: 14.5, color: INK.body, lineHeight: 22 }}>{per}</Text>
                  </View>
                ))}
              </View>
            )}

            {card.tweets_muestra?.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <Text style={{ fontSize: 10, color: INK.faint, fontWeight: '800', letterSpacing: 1, marginBottom: 14 }}>FUENTES</Text>
                {card.tweets_muestra.map((t, i) => (
                  <View key={i} style={{ marginBottom: 18 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: INK.title }}>@{t.usuario}</Text>
                      {t.verified && <BadgeCheck size={13} color="#2563EB" style={{ marginLeft: 5 }} />}
                    </View>
                    <Text style={{ fontSize: 14, color: INK.body, lineHeight: 21 }}>{t.texto}</Text>
                    <MarcaTweet marca={marcaDe(t)} />
                    <View style={{ height: 1, backgroundColor: 'rgba(28,43,34,0.09)', marginTop: 18 }} />
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 12 }} />
          </ScrollView>

          {/* ── Ficha de la entidad, sobre el contenido ── */}
          {entityName && (
            <>
              <Pressable
                style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(20,32,26,0.32)', borderTopLeftRadius: 22, borderTopRightRadius: 22 }]}
                onPress={() => setEntityName(null)}
              />
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: PAPEL,
                  borderTopLeftRadius: 18,
                  borderTopRightRadius: 18,
                  borderTopWidth: 1,
                  borderColor: 'rgba(28,43,34,0.10)',
                  padding: 22,
                  paddingBottom: insets.bottom + 20,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: INK.faint, letterSpacing: 1, marginBottom: 5 }}>ACTOR / ENTIDAD</Text>
                    <Text style={{ fontFamily: SERIF, fontSize: 21, color: INK.title }}>{entityName}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setEntityName(null)} hitSlop={12} style={{ padding: 4 }}>
                    <X size={16} color={INK.faint} />
                  </TouchableOpacity>
                </View>

                {entityLoading ? (
                  <ActivityIndicator size="small" color={INK.faint} style={{ marginVertical: 12 }} />
                ) : entityWikiItem ? (
                  <View>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: p.tinta, letterSpacing: 1, marginBottom: 7 }}>
                      {created ? 'RECIÉN CREADO' : 'EN TU CODEX'}
                    </Text>
                    {entityWikiItem.description ? (
                      <Text numberOfLines={3} style={{ fontSize: 14, color: INK.body, lineHeight: 21, marginBottom: 16 }}>
                        {entityWikiItem.description}
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 14, color: 'rgba(28,43,34,0.3)', marginBottom: 16 }}>Sin descripción aún</Text>
                    )}
                    <TouchableOpacity
                      onPress={() => setEntityName(null)}
                      style={{ borderRadius: 999, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(28,43,34,0.16)' }}
                    >
                      <Text style={{ fontSize: 13, color: INK.body }}>cerrar</Text>
                    </TouchableOpacity>
                  </View>
                ) : entityIsAuth ? (
                  <TouchableOpacity
                    onPress={handleCreateTap}
                    disabled={creating}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      backgroundColor: confirmPending ? '#B91C1C' : INK.title,
                      borderRadius: 999,
                      paddingVertical: 12,
                      opacity: creating ? 0.6 : 1,
                    }}
                  >
                    {creating ? <ActivityIndicator size="small" color={PAPEL} /> : <Plus size={14} color={PAPEL} />}
                    <Text style={{ fontSize: 13, color: PAPEL }}>
                      {creating ? 'agregando…' : confirmPending ? 'tocá de nuevo para confirmar' : 'agregar al Codex'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function Index() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [viendoMapa, setViendoMapa] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [entityModal, setEntityModal] = useState(null); // string | null
  const queryClient = useQueryClient();

  // Si se salió con el mapa a la vista, se vuelve al mapa. La cámara —dónde
  // estaba parado y con cuánto zoom— ya la guarda `mapaStore` aparte; esto solo
  // decide que el mapa se abra.
  useRecordarLugar(viendoMapa ? { tipo: 'mapa' } : null, TIPOS_MAPA);

  const porRestaurar = useUltimoLugarStore((s) => s.porRestaurar);
  const consumir = useUltimoLugarStore((s) => s.consumir);

  useEffect(() => {
    if (porRestaurar?.tipo !== 'mapa') return;
    if (consumir('mapa')) setViendoMapa(true);
  }, [porRestaurar?.tipo, consumir]);

  // Realtime: notify when new news_cards are inserted
  useEffect(() => {
    const channel = supabase
      .channel('feed-news-cards')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'news_cards' },
        (payload) => {
          if (payload.new?.pais !== FEED_COUNTRY) return;

          const cards = payload.new?.cards;
          const first = Array.isArray(cards) ? cards[0] : null;
          if (!first) return;

          // Refresh the hot topics query so the feed updates automatically
          queryClient.invalidateQueries({ queryKey: ['pulse-hot-topics'] });

          // Show local notification
          Notifications.scheduleNotificationAsync({
            content: {
              title: 'Vizta',
              body: 'Revisa las ultimas noticias actualizadas',
              data: { type: 'news_update' },
              sound: 'default',
            },
            trigger: null, // immediate
          }).catch(() => {}); // silently ignore if permissions not granted
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: trendsData } = useQuery({
    queryKey: ['pulse-trends'],
    queryFn: async () => {
      const rows = await supabaseFetch(
        'trends',
        'select=about,top_keywords,timestamp&order=timestamp.desc&limit=1'
      );
      return rows[0] || null;
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: hotTopicsData } = useQuery({
    queryKey: ['pulse-hot-topics'],
    queryFn: async () => {
      // La corrida más reciente, sin excepciones.
      //
      // Antes se elegía la que más tarjetas traía, para esquivar corridas
      // parciales de una sola tarjeta. Ese criterio se volvió en contra: hoy la
      // corrida degradada de 08:46 trae 24 tarjetas —más que ninguna— con 20 de
      // ellas en `categoria_principal: 'Otros'`, y le ganaba a la de 08:48, que
      // trae 17 bien clasificadas. Contar tarjetas no dice nada sobre si
      // sirven, y la más nueva es la que refleja el día.
      const rows = await supabaseFetch(
        'news_cards',
        `select=cards,generated_at,tweets_source_count` +
          `&pais=eq.${FEED_COUNTRY}&order=generated_at.desc&limit=1`
      );
      return rows?.[0]?.cards || [];
    },
    staleTime: 1000 * 60 * 10,
  });

  const { data: tweetsData } = useQuery({
    queryKey: ['pulse-tweets'],
    queryFn: async () => {
      const rows = await supabaseFetch(
        'trending_tweets',
        `select=texto,usuario,likes,retweets,verified,fecha_tweet&pais=eq.${FEED_COUNTRY}` +
          '&source_type=eq.profile&order=fecha_tweet.desc&limit=8'
      );
      return rows || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // De dónde viene «lo que hay que leer»: el país (lo de siempre) o el Congreso.
  const [feed, setFeed] = useState("pais");
  // Lo del Congreso se pide recién cuando se elige: quien no lo abre no lo paga.
  const { data: diasCongreso, isLoading: cargandoCongreso } = useQuery({
    queryKey: ['congreso-feed'],
    queryFn: traerCongreso,
    enabled: feed === "congreso",
    staleTime: 10 * 60 * 1000,
  });

  const { data: narrativaData } = useQuery({
    queryKey: ['pulse-narrativa'],
    queryFn: async () => {
      const rows = await supabaseFetch(
        'narrativa_diaria',
        `select=titulo,narrativa,temas_subiendo,actores_clave,intencion_predominante,intensidad_informativa,generated_at&pais=eq.${FEED_COUNTRY}` +
          '&order=generated_at.desc&limit=1'
      );
      return rows[0] || null;
    },
    staleTime: 1000 * 60 * 30,
  });

  const about = trendsData?.about || [];
  const narrative = about[0] || null;
  const trendingTopics = about.slice(0, 15);
  const topKeywords = trendsData?.top_keywords || [];
  // Modo complejo (cards con gradiente) solo si TODOS los items tienen datos ricos:
  // categoría distinta de "Otros" o razón de tendencia real. Si no hay items o
  // ninguno tiene datos, se muestran como pills simples.
  const hasRealAbout = trendingTopics.length > 0 && trendingTopics.every(item =>
    item.nombre &&
    (
      (item.categoria && item.categoria !== 'Otros') ||
      (item.razon_tendencia &&
       !item.razon_tendencia.toLowerCase().startsWith('tendencia relacionada con') &&
       item.razon_tendencia.length > 20)
    )
  );
  const tweets = tweetsData || [];
  const hotTopics = hotTopicsData || [];

  const isLoading = !trendsData && !hotTopicsData;

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" />

      {/* Modal de detalle */}
      <NewsCardModal card={selectedCard} onClose={() => setSelectedCard(null)} />
      {entityModal && (
        <EntityWikiModal entityName={entityModal} onClose={() => setEntityModal(null)} />
      )}

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={INK.meta} />
          <Text style={{ color: INK.meta, marginTop: 12, fontSize: 15 }}>
            Cargando tendencias...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 72,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header. El mundito va acá arriba y no en la barra de abajo: la
              barra son destinos permanentes y el mapa es una lente sobre lo que
              ya se está leyendo. Centrado con la palabra ahora que no hay
              bajada: contra una sola línea de 48px, alinearlo abajo lo dejaba
              colgando del hueco que deja la tipografía. */}
          <View
            style={{
              paddingHorizontal: 24,
              marginBottom: 32,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Text style={{ flex: 1, fontSize: 48, fontWeight: "800", color: INK.title, letterSpacing: -1 }}>
              Vizta
            </Text>

            {/* Mundo y ajustes, juntos.
              *
              * Ajustes vivía en la barra de abajo, que se fue entera. Sube acá
              * porque el cabezal ya era el lugar de «salir del feed hacia otra
              * cosa» —eso hace el mundito— y una segunda puerta al lado no
              * inventa una zona nueva de la pantalla.
              *
              * La tuerca va en ámbar y no en tinta: al lado de un globo azul,
              * un gris se lee como deshabilitado. El ámbar es el mismo acento
              * que ya usan los puntos del mapa, así que no entra un color
              * nuevo a la app. */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Mundito size={30} onPress={() => setViendoMapa(true)} />

              <Pressable
                onPress={() => router.push('/settings')}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Ajustes"
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
              >
                <SettingsIcon size={23} color={TUERCA} strokeWidth={2} />
              </Pressable>
            </View>
          </View>

          {/* Portada del día: el título manda, el análisis se abre tocando. */}
          {narrativaData ? (
            <View style={{ marginBottom: 30 }}>
              <PortadaDia narrativa={narrativaData} />
            </View>
          ) : null}

          {/* Hot Topics — las tarjetas de `news_cards`, que son las noticias del
              día. Van acá arriba, en el lugar donde antes había una lista de
              temas sacada de `narrativa_diaria`: eran los mismos hechos contados
              dos veces, con vocabularios que ni coincidían.

              El orden por ahora es el que trae la corrida. Cuando exista el
              contador de clicks pasa a ser: primero los temas que el usuario más
              mira. */}
          <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
            {/* El título y, a su lado, de dónde viene lo que se lee: el país o
                el Congreso. El selector va en la misma línea para que se lea
                como parte de la frase —«lo que hay que leer hoy… de acá»—. */}
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <SectionHeader title="Lo que hay que leer" marcado="hoy" />
              </View>
              <SelectorFeed valor={feed} onCambiar={setFeed} />
            </View>

            {feed === "congreso" ? (
              cargandoCongreso ? (
                <Text style={{ fontSize: 13, color: INK.faint, paddingVertical: 10 }}>Trayendo lo del Congreso…</Text>
              ) : !diasCongreso?.length ? (
                <Text style={{ fontSize: 13, color: INK.faint, paddingVertical: 10 }}>
                  El Congreso no publicó nada en estos días.
                </Text>
              ) : (
                diasCongreso.map((dia, n) => (
                  <View key={dia.fecha}>
                    {/* El día solo se nombra desde el segundo: el primero es
                        el de más arriba, y el título ya dice «hoy». */}
                    {n > 0 ? (
                      <Text style={{ fontSize: 10, fontWeight: "800", color: INK.faint, letterSpacing: 1.2, marginTop: 6, marginBottom: 18 }}>
                        {nombreDelDia(dia.fecha).toUpperCase()}
                      </Text>
                    ) : null}
                    {dia.items.map((item) => (
                      <TarjetaCongreso
                        key={item.id}
                        item={item}
                        onPress={() => {
                          evento(EV.FEED_NOTICIA_ABIERTA, { tema: "congreso" });
                          if (item.url) Linking.openURL(item.url).catch(() => {});
                        }}
                        style={{ marginBottom: 22 }}
                      />
                    ))}
                  </View>
                ))
              )
            ) : hotTopics.length === 0 ? (
              <Text style={{ fontSize: 13, color: INK.faint, paddingVertical: 10 }}>
                Sin noticias en las últimas 48 horas.
              </Text>
            ) : (
              hotTopics.map((card, index) => (
                <TarjetaNoticia
                  key={card.id || index}
                  card={card}
                  onPress={() => {
                    // El tema, no el titular: sirve para saber qué se lee sin
                    // mandar qué dice.
                    evento(EV.FEED_NOTICIA_ABIERTA, { tema: temaDe(categoriaDe(card)) });
                    setSelectedCard(card);
                  }}
                  onEntidad={(e) => setEntityModal(e)}
                  style={{ marginBottom: 22 }}
                />
              ))
            )}
          </View>

          {/* Trending Ahora */}
          {(trendingTopics.length > 0 || topKeywords.length > 0) && (
            <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
              <SectionHeader title="Trending ahora" />

              {hasRealAbout ? (
                trendingTopics.map((item, index) => {
                  const acc = getCatAccent(item.categoria);
                  return (
                  <PressCard key={index} style={{ marginBottom: 16 }}>
                    <GlassCard accent={acc.ink} wash={acc.tint}>
                      <View style={{ padding: 20 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                          <View style={{
                            backgroundColor: acc.tint,
                            paddingHorizontal: 11,
                            paddingVertical: 5,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: acc.tint,
                          }}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: acc.ink, letterSpacing: 0.3 }}>
                              {item.categoria || 'Tendencia'}
                            </Text>
                          </View>
                          {item.estadisticas?.tweet_volume ? (
                            <Text style={{ fontSize: 12, color: INK.meta, marginLeft: 10 }}>
                              {item.estadisticas.tweet_volume} tweets
                            </Text>
                          ) : null}
                        </View>

                        <Text style={{
                          fontSize: 20,
                          fontWeight: "800",
                          color: INK.title,
                          lineHeight: 27,
                          marginBottom: item.razon_tendencia ? 10 : 0,
                        }}>
                          {item.nombre}
                        </Text>

                        {item.razon_tendencia ? (
                          <Text style={{ fontSize: 13, color: INK.body, lineHeight: 20 }}>
                            {item.razon_tendencia}
                          </Text>
                        ) : null}
                      </View>
                    </GlassCard>
                  </PressCard>
                  );
                })
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {(trendingTopics.length > 0 ? trendingTopics.map(t => t.nombre) : topKeywords.map(kw => typeof kw === 'string' ? kw : kw.word || kw.keyword || kw.nombre || String(kw))).map((label, i) => (
                    // Sin cristal: la píldora de vidrio con borde claro era el
                    // último resto del lenguaje viejo en el feed. Papel, mismo
                    // radio chico y misma tinta que el resto de la página.
                    <View
                      key={i}
                      style={{
                        backgroundColor: 'rgba(28,43,34,0.045)',
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 4,
                      }}
                    >
                      <Text style={{ fontSize: 13, color: INK.title }}>{label}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Últimas Noticias */}
          {tweets.length > 0 && (
            <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
              <SectionHeader title="Últimas noticias" />

              {/* Mismas medidas que las noticias: el autor donde va la
                  pegatina, el texto donde va el sumario, y la misma línea de un
                  pelo separando. Antes eran tarjetas de cristal con 16px de
                  padding — otra caja más, y de otro material. */}
              {tweets.map((tweet, index) => (
                <View key={index} style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 9 }}>
                    <Text style={{ fontSize: 12.5, fontWeight: "700", color: INK.title }}>
                      @{tweet.usuario}
                    </Text>
                    {tweet.verified && (
                      <BadgeCheck size={13} color="#2563EB" style={{ marginLeft: 5 }} />
                    )}
                  </View>
                  <Text style={{ fontSize: 14, color: INK.body, lineHeight: 22 }} numberOfLines={3}>
                    {tweet.texto}
                  </Text>
                  <View style={{ height: 1, backgroundColor: 'rgba(28,43,34,0.09)', marginTop: 20 }} />
                </View>
              ))}
            </View>
          )}

        </ScrollView>
      )}

      {/* Grano: capa fija POR ENCIMA de todo, último hermano del árbol. Puesta
          antes del ScrollView quedaba debajo y no se veía. Va acá y no por
          tarjeta porque un filtro de ruido dentro de algo que scrollea se
          repinta en cada frame. */}
      <Grano />

      {/* El mapa es un Modal, así que se dibuja sobre todo el feed. Va después
          del grano porque es una pantalla entera, no una capa del papel. */}
      {viendoMapa ? (
        <MapaSheet
          onClose={() => setViendoMapa(false)}
          topInset={insets.top}
          bottomInset={insets.bottom}
        />
      ) : null}
    </View>
  );
}

/**
 * Rótulo de sección en versalitas.
 *
 * Antes llevaba un icono de 22px a la izquierda de cada título. Un icono por
 * sección es decoración: ni «Hot Topics» ni «Últimas Noticias» se entienden
 * mejor con una llama o un globo de diálogo al lado, y cuatro iconos distintos
 * en una pantalla compiten con el contenido. Se sigue aceptando `icon` para no
 * romper las llamadas existentes, y se ignora.
 */
/**
 * Encabezado de sección.
 *
 * `marcado` recibe una palabra que va resaltada con marcador, como en una
 * revista. Es **el único acento de color fuerte de la pantalla** y se usa una
 * sola vez: repetido en cada sección deja de destacar nada y se vuelve ruido.
 *
 * El verde es el del orbe, rebajado. La referencia usa un verde neón, pero
 * sobre papel cálido el neón se ve pegado encima, como un sticker; este se ve
 * impreso, que es lo que buscamos.
 */
function SectionHeader({ title, marcado }) {
  if (!marcado) {
    return (
      <Text
        style={{
          fontSize: 10,
          fontWeight: "800",
          color: INK.faint,
          letterSpacing: 1.2,
          marginBottom: 14,
        }}
      >
        {String(title).toUpperCase()}
      </Text>
    );
  }

  return (
    <View style={{ marginBottom: 18 }}>
      <Text
        style={{
          fontFamily: SERIF,
          fontSize: 26,
          color: INK.title,
          lineHeight: 33,
          letterSpacing: -0.3,
        }}
      >
        {title}{" "}
        {/* El resaltado va como fondo del propio texto: así el trazo sigue al
            renglón si el título se parte en dos líneas, cosa que una caja
            dibujada aparte no haría. */}
        <Text
          style={{
            fontFamily: SERIF,
            fontSize: 26,
            color: INK.title,
            backgroundColor: "rgba(124,176,132,0.42)",
          }}
        >
          {" "}{marcado}{" "}
        </Text>
      </Text>
    </View>
  );
}
