import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  ScrollView,
  Image,
  useWindowDimensions,
} from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useRef, useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ArrowLeft, Trash2, Clock, ChevronRight, AlertCircle } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';

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

// ── Helper components ─────────────────────────────────────────────────────────

function IntensidadBadge({ nivel }) {
  const config = {
    alta:  { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   label: 'ALTA' },
    media: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  label: 'MEDIA' },
    baja:  { color: '#6ee7b7', bg: 'rgba(110,231,183,0.15)', label: 'BAJA' },
  };
  const c = config[nivel?.toLowerCase()] || config.media;
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
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      padding: 16,
      marginBottom: 12,
    }, style]}>
      {children}
    </View>
  );
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

function NewsCard({ card }) {
  const impacto = card.impacto_score ?? 0;
  const impactoColor = impacto >= 70 ? '#ef4444' : impacto >= 40 ? '#f59e0b' : '#6ee7b7';

  return (
    <View style={{
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      padding: 18,
      marginBottom: 14,
    }}>
      {/* Top row: category chip + impacto */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <View style={{
          backgroundColor: 'rgba(255,255,255,0.1)',
          paddingHorizontal: 10, paddingVertical: 4,
          borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
        }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 0.3 }}>
            {card.categoria || 'General'}
          </Text>
        </View>
        {impacto > 0 && (
          <View style={{
            backgroundColor: impactoColor + '18',
            paddingHorizontal: 8, paddingVertical: 3,
            borderRadius: 6, borderWidth: 1, borderColor: impactoColor + '40',
          }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: impactoColor }}>
              ⚡ {impacto}
            </Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff', lineHeight: 22, marginBottom: 8 }}>
        {card.titulo}
      </Text>

      {/* Resumen */}
      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.68)', lineHeight: 20, marginBottom: 12 }}
        numberOfLines={3}>
        {card.resumen}
      </Text>

      {/* Impacto bar */}
      {impacto > 0 && (
        <View style={{ marginBottom: 12 }}>
          <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
            <View style={{ height: 3, width: `${impacto}%`, borderRadius: 2, backgroundColor: impactoColor }} />
          </View>
        </View>
      )}

      {/* Entidades */}
      {card.entidades?.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
          {card.entidades.slice(0, 4).map((e, i) => (
            <View key={i} style={{
              backgroundColor: 'rgba(99,102,241,0.14)',
              paddingHorizontal: 8, paddingVertical: 3,
              borderRadius: 6, borderWidth: 1, borderColor: 'rgba(99,102,241,0.28)',
            }}>
              <Text style={{ fontSize: 11, color: 'rgba(165,180,252,0.9)' }}>{e}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Perspectivas */}
      {card.perspectivas?.length > 0 && (
        <View style={{ gap: 5 }}>
          {card.perspectivas.slice(0, 2).map((p, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#6366f1', marginTop: 7 }} />
              <Text style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 18 }}>{p}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Category Detail screen ────────────────────────────────────────────────────

function CategoryDetail({ category, allCards, isLoading, generatedAt, onBack, insets }) {
  const config = CATEGORIES[category];

  const cards = (allCards || [])
    .filter(c => matchesCategory(c, category))
    .sort((a, b) => (b.impacto_score || 0) - (a.impacto_score || 0));

  const topScore    = cards[0]?.impacto_score ?? 0;
  const intensidad  = cards.length > 0 ? intensidadFromScore(topScore) : null;
  const lastUpdated = relativeTime(generatedAt);

  return (
    <View style={{ flex: 1, backgroundColor: '#080a18' }}>
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
        </View>

        {intensidad ? <IntensidadBadge nivel={intensidad} /> : <View style={{ width: 50 }} />}
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
          {cards.length > 0 ? `${cards.length} temas activos` : 'Sin datos disponibles'}
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
          /* Loading */
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
        ) : cards.length === 0 ? (
          /* Empty state — no fake data */
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
        ) : (
          /* Real cards */
          <>
            <Text style={{
              fontSize: 11, fontWeight: '700',
              color: 'rgba(255,255,255,0.35)',
              letterSpacing: 1, textTransform: 'uppercase',
              marginBottom: 14,
            }}>
              Hot Topics
            </Text>
            {cards.map((card, i) => (
              <NewsCard key={card.id || i} card={card} />
            ))}
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

function ParticleSphere({ cx, cy }) {
  const angleRef = useRef(0);
  const rafRef   = useRef(null);
  const [paths, setPaths] = useState(() => buildPaths(0));

  useEffect(() => {
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
  }, []);

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

// ── Main screen ───────────────────────────────────────────────────────────────

export default function OrbitScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Fetch latest news_cards on mount so data is ready when user taps a category
  const { data: newsData, isLoading: newsLoading } = useQuery({
    queryKey: ['orbit-news-cards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_cards')
        .select('cards, generated_at')
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });

  const allCards    = newsData?.cards || [];
  const generatedAt = newsData?.generated_at || null;

  const pulseAnim = useRef(new Animated.Value(0.55)).current;
  const detailTranslateY = useRef(new Animated.Value(screenHeight)).current;

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

          <TouchableOpacity
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Trash2 size={16} color="rgba(255,255,255,0.45)" />
          </TouchableOpacity>
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

        {/* Orbit layout */}
        <View style={{ height: containerHeight, position: 'relative' }}>

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
          <ParticleSphere cx={cX} cy={cY} />

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

        {/* Hint text */}
        <Text style={{
          textAlign: 'center',
          fontSize: 12,
          color: 'rgba(255,255,255,0.22)',
          marginTop: 8,
          letterSpacing: 0.3,
        }}>
          Toca un orb para explorar
        </Text>
      </View>

      {/* ── Detail view (slides up from bottom) ── */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateY: detailTranslateY }] },
        ]}
      >
        {selectedCategory && (
          <CategoryDetail
            category={selectedCategory}
            allCards={allCards}
            isLoading={newsLoading}
            generatedAt={generatedAt}
            onBack={handleBack}
            insets={insets}
          />
        )}
      </Animated.View>
    </View>
  );
}
