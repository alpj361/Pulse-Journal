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
} from "react-native";
import { useRef, useState, useCallback, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { BlurView } from "expo-blur";
import {
  TrendingUp,
  Flame,
  BookOpen,
  MessageCircle,
  X,
  ChevronRight,
  Plus,
  Zap,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://qqshdccpmypelhmyqnut.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Returns ISO string for 30 hours ago — covers the latest daily cron run (every 24h)
// without showing data older than ~1.25 days.
function since30h() {
  return new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
}

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

function getCatGradient(cat) {
  const key = (cat || '').toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u');
  return CATEGORY_GRADIENTS[key] || DEFAULT_GRADIENT;
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

const cardBase = {
  borderRadius: 20,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.14)',
  overflow: 'hidden',
  backgroundColor: 'rgba(8, 10, 24, 0.72)',
};

// ─── Modal de detalle de news card ───────────────────────────────────────────
function NewsCardModal({ card, onClose }) {
  const insets = useSafeAreaInsets();
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
  const catGradient = getCatGradient(card.categoria);
  const impacto = typeof card.impacto_score === 'number' ? card.impacto_score : 50;

  return (
    <Modal
      visible={!!card}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={entityName ? () => setEntityName(null) : onClose} />

        <View style={{
          backgroundColor: '#0a0c1e',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderTopWidth: 1,
          borderColor: 'rgba(255,255,255,0.12)',
          maxHeight: '90%',
          paddingBottom: insets.bottom + 20,
        }}>
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, marginBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
          </View>

          {/* ── Contenido principal — siempre visible ── */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ paddingHorizontal: 24 }}
            scrollEnabled={!entityName}
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ backgroundColor: catGradient[0], paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{card.categoria || 'Otros'}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff', lineHeight: 30, marginBottom: 14 }}>{card.titulo}</Text>

            <View style={{ marginBottom: 18 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '600', letterSpacing: 0.5 }}>IMPACTO</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: impacto >= 70 ? '#f97316' : impacto >= 40 ? '#facc15' : '#94a3b8' }}>{impacto}/100</Text>
              </View>
              <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                <View style={{ height: 4, width: `${impacto}%`, borderRadius: 2, backgroundColor: impacto >= 70 ? '#f97316' : impacto >= 40 ? '#facc15' : '#94a3b8' }} />
              </View>
            </View>

            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.82)', lineHeight: 24, marginBottom: 20 }}>{card.resumen}</Text>

            {card.datos_relevantes ? (
              <View style={{ backgroundColor: 'rgba(99,102,241,0.12)', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)' }}>
                <Text style={{ fontSize: 11, color: 'rgba(165,180,252,0.7)', fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 }}>DATO CLAVE</Text>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20 }}>{card.datos_relevantes}</Text>
              </View>
            ) : null}

            {card.entidades?.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>ACTORES Y ENTIDADES</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {card.entidades.map((e, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => setEntityName(e)}
                      activeOpacity={0.7}
                      style={{ backgroundColor: 'rgba(99,102,241,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)' }}
                    >
                      <Text style={{ fontSize: 13, color: 'rgba(165,180,252,0.9)' }}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {card.perspectivas?.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 }}>PERSPECTIVAS</Text>
                {card.perspectivas.map((p, i) => (
                  <View key={i} style={{ flexDirection: 'row', marginBottom: 8, alignItems: 'flex-start' }}>
                    <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#6366f1', marginTop: 7, marginRight: 10 }} />
                    <Text style={{ flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.72)', lineHeight: 21 }}>{p}</Text>
                  </View>
                ))}
              </View>
            )}

            {card.tweets_muestra?.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 }}>FUENTES</Text>
                {card.tweets_muestra.map((t, i) => (
                  <View key={i} style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>@{t.usuario}</Text>
                      {t.verified && <Text style={{ fontSize: 12, color: '#60a5fa', marginLeft: 4 }}>✓</Text>}
                    </View>
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 19 }}>{t.texto}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* ── Preview flotante de entidad (sobre el contenido) ── */}
          {entityName && (
            <>
              {/* Dim sobre el contenido */}
              <Pressable
                style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)', borderTopLeftRadius: 28, borderTopRightRadius: 28 }]}
                onPress={() => setEntityName(null)}
              />
              {/* Card preview anclada al fondo */}
              <View style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                backgroundColor: '#131526',
                borderTopLeftRadius: 20, borderTopRightRadius: 20,
                borderTopWidth: 1, borderColor: 'rgba(99,102,241,0.35)',
                padding: 20,
                paddingBottom: insets.bottom + 20,
              }}>
                {/* Handle pequeño */}
                <View style={{ width: 32, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 16 }} />

                {/* Nombre + cerrar */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(165,180,252,0.6)', letterSpacing: 0.5, marginBottom: 3 }}>ACTOR / ENTIDAD</Text>
                    <Text style={{ fontSize: 17, fontWeight: '800', color: '#fff' }}>{entityName}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setEntityName(null)}
                    style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={13} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                </View>

                {entityLoading ? (
                  <ActivityIndicator size="small" color="rgba(165,180,252,0.8)" style={{ marginVertical: 12 }} />
                ) : entityWikiItem ? (
                  /* Encontrado en wiki */
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <BookOpen size={12} color="rgba(165,180,252,0.7)" />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(165,180,252,0.7)', letterSpacing: 0.4 }}>
                        {created ? 'RECIÉN CREADO' : 'EN TU WIKI'}
                      </Text>
                    </View>
                    {entityWikiItem.description ? (
                      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 19, marginBottom: 14 }} numberOfLines={3}>
                        {entityWikiItem.description}
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', marginBottom: 14 }}>Sin descripción aún</Text>
                    )}
                    <TouchableOpacity
                      onPress={() => setEntityName(null)}
                      style={{ backgroundColor: 'rgba(99,102,241,0.55)', borderRadius: 12, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(99,102,241,0.4)' }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Ver en Codex →</Text>
                    </TouchableOpacity>
                  </View>
                ) : entityIsAuth ? (
                  /* No está en wiki, usuario autenticado */
                  <TouchableOpacity
                    onPress={handleCreateTap}
                    disabled={creating}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                      backgroundColor: creating ? 'rgba(99,102,241,0.3)' : confirmPending ? 'rgba(16,185,129,0.55)' : 'rgba(99,102,241,0.55)',
                      borderRadius: 12, paddingVertical: 12,
                      borderWidth: 1, borderColor: confirmPending ? 'rgba(16,185,129,0.45)' : 'rgba(99,102,241,0.4)',
                    }}
                  >
                    {creating ? <ActivityIndicator size="small" color="#fff" /> : <Plus size={14} color="#fff" />}
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>
                      {creating ? 'Agregando...' : confirmPending ? 'Toca de nuevo para confirmar' : 'Agregar al Codex'}
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
  const [selectedCard, setSelectedCard] = useState(null);
  const [entityModal, setEntityModal] = useState(null); // string | null
  const queryClient = useQueryClient();

  // Realtime: notify when new news_cards are inserted
  useEffect(() => {
    const channel = supabase
      .channel('feed-news-cards')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'news_cards' },
        (payload) => {
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

  const player = useVideoPlayer(
    require("../../../assets/videos/feed-background.mp4"),
    (p) => {
      p.loop = true;
      p.muted = true;
      p.play();
    }
  );

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
      const rows = await supabaseFetch(
        'news_cards',
        `select=cards,generated_at&generated_at=gte.${since30h()}&order=generated_at.desc&limit=1`
      );
      const latest = rows[0];
      return latest?.cards || [];
    },
    staleTime: 1000 * 60 * 10,
  });

  const { data: tweetsData } = useQuery({
    queryKey: ['pulse-tweets'],
    queryFn: async () => {
      const rows = await supabaseFetch(
        'trending_tweets',
        'select=texto,usuario,likes,retweets,verified,fecha_tweet&source_type=eq.profile&order=fecha_tweet.desc&limit=8'
      );
      return rows || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: narrativaData } = useQuery({
    queryKey: ['pulse-narrativa'],
    queryFn: async () => {
      const rows = await supabaseFetch(
        'narrativa_diaria',
        'select=titulo,narrativa,temas_subiendo,actores_clave,intencion_predominante,intensidad_informativa,generated_at&order=generated_at.desc&limit=1'
      );
      return rows[0] || null;
    },
    staleTime: 1000 * 60 * 30,
  });

  const about = trendsData?.about || [];
  const narrative = about[0] || null;
  const trendingTopics = about.slice(0, 15);
  const topKeywords = trendsData?.top_keywords || [];
  // Tiene about real si algún item tiene categoría distinta de "Otros"
  // o razón que no sea el boilerplate "Tendencia relacionada con X"
  const hasRealAbout = trendingTopics.some(item =>
    (item.categoria && item.categoria !== 'Otros') ||
    (item.razon_tendencia && !item.razon_tendencia.toLowerCase().startsWith('tendencia relacionada con'))
  );
  const tweets = tweetsData || [];
  const hotTopics = hotTopicsData || [];

  const isLoading = !trendsData && !hotTopicsData;

  return (
    <View style={{ flex: 1 }}>
      {/* Video background */}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
      />
      {/* Blur + dark overlay */}
      <BlurView
        intensity={55}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(4, 5, 18, 0.55)" }]}
      />

      <StatusBar style="light" />

      {/* Modal de detalle */}
      <NewsCardModal card={selectedCard} onClose={() => setSelectedCard(null)} />
      {entityModal && (
        <EntityWikiModal entityName={entityModal} onClose={() => setEntityModal(null)} />
      )}

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 12, fontSize: 15 }}>
            Cargando tendencias...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
            <Text style={{ fontSize: 48, fontWeight: "800", color: "#ffffff", letterSpacing: -1 }}>
              Vizta
            </Text>
            <Text style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", marginTop: 4, fontWeight: "500" }}>
              Noticias de Guatemala
            </Text>
          </View>

          {/* Narrativa del Día */}
          {narrativaData && (
            <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
              <SectionHeader icon={<BookOpen size={22} color="#ffffff" />} title="Narrativa del Día" />
              <View style={[cardBase, { borderRadius: 24 }]}>
                <LinearGradient
                  colors={["rgba(99,102,241,0.18)", "rgba(139,92,246,0.10)"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={{ padding: 24 }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff', lineHeight: 30, marginBottom: 12, letterSpacing: -0.5 }}>
                    {narrativaData.titulo}
                  </Text>
                  <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 22, marginBottom: 16 }}>
                    {narrativaData.narrativa}
                  </Text>
                  {narrativaData.temas_subiendo?.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                      {narrativaData.temas_subiendo.slice(0, 3).map((t, i) => (
                        <View key={i} style={{
                          backgroundColor: 'rgba(99,102,241,0.18)',
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: 'rgba(99,102,241,0.3)',
                        }}>
                          <Text style={{ fontSize: 12, color: 'rgba(165,180,252,0.9)', fontWeight: '600' }}>
                            {t.nombre}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                </View>
              </View>
            </View>
          )}

          {/* Insight del Día */}
          {narrativaData && (narrativaData.intencion_predominante || narrativaData.actores_clave?.length > 0) && (
            <View style={{ paddingHorizontal: 24, marginTop: -16, marginBottom: 32 }}>
              <View style={[cardBase, { borderRadius: 20 }]}>
                <LinearGradient
                  colors={["rgba(245,158,11,0.12)", "rgba(120,53,15,0.08)"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={{ padding: 18 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <Zap size={13} color="#f59e0b" />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#f59e0b', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                      Insight del Día
                    </Text>
                  </View>
                  {narrativaData.intencion_predominante && (
                    <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 21, fontWeight: '500', marginBottom: 14, fontStyle: 'italic' }}>
                      "{narrativaData.intencion_predominante}"
                    </Text>
                  )}
                  {narrativaData.actores_clave?.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {narrativaData.actores_clave.slice(0, 5).map((actor, i) => {
                        const nombre = typeof actor === 'string' ? actor : actor.nombre || actor.name || '';
                        return nombre ? (
                          <View key={i} style={{
                            backgroundColor: 'rgba(245,158,11,0.10)', paddingHorizontal: 10, paddingVertical: 4,
                            borderRadius: 8, borderWidth: 1, borderColor: 'rgba(245,158,11,0.22)',
                          }}>
                            <Text style={{ fontSize: 12, color: 'rgba(253,230,138,0.9)', fontWeight: '600' }}>{nombre}</Text>
                          </View>
                        ) : null;
                      })}
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Trending Ahora */}
          {(trendingTopics.length > 0 || topKeywords.length > 0) && (
            <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
              <SectionHeader icon={<TrendingUp size={22} color="#ffffff" />} title="Trending Ahora" />

              {hasRealAbout ? (
                trendingTopics.map((item, index) => (
                  <PressCard key={index} style={{ marginBottom: 14 }}>
                    <View style={cardBase}>
                      <LinearGradient
                        colors={[...getCatGradient(item.categoria), 'transparent']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={[StyleSheet.absoluteFill, { opacity: 0.35 }]}
                      />
                      <View style={{ padding: 20 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                          <View style={{
                            backgroundColor: "rgba(255,255,255,0.15)",
                            paddingHorizontal: 11,
                            paddingVertical: 5,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.2)",
                          }}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: "#ffffff", letterSpacing: 0.3 }}>
                              {item.categoria || 'Tendencia'}
                            </Text>
                          </View>
                          {item.estadisticas?.tweet_volume ? (
                            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginLeft: 10 }}>
                              {item.estadisticas.tweet_volume} tweets
                            </Text>
                          ) : null}
                        </View>

                        <Text style={{
                          fontSize: 20,
                          fontWeight: "800",
                          color: "#ffffff",
                          lineHeight: 27,
                          marginBottom: item.razon_tendencia ? 10 : 0,
                        }}>
                          {item.nombre}
                        </Text>

                        {item.razon_tendencia ? (
                          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.68)", lineHeight: 20 }}>
                            {item.razon_tendencia}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </PressCard>
                ))
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {(trendingTopics.length > 0 ? trendingTopics.map(t => t.nombre) : topKeywords.map(kw => typeof kw === 'string' ? kw : kw.word || kw.keyword || kw.nombre || String(kw))).map((label, i) => (
                    <View key={i} style={{
                      backgroundColor: 'rgba(255,255,255,0.09)',
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.15)',
                    }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{label}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Hot Topics */}
          <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
            <SectionHeader icon={<Flame size={22} color="#ffffff" />} title="Hot Topics" />

            {hotTopics.length === 0 ? (
              <View style={[cardBase, { borderRadius: 20 }]}>
                <LinearGradient
                  colors={["rgba(251,191,36,0.10)", "rgba(245,158,11,0.06)"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={{ padding: 28, alignItems: "center" }}>
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.4)" />
                  <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 10 }}>
                    Cargando noticias...
                  </Text>
                </View>
              </View>
            ) : (
              hotTopics.map((card, index) => {
                const catGradient = getCatGradient(card.categoria);

                return (
                  <PressCard
                    key={card.id || index}
                    style={{ marginBottom: 14 }}
                    onPress={() => setSelectedCard(card)}
                  >
                    <View style={cardBase}>
                      <LinearGradient
                        colors={[...catGradient, 'transparent']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={[StyleSheet.absoluteFill, { opacity: 0.3 }]}
                      />
                      <View style={{ padding: 20 }}>
                        {/* Fila superior: categoría + sentimiento negativo + flecha */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{
                              backgroundColor: 'rgba(255,255,255,0.14)',
                              paddingHorizontal: 10,
                              paddingVertical: 4,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: 'rgba(255,255,255,0.18)',
                            }}>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 0.3 }}>
                                {card.categoria || 'Otros'}
                              </Text>
                            </View>
                          </View>
                          <ChevronRight size={16} color="rgba(255,255,255,0.35)" />
                        </View>

                        {/* Título */}
                        <Text style={{
                          fontSize: 17,
                          fontWeight: '800',
                          color: '#fff',
                          lineHeight: 24,
                          marginBottom: 8,
                        }}>
                          {card.titulo}
                        </Text>

                        {/* Resumen truncado */}
                        <Text
                          numberOfLines={2}
                          style={{ fontSize: 13, color: 'rgba(255,255,255,0.62)', lineHeight: 19 }}
                        >
                          {card.resumen}
                        </Text>

                        {/* Entidades chips — toca para ver/crear en Wiki */}
                        {card.entidades?.length > 0 && (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                            {card.entidades.slice(0, 3).map((e, i) => (
                              <TouchableOpacity
                                key={i}
                                onPress={(ev) => { ev.stopPropagation(); setEntityModal(e); }}
                                activeOpacity={0.7}
                                style={{
                                  backgroundColor: 'rgba(99,102,241,0.12)',
                                  paddingHorizontal: 8,
                                  paddingVertical: 3,
                                  borderRadius: 6,
                                  borderWidth: 1,
                                  borderColor: 'rgba(99,102,241,0.25)',
                                }}
                              >
                                <Text style={{ fontSize: 11, color: 'rgba(165,180,252,0.8)' }}>{e}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  </PressCard>
                );
              })
            )}
          </View>

          {/* Últimas Noticias */}
          {tweets.length > 0 && (
            <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
              <SectionHeader icon={<MessageCircle size={22} color="#ffffff" />} title="Últimas Noticias" />

              {tweets.map((tweet, index) => (
                <PressCard key={index} style={{ marginBottom: 10 }}>
                  <View style={[cardBase, { borderRadius: 16 }]}>
                    <View style={{ padding: 16 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 7 }}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#ffffff" }}>
                          @{tweet.usuario}
                        </Text>
                        {tweet.verified && (
                          <Text style={{ fontSize: 12, color: '#60a5fa', marginLeft: 4 }}>✓</Text>
                        )}
                      </View>
                      <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.82)", lineHeight: 20, marginBottom: 10 }}
                        numberOfLines={3}>
                        {tweet.texto}
                      </Text>
                    </View>
                  </View>
                </PressCard>
              ))}
            </View>
          )}

        </ScrollView>
      )}
    </View>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
      {icon}
      <Text style={{ fontSize: 19, fontWeight: "700", color: "#ffffff", marginLeft: 8 }}>
        {title}
      </Text>
    </View>
  );
}

