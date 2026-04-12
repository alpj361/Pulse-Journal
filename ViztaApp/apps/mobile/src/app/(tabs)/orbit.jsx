import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  PanResponder,
  Animated,
  StyleSheet,
  ScrollView,
  Image,
  useWindowDimensions,
  // TextInput,       // AI Chat — hidden for App Store Review
  // KeyboardAvoidingView, // AI Chat — hidden for App Store Review
  // Keyboard,        // AI Chat — hidden for App Store Review
  Platform,
  Linking,
} from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useRef, useState, useEffect, /* useCallback, */ Component } from 'react';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ArrowLeft, Clock, AlertCircle /*, Trash2, ChevronRight, Send — hidden for App Store Review */ } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';

// ── Chat constants — hidden for App Store Review ───────────────────────────────
// const EXTRACTORW_URL = process.env.EXPO_PUBLIC_EXTRACTORW_URL || 'https://server.standatpd.com';
// const CHAT_ENDPOINT_AUTH  = `${EXTRACTORW_URL}/api/vizta-chat/query`;
// const CHAT_ENDPOINT_GUEST = `${EXTRACTORW_URL}/api/vizta-chat/query-guest`;

// ── Constants ─────────────────────────────────────────────────────────────────

const ORB_SIZE = 80;
const HALF_ORB = ORB_SIZE / 2;
const ORBIT_RADIUS_Y = 130;

const CATEGORIES = {
  Política: {
    image: require('../../../assets/images/politics.png'),
    color: '#7c3aed',
    shadowColor: '#6d28d9',
  },
  Violencia: {
    image: require('../../../assets/images/violence.png'),
    color: '#dc2626',
    shadowColor: '#b91c1c',
  },
  Deportes: {
    image: require('../../../assets/images/sports.png'),
    color: '#059669',
    shadowColor: '#047857',
  },
  Movilidad: {
    image: require('../../../assets/images/movility.png'),
    color: '#2563eb',
    shadowColor: '#1d4ed8',
  },
};

const CATEGORY_ORDER = ['Política', 'Violencia', 'Deportes', 'Movilidad'];

// Color semántico por tipo de rol — paleta fría sobre fondo oscuro
const ROLE_PALETTE = {
  'Legislativo': { fg: '#a5b4fc', bg: 'rgba(129,140,248,0.1)' },
  'Judicial':    { fg: '#fcd34d', bg: 'rgba(251,191,36,0.1)'  },
  'Ejecutivo':   { fg: '#6ee7b7', bg: 'rgba(52,211,153,0.1)'  },
  'Académico':   { fg: '#d8b4fe', bg: 'rgba(192,132,252,0.1)' },
  'Acusado':     { fg: '#fca5a5', bg: 'rgba(248,113,113,0.1)' },
  'default':     { fg: 'rgba(148,163,184,0.85)', bg: 'rgba(148,163,184,0.1)' },
};

// ── Helper components ─────────────────────────────────────────────────────────

function IntensidadBadge({ nivel }) {
  // nivel puede llegar como número (75) o string ('alta')
  const nivelStr = typeof nivel === 'number' ? intensidadFromScore(nivel) : nivel;
  const config = {
    alta:  { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   label: 'ALTA' },
    media: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  label: 'MEDIA' },
    baja:  { color: '#6ee7b7', bg: 'rgba(110,231,183,0.15)', label: 'BAJA' },
  };
  const c = config[nivelStr?.toLowerCase?.()] || config.media;
  return (
    <View style={{
      backgroundColor: c.bg, paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: 8, borderWidth: 1, borderColor: c.color + '50',
    }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: c.color, letterSpacing: 0.6 }}>
        {c.label}
      </Text>
    </View>
  );
}

function SectionLabel({ title }) {
  return (
    <Text style={{
      fontSize: 11,
      fontWeight: '700',
      color: 'rgba(255,255,255,0.38)',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 10,
    }}>
      {title}
    </Text>
  );
}

function DetailCard({ children, style }) {
  return (
    <View style={[{
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      marginBottom: 12,
    }, style]}>
      <BlurView intensity={18} tint="dark">
        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', padding: 16 }}>
          {children}
        </View>
      </BlurView>
    </View>
  );
}

// ── Date helpers ──────────────────────────────────────────────────────────────

// Returns ISO string for 30 hours ago — covers the latest daily cron run (every 24h)
// without showing data older than ~1.25 days.
function since30h() {
  return new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
}

// ── Category data helpers ─────────────────────────────────────────────────────

function matchesCategory(card, orbitCat) {
  return (card.categoria_principal || '').trim() === orbitCat;
}

function relativeTime(iso) {
  if (!iso) return null;
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `hace ${hrs} h`;
  return `hace ${Math.floor(hrs / 24)} d`;
}

function intensidadFromScore(score) {
  if (score >= 70) return 'alta';
  if (score >= 40) return 'media';
  return 'baja';
}

// ── News card (real data) ─────────────────────────────────────────────────────

function NewsCard({ card, index = 0 }) {
  // Stagger entrance
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  // Press feedback
  const scale = useSharedValue(1);
  const pressOpacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withDelay(index * 60, withSpring(1, { damping: 18 }));
    translateY.value = withDelay(index * 60, withSpring(0, { mass: 0.8, damping: 14 }));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * pressOpacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Pressable
      onPressIn={() => {
        scale.value = withSpring(0.97, { stiffness: 400, damping: 20 });
        pressOpacity.value = withSpring(0.82, { stiffness: 400 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { stiffness: 300, damping: 20 });
        pressOpacity.value = withSpring(1, { stiffness: 300 });
      }}
    >
      <Reanimated.View style={[{
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.09)',
        marginBottom: 10,
      }, animStyle]}>
        <BlurView intensity={18} tint="dark">
        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', padding: 16 }}>
        {/* Title */}
        <Text style={{ fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.92)', lineHeight: 21, marginBottom: 6 }}>
          {card.titulo}
        </Text>

        {/* Resumen */}
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 19, marginBottom: 10 }}
          numberOfLines={3}>
          {card.resumen}
        </Text>

        {/* Entidades — solo texto, sin chips de colores */}
        {card.entidades?.length > 0 && (
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', lineHeight: 16 }} numberOfLines={1}>
            {card.entidades.slice(0, 4).join(' · ')}
          </Text>
        )}
        </View>
        </BlurView>
      </Reanimated.View>
    </Pressable>
  );
}

// ── Error boundary for CategoryDetail ────────────────────────────────────────

class DetailErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[Orbit] CategoryDetail CRASH:', error?.message);
    console.error('[Orbit] Stack:', error?.stack);
    console.error('[Orbit] Component stack:', info?.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#080a18', alignItems: 'center', justifyContent: 'center', padding: 30 }}>
          <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
            Error en CategoryDetail
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, textAlign: 'center' }}>
            {this.state.error?.message}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// ── Timeline item with press feedback ────────────────────────────────────────

function TimelineItem({ t, i, total, config }) {
  const scale = useSharedValue(1);
  const itemOpacity = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: itemOpacity.value,
  }));

  const texto = typeof t === 'string' ? t : (t.texto || '');

  return (
    <Pressable
      onPressIn={() => {
        scale.value = withSpring(0.97, { stiffness: 500, damping: 22 });
        itemOpacity.value = withSpring(0.7, { stiffness: 500 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { stiffness: 300, damping: 18 });
        itemOpacity.value = withSpring(1, { stiffness: 300 });
      }}
    >
      <Reanimated.View style={[{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: i < total - 1 ? 12 : 0 }, animStyle]}>
        <View style={{ alignItems: 'center', width: 6, marginRight: 12, marginTop: 5 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: config.color }} />
          {i < total - 1 && (
            <View style={{ width: 1, height: 20, backgroundColor: config.color + '28', marginTop: 3 }} />
          )}
        </View>
        <Text style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 19 }}>
          {texto}
        </Text>
      </Reanimated.View>
    </Pressable>
  );
}

// ── Legal tab helper components ───────────────────────────────────────────────

function EstadoBadge({ estado }) {
  const cfg = {
    aprobada:     { fg: '#34d399', bg: 'rgba(52,211,153,0.12)' },
    en_debate:    { fg: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
    rechazada:    { fg: '#f87171', bg: 'rgba(248,113,113,0.12)' },
    presentada:   { fg: 'rgba(148,163,184,0.85)', bg: 'rgba(148,163,184,0.1)' },
    'en_comisión':{ fg: '#c084fc', bg: 'rgba(192,132,252,0.12)' },
  };
  const c = cfg[(estado || '').toLowerCase()] || { fg: 'rgba(148,163,184,0.8)', bg: 'rgba(148,163,184,0.1)' };
  return (
    <View style={{
      alignSelf: 'flex-start',
      backgroundColor: c.bg,
      paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: 6, borderWidth: 1, borderColor: c.fg + '50',
      marginBottom: 6,
    }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: c.fg, letterSpacing: 0.5 }}>
        {(estado || 'pendiente').replace(/_/g, ' ').toUpperCase()}
      </Text>
    </View>
  );
}

function TipoBadge({ tipo }) {
  const colors = {
    'aprobación':  '#34d399',
    'debate':      '#fbbf24',
    'sesión':      '#818cf8',
    'comisión':    '#a78bfa',
    'rechazo':     '#f87171',
    'lectura':     '#38bdf8',
    'presentación':'#94a3b8',
    'votación':    '#fb923c',
    'declaración': '#e879f9',
  };
  const color = colors[(tipo || '').toLowerCase()] || 'rgba(148,163,184,0.8)';
  return (
    <View style={{
      alignSelf: 'flex-start',
      backgroundColor: color + '18',
      paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: 6, borderWidth: 1, borderColor: color + '50',
      marginRight: 8,
      flexShrink: 0,
    }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color, letterSpacing: 0.5 }}>
        {(tipo || '').toUpperCase()}
      </Text>
    </View>
  );
}

function FuenteLink({ fuente }) {
  if (!fuente?.enlace) return null;
  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(fuente.enlace).catch(() => {})}
      style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5, alignSelf: 'flex-start' }}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Text style={{ fontSize: 11, color: 'rgba(124,58,237,0.65)', fontStyle: 'italic' }}>
        {fuente.usuario ? `@${fuente.usuario}` : 'Ver fuente'}
      </Text>
      <Text style={{ fontSize: 11, color: 'rgba(124,58,237,0.45)', marginLeft: 3 }}>↗</Text>
    </TouchableOpacity>
  );
}

function IniciativaCard({ item, index }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withDelay(index * 50, withSpring(1, { damping: 18 }));
  }, []);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Reanimated.View style={[{ marginBottom: 12 }, animStyle]}>
      <DetailCard style={{ marginBottom: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <EstadoBadge estado={item.estado} />
          {item.numero && (
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
              No. {item.numero}
            </Text>
          )}
        </View>
        <Text style={{ fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.92)', lineHeight: 20, marginBottom: item.descripcion ? 6 : 0 }}>
          {item.titulo}
        </Text>
        {item.descripcion && (
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 19, marginBottom: 6 }} numberOfLines={3}>
            {item.descripcion}
          </Text>
        )}
        {item.diputados_involucrados?.length > 0 && (
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', lineHeight: 16 }} numberOfLines={2}>
            {item.diputados_involucrados.join(' · ')}
          </Text>
        )}
        <FuenteLink fuente={item.fuente} />
      </DetailCard>
    </Reanimated.View>
  );
}

function LegalTimeline({ items, config }) {
  if (!items?.length) return null;
  return (
    <DetailCard style={{ marginBottom: 12 }}>
      <SectionLabel title="Timeline de Sesión" />
      {items.map((t, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: i < items.length - 1 ? 14 : 0 }}>
          <View style={{ alignItems: 'center', width: 6, marginRight: 12, marginTop: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: config.color }} />
            {i < items.length - 1 && (
              <View style={{ width: 1, height: 24, backgroundColor: config.color + '28', marginTop: 3 }} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3, gap: 6 }}>
              {t.tipo && <TipoBadge tipo={t.tipo} />}
              {t.hora && (
                <Text style={{ fontSize: 11, color: config.color + 'bb' }}>
                  {t.hora}
                </Text>
              )}
            </View>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 19 }}>
              {typeof t === 'string' ? t : (t.texto || '')}
            </Text>
            <FuenteLink fuente={t.fuente} />
          </View>
        </View>
      ))}
    </DetailCard>
  );
}

// ── Category Detail screen ────────────────────────────────────────────────────

function CategoryDetail({ category, allCards, isLoading, generatedAt, onBack, insets, feedData, onSwipeLeft, onSwipeRight, categoryIndex, totalCategories }) {
  const config = CATEGORIES[category];

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5,
      onPanResponderRelease: (_, { dx, vx }) => {
        if (dx < -50 || vx < -0.5) onSwipeLeft?.();
        else if (dx > 50 || vx > 0.5) onSwipeRight?.();
      },
    })
  ).current;

  const [activeTab, setActiveTab] = useState('pulso');
  const tabFadeOpacity = useSharedValue(1);
  const tabScale0 = useSharedValue(1);
  const tabScale1 = useSharedValue(1);

  const leyEntry = (feedData || []).find(f => f.categoria === 'ley');
  const leyData = leyEntry?.data || null;

  const handleTabSwitch = (tab) => {
    if (tab === activeTab) return;
    tabFadeOpacity.value = withTiming(0, { duration: 80 }, () => {
      runOnJS(setActiveTab)(tab);
      tabFadeOpacity.value = withTiming(1, { duration: 120 });
    });
  };

  const tabFadeStyle = useAnimatedStyle(() => ({ opacity: tabFadeOpacity.value }));
  const tabPillStyle0 = useAnimatedStyle(() => ({ transform: [{ scale: tabScale0.value }] }));
  const tabPillStyle1 = useAnimatedStyle(() => ({ transform: [{ scale: tabScale1.value }] }));

  const cards = (allCards || [])
    .filter(c => matchesCategory(c, category))
    .sort((a, b) => (b.impacto_score || 0) - (a.impacto_score || 0));

  const lastUpdated = relativeTime(generatedAt);

  const feedEntry = (feedData || []).find(f => f.categoria === category);
  const d = feedEntry?.data || null;

  return (
    <View style={{ flex: 1, backgroundColor: '#080a18' }} {...panResponder.panHandlers}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.07)',
      }}>
        <TouchableOpacity
          onPress={onBack}
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.08)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ArrowLeft size={18} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: 0.5 }}>
            {category.toUpperCase()}
          </Text>
          {lastUpdated && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Clock size={11} color="rgba(255,255,255,0.35)" />
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{lastUpdated}</Text>
            </View>
          )}
          {/* Navigation dots */}
          {totalCategories > 1 && (
            <View style={{ flexDirection: 'row', gap: 5, marginTop: 6 }}>
              {Array.from({ length: totalCategories }).map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === categoryIndex ? 16 : 5,
                    height: 5,
                    borderRadius: 2.5,
                    backgroundColor: i === categoryIndex
                      ? config.color
                      : 'rgba(255,255,255,0.2)',
                  }}
                />
              ))}
            </View>
          )}
        </View>

        <View style={{ width: 50 }} />
      </View>

      {/* Category orb */}
      <View style={{
        alignItems: 'center',
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
      }}>
        <View style={{
          width: 64, height: 64, borderRadius: 32,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: config.color + 'AA',
          shadowColor: config.color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 18,
          elevation: 12,
          marginBottom: 8,
        }}>
          <Image source={config.image} style={{ width: 64, height: 64 }} resizeMode="cover" />
        </View>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 }}>
          {cards.length > 0
            ? `${cards.length} temas activos`
            : relativeTime(feedEntry?.generated_at || generatedAt)
              ? `Actualizado ${relativeTime(feedEntry?.generated_at || generatedAt)}`
              : null}
        </Text>
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={{ alignItems: 'center', paddingTop: 40, gap: 12 }}>
            <View style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.06)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Clock size={20} color="rgba(255,255,255,0.3)" />
            </View>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>Cargando datos...</Text>
          </View>
        ) : (
          <>
            {/* ── Tab switcher (only for Política) ── */}
            {category === 'Política' && (
              <View style={{
                flexDirection: 'row',
                alignSelf: 'center',
                marginBottom: 20,
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderRadius: 12,
                padding: 3,
                gap: 2,
              }}>
                <Pressable
                  onPress={() => handleTabSwitch('pulso')}
                  onPressIn={() => { tabScale0.value = withSpring(0.96, { stiffness: 400, damping: 20 }); }}
                  onPressOut={() => { tabScale0.value = withSpring(1, { stiffness: 300, damping: 18 }); }}
                >
                  <Reanimated.View style={[{
                    paddingVertical: 8,
                    paddingHorizontal: 24,
                    borderRadius: 9,
                    backgroundColor: activeTab === 'pulso' ? config.color + '22' : 'transparent',
                    borderWidth: 1,
                    borderColor: activeTab === 'pulso' ? config.color + '55' : 'transparent',
                  }, tabPillStyle0]}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: activeTab === 'pulso' ? config.color : 'rgba(255,255,255,0.35)' }}>
                      Pulso
                    </Text>
                  </Reanimated.View>
                </Pressable>
                <Pressable
                  onPress={() => handleTabSwitch('legal')}
                  onPressIn={() => { tabScale1.value = withSpring(0.96, { stiffness: 400, damping: 20 }); }}
                  onPressOut={() => { tabScale1.value = withSpring(1, { stiffness: 300, damping: 18 }); }}
                >
                  <Reanimated.View style={[{
                    paddingVertical: 8,
                    paddingHorizontal: 24,
                    borderRadius: 9,
                    backgroundColor: activeTab === 'legal' ? config.color + '22' : 'transparent',
                    borderWidth: 1,
                    borderColor: activeTab === 'legal' ? config.color + '55' : 'transparent',
                  }, tabPillStyle1]}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: activeTab === 'legal' ? config.color : 'rgba(255,255,255,0.35)' }}>
                      Legal
                    </Text>
                  </Reanimated.View>
                </Pressable>
              </View>
            )}

            <Reanimated.View style={tabFadeStyle}>
            {/* ── Feed Pulso section ── */}
            {d && (activeTab === 'pulso' || category !== 'Política') && (
              <View style={{ marginBottom: 24 }}>
                {category !== 'Política' && <SectionLabel title="Pulso" />}

                {category === 'Deportes' && (
                  <>
                    {d.narrativaLiga && (
                      <DetailCard style={{ marginBottom: 12 }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff', lineHeight: 22, marginBottom: 6 }}>
                          {d.narrativaLiga.titulo}
                        </Text>
                        {d.narrativaLiga.descripcion && (
                          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.68)', lineHeight: 20 }}>
                            {d.narrativaLiga.descripcion}
                          </Text>
                        )}
                      </DetailCard>
                    )}
                    {d.momentosClave?.length > 0 && (
                      <DetailCard style={{ marginBottom: 12 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.38)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                          MOMENTOS CLAVE
                        </Text>
                        {d.momentosClave.map((m, i) => (
                          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: i < d.momentosClave.length - 1 ? 10 : 0 }}>
                            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: m.color || config.color, marginTop: 7, marginRight: 10 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff', marginBottom: 3 }}>{m.titulo}</Text>
                              {m.descripcion && <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 18 }}>{m.descripcion}</Text>}
                            </View>
                          </View>
                        ))}
                      </DetailCard>
                    )}
                    {d.discursoComparativo?.length > 0 && (
                      <DetailCard>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.38)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                          DISCURSO
                        </Text>
                        {d.discursoComparativo.map((item, i) => (
                          <Text key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,0.68)', lineHeight: 20, fontStyle: 'italic', marginBottom: i < d.discursoComparativo.length - 1 ? 8 : 0 }}>
                            "{typeof item === 'string' ? item : item.narrativa || item.texto || ''}"
                          </Text>
                        ))}
                      </DetailCard>
                    )}
                  </>
                )}

                {category === 'Violencia' && (
                  <>
                    {d.narrativaMediatica?.length > 0 && (
                      <DetailCard style={{ marginBottom: 12 }}>
                        {d.narrativaMediatica.map((n, i) => (
                          <View key={i} style={{ marginBottom: i < d.narrativaMediatica.length - 1 ? 12 : 0 }}>
                            <Text style={{ fontSize: i === 0 ? 15 : 13, fontWeight: '800', color: '#fff', lineHeight: 21, marginBottom: 4 }}>
                              {n.titulo}
                            </Text>
                            {n.descripcion && (
                              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.68)', lineHeight: 19 }}>
                                {n.descripcion}
                              </Text>
                            )}
                          </View>
                        ))}
                      </DetailCard>
                    )}
                    {d.patronesSemana?.length > 0 && (
                      <DetailCard style={{ marginBottom: 12 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.38)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                          PATRONES
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {d.patronesSemana.map((p, i) => (
                            <View key={i} style={{
                              backgroundColor: 'rgba(220,38,38,0.12)',
                              paddingHorizontal: 10, paddingVertical: 4,
                              borderRadius: 8, borderWidth: 1, borderColor: 'rgba(220,38,38,0.28)',
                            }}>
                              <Text style={{ fontSize: 12, color: 'rgba(252,165,165,0.9)' }}>{typeof p === 'string' ? p : p.zona || ''}</Text>
                            </View>
                          ))}
                        </View>
                      </DetailCard>
                    )}
                    {d.respuestaInstitucional?.length > 0 && (
                      <DetailCard>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.38)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                          RESPUESTA INSTITUCIONAL
                        </Text>
                        {d.respuestaInstitucional.map((r, i) => (
                          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: i < d.respuestaInstitucional.length - 1 ? 8 : 0 }}>
                            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: config.color, marginTop: 7, marginRight: 10 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>{r.actor}</Text>
                              {r.accion && <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 18 }}>{r.accion}</Text>}
                            </View>
                          </View>
                        ))}
                      </DetailCard>
                    )}
                  </>
                )}

                {category === 'Movilidad' && (
                  <>
                    {d.narrativaMovilidad?.length > 0 && (
                      <DetailCard style={{ marginBottom: 12 }}>
                        {d.narrativaMovilidad.map((n, i) => (
                          <View key={i} style={{ marginBottom: i < d.narrativaMovilidad.length - 1 ? 12 : 0 }}>
                            <Text style={{ fontSize: i === 0 ? 15 : 13, fontWeight: '800', color: '#fff', lineHeight: 21, marginBottom: 4 }}>
                              {n.titulo}
                            </Text>
                            {n.descripcion && (
                              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.68)', lineHeight: 19 }}>
                                {n.descripcion}
                              </Text>
                            )}
                          </View>
                        ))}
                      </DetailCard>
                    )}
                    {d.zonasCriticas?.length > 0 && (
                      <DetailCard style={{ marginBottom: 12 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.38)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                          ZONAS CRÍTICAS
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {d.zonasCriticas.map((z, i) => {
                            const nivel = (z.nivel || '').toLowerCase();
                            const chipColor = nivel === 'alta' || nivel === 'alto' ? '#ef4444' : nivel === 'media' || nivel === 'medio' ? '#f59e0b' : '#6ee7b7';
                            return (
                              <View key={i} style={{
                                backgroundColor: chipColor + '18',
                                paddingHorizontal: 10, paddingVertical: 4,
                                borderRadius: 8, borderWidth: 1, borderColor: chipColor + '40',
                              }}>
                                <Text style={{ fontSize: 12, color: chipColor }}>{z.nombre || z.zona || z}</Text>
                              </View>
                            );
                          })}
                        </View>
                      </DetailCard>
                    )}
                    {d.timeline?.length > 0 && (
                      <DetailCard>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.38)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                          TIMELINE
                        </Text>
                        {d.timeline.map((t, i) => (
                          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: i < d.timeline.length - 1 ? 8 : 0 }}>
                            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: config.color, marginTop: 7, marginRight: 10 }} />
                            <Text style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 19 }}>{typeof t === 'string' ? t : t.texto || ''}</Text>
                          </View>
                        ))}
                      </DetailCard>
                    )}
                  </>
                )}

                {category === 'Política' && activeTab === 'pulso' && (
                  <>
                    {/* ── Narrativas ── */}
                    {d.narrativas?.length > 0 && (
                      <DetailCard style={{ marginBottom: 12 }}>
                        {d.narrativas.map((n, i) => (
                          <View key={i}>
                            {i > 0 && (
                              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 12 }} />
                            )}
                            <Text style={{
                              fontSize: i === 0 ? 15 : 13,
                              fontWeight: i === 0 ? '700' : '500',
                              color: i === 0 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.65)',
                              lineHeight: i === 0 ? 22 : 20,
                              marginBottom: n.descripcion ? 5 : 0,
                            }}>
                              {n.titulo}
                            </Text>
                            {n.descripcion && i === 0 && (
                              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 19 }}>
                                {n.descripcion}
                              </Text>
                            )}
                          </View>
                        ))}
                      </DetailCard>
                    )}

                    {/* ── Actores ── */}
                    {d.actores?.length > 0 && (
                      <DetailCard style={{ marginBottom: 12, paddingVertical: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 }}>
                          <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.25)', letterSpacing: 1.4, textTransform: 'uppercase' }}>
                            Actores
                          </Text>
                          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
                            {d.actores.length}
                          </Text>
                        </View>
                        {d.actores.map((a, i) => {
                          const rp = ROLE_PALETTE[a.rol] || ROLE_PALETTE['default'];
                          return (
                            <View key={i} style={{
                              paddingVertical: 10, paddingHorizontal: 4,
                              borderTopWidth: i > 0 ? 1 : 0,
                              borderTopColor: 'rgba(255,255,255,0.04)',
                            }}>
                              <Text style={{ fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)', lineHeight: 19 }}>
                                {a.nombre}
                              </Text>
                              {/* Role badge as subtitle */}
                              <View style={{
                                alignSelf: 'flex-start',
                                backgroundColor: rp.bg,
                                paddingHorizontal: 7, paddingVertical: 2,
                                borderRadius: 4, marginTop: 4,
                              }}>
                                <Text style={{ fontSize: 9, fontWeight: '700', color: rp.fg, letterSpacing: 0.6 }}>
                                  {(a.rol || '—').toUpperCase()}
                                </Text>
                              </View>
                              {a.narrativaPrincipal && (
                                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 17, marginTop: 5 }}>
                                  {a.narrativaPrincipal}
                                </Text>
                              )}
                            </View>
                          );
                        })}
                      </DetailCard>
                    )}

                    {/* ── Timeline ── */}
                    {d.timeline?.length > 0 && (
                      <DetailCard>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.25)', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 14 }}>
                          Timeline
                        </Text>
                        {d.timeline.map((t, i) => (
                          <TimelineItem key={i} t={t} i={i} total={d.timeline.length} config={config} />
                        ))}
                      </DetailCard>
                    )}
                  </>
                )}
              </View>
            )}

            {/* ── Legal tab content ── */}
            {category === 'Política' && activeTab === 'legal' && (
              leyData ? (
                <View style={{ marginBottom: 24 }}>
                  {/* Header: tipo_dia + lastUpdated + intensidad */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {leyData.tipo_dia && (
                        <View style={{
                          backgroundColor: leyData.tipo_dia === 'sesion_activa'
                            ? 'rgba(52,211,153,0.12)'
                            : 'rgba(148,163,184,0.08)',
                          paddingHorizontal: 10, paddingVertical: 4,
                          borderRadius: 8, borderWidth: 1,
                          borderColor: leyData.tipo_dia === 'sesion_activa'
                            ? '#34d39950'
                            : 'rgba(148,163,184,0.2)',
                        }}>
                          <Text style={{
                            fontSize: 11, fontWeight: '700', letterSpacing: 0.6,
                            color: leyData.tipo_dia === 'sesion_activa'
                              ? '#34d399'
                              : 'rgba(148,163,184,0.7)',
                          }}>
                            {leyData.tipo_dia === 'sesion_activa' ? 'SESIÓN ACTIVA' : 'PUBLICACIONES'}
                          </Text>
                        </View>
                      )}
                      {leyData.lastUpdated && (
                        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                          {leyData.lastUpdated}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Timeline — solo en sesion_activa, posición prominente */}
                  {leyData.tipo_dia === 'sesion_activa' && leyData.timeline?.length > 0 && (
                    <LegalTimeline items={leyData.timeline} config={config} />
                  )}

                  {/* Avances */}
                  {leyData.avances?.length > 0 && (
                    <DetailCard style={{ marginBottom: 12 }}>
                      <SectionLabel title="Avances Legislativos" />
                      {leyData.avances.map((av, i) => (
                        <View key={i} style={{ marginBottom: i < leyData.avances.length - 1 ? 12 : 0 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 4, gap: 6 }}>
                            <TipoBadge tipo={av.tipo} />
                            {av.fecha && (
                              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                                {av.fecha}
                              </Text>
                            )}
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.88)', lineHeight: 19, marginBottom: av.descripcion ? 4 : 0 }}>
                            {av.titulo}
                          </Text>
                          {av.descripcion && (
                            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 18 }}>
                              {av.descripcion}
                            </Text>
                          )}
                          <FuenteLink fuente={av.fuente} />
                          {i < leyData.avances.length - 1 && (
                            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginTop: 10 }} />
                          )}
                        </View>
                      ))}
                    </DetailCard>
                  )}

                  {/* Iniciativas */}
                  {leyData.iniciativas?.length > 0 && (
                    <>
                      <SectionLabel title="Iniciativas" />
                      {leyData.iniciativas.map((item, i) => (
                        <IniciativaCard key={item.id || i} item={item} index={i} />
                      ))}
                    </>
                  )}

                  {/* Diputados */}
                  {leyData.diputados?.length > 0 && (
                    <DetailCard style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.25)', letterSpacing: 1.4, textTransform: 'uppercase' }}>
                          Diputados
                        </Text>
                        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>
                          {leyData.diputados.length}
                        </Text>
                      </View>
                      {leyData.diputados.map((dp, i) => {
                        const posColors = {
                          'ponente':   '#a5b4fc',
                          'moderador': '#6ee7b7',
                          'a favor':   '#34d399',
                          'en contra': '#f87171',
                        };
                        const posColor = posColors[dp.posicion] || 'rgba(148,163,184,0.8)';
                        return (
                          <View key={i} style={{
                            paddingVertical: 10, paddingHorizontal: 4,
                            borderTopWidth: i > 0 ? 1 : 0,
                            borderTopColor: 'rgba(255,255,255,0.04)',
                          }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)', lineHeight: 19 }}>
                              {dp.nombre}
                            </Text>
                            {dp.partido && (
                              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                                {dp.partido}
                              </Text>
                            )}
                            <View style={{
                              alignSelf: 'flex-start',
                              backgroundColor: posColor + '18',
                              paddingHorizontal: 7, paddingVertical: 2,
                              borderRadius: 4, marginTop: 5,
                            }}>
                              <Text style={{ fontSize: 9, fontWeight: '700', color: posColor, letterSpacing: 0.6 }}>
                                {(dp.posicion || '—').replace(/_/g, ' ').toUpperCase()}
                              </Text>
                            </View>
                            {dp.temas?.length > 0 && (
                              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 17, marginTop: 5 }}>
                                {dp.temas.join(' · ')}
                              </Text>
                            )}
                            <FuenteLink fuente={dp.fuente} />
                          </View>
                        );
                      })}
                    </DetailCard>
                  )}

                  {/* Discusiones */}
                  {leyData.discusiones?.length > 0 && (
                    <DetailCard style={{ marginBottom: 12 }}>
                      <SectionLabel title="Discusiones" />
                      {leyData.discusiones.map((disc, i) => (
                        <View key={i} style={{ marginBottom: i < leyData.discusiones.length - 1 ? 14 : 0 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.88)', lineHeight: 19, marginBottom: 4 }}>
                            {disc.tema}
                          </Text>
                          {disc.descripcion && (
                            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 18, marginBottom: disc.posiciones?.length ? 6 : 0 }}>
                              {disc.descripcion}
                            </Text>
                          )}
                          {disc.posiciones?.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 2 }}>
                              {disc.posiciones.map((pos, j) => (
                                <View key={j} style={{
                                  backgroundColor: 'rgba(124,58,237,0.12)',
                                  paddingHorizontal: 8, paddingVertical: 3,
                                  borderRadius: 6, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)',
                                }}>
                                  <Text style={{ fontSize: 11, color: '#a78bfa' }}>
                                    {typeof pos === 'string' ? pos : (pos.texto || '')}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}
                          <FuenteLink fuente={disc.fuente} />
                        </View>
                      ))}
                    </DetailCard>
                  )}
                </View>
              ) : (
                <View style={{ alignItems: 'center', paddingTop: 40, gap: 14 }}>
                  <View style={{
                    width: 56, height: 56, borderRadius: 28,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                  }}>
                    <AlertCircle size={24} color="rgba(255,255,255,0.25)" />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                    Sin datos legislativos
                  </Text>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.28)', textAlign: 'center', lineHeight: 19, paddingHorizontal: 20 }}>
                    No hay actividad legislativa reciente disponible.
                  </Text>
                </View>
              )
            )}

            {/* Hot Topics — hidden on Legal tab */}
            {(category !== 'Política' || activeTab === 'pulso') && (
              cards.length > 0 ? (
                <>
                  <Text style={{
                    fontSize: 10, fontWeight: '600',
                    color: 'rgba(255,255,255,0.25)',
                    letterSpacing: 1.4, textTransform: 'uppercase',
                    marginBottom: 12,
                  }}>
                    Noticias
                  </Text>
                  {cards.map((card, i) => (
                    <NewsCard key={card.id || i} card={card} index={i} />
                  ))}
                </>
              ) : !d ? (
                <View style={{ alignItems: 'center', paddingTop: 40, gap: 14 }}>
                  <View style={{
                    width: 56, height: 56, borderRadius: 28,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                  }}>
                    <AlertCircle size={24} color="rgba(255,255,255,0.25)" />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                    Sin noticias recientes
                  </Text>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.28)', textAlign: 'center', lineHeight: 19, paddingHorizontal: 20 }}>
                    No hay datos de {category.toLowerCase()} en el último ciclo de análisis.
                  </Text>
                </View>
              ) : null
            )}
            </Reanimated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Particle sphere (3D, Skia) ────────────────────────────────────────────────

// Fibonacci sphere: evenly distributes N points on a sphere of radius r
function fibSphere(n, r) {
  const pts = [];
  const gr = (1 + Math.sqrt(5)) / 2;
  for (let i = 0; i < n; i++) {
    const theta = Math.acos(1 - 2 * (i + 0.5) / n);
    const phi = 2 * Math.PI * i / gr;
    pts.push({
      x: r * Math.sin(theta) * Math.cos(phi),
      y: r * Math.sin(theta) * Math.sin(phi),
      z: r * Math.cos(theta),
    });
  }
  return pts;
}

const SPHERE_R   = 34;
const CANVAS_C   = 50;   // canvas 100×100, center at 50
const SPHERE_PTS = fibSphere(160, SPHERE_R);

// Pre-compute trig cache to avoid redundant work per frame
function buildPaths(angle) {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const back  = Skia.Path.Make();
  const mid   = Skia.Path.Make();
  const front = Skia.Path.Make();

  for (let i = 0; i < SPHERE_PTS.length; i++) {
    const pt  = SPHERE_PTS[i];
    const rotX = pt.x * cosA + pt.z * sinA;
    const rotZ = -pt.x * sinA + pt.z * cosA;
    // depth: 0 = back of sphere, 1 = front
    const d = (rotZ + SPHERE_R) / (2 * SPHERE_R);

    const sx = CANVAS_C + rotX;
    const sy = CANVAS_C + pt.y;

    if (d >= 0.66) {
      front.addCircle(sx, sy, Math.max(0.7, d * 2.6));
    } else if (d >= 0.33) {
      mid.addCircle(sx, sy, Math.max(0.5, d * 1.7));
    } else if (d >= 0.04) {
      back.addCircle(sx, sy, Math.max(0.3, d * 1.1));
    }
  }
  return { back, mid, front };
}

function ParticleSphere({ cx, cy, paused }) {
  const angleRef = useRef(0);
  const rafRef   = useRef(null);
  const [paths, setPaths] = useState(() => buildPaths(0));

  useEffect(() => {
    if (paused) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    let lastTs = 0;

    const tick = (ts) => {
      const dt = lastTs ? ts - lastTs : 16;
      lastTs = ts;
      angleRef.current += dt * 0.00042; // ~1.5 RPM
      setPaths(buildPaths(angleRef.current));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [paused]);

  return (
    <Canvas style={{
      position: 'absolute',
      left: cx - CANVAS_C,
      top: cy - CANVAS_C,
      width: CANVAS_C * 2,
      height: CANVAS_C * 2,
    }}>
      <Path path={paths.back}  color="rgba(100,149,237,0.14)" />
      <Path path={paths.mid}   color="rgba(150,190,255,0.50)" />
      <Path path={paths.front} color="rgba(205,225,255,0.92)" />
    </Canvas>
  );
}

// ── Category orb ──────────────────────────────────────────────────────────────

function CategoryOrb({ name, config, onPress, isSelected }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1.18,
        useNativeDriver: true,
        speed: 80,
        bounciness: 6,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 40,
        bounciness: 8,
      }),
    ]).start();
    onPress(name);
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
      <Animated.View style={{
        width: ORB_SIZE,
        height: ORB_SIZE,
        borderRadius: HALF_ORB,
        overflow: 'hidden',
        transform: [{ scale }],
        shadowColor: config.shadowColor,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: isSelected ? 1 : 0.55,
        shadowRadius: isSelected ? 22 : 10,
        elevation: 10,
        borderWidth: isSelected ? 2 : 1,
        borderColor: isSelected ? config.color + 'CC' : 'rgba(255,255,255,0.18)',
      }}>
        <Image
          source={config.image}
          style={{ width: ORB_SIZE, height: ORB_SIZE }}
          resizeMode="cover"
        />
      </Animated.View>
      <Text style={{
        marginTop: 8,
        fontSize: 11,
        fontWeight: '700',
        color: isSelected ? config.color : 'rgba(255,255,255,0.75)',
        textAlign: 'center',
        letterSpacing: 0.8,
      }}>
        {name.toUpperCase()}
      </Text>
    </TouchableOpacity>
  );
}

// ── Chat message bubble — hidden for App Store Review ────────────────────────

/* APP_STORE_REVIEW: ChatBubble hidden
function ChatBubble({ message }) {
  const isUser = message.role === 'user';

  if (message.loading) {
    return (
      <View style={{ alignItems: 'flex-start', marginBottom: 10, paddingHorizontal: 16 }}>
        <View style={{
          backgroundColor: 'rgba(100,149,237,0.12)',
          borderRadius: 16,
          borderBottomLeftRadius: 4,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: 'rgba(100,149,237,0.2)',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}>
          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: 'rgba(100,149,237,0.7)',
                  opacity: 0.4 + i * 0.2,
                }}
              />
            ))}
          </View>
          <Text style={{ fontSize: 11, color: 'rgba(100,149,237,0.6)' }}>Vizta está pensando...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{
      alignItems: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 10,
      paddingHorizontal: 16,
    }}>
      {!isUser && (
        <Text style={{
          fontSize: 10,
          fontWeight: '700',
          color: 'rgba(100,149,237,0.6)',
          letterSpacing: 0.5,
          marginBottom: 4,
          marginLeft: 2,
        }}>
          VIZTA
        </Text>
      )}
      <View style={{
        maxWidth: '82%',
        backgroundColor: isUser
          ? 'rgba(124,58,237,0.25)'
          : 'rgba(100,149,237,0.1)',
        borderRadius: 16,
        borderBottomLeftRadius: isUser ? 16 : 4,
        borderBottomRightRadius: isUser ? 4 : 16,
        paddingHorizontal: 13,
        paddingVertical: 9,
        borderWidth: 1,
        borderColor: isUser
          ? 'rgba(124,58,237,0.35)'
          : 'rgba(100,149,237,0.18)',
      }}>
        <Text style={{
          fontSize: 14,
          color: isUser ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.82)',
          lineHeight: 20,
        }}>
          {message.text}
        </Text>
      </View>
    </View>
  );
}
*/ // END APP_STORE_REVIEW

// ── Main screen ───────────────────────────────────────────────────────────────

export default function OrbitScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [selectedCategory, setSelectedCategory] = useState(null);

  /* APP_STORE_REVIEW: Chat state + functions hidden
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatFocused, setChatFocused] = useState(false);
  const chatSessionId = useRef(`orbit-${Math.random().toString(36).slice(2)}`);
  const chatScrollRef = useRef(null);
  const focusAnim = useRef(new Animated.Value(0)).current;
  const orbitMaxHeight = useRef(new Animated.Value(380)).current;
  const chatEnteredRef = useRef(false);

  const focusChat = useCallback(() => {
    chatEnteredRef.current = true;
    setChatFocused(true);
    // iOS drawer curve (cubic-bezier(0.32, 0.72, 0, 1))
    const iosCurve = t =>
      3 * (1 - t) * (1 - t) * t * 0.32 +
      3 * (1 - t) * t * t * 0.72 +
      t * t * t;

    Animated.timing(focusAnim, {
      toValue: 1,
      duration: 280,
      easing: iosCurve,
      useNativeDriver: true,
    }).start();

    Animated.timing(orbitMaxHeight, {
      toValue: 0,
      duration: 260,
      easing: iosCurve,
      useNativeDriver: false,
    }).start();
  }, [focusAnim, orbitMaxHeight]);

  const collapseOrbit = useCallback(() => {
    Keyboard.dismiss();
    // Strong ease-out (cubic-bezier(0.23, 1, 0.32, 1))
    const easeOut = t =>
      3 * (1 - t) * (1 - t) * t * 0.23 +
      3 * (1 - t) * t * t * 1.0 +
      t * t * t;

    chatEnteredRef.current = false;
    setChatFocused(false);

    Animated.timing(focusAnim, {
      toValue: 0,
      duration: 220,
      easing: easeOut,
      useNativeDriver: true,
    }).start();

    Animated.timing(orbitMaxHeight, {
      toValue: 380,
      duration: 240,
      easing: easeOut,
      useNativeDriver: false,
    }).start();
  }, [focusAnim, orbitMaxHeight]);

  // Only collapse orbit if user wasn't in chat mode (e.g. keyboard hides after send)
  const blurChat = useCallback(() => {
    if (chatEnteredRef.current) return; // still in chat context
    collapseOrbit();
  }, [collapseOrbit]);

  const clearChat = useCallback(() => {
    setChatMessages([]);
    setChatInput('');
    chatSessionId.current = `orbit-${Math.random().toString(36).slice(2)}`;
  }, []);

  const sendMessage = useCallback(async () => {
    console.log('[Chat] sendMessage called, input:', chatInput, 'loading:', chatLoading);
    const text = chatInput.trim();
    if (!text || chatLoading) {
      console.log('[Chat] Skipping — empty or loading');
      return;
    }

    setChatInput('');
    setChatLoading(true);

    const userMsg = { id: Date.now().toString(), role: 'user', text };
    const loadingMsg = { id: `loading-${Date.now()}`, role: 'assistant', text: '', loading: true };

    setChatMessages(prev => [...prev, userMsg, loadingMsg]);

    // Scroll to bottom after adding messages
    setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      console.log('[Chat] Getting Supabase session...');
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) console.warn('[Chat] Session error:', sessionError);
      const token = sessionData?.session?.access_token;
      console.log('[Chat] Token present:', !!token);

      // Route: authenticated → full ViztaAgent flow, guest → Minimax free direct
      const endpoint = token ? CHAT_ENDPOINT_AUTH : CHAT_ENDPOINT_GUEST;
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      console.log('[Chat] Fetching:', endpoint, '| authenticated:', !!token);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: text,
          sessionId: chatSessionId.current,
        }),
      });

      console.log('[Chat] Response status:', res.status, res.statusText);

      if (!res.ok) {
        // Try to parse server's error body (e.g. 429 rate limit with friendly message)
        const errText = await res.text().catch(() => '');
        console.error('[Chat] HTTP error body:', errText);
        let serverMsg = null;
        try {
          const errJson = JSON.parse(errText);
          serverMsg = errJson?.response?.message || null;
        } catch (_) {}
        if (serverMsg) {
          // Show the server's message directly (e.g. rate limit explanation)
          setChatMessages(prev =>
            prev
              .filter(m => !m.loading)
              .concat({ id: `err-${Date.now()}`, role: 'assistant', text: serverMsg })
          );
          return;
        }
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }

      const rawText = await res.text();
      console.log('[Chat] Raw response (first 200):', rawText.slice(0, 200));

      let data;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        console.error('[Chat] JSON parse error:', parseErr, 'raw:', rawText.slice(0, 300));
        throw new Error('Respuesta inválida del servidor (no es JSON).');
      }

      console.log('[Chat] Response keys:', Object.keys(data));
      console.log('[Chat] data.response type:', typeof data.response, JSON.stringify(data.response)?.slice(0, 120));

      // The server returns { success, response: { agent, message, type }, conversationId, metadata }
      const responseText =
        data.finalResponse ||
        (typeof data.response === 'string' ? data.response : null) ||
        data.response?.message ||
        data.response?.text ||
        data.response?.content ||
        data.message ||
        data.content ||
        'Sin respuesta del servidor.';

      console.log('[Chat] Response text resolved (first 100):', String(responseText).slice(0, 100));

      setChatMessages(prev =>
        prev
          .filter(m => !m.loading)
          .concat({ id: `ai-${Date.now()}`, role: 'assistant', text: responseText })
      );
    } catch (err) {
      console.error('[Chat] CAUGHT ERROR:', err?.message, err?.stack);
      const errorText = err.message?.includes('401')
        ? 'Inicia sesión para usar el chat de Vizta.'
        : `Error: ${err.message || 'No se pudo conectar con Vizta.'}`;

      setChatMessages(prev =>
        prev
          .filter(m => !m.loading)
          .concat({ id: `err-${Date.now()}`, role: 'assistant', text: errorText })
      );
    } finally {
      console.log('[Chat] finally — resetting loading');
      setChatLoading(false);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [chatInput, chatLoading]);

  */ // END APP_STORE_REVIEW

  // Fetch today's news_cards (Guatemala time, UTC-6)
  const { data: newsData, isLoading: newsLoading } = useQuery({
    queryKey: ['orbit-news-cards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_cards')
        .select('cards, generated_at')
        .gte('generated_at', since30h())
        .order('generated_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] || null;
    },
    staleTime: 1000 * 60 * 10,
  });

  const { data: feedData } = useQuery({
    queryKey: ['orbit-feed-data'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feed_data')
        .select('categoria, data, generated_at')
        .order('generated_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      const seen = new Set();
      return (data || []).filter(r => {
        if (seen.has(r.categoria)) return false;
        seen.add(r.categoria);
        return true;
      });
    },
    staleTime: 1000 * 60 * 15,
  });

  const allCards    = newsData?.cards || [];
  const generatedAt = newsData?.generated_at || null;

  const pulseAnim = useRef(new Animated.Value(0.55)).current;
  const detailTranslateY = useRef(new Animated.Value(screenHeight)).current;
  const detailTranslateX = useRef(new Animated.Value(0)).current;

  const handleSwipeCategory = (direction) => {
    const idx = CATEGORY_ORDER.indexOf(selectedCategory);
    const newIdx = direction === 'left'
      ? (idx + 1) % CATEGORY_ORDER.length
      : (idx - 1 + CATEGORY_ORDER.length) % CATEGORY_ORDER.length;

    const exitTo = direction === 'left' ? -screenWidth : screenWidth;
    const enterFrom = direction === 'left' ? screenWidth : -screenWidth;

    Animated.timing(detailTranslateX, {
      toValue: exitTo,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setSelectedCategory(CATEGORY_ORDER[newIdx]);
      detailTranslateX.setValue(enterFrom);
      Animated.spring(detailTranslateX, {
        toValue: 0,
        tension: 80,
        friction: 13,
        useNativeDriver: true,
      }).start();
    });
  };

  const player = useVideoPlayer(
    require('../../../assets/videos/feed-background.mp4'),
    (p) => {
      p.loop = true;
      p.muted = true;
      p.play();
    }
  );

  // Center orb pulse
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.45, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleSelectCategory = (name) => {
    setSelectedCategory(name);
    Animated.spring(detailTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 60,
      friction: 11,
    }).start();
  };

  const handleBack = () => {
    Animated.timing(detailTranslateY, {
      toValue: screenHeight,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setSelectedCategory(null));
  };

  // Orbit layout geometry
  const cX = screenWidth / 2;
  const containerHeight = 360;
  const cY = containerHeight / 2;

  // Clamp horizontal radius so orbs don't go off screen
  const ORBIT_RADIUS_X = Math.min(148, screenWidth / 2 - HALF_ORB - 12);

  // Line lengths (gap between orb edges)
  const lineV = ORBIT_RADIUS_Y - ORB_SIZE; // 130 - 80 = 50
  const lineH = ORBIT_RADIUS_X - ORB_SIZE; // variable

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
      <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4, 5, 18, 0.62)' }]} />

      <StatusBar style="light" />

      {/* ── Selector screen ── */}
      <View style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 14,
        }}>
          <View style={{ width: 36, height: 36 }} />

          <Text style={{
            fontSize: 16,
            fontWeight: '800',
            color: '#fff',
            letterSpacing: 3,
          }}>
            VIZTA
          </Text>

          <View style={{ width: 36, height: 36 }} />
        </View>

        {/* Subtitle */}
        <Text style={{
          textAlign: 'center',
          fontSize: 15,
          color: 'rgba(255,255,255,0.50)',
          fontWeight: '500',
          marginBottom: 20,
          letterSpacing: 0.2,
        }}>
          Selecciona un tema
        </Text>

        {/* Orbit wrapper */}
        <View style={{ height: containerHeight, position: 'relative' }}>
        <View style={{
          height: containerHeight,
          position: 'relative',
        }}>
          {/* ── Connecting lines ── */}

          {/* Top line (center-orb-top-edge → política-orb-bottom-edge) */}
          <View style={{
            position: 'absolute',
            left: cX - 0.5,
            top: cY - ORBIT_RADIUS_Y + HALF_ORB,
            width: 1,
            height: lineV,
            backgroundColor: 'rgba(255,255,255,0.13)',
          }} />

          {/* Bottom line */}
          <View style={{
            position: 'absolute',
            left: cX - 0.5,
            top: cY + HALF_ORB,
            width: 1,
            height: lineV,
            backgroundColor: 'rgba(255,255,255,0.13)',
          }} />

          {/* Left line */}
          <View style={{
            position: 'absolute',
            left: cX - ORBIT_RADIUS_X + HALF_ORB,
            top: cY - 0.5,
            width: lineH,
            height: 1,
            backgroundColor: 'rgba(255,255,255,0.13)',
          }} />

          {/* Right line */}
          <View style={{
            position: 'absolute',
            left: cX + HALF_ORB,
            top: cY - 0.5,
            width: lineH,
            height: 1,
            backgroundColor: 'rgba(255,255,255,0.13)',
          }} />

          {/* ── Center orb backdrop (pulsing glow ring) ── */}
          <Animated.View style={{
            position: 'absolute',
            left: cX - HALF_ORB,
            top: cY - HALF_ORB,
            width: ORB_SIZE,
            height: ORB_SIZE,
            borderRadius: HALF_ORB,
            backgroundColor: 'rgba(0, 0, 0, 0.82)',
            borderWidth: 1,
            borderColor: 'rgba(100,149,237,0.38)',
            shadowColor: '#6495ED',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.65,
            shadowRadius: 18,
            elevation: 10,
            opacity: pulseAnim,
          }} />

          {/* ── Particle sphere (3D, Skia) ── */}
          <ParticleSphere cx={cX} cy={cY} paused={false} />

          {/* ── Category orbs ── */}

          {/* Política — top */}
          <View style={{
            position: 'absolute',
            left: cX - HALF_ORB,
            top: cY - ORBIT_RADIUS_Y - HALF_ORB,
          }}>
            <CategoryOrb
              name="Política"
              config={CATEGORIES['Política']}
              onPress={handleSelectCategory}
              isSelected={selectedCategory === 'Política'}
            />
          </View>

          {/* Violencia — left */}
          <View style={{
            position: 'absolute',
            left: cX - ORBIT_RADIUS_X - HALF_ORB,
            top: cY - HALF_ORB,
          }}>
            <CategoryOrb
              name="Violencia"
              config={CATEGORIES['Violencia']}
              onPress={handleSelectCategory}
              isSelected={selectedCategory === 'Violencia'}
            />
          </View>

          {/* Deportes — right */}
          <View style={{
            position: 'absolute',
            left: cX + ORBIT_RADIUS_X - HALF_ORB,
            top: cY - HALF_ORB,
          }}>
            <CategoryOrb
              name="Deportes"
              config={CATEGORIES['Deportes']}
              onPress={handleSelectCategory}
              isSelected={selectedCategory === 'Deportes'}
            />
          </View>

          {/* Movilidad — bottom */}
          <View style={{
            position: 'absolute',
            left: cX - HALF_ORB,
            top: cY + ORBIT_RADIUS_Y - HALF_ORB,
          }}>
            <CategoryOrb
              name="Movilidad"
              config={CATEGORIES['Movilidad']}
              onPress={handleSelectCategory}
              isSelected={selectedCategory === 'Movilidad'}
            />
          </View>
        </View>
        </View>

      </View>
      </View>

      {/* ── Detail view (slides up from bottom) ── */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateY: detailTranslateY }, { translateX: detailTranslateX }] },
        ]}
      >
        {selectedCategory && (
          <DetailErrorBoundary key={selectedCategory}>
            <CategoryDetail
              category={selectedCategory}
              allCards={allCards}
              isLoading={newsLoading}
              generatedAt={generatedAt}
              onBack={handleBack}
              insets={insets}
              feedData={feedData || []}
              onSwipeLeft={() => handleSwipeCategory('left')}
              onSwipeRight={() => handleSwipeCategory('right')}
              categoryIndex={CATEGORY_ORDER.indexOf(selectedCategory)}
              totalCategories={CATEGORY_ORDER.length}
            />
          </DetailErrorBoundary>
        )}
      </Animated.View>
    </View>
  );
}
