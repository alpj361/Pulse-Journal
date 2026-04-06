import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { BookOpen, FileText, Search, Link, Headphones, Video, AlertCircle, X, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { usePulseConnectionStore } from '../../state/pulseConnectionStore';
import { supabase } from '../../utils/supabase';

const EXTRACTORW_URL = process.env.EXPO_PUBLIC_EXTRACTORW_URL || 'https://server.standatpd.com';

const ACTOR_TYPES = [
  { id: 'person', label: 'Persona' },
  { id: 'organization', label: 'Organización' },
  { id: 'location', label: 'Lugar' },
  { id: 'event', label: 'Evento' },
  { id: 'concept', label: 'Concepto' },
];

const DIMENSIONS = [
  { key: 'bio',           label: 'Biografía',           icon: '📅' },
  { key: 'profession',    label: 'Profesión / Cargo',    icon: '💼' },
  { key: 'historical',    label: 'Contexto histórico',   icon: '📚' },
  { key: 'alliances',     label: 'Alianzas',             icon: '🤝' },
  { key: 'controversies', label: 'Controversias',        icon: '⚡' },
  { key: 'achievements',  label: 'Logros',               icon: '🏆' },
  { key: 'opinions',      label: 'Posición pública',     icon: '🎤' },
  { key: 'recent',        label: 'Noticias recientes',   icon: '📰' },
];

const currentYear = new Date().getFullYear();

function buildDimensionQuery(name, key) {
  switch (key) {
    case 'bio':           return `¿Quién es ${name}? fecha de nacimiento edad lugar de origen familia historia personal Guatemala`;
    case 'profession':    return `${name} Guatemala cargo actual profesión estudios trayectoria profesional institución`;
    case 'historical':    return `historia y antecedentes de ${name} Guatemala cronología eventos pasados contexto previo a ${currentYear}`;
    case 'alliances':     return `${name} Guatemala aliados socios políticos relaciones vínculos con instituciones y personas`;
    case 'controversies': return `${name} Guatemala escándalos denuncias problemas legales acusaciones polémicas`;
    case 'achievements':  return `logros éxitos obras resultados reconocimientos de ${name} Guatemala qué ha conseguido`;
    case 'opinions':      return `declaraciones discursos postura pública de ${name} Guatemala qué ha dicho`;
    case 'recent':        return `${name} Guatemala noticias ${currentYear} actividad reciente últimas semanas`;
    default:              return `${name} Guatemala ${key}`;
  }
}

const WIKI_CATEGORIES = ['Todos', 'persona', 'organización', 'lugar', 'evento', 'concepto'];

// Maps English subcategory values (from DB/backend) to Spanish display keys
const SUBCATEGORY_NORMALIZE = {
  person: 'persona',
  people: 'persona',
  organization: 'organización',
  org: 'organización',
  location: 'lugar',
  place: 'lugar',
  event: 'evento',
  concept: 'concepto',
  entity: 'organización',
};

function normalizeSubcategory(val) {
  if (!val) return '';
  const lower = val.toLowerCase();
  return SUBCATEGORY_NORMALIZE[lower] || lower;
}

const WIKI_CATEGORY_COLORS = {
  persona: { bg: 'rgba(99,102,241,0.2)', border: 'rgba(99,102,241,0.4)', text: '#a5b4fc' },
  organización: { bg: 'rgba(245,158,11,0.2)', border: 'rgba(245,158,11,0.4)', text: '#fcd34d' },
  lugar: { bg: 'rgba(16,185,129,0.2)', border: 'rgba(16,185,129,0.4)', text: '#6ee7b7' },
  evento: { bg: 'rgba(239,68,68,0.2)', border: 'rgba(239,68,68,0.4)', text: '#fca5a5' },
  concepto: { bg: 'rgba(139,92,246,0.2)', border: 'rgba(139,92,246,0.3)', text: '#c4b5fd' },
};

const CODEX_TYPE_ICONS = {
  documento: FileText,
  audio: Headphones,
  video: Video,
  enlace: Link,
};

const CODEX_TYPE_COLORS = {
  documento: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.3)', text: '#93c5fd' },
  audio: { bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.3)', text: '#d8b4fe' },
  video: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', text: '#fca5a5' },
  enlace: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', text: '#6ee7b7' },
};

function TypeBadge({ type, colorMap }) {
  const colors = colorMap[type?.toLowerCase()] || {
    bg: 'rgba(255,255,255,0.08)',
    border: 'rgba(255,255,255,0.15)',
    text: 'rgba(255,255,255,0.6)',
  };
  return (
    <View style={{
      backgroundColor: colors.bg,
      borderRadius: 8,
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: colors.border,
    }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>
        {type || 'otro'}
      </Text>
    </View>
  );
}

function WikiItem({ item, onPress }) {
  const catKey = normalizeSubcategory(item.subcategory);
  const catColors = WIKI_CATEGORY_COLORS[catKey] || {
    bg: 'rgba(255,255,255,0.08)',
    border: 'rgba(255,255,255,0.15)',
    text: 'rgba(255,255,255,0.6)',
  };

  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      activeOpacity={0.75}
      style={{
        backgroundColor: 'rgba(8,10,24,0.72)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        padding: 16,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', flex: 1 }} numberOfLines={1}>
          {item.name}
        </Text>
        {item.subcategory && (
          <View style={{
            backgroundColor: catColors.bg,
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderWidth: 1,
            borderColor: catColors.border,
            marginLeft: 8,
          }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: catColors.text }}>
              {catKey}
            </Text>
          </View>
        )}
      </View>
      {item.description ? (
        <Text
          numberOfLines={2}
          style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 19, marginTop: 6 }}
        >
          {item.description}
        </Text>
      ) : null}
      {item.tags?.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
          {item.tags.map((tag, i) => (
            <View key={i} style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: 5,
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
            }}>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Wiki Search Modal (3-step: detect → dimensions → results) ─────────────────

function WikiSearchModal({ item, onClose }) {
  const [step, setStep] = useState('select'); // 'detect' | 'select' | 'results'
  const [actorType, setActorType] = useState(() => {
    const SPANISH_TO_ACTOR_ID = {
      'persona': 'person', 'organización': 'organization',
      'lugar': 'location', 'evento': 'event', 'concepto': 'concept',
    };
    const n = normalizeSubcategory(item.subcategory);
    return SPANISH_TO_ACTOR_ID[n] || 'person';
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedDims, setSelectedDims] = useState(new Set());
  const [engine, setEngine] = useState('perplexity');
  const [results, setResults] = useState(null);  // [{ dimension, status, analysis, sources, error }]
  const [expandedKeys, setExpandedKeys] = useState(new Set());
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState(null);

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token;
  };


  const handleDetect = async () => {
    setDetectLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${EXTRACTORW_URL}/api/wiki/exa-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: item.name, type: actorType }),
      });
      if (res.ok) setDetectedInfo(await res.json());
    } catch (_) { /* silent — detection is optional */ }
    finally { setDetectLoading(false); }
    setStep('select');
  };

  const toggleDim = (key) => {
    setSelectedDims(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleExpanded = (key) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const searchDimension = async (dim, token) => {
    const query = buildDimensionQuery(item.name, dim.key);
    try {
      const res = await fetch(`${EXTRACTORW_URL}/api/mcp/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tool_name: 'search', parameters: { query, provider: engine, location: 'Guatemala', num_results: 5 } }),
      });
      const json = await res.json();
      const data = json?.result?.data || json?.result || {};
      const analysis = engine === 'perplexity' ? (data?.analysis || '') : undefined;
      const sources = engine === 'perplexity'
        ? (data?.search_results || [])
        : (data?.search_results || json?.result?.search_results || []);

      setResults(prev => prev?.map(r =>
        r.dimension.key === dim.key ? { ...r, status: 'done', analysis, sources } : r
      ));
      return { key: dim.key, dim, analysis, sources };
    } catch (err) {
      setResults(prev => prev?.map(r =>
        r.dimension.key === dim.key ? { ...r, status: 'error', error: err.message } : r
      ));
      return null;
    }
  };

  const handleSearch = async () => {
    if (selectedDims.size === 0) return;
    const token = await getToken();
    const activeDims = DIMENSIONS.filter(d => selectedDims.has(d.key));
    const initial = activeDims.map(d => ({ dimension: d, status: 'loading', analysis: '', sources: [] }));
    setResults(initial);
    setExpandedKeys(new Set(activeDims.map(d => d.key)));
    setStep('results');
    setSaveSuccess(false);

    let dimResults = [];
    if (engine === 'perplexity') {
      for (const dim of activeDims) {
        const r = await searchDimension(dim, token);
        if (r) dimResults.push(r);
      }
    } else {
      const settled = await Promise.allSettled(activeDims.map(d => searchDimension(d, token)));
      dimResults = settled.filter(s => s.status === 'fulfilled' && s.value).map(s => s.value);
    }

    // Auto-save results to DB
    if (dimResults.length > 0) {
      try {
        const existing = item.metadata?.research || {};
        const newResearch = { ...existing };
        dimResults.forEach(({ dim: d, key, analysis, sources }) => {
          newResearch[key] = {
            label: d.label, icon: d.icon, analysis,
            sources: sources.map(s => ({ title: s.title, url: s.url, snippet: s.highlights?.[0] || s.snippet })),
            timestamp: new Date().toISOString(), engine,
          };
        });
        const updates = {
          metadata: { ...item.metadata, research: newResearch, research_last_updated: new Date().toISOString() },
        };
        // Si hay resultado de bio y el item no tiene descripción, guardar como descripción
        const bioResult = dimResults.find(r => r.key === 'bio');
        if (bioResult?.analysis && !item.description) {
          updates.description = bioResult.analysis.slice(0, 500);
        }
        await supabase.from('wiki_items').update(updates).eq('id', item.id);
        setSaveSuccess(true);
      } catch (_) { /* silencioso — los resultados siguen visibles en UI */ }
    }
  };

  const retryDimension = async (dim) => {
    const token = await getToken();
    setResults(prev => prev?.map(r =>
      r.dimension.key === dim.key ? { ...r, status: 'loading', error: undefined, sources: [] } : r
    ));
    const result = await searchDimension(dim, token);
    if (result) {
      try {
        const { data: cur } = await supabase.from('wiki_items').select('metadata').eq('id', item.id).single();
        const existing = cur?.metadata?.research || {};
        existing[result.key] = {
          label: result.dim.label, icon: result.dim.icon, analysis: result.analysis,
          sources: result.sources.map(s => ({ title: s.title, url: s.url, snippet: s.highlights?.[0] || s.snippet })),
          timestamp: new Date().toISOString(), engine,
        };
        await supabase.from('wiki_items').update({
          metadata: { ...cur?.metadata, research: existing, research_last_updated: new Date().toISOString() },
        }).eq('id', item.id);
        setSaveSuccess(true);
      } catch (_) { /* silencioso */ }
    }
  };

  const catKey = normalizeSubcategory(item.subcategory);
  const catColors = WIKI_CATEGORY_COLORS[catKey] || { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.15)', text: 'rgba(255,255,255,0.6)' };
  const savedResearch = item.metadata?.research;
  const hasSavedResearch = savedResearch && Object.keys(savedResearch).length > 0;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={{
            backgroundColor: '#0a0c1b',
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            maxHeight: '92%',
          }}>
            {/* Handle */}
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' }} />
            </View>

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 10, paddingBottom: 14, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }} numberOfLines={1}>{item.name}</Text>
                {item.subcategory && (
                  <View style={{ marginTop: 4 }}>
                    <View style={{ backgroundColor: catColors.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: catColors.border, alignSelf: 'flex-start' }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: catColors.text }}>{catKey}</Text>
                    </View>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={onClose} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginLeft: 12 }}>
                <X size={15} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

              {/* Descripción */}
              {item.description ? (
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 22, marginBottom: 20 }}>
                  {item.description}
                </Text>
              ) : null}

              {/* Investigación guardada (si existe y no hay búsqueda activa) */}
              {hasSavedResearch && !results && (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 0.8, marginBottom: 10 }}>INVESTIGACIÓN GUARDADA</Text>
                  {Object.entries(savedResearch).map(([key, val]) => (
                    <View key={key} style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.55)', marginBottom: val.analysis ? 5 : 0 }}>
                        {val.icon} {val.label}
                      </Text>
                      {val.analysis ? (
                        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 18 }} numberOfLines={3}>
                          {val.analysis}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}

              {/* Acordeón de búsqueda */}
              <TouchableOpacity
                onPress={() => setSearchOpen(o => !o)}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: searchOpen ? 'rgba(6,182,212,0.12)' : 'rgba(255,255,255,0.05)',
                  borderRadius: 12, padding: 14,
                  borderWidth: 1, borderColor: searchOpen ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.1)',
                  marginBottom: searchOpen ? 16 : 0,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={14} color={searchOpen ? 'rgba(6,182,212,0.9)' : 'rgba(255,255,255,0.4)'} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: searchOpen ? 'rgba(6,182,212,0.9)' : 'rgba(255,255,255,0.5)' }}>
                    Buscar información
                  </Text>
                  {saveSuccess && <Text style={{ fontSize: 11, color: 'rgba(16,185,129,0.8)' }}>✓ guardado</Text>}
                </View>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{searchOpen ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {searchOpen && (
                <View>
                  {/* Tipo de actor */}
                  <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 0.8, marginBottom: 10 }}>TIPO DE ACTOR</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, marginBottom: 20 }}>
                    {ACTOR_TYPES.map(t => (
                      <TouchableOpacity key={t.id} onPress={() => setActorType(t.id)} style={{
                        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
                        backgroundColor: actorType === t.id ? 'rgba(6,182,212,0.6)' : 'rgba(255,255,255,0.07)',
                        borderWidth: 1, borderColor: actorType === t.id ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.1)',
                      }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: actorType === t.id ? '#fff' : 'rgba(255,255,255,0.5)' }}>{t.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Dimensiones */}
                  <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 0.8, marginBottom: 10 }}>¿QUÉ INVESTIGAR?</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                    {DIMENSIONS.map(d => {
                      const active = selectedDims.has(d.key);
                      return (
                        <TouchableOpacity key={d.key} onPress={() => toggleDim(d.key)} style={{
                          flexDirection: 'row', alignItems: 'center', gap: 6,
                          paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10,
                          backgroundColor: active ? 'rgba(6,182,212,0.18)' : 'rgba(255,255,255,0.06)',
                          borderWidth: 1, borderColor: active ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.1)',
                          width: '47%',
                        }}>
                          <Text style={{ fontSize: 14 }}>{d.icon}</Text>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#67e8f9' : 'rgba(255,255,255,0.55)', flex: 1 }} numberOfLines={1}>{d.label}</Text>
                          {active && <Text style={{ fontSize: 10, color: '#67e8f9' }}>✓</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Motor */}
                  <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 0.8, marginBottom: 10 }}>MOTOR</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                    {['perplexity', 'exa'].map(e => (
                      <TouchableOpacity key={e} onPress={() => setEngine(e)} style={{
                        paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10,
                        backgroundColor: engine === e ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.07)',
                        borderWidth: 1, borderColor: engine === e ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.1)',
                      }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: engine === e ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                          {e === 'perplexity' ? '⚡ Perplexity' : '🔍 Exa'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    onPress={handleSearch}
                    disabled={selectedDims.size === 0}
                    style={{
                      backgroundColor: selectedDims.size === 0 ? 'rgba(6,182,212,0.2)' : 'rgba(6,182,212,0.7)',
                      borderRadius: 14, paddingVertical: 13, alignItems: 'center',
                      borderWidth: 1, borderColor: 'rgba(6,182,212,0.4)',
                      marginBottom: 4,
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: selectedDims.size === 0 ? 'rgba(255,255,255,0.3)' : '#fff' }}>
                      {selectedDims.size === 0 ? 'Selecciona dimensiones' : `Buscar (${selectedDims.size}) →`}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Resultados */}
              {results && (
                <View style={{ marginTop: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#e2e8f0' }}>Resultados</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      {saveSuccess && <Text style={{ fontSize: 11, color: 'rgba(16,185,129,0.8)' }}>✓ guardado</Text>}
                      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                        {engine === 'perplexity' ? '⚡ Perplexity' : '🔍 Exa'}
                      </Text>
                      <TouchableOpacity onPress={() => { setResults(null); setSaveSuccess(false); }}>
                        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {results.map(r => {
                    const expanded = expandedKeys.has(r.dimension.key);
                    return (
                      <View key={r.dimension.key} style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
                        <TouchableOpacity
                          onPress={() => toggleExpanded(r.dimension.key)}
                          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: 'rgba(255,255,255,0.04)' }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {r.status === 'loading'
                              ? <ActivityIndicator size="small" color="rgba(6,182,212,0.8)" />
                              : <Text style={{ fontSize: 15 }}>{r.dimension.icon}</Text>
                            }
                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#e2e8f0' }}>{r.dimension.label}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {r.status === 'loading' && <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Buscando...</Text>}
                            {r.status === 'done' && r.sources.length > 0 && <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{r.sources.length} fuentes</Text>}
                            {r.status === 'error' && <Text style={{ fontSize: 11, color: 'rgba(239,68,68,0.8)' }}>Error</Text>}
                            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{expanded ? '▲' : '▼'}</Text>
                          </View>
                        </TouchableOpacity>

                        {expanded && (
                          <View style={{ padding: 14, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                            {r.status === 'loading' && (
                              <View style={{ gap: 6 }}>
                                {[1,2,3].map(i => <View key={i} style={{ height: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4, width: `${90 - i * 10}%` }} />)}
                              </View>
                            )}
                            {r.status === 'error' && (
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ fontSize: 12, color: 'rgba(239,68,68,0.8)', flex: 1 }}>{r.error}</Text>
                                <TouchableOpacity onPress={() => retryDimension(r.dimension)}>
                                  <Text style={{ fontSize: 12, color: 'rgba(6,182,212,0.8)', fontWeight: '600', marginLeft: 12 }}>Reintentar</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                            {r.status === 'done' && (
                              <>
                                {r.analysis ? (
                                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 20, marginBottom: r.sources.length > 0 ? 12 : 0 }}>
                                    {r.analysis}
                                  </Text>
                                ) : null}
                                {r.sources.length > 0 && (
                                  <>
                                    <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 0.8, marginBottom: 8, borderTopWidth: r.analysis ? 1 : 0, borderColor: 'rgba(255,255,255,0.08)', paddingTop: r.analysis ? 10 : 0 }}>
                                      FUENTES
                                    </Text>
                                    {r.sources.map((s, i) => {
                                      let hostname = s.url;
                                      try { hostname = new URL(s.url).hostname.replace('www.', ''); } catch {}
                                      return (
                                        <View key={i} style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                                          <Text style={{ fontSize: 12, fontWeight: '600', color: '#e2e8f0', marginBottom: 3 }} numberOfLines={2}>{s.title}</Text>
                                          {(s.snippet || s.highlights?.[0]) && (
                                            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }} numberOfLines={2}>
                                              {s.snippet || s.highlights?.[0]}
                                            </Text>
                                          )}
                                          <Text style={{ fontSize: 11, color: 'rgba(6,182,212,0.7)' }}>{hostname}</Text>
                                        </View>
                                      );
                                    })}
                                  </>
                                )}
                                {!r.analysis && r.sources.length === 0 && (
                                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', paddingVertical: 8 }}>Sin resultados para esta dimensión</Text>
                                )}
                              </>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {error && (
                    <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' }}>
                      <Text style={{ fontSize: 12, color: 'rgba(239,68,68,0.9)' }}>{error}</Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CodexItem({ item }) {
  const TypeIcon = CODEX_TYPE_ICONS[item.tipo?.toLowerCase()] || FileText;
  const colors = CODEX_TYPE_COLORS[item.tipo?.toLowerCase()] || {
    bg: 'rgba(255,255,255,0.08)',
    border: 'rgba(255,255,255,0.15)',
    text: 'rgba(255,255,255,0.6)',
  };
  const date = item.fecha || item.created_at;
  const formattedDate = date
    ? new Date(date).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <View style={{
      backgroundColor: 'rgba(8,10,24,0.72)',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      padding: 16,
      marginBottom: 10,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: colors.bg,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}>
          <TypeIcon size={18} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', lineHeight: 21 }} numberOfLines={2}>
            {item.titulo}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 }}>
            <TypeBadge type={item.tipo} colorMap={CODEX_TYPE_COLORS} />
            {item.proyecto && (
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }} numberOfLines={1}>
                {item.proyecto}
              </Text>
            )}
          </View>
          {formattedDate && (
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
              {formattedDate}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

export default function CodexScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isConnected } = usePulseConnectionStore();

  const [activeTab, setActiveTab] = useState('wiki'); // 'wiki' | 'codex'
  const [wikiFilter, setWikiFilter] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');

  const [wikiItems, setWikiItems] = useState([]);
  const [codexItems, setCodexItems] = useState([]);
  const [isLoadingWiki, setIsLoadingWiki] = useState(false);
  const [isLoadingCodex, setIsLoadingCodex] = useState(false);
  const [wikiError, setWikiError] = useState(null);
  const [codexError, setCodexError] = useState(null);

  const [selectedWikiItem, setSelectedWikiItem] = useState(null);

  const player = useVideoPlayer(
    require('../../../assets/videos/feed-background.mp4'),
    (p) => {
      p.loop = true;
      p.muted = true;
      p.play();
    }
  );

  useEffect(() => {
    if (!isConnected) return;
    fetchWiki();
    fetchCodex();
  }, [isConnected]);

  const fetchWiki = async () => {
    setIsLoadingWiki(true);
    setWikiError(null);
    const { data, error } = await supabase
      .from('wiki_items')
      .select('id, name, subcategory, description, relevance_score, tags, created_at')
      .order('created_at', { ascending: false });
    setIsLoadingWiki(false);
    if (error) {
      setWikiError(error.message);
    } else {
      setWikiItems(data || []);
    }
  };

  const fetchCodex = async () => {
    setIsLoadingCodex(true);
    setCodexError(null);
    const { data, error } = await supabase
      .from('codex_items')
      .select('id, titulo, tipo, fecha, proyecto, etiquetas, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    setIsLoadingCodex(false);
    if (error) {
      setCodexError(error.message);
    } else {
      setCodexItems(data || []);
    }
  };

  const filteredWiki = wikiItems.filter((item) => {
    const matchesCategory =
      wikiFilter === 'Todos' ||
      normalizeSubcategory(item.subcategory) === wikiFilter.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <View style={{ flex: 1 }}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
      />
      <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4, 5, 18, 0.55)' }]} />

      <StatusBar style="light" />

      {/* Wiki detail + research modal */}
      {selectedWikiItem && (
        <WikiSearchModal
          item={selectedWikiItem}
          onClose={() => setSelectedWikiItem(null)}
        />
      )}

      {!isConnected ? (
        /* ── Not connected CTA ── */
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <View style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: 'rgba(99,102,241,0.15)',
            borderWidth: 1,
            borderColor: 'rgba(99,102,241,0.3)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}>
            <BookOpen size={34} color="rgba(165,180,252,0.7)" />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 10 }}>
            Conecta Pulse Journal
          </Text>
          <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
            Accede a tu Codex y Wiki personal desde aquí
          </Text>
          <TouchableOpacity
            onPress={() => router.navigate('/(tabs)/settings')}
            style={{
              backgroundColor: 'rgba(99,102,241,0.75)',
              borderRadius: 14,
              paddingVertical: 14,
              paddingHorizontal: 28,
              borderWidth: 1,
              borderColor: 'rgba(99,102,241,0.5)',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
              Ir a Ajustes
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* ── Connected content ── */
        <View style={{ flex: 1, paddingTop: insets.top + 20 }}>
          {/* Header */}
          <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
            <Text style={{ fontSize: 32, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 }}>
              Codex
            </Text>
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
              Tu base de conocimiento personal
            </Text>
          </View>

          {/* Internal tabs */}
          <View style={{
            flexDirection: 'row',
            paddingHorizontal: 24,
            marginBottom: 16,
            gap: 8,
          }}>
            {['wiki', 'codex'].map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 9,
                  borderRadius: 12,
                  backgroundColor: activeTab === tab
                    ? 'rgba(99,102,241,0.7)'
                    : 'rgba(255,255,255,0.07)',
                  borderWidth: 1,
                  borderColor: activeTab === tab
                    ? 'rgba(99,102,241,0.5)'
                    : 'rgba(255,255,255,0.1)',
                }}
              >
                <Text style={{
                  fontSize: 14,
                  fontWeight: '700',
                  color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.5)',
                  textTransform: 'capitalize',
                }}>
                  {tab === 'wiki' ? 'Wiki' : 'Codex'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'wiki' ? (
            <View style={{ flex: 1 }}>
              {/* Search */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginHorizontal: 24,
                marginBottom: 12,
                backgroundColor: 'rgba(255,255,255,0.07)',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
                paddingHorizontal: 12,
                height: 44,
              }}>
                <Search size={16} color="rgba(255,255,255,0.4)" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Buscar en Wiki..."
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  style={{ flex: 1, color: '#fff', fontSize: 14, marginLeft: 8 }}
                />
              </View>

              {/* Category filters */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 24, gap: 8, marginBottom: 16 }}
                style={{ flexGrow: 0, marginBottom: 12 }}
              >
                {WIKI_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setWikiFilter(cat)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 10,
                      backgroundColor: wikiFilter === cat
                        ? 'rgba(99,102,241,0.6)'
                        : 'rgba(255,255,255,0.07)',
                      borderWidth: 1,
                      borderColor: wikiFilter === cat
                        ? 'rgba(99,102,241,0.5)'
                        : 'rgba(255,255,255,0.1)',
                    }}
                  >
                    <Text style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: wikiFilter === cat ? '#fff' : 'rgba(255,255,255,0.5)',
                      textTransform: 'capitalize',
                    }}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {isLoadingWiki ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="large" color="rgba(165,180,252,0.8)" />
                </View>
              ) : wikiError ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
                  <AlertCircle size={28} color="rgba(239,68,68,0.7)" />
                  <Text style={{ fontSize: 14, color: 'rgba(239,68,68,0.8)', textAlign: 'center', marginTop: 12 }}>
                    {wikiError}
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 20 }}
                  showsVerticalScrollIndicator={false}
                >
                  {filteredWiki.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingTop: 40 }}>
                      <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>
                        {wikiFilter === 'Todos' ? 'No hay elementos en tu Wiki' : `No hay entradas de tipo "${wikiFilter}"`}
                      </Text>
                    </View>
                  ) : (
                    filteredWiki.map((item) => (
                      <WikiItem key={item.id} item={item} onPress={setSelectedWikiItem} />
                    ))
                  )}
                </ScrollView>
              )}
            </View>
          ) : (
            /* ── Codex tab ── */
            <View style={{ flex: 1 }}>
              {isLoadingCodex ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="large" color="rgba(165,180,252,0.8)" />
                </View>
              ) : codexError ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
                  <AlertCircle size={28} color="rgba(239,68,68,0.7)" />
                  <Text style={{ fontSize: 14, color: 'rgba(239,68,68,0.8)', textAlign: 'center', marginTop: 12 }}>
                    {codexError}
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 20 }}
                  showsVerticalScrollIndicator={false}
                >
                  {codexItems.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingTop: 40 }}>
                      <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>
                        No hay elementos en tu Codex
                      </Text>
                    </View>
                  ) : (
                    codexItems.map((item) => <CodexItem key={item.id} item={item} />)
                  )}
                </ScrollView>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
