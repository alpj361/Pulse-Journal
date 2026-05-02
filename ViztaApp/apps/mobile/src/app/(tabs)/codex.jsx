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
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { BookOpen, FileText, Search, Link, Headphones, Video, AlertCircle, X, Sparkles, Camera, Plus, ChevronLeft, ChevronRight, ClipboardPaste, Eye, EyeOff } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { usePulseConnectionStore } from '../../state/pulseConnectionStore';
import { supabase } from '../../utils/supabase';
import { Avatar, AvatarBuilderModal } from '../../components/avatar';

const EXTRACTORW_URL = process.env.EXPO_PUBLIC_EXTRACTORW_URL || 'https://server.standatpd.com';
const EXTRACTORT_URL = process.env.EXPO_PUBLIC_EXTRACTORT_URL || 'https://api.standatpd.com';

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

const WIKI_CATEGORIES = ['Todos', 'Actor', 'Entidad', 'Territorio', 'Concepto', 'Evento', 'Evidencia'];

// Maps legacy/English subcategory values to the real Spanish DB names (capitalized)
const SUBCATEGORY_NORMALIZE = {
  // English legacy (wiki_items)
  person: 'Actor',
  people: 'Actor',
  organization: 'Entidad',
  org: 'Entidad',
  entity: 'Entidad',
  location: 'Territorio',
  place: 'Territorio',
  event: 'Evento',
  concept: 'Concepto',
  evidence: 'Evidencia',
  // Spanish legacy (lowercase)
  persona: 'Actor',
  organización: 'Entidad',
  lugar: 'Territorio',
  concepto: 'Concepto',
  evento: 'Evento',
  evidencia: 'Evidencia',
  // Direct codex_universe_items tipos (lowercased for matching)
  actor: 'Actor',
  entidad: 'Entidad',
  territorio: 'Territorio',
  biblioteca: 'Concepto',
  fuente: 'Evidencia',
};

function normalizeSubcategory(val) {
  if (!val) return '';
  const lower = val.toLowerCase().trim();
  return SUBCATEGORY_NORMALIZE[lower] || val;
}

const WIKI_CATEGORY_COLORS = {
  Actor:      { bg: 'rgba(99,102,241,0.2)',  border: 'rgba(99,102,241,0.4)',  text: '#a5b4fc' },
  Entidad:    { bg: 'rgba(59,130,246,0.2)',  border: 'rgba(59,130,246,0.4)',  text: '#93c5fd' },
  Territorio: { bg: 'rgba(16,185,129,0.2)', border: 'rgba(16,185,129,0.4)', text: '#6ee7b7' },
  Concepto:   { bg: 'rgba(245,158,11,0.2)', border: 'rgba(245,158,11,0.4)', text: '#fcd34d' },
  Evento:     { bg: 'rgba(249,115,22,0.2)', border: 'rgba(249,115,22,0.4)', text: '#fdba74' },
  Evidencia:  { bg: 'rgba(236,72,153,0.2)', border: 'rgba(236,72,153,0.4)', text: '#f9a8d4' },
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
  const actorAvatar = catKey === 'Actor' ? (item.metadata?.avatar ?? null) : null;

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
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: actorAvatar ? 10 : 0 }}>
          {actorAvatar && (
            <Avatar config={actorAvatar} seed={item.name} size={40} showBorder={false} />
          )}
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff', flex: 1 }} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
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

function WikiSearchModal({ item, onClose, onAvatarUpdate }) {
  const catKey = normalizeSubcategory(item.subcategory);
  const catColors = WIKI_CATEGORY_COLORS[catKey] || { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.15)', text: 'rgba(255,255,255,0.6)' };
  const isActor = catKey === 'Actor';

  const [localAvatar, setLocalAvatar] = useState(item.metadata?.avatar ?? null);
  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false);

  const handleSaveAvatar = async (newConfig) => {
    setLocalAvatar(newConfig);
    if (item._source !== 'universe') {
      try {
        const { data: cur } = await supabase
          .from('wiki_items')
          .select('metadata')
          .eq('id', item.id)
          .single();
        await supabase.from('wiki_items').update({
          metadata: { ...cur?.metadata, avatar: newConfig },
        }).eq('id', item.id);
      } catch (e) {
        console.log('[WikiSearchModal] avatar save error:', e.message);
      }
    }
    onAvatarUpdate?.(newConfig);
  };

  const [step, setStep] = useState('select'); // 'detect' | 'select' | 'results'
  const [detectLoading, setDetectLoading] = useState(false);
  const [detectedInfo, setDetectedInfo] = useState(null);
  const [actorType, setActorType] = useState(() => {
    const SPANISH_TO_ACTOR_ID = {
      'Actor': 'person',
      'Entidad': 'organization',
      'Territorio': 'location',
      'Evento': 'event',
      'Concepto': 'concept',
      'Evidencia': 'concept',
    };
    const n = normalizeSubcategory(item.subcategory);
    return SPANISH_TO_ACTOR_ID[n] || 'person';
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedDims, setSelectedDims] = useState(new Set());
  const [engine, setEngine] = useState('parallel');
  const [results, setResults] = useState(null);  // [{ dimension, status, analysis, sources, error }]
  const [expandedKeys, setExpandedKeys] = useState(new Set());
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState(null);
  // Estado local de investigación guardada para poder actualizar sin cerrar el modal
  const [localResearch, setLocalResearch] = useState(item.metadata?.research || {});

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    console.log('[WikiSearch] getToken →', token ? `OK (${token.slice(0,20)}...)` : 'NULL - no session!');
    return token;
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
    const url = `${EXTRACTORW_URL}/api/mcp/execute`;
    const body = { tool_name: 'search', parameters: { query, provider: engine, location: 'Guatemala', num_results: 5 } };
    console.log(`[WikiSearch] 🔍 searchDimension "${dim.key}" → POST ${url}`);
    console.log(`[WikiSearch]   query: "${query}"`);
    console.log(`[WikiSearch]   body:`, JSON.stringify(body));
    console.log(`[WikiSearch]   token present: ${!!token}`);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      console.log(`[WikiSearch] 📡 Response status: ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.log(`[WikiSearch] 📄 Raw response (first 500 chars): ${text.slice(0, 500)}`);
      let json;
      try { json = JSON.parse(text); } catch (e) { console.log(`[WikiSearch] ❌ JSON parse error: ${e.message}`); throw new Error(`JSON parse error: ${e.message}`); }
      console.log(`[WikiSearch] ✅ json.success: ${json?.success}, result keys: ${Object.keys(json?.result || {}).join(', ')}`);
      // Response shapes from backend:
      // Perplexity success: { result: { success, data: { search_results, analysis }, ... } }
      // Exa success:        { result: { success, result: { search_results }, ... } }
      // Exa fallback:       { result: { success, result: { search_results }, ... } }
      const outer = json?.result || {};
      // Try all possible nesting levels for search_results
      const sources =
        outer?.data?.search_results ||      // Perplexity
        outer?.result?.search_results ||    // Exa direct / fallback
        outer?.search_results ||            // flat
        [];
      const analysis =
        outer?.data?.analysis ||            // Perplexity analysis
        outer?.result?.analysis ||          // Exa analysis
        outer?.formatted_response ||        // generic formatted_response
        outer?.analysis ||                  // flat
        '';
      console.log(`[WikiSearch] 📊 analysis length: ${analysis?.length}, sources count: ${sources?.length}`);
      if (!json?.success && json?.error) {
        throw new Error(json.error);
      }

      setResults(prev => prev?.map(r =>
        r.dimension.key === dim.key ? { ...r, status: 'done', analysis, sources } : r
      ));
      return { key: dim.key, dim, analysis, sources };
    } catch (err) {
      console.log(`[WikiSearch] ❌ searchDimension error for "${dim.key}": ${err.message}`);
      setResults(prev => prev?.map(r =>
        r.dimension.key === dim.key ? { ...r, status: 'error', error: err.message } : r
      ));
      return null;
    }
  };

  const handleSearch = async () => {
    if (selectedDims.size === 0) return;
    console.log(`[WikiSearch] 🚀 handleSearch START — item: "${item.name}", engine: ${engine}, dims: [${[...selectedDims].join(', ')}]`);
    console.log(`[WikiSearch] 🌐 EXTRACTORW_URL: ${EXTRACTORW_URL}`);
    const token = await getToken();
    if (!token) {
      console.log('[WikiSearch] ❌ No hay token — abortando búsqueda');
      setError('No hay sesión activa. Por favor inicia sesión nuevamente.');
      return;
    }
    const activeDims = DIMENSIONS.filter(d => selectedDims.has(d.key));
    console.log(`[WikiSearch] 📋 Dimensiones activas: ${activeDims.map(d => d.key).join(', ')}`);
    const initial = activeDims.map(d => ({ dimension: d, status: 'loading', analysis: '', sources: [] }));
    setResults(initial);
    setExpandedKeys(new Set(activeDims.map(d => d.key)));
    setStep('results');
    setSaveSuccess(false);

    let dimResults = [];
    if (engine === 'parallel') {
      for (const dim of activeDims) {
        const r = await searchDimension(dim, token);
        if (r) dimResults.push(r);
      }
    } else {
      const settled = await Promise.allSettled(activeDims.map(d => searchDimension(d, token)));
      dimResults = settled.filter(s => s.status === 'fulfilled' && s.value).map(s => s.value);
    }

    // Auto-save results to DB — only for wiki_items (universe items have prefixed ids)
    if (dimResults.length > 0 && item._source !== 'universe') {
      try {
        // Fetch fresh metadata from DB to avoid overwriting existing research
        const { data: cur } = await supabase.from('wiki_items').select('metadata').eq('id', item.id).single();
        const existing = cur?.metadata?.research || {};
        const newResearch = { ...existing };
        dimResults.forEach(({ dim: d, key, analysis, sources }) => {
          newResearch[key] = {
            label: d.label, icon: d.icon, analysis,
            sources: sources.map(s => ({ title: s.title, url: s.url, snippet: s.highlights?.[0] || s.snippet })),
            timestamp: new Date().toISOString(), engine,
          };
        });
        const updates = {
          metadata: { ...cur?.metadata, research: newResearch, research_last_updated: new Date().toISOString() },
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
    if (result && item._source !== 'universe') {
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

  const hasSavedResearch = localResearch && Object.keys(localResearch).length > 0;
  const actorInitials = isActor && item.name
    ? item.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '';

  return (
    <>
      <Modal visible animationType="slide" transparent onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
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
                {isActor && (
                  <TouchableOpacity onPress={() => setShowAvatarBuilder(true)} activeOpacity={0.8} style={{ marginRight: 12 }}>
                    {localAvatar ? (
                      <Avatar config={localAvatar} seed={item.name} size={46} showBorder={false} />
                    ) : (
                      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(99,102,241,0.12)', borderWidth: 1.5, borderColor: 'rgba(99,102,241,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#a5b4fc' }}>{actorInitials}</Text>
                      </View>
                    )}
                    <View style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#0a0c1b' }}>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', lineHeight: 14 }}>{localAvatar ? '✎' : '+'}</Text>
                    </View>
                  </TouchableOpacity>
                )}
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 0.8 }}>INVESTIGACIÓN GUARDADA</Text>
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>mantén presionado para eliminar</Text>
                  </View>
                  {Object.entries(localResearch).map(([key, val]) => (
                    <TouchableOpacity
                      key={key}
                      onLongPress={() => {
                        const { Alert } = require('react-native');
                        Alert.alert(
                          'Eliminar investigación',
                          `¿Eliminar "${val.label}" de la investigación guardada?`,
                          [
                            { text: 'Cancelar', style: 'cancel' },
                            {
                              text: 'Eliminar',
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  const { data: cur } = await supabase.from('wiki_items').select('metadata').eq('id', item.id).single();
                                  const newResearch = { ...(cur?.metadata?.research || {}) };
                                  delete newResearch[key];
                                  await supabase.from('wiki_items').update({
                                    metadata: { ...cur?.metadata, research: newResearch },
                                  }).eq('id', item.id);
                                  // Actualizar estado local para re-render inmediato
                                  setLocalResearch(newResearch);
                                } catch (e) {
                                  console.log('[delete research] error:', e.message);
                                }
                              },
                            },
                          ]
                        );
                      }}
                      delayLongPress={500}
                      activeOpacity={0.7}
                      style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.55)', marginBottom: val.analysis ? 5 : 0 }}>
                        {val.icon} {val.label}
                      </Text>
                      {val.analysis ? (
                        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 18 }} numberOfLines={3}>
                          {val.analysis}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
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
                    {['parallel', 'exa'].map(e => (
                      <TouchableOpacity key={e} onPress={() => setEngine(e)} style={{
                        paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10,
                        backgroundColor: engine === e ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.07)',
                        borderWidth: 1, borderColor: engine === e ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.1)',
                      }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: engine === e ? '#fff' : 'rgba(255,255,255,0.5)' }}>
                          {e === 'parallel' ? '🌐 Parallel' : '🔍 Exa'}
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
                        {engine === 'parallel' ? '🌐 Parallel' : '🔍 Exa'}
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
        </View>
        <AvatarBuilderModal
          visible={showAvatarBuilder}
          onClose={() => setShowAvatarBuilder(false)}
          onSave={handleSaveAvatar}
          initialConfig={localAvatar}
          seed={item.name}
        />
      </Modal>
    </>
  );
}

/**
 * buildSegmentsFromAnnotations — construye segmentos coloreados para la vista "anotado"
 * usando los actores y entidades detectados por el LLM para marcar fragmentos en el texto original.
 * @param {string} text — texto original completo
 * @param {string[]} actores — lista de actores detectados por el LLM
 * @param {string[]} entidades — lista de entidades detectadas por el LLM
 * @param {string[]} hechos — lista de hechos/eventos detectados por el LLM
 * @returns {{ text: string, type: 'actor'|'entidad'|'hecho'|'normal' }[]}
 */
function buildSegmentsFromAnnotations(text, actores = [], entidades = [], hechos = []) {
  if (!text) return [];

  // Palabras clave que indican hechos verificables (verbos de acción)
  const FACT_WORDS = ['declaró', 'anunció', 'denunció', 'firmó', 'ordenó', 'aprobó', 'rechazó',
    'investiga', 'acusó', 'señaló', 'afirmó', 'confirmó', 'reveló', 'publicó', 'aseguró',
    'advirtió', 'exigió', 'presentó', 'solicitó', 'demandó', 'indicó'];

  // Construir mapa de términos con su tipo (actores tienen prioridad sobre entidades)
  const termMap = [];
  for (const actor of actores) {
    if (actor && actor.trim().length > 2) termMap.push({ term: actor.trim(), type: 'actor' });
  }
  for (const ent of entidades) {
    if (ent && ent.trim().length > 2) termMap.push({ term: ent.trim(), type: 'entidad' });
  }
  // Ordenar por longitud descendente para que frases largas tengan precedencia
  termMap.sort((a, b) => b.term.length - a.term.length);

  const segments = [];
  let remaining = text;
  let safetyLimit = 0;

  while (remaining.length > 0 && safetyLimit < 1000) {
    safetyLimit++;
    let matched = false;

    // Intentar hacer match con actores/entidades del LLM (case-insensitive)
    for (const { term, type } of termMap) {
      if (remaining.toLowerCase().startsWith(term.toLowerCase())) {
        segments.push({ text: remaining.slice(0, term.length), type });
        remaining = remaining.slice(term.length);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Extraer siguiente token (palabra o whitespace)
    const spaceIdx = remaining.search(/\s/);
    const newlineIdx = remaining.indexOf('\n');
    let wordEnd;
    if (spaceIdx === -1 && newlineIdx === -1) wordEnd = remaining.length;
    else if (spaceIdx === -1) wordEnd = newlineIdx;
    else if (newlineIdx === -1) wordEnd = spaceIdx;
    else wordEnd = Math.min(spaceIdx, newlineIdx);

    if (wordEnd === 0) {
      const wsEnd = remaining.search(/\S/);
      if (wsEnd === -1) { segments.push({ text: remaining, type: 'normal' }); remaining = ''; }
      else { segments.push({ text: remaining.slice(0, wsEnd), type: 'normal' }); remaining = remaining.slice(wsEnd); }
      continue;
    }

    const word = remaining.slice(0, wordEnd);
    const wordClean = word.toLowerCase().replace(/[.,;:!?¿¡"'«»()[\]]/g, '');
    if (FACT_WORDS.includes(wordClean)) {
      segments.push({ text: word, type: 'hecho' });
    } else {
      segments.push({ text: word, type: 'normal' });
    }
    remaining = remaining.slice(wordEnd);
  }

  return segments;
}

// ── PostCard: tarjeta de Instagram post/reel con transcripción expandible ──
function PostCard({ post, isReel, transcription, thumbUri }) {
  const [expanded, setExpanded] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisView, setAnalysisView] = useState('anotado'); // 'anotado' | 'organizado'
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Pre-cargar análisis guardado desde details del post (si ya existe)
  const [analysisData, setAnalysisData] = useState(() => {
    const saved = post.details?.analysis;
    if (!saved) return null;
    // Reconstruir anotadoSegments desde el texto y los datos guardados
    const rawText = transcription || post.description || post.name || '';
    return {
      ...saved,
      anotadoSegments: buildSegmentsFromAnnotations(rawText, saved.actores || [], saved.entidades || [], []),
    };
  });

  const date = post.created_at
    ? new Date(post.created_at).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  async function handleAnalyze() {
    // Si ya tenemos datos (desde DB o sesión anterior): solo toggle el panel
    if (analysisData) { setAnalysisOpen(o => !o); return; }

    setAnalysisLoading(true);
    setAnalysisOpen(true);

    try {
      // 1. Texto a analizar
      const rawText = transcription || post.description || post.name || '';
      if (!rawText.trim()) {
        setAnalysisData({ error: 'No hay texto disponible para analizar.' });
        return;
      }

      // 2. Obtener token Supabase
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      // 3. Llamar al endpoint de ExtractorW (GPT-4o-mini via OpenRouter)
      console.log('[handleAnalyze] 🔍 Llamando a /api/ai/analyze-content...');
      const res = await fetch(`${EXTRACTORW_URL}/api/ai/analyze-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text: rawText,
          title: post.name || '',
        }),
      });

      const json = await res.json();
      console.log('[handleAnalyze] 📡 Respuesta:', res.status, json?.success);

      if (!res.ok || !json.success) {
        throw new Error(json.error || json.message || 'Error en el análisis');
      }

      const d = json.analysis || {};

      // 4. Mapear respuesta al shape del UI
      const actores   = d.actores    || [];
      const entidades = [...(d.entidades || []), ...(d.territorios || [])];
      const temas     = d.eventos    || [];
      const contexto  = d.narrativa  || '';
      const resumen   = d.hechos?.[0] || contexto.slice(0, 120) || '';

      // 5. Construir segmentos coloreados
      const anotadoSegments = buildSegmentsFromAnnotations(rawText, actores, entidades, d.hechos || []);

      const newAnalysis = { anotadoSegments, temas, actores, entidades, contexto, resumen };
      setAnalysisData(newAnalysis);

      // 6. Persistir en codex_universe_items.details para no repetir el análisis
      console.log('[handleAnalyze] 💾 Guardando análisis en DB...');
      try {
        // Leer details actuales para no sobreescribir otros campos
        const { data: current } = await supabase
          .from('codex_universe_items')
          .select('details')
          .eq('id', post.id)
          .single();

        // Guardar sin anotadoSegments (se reconstruyen al cargar, son datos derivados)
        const analysisToSave = { temas, actores, entidades, contexto, resumen, analyzed_at: new Date().toISOString() };

        await supabase
          .from('codex_universe_items')
          .update({ details: { ...(current?.details || {}), analysis: analysisToSave } })
          .eq('id', post.id);

        console.log('[handleAnalyze] ✅ Análisis guardado en DB');
      } catch (dbErr) {
        // Error al guardar en DB es no-crítico: el análisis ya está en estado local
        console.warn('[handleAnalyze] ⚠️ No se pudo guardar en DB:', dbErr.message);
      }

    } catch (err) {
      console.error('[handleAnalyze] ❌ Error:', err.message);
      setAnalysisData({ error: err.message || 'Error al analizar el contenido.' });
    } finally {
      setAnalysisLoading(false);
    }
  }

  return (
    <View style={{
      backgroundColor: 'rgba(8,10,24,0.72)',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: isReel ? 'rgba(225,48,108,0.25)' : 'rgba(255,255,255,0.1)',
      padding: 14,
      marginBottom: 10,
    }}>
      {/* Thumbnail */}
      {thumbUri && (
        <View style={{ position: 'relative', marginBottom: 10 }}>
          <Image
            source={{ uri: thumbUri }}
            style={{ width: '100%', height: 180, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' }}
            resizeMode="cover"
          />
          {isReel && (
            <View style={{
              position: 'absolute', top: 8, left: 8,
              backgroundColor: 'rgba(225,48,108,0.85)',
              borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
              flexDirection: 'row', alignItems: 'center', gap: 4,
            }}>
              <Video size={11} color="#fff" />
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 }}>REEL</Text>
            </View>
          )}
        </View>
      )}

      {/* Sin thumbnail pero es reel */}
      {!thumbUri && isReel && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <View style={{
            backgroundColor: 'rgba(225,48,108,0.2)', borderRadius: 8,
            paddingHorizontal: 8, paddingVertical: 4,
            flexDirection: 'row', alignItems: 'center', gap: 4,
            borderWidth: 1, borderColor: 'rgba(225,48,108,0.4)',
          }}>
            <Video size={11} color="rgba(225,48,108,0.9)" />
            <Text style={{ fontSize: 10, fontWeight: '800', color: 'rgba(225,48,108,0.9)', letterSpacing: 0.5 }}>REEL</Text>
          </View>
        </View>
      )}

      {/* Header row: title + eye button */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', flex: 1, marginRight: 8 }} numberOfLines={2}>{post.name}</Text>
        <TouchableOpacity
          onPress={handleAnalyze}
          activeOpacity={0.75}
          style={{
            width: 34, height: 34, borderRadius: 17,
            backgroundColor: analysisOpen ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)',
            borderWidth: 1,
            borderColor: analysisOpen ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.12)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {analysisLoading
            ? <ActivityIndicator size="small" color="rgba(99,102,241,0.9)" />
            : <Eye size={16} color={analysisOpen ? 'rgba(99,102,241,0.9)' : 'rgba(255,255,255,0.45)'} />
          }
        </TouchableOpacity>
      </View>

      {post.description ? (
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 18, marginTop: 5 }} numberOfLines={3}>
          {post.description}
        </Text>
      ) : null}

      {/* Transcripción + panel unificado (solo reels con transcripción) */}
      {isReel && transcription ? (
        <View style={{
          backgroundColor: 'rgba(99,102,241,0.07)',
          borderRadius: 10, padding: 12, marginTop: 10,
          borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)',
        }}>
          {/* Tab toggle — solo si el análisis está disponible */}
          {analysisOpen && (
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
              {['anotado', 'organizado'].map(v => (
                <TouchableOpacity
                  key={v}
                  onPress={() => setAnalysisView(v)}
                  activeOpacity={0.75}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
                    backgroundColor: analysisView === v ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)',
                    borderWidth: 1,
                    borderColor: analysisView === v ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.1)',
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: analysisView === v ? 'rgba(99,102,241,1)' : 'rgba(255,255,255,0.4)' }}>
                    {v === 'anotado' ? 'Transcripcion' : 'Organizado'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {analysisOpen && analysisLoading && (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <ActivityIndicator color="rgba(99,102,241,0.8)" />
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>Analizando contenido…</Text>
            </View>
          )}

          {analysisOpen && !analysisLoading && analysisData?.error && (
            <Text style={{ fontSize: 12, color: 'rgba(255,80,80,0.8)', lineHeight: 17 }}>⚠ {analysisData.error}</Text>
          )}

          {/* Transcripción — visible cuando no hay análisis O cuando tab=Transcripcion */}
          {(!analysisOpen || (analysisOpen && !analysisLoading && analysisView === 'anotado')) && (
            <>
              <TouchableOpacity
                onPress={() => setExpanded(e => !e)}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}
              >
                {!analysisOpen && (
                  <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(99,102,241,0.7)', letterSpacing: 0.6 }}>
                    TRANSCRIPCIÓN
                  </Text>
                )}
                <Text style={{ fontSize: 11, color: 'rgba(99,102,241,0.6)', marginLeft: analysisOpen ? 'auto' : 0 }}>
                  {expanded ? '▲ ocultar' : '▼ ver completa'}
                </Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 12, lineHeight: 20 }} numberOfLines={expanded ? undefined : 4}>
                {analysisOpen && analysisData && !analysisData.error
                  ? (analysisData.anotadoSegments || []).map((seg, i) => {
                      if (seg.type === 'actor') return <Text key={i} style={{ color: 'rgba(251,191,36,1)', fontWeight: '700' }}>{seg.text}</Text>;
                      if (seg.type === 'entidad') return <Text key={i} style={{ color: 'rgba(99,102,241,1)', fontWeight: '700' }}>{seg.text}</Text>;
                      if (seg.type === 'hecho') return <Text key={i} style={{ color: 'rgba(52,211,153,1)', fontWeight: '700' }}>{seg.text}</Text>;
                      return <Text key={i} style={{ color: 'rgba(255,255,255,0.6)' }}>{seg.text}</Text>;
                    })
                  : <Text style={{ color: 'rgba(255,255,255,0.6)' }}>{transcription}</Text>
                }
              </Text>
            </>
          )}

          {/* Tab Organizado — solo cuando está disponible */}
          {analysisOpen && !analysisLoading && analysisData && !analysisData.error && analysisView === 'organizado' && (
            <View style={{ gap: 12 }}>
              {/* Temas */}
              {analysisData.temas && analysisData.temas.length > 0 && (
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(99,102,241,0.8)', marginBottom: 6, letterSpacing: 0.8 }}>🏷 TEMAS</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                    {analysisData.temas.map((t, i) => (
                      <View key={i} style={{ backgroundColor: 'rgba(99,102,241,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)' }}>
                        <Text style={{ fontSize: 11, color: 'rgba(200,201,255,0.95)', fontWeight: '600' }}>{t}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {/* Actores */}
              {analysisData.actores && analysisData.actores.length > 0 && (
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(251,191,36,0.85)', marginBottom: 6, letterSpacing: 0.8 }}>👤 ACTORES</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                    {analysisData.actores.map((a, i) => (
                      <View key={i} style={{ backgroundColor: 'rgba(251,191,36,0.1)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)' }}>
                        <Text style={{ fontSize: 11, color: 'rgba(251,191,36,0.95)', fontWeight: '600' }}>{a}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {/* Entidades */}
              {analysisData.entidades && analysisData.entidades.length > 0 && (
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(52,211,153,0.85)', marginBottom: 6, letterSpacing: 0.8 }}>🏛 ENTIDADES</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                    {analysisData.entidades.map((e, i) => (
                      <View key={i} style={{ backgroundColor: 'rgba(52,211,153,0.1)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(52,211,153,0.3)' }}>
                        <Text style={{ fontSize: 11, color: 'rgba(52,211,153,0.95)', fontWeight: '600' }}>{e}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {/* Postura / Contexto */}
              {analysisData.contexto && (
                <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: 'rgba(99,102,241,0.5)' }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(99,102,241,0.8)', marginBottom: 4, letterSpacing: 0.8 }}>📌 POSTURA / CONTEXTO</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 18 }}>{analysisData.contexto}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      ) : null}

      {date && (
        <Text style={{ fontSize: 11, color: 'rgba(225,48,108,0.7)', marginTop: 8 }}>{date}</Text>
      )}
    </View>
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

  const [instagramPosts, setInstagramPosts] = useState([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [showAddPostModal, setShowAddPostModal] = useState(false);
  const [postUrl, setPostUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractedPost, setExtractedPost] = useState(null);
  const [extractError, setExtractError] = useState(null);
  const [savingPost, setSavingPost] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

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

  const fetchInstagramPosts = async () => {
    setIsLoadingPosts(true);
    const { data, error } = await supabase
      .from('codex_universe_items')
      .select('id, name, tipo, description, tags, thumbnail_url, details, created_at')
      .eq('flag', 'instagram')
      .order('created_at', { ascending: false })
      .limit(50);
    setIsLoadingPosts(false);
    if (!error) setInstagramPosts(data || []);
  };

  // ── Instagram: extract post from URL ──
  // Detecta si es reel (/reel/) → usa /instagram/transcribe en ExtractorT
  // Si es post normal (/p/) → usa /api/instagram/extract en ExtractorW
  const handleExtractPost = async () => {
    if (!postUrl.trim()) return;
    setExtracting(true);
    setExtractError(null);
    setExtractedPost(null);
    setCarouselIndex(0);
    try {
      const url = postUrl.trim();
      const isReel = url.includes('/reel/');

      if (isReel) {
        // Reels → ExtractorT /instagram/transcribe (incluye audio→Whisper)
        const res = await fetch(`${EXTRACTORT_URL}/instagram/transcribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const json = await res.json();
        if (json.success) {
          // Normalizar respuesta al mismo shape que usa el resto del componente
          setExtractedPost({
            success: true,
            source_url: url,
            author: json.author || null,
            description: json.description || null,
            is_reel: true,
            thumbnail_url: json.thumbnail_url || null,
            video_url: json.video_url || null,
            transcription: json.transcription || null,
            post_id: json.post_id || null,
            // Para compatibilidad con el render de imágenes existente
            extracted_images: json.thumbnail_url ? [json.thumbnail_url] : [],
          });
        } else {
          setExtractError(json.error || 'No se pudo transcribir el reel');
        }
      } else {
        // Posts normales → ExtractorW /api/instagram/extract
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const res = await fetch(`${EXTRACTORW_URL}/api/instagram/extract`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ url }),
        });
        const json = await res.json();
        if (json.success) {
          setExtractedPost(json);
        } else {
          setExtractError(json.error?.message || 'No se pudo extraer el post');
        }
      }
    } catch (e) {
      setExtractError('Error de conexión. Verifica tu red.');
    } finally {
      setExtracting(false);
    }
  };

  // ── Instagram: save post to codex_universe_items ──
  const handleSavePost = async () => {
    if (!extractedPost) return;
    setSavingPost(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      const name = extractedPost.author
        ? `@${extractedPost.author}${extractedPost.description ? ' — ' + extractedPost.description.slice(0, 60) : ''}`
        : extractedPost.description?.slice(0, 80) || 'Post de Instagram';

      const { error } = await supabase.from('codex_universe_items').insert({
        name,
        tipo: 'post',
        flag: 'instagram',
        description: extractedPost.description || '',
        thumbnail_url: extractedPost.thumbnail_url || extractedPost.extracted_images?.[0] || null,
        tags: ['instagram', ...(extractedPost.is_reel ? ['reel', 'video'] : [])],
        aliases: extractedPost.author ? [`@${extractedPost.author}`] : [],
        details: {
          source_url: extractedPost.source_url,
          images: extractedPost.extracted_images || [],
          author: extractedPost.author,
          is_reel: extractedPost.is_reel || false,
          video_url: extractedPost.video_url || null,
          thumbnail_url: extractedPost.thumbnail_url || null,
          transcription: extractedPost.transcription || null,
          post_id: extractedPost.post_id || null,
        },
        mentions: [],
        datasets: [],
        ...(userId ? { user_id: userId } : {}),
      });
      if (!error) {
        setShowAddPostModal(false);
        setPostUrl('');
        setExtractedPost(null);
        setExtractError(null);
        fetchInstagramPosts();
      } else {
        setExtractError(error.message);
      }
    } catch (e) {
      setExtractError('Error al guardar. Intenta de nuevo.');
    } finally {
      setSavingPost(false);
    }
  };

  // Cargar posts de Instagram cuando el tab está activo
  useEffect(() => {
    if (!isConnected || activeTab !== 'posts') return;
    fetchInstagramPosts();
  }, [isConnected, activeTab]);

  // Escuchar cambios de sesión de Supabase para recargar wiki cuando la sesión esté lista
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[codex] onAuthStateChange →', event, 'session:', session ? `OK user=${session.user?.email}` : 'NULL');
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && session && isConnected) {
        console.log('[codex] ✅ Sesión disponible — recargando wiki y codex');
        fetchWiki(session);
        fetchCodex();
      }
    });
    return () => subscription.unsubscribe();
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected) return;
    // Intentar fetch inmediato — si la sesión no está lista aún, onAuthStateChange lo manejará
    fetchWiki();
    fetchCodex();
  }, [isConnected]);

  // Refresca la wiki cada vez que el tab recibe foco (ej: se agregó un item desde otra pantalla)
  useFocusEffect(
    useCallback(() => {
      if (!isConnected) return;
      fetchWiki();
    }, [isConnected])
  );

  const fetchWiki = async (sessionOverride) => {
    console.log('[fetchWiki] 🚀 START — isConnected:', isConnected);
    setIsLoadingWiki(true);
    setWikiError(null);

    // Verificar sesión activa de Supabase
    let session = sessionOverride;
    if (!session) {
      const { data: sessionData } = await supabase.auth.getSession();
      session = sessionData?.session;
    }
    console.log('[fetchWiki] 🔑 Supabase session:', session ? `OK user=${session.user?.email}` : 'NULL - no session!');

    // Si no hay sesión, no tiene sentido intentar — RLS bloqueará todo
    if (!session) {
      console.log('[fetchWiki] ⚠️ Sin sesión Supabase — esperando onAuthStateChange para reintento automático');
      setIsLoadingWiki(false);
      return;
    }

    // Fetch both tables in parallel
    const [wikiResult, universeResult] = await Promise.all([
      supabase
        .from('wiki_items')
        .select('id, name, subcategory, description, relevance_score, tags, metadata, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('codex_universe_items')
        .select('id, name, tipo, description, tags, aliases, details, created_at')
        .neq('tipo', 'post')
        .order('created_at', { ascending: false }),
    ]);

    console.log('[fetchWiki] 📊 wiki_items count:', wikiResult.data?.length ?? 'null', '| error:', wikiResult.error?.message ?? 'none');
    console.log('[fetchWiki] 📊 codex_universe_items count:', universeResult.data?.length ?? 'null', '| error:', universeResult.error?.message ?? 'none');

    setIsLoadingWiki(false);

    if (wikiResult.error && universeResult.error) {
      console.log('[fetchWiki] ❌ Both errors:', wikiResult.error.message, universeResult.error.message);
      setWikiError(wikiResult.error.message);
      return;
    }

    // Map codex_universe_items to the same shape as wiki_items
    const universeItems = (universeResult.data || []).map(item => ({
      id: `universe_${item.id}`,
      _sourceId: item.id,
      _source: 'universe',
      name: item.name,
      subcategory: item.tipo, // Actor, Entidad, Evento, etc. — normalizeSubcategory handles these
      description: item.description || '',
      tags: item.tags || [],
      metadata: { details: item.details },
      created_at: item.created_at,
    }));

    // Merge: wiki_items first (they have research/metadata), then universe items not already in wiki
    const wikiNames = new Set((wikiResult.data || []).map(w => w.name?.toLowerCase()));
    const deduplicatedUniverse = universeItems.filter(u => !wikiNames.has(u.name?.toLowerCase()));

    const merged = [...(wikiResult.data || []), ...deduplicatedUniverse]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    console.log('[fetchWiki] ✅ Merged wikiItems:', merged.length, '(wiki:', wikiResult.data?.length ?? 0, '+ universe:', deduplicatedUniverse.length, ')');
    setWikiItems(merged);
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

  const filteredWiki = (() => {
    console.log('[filteredWiki] 🔎 wikiItems total:', wikiItems.length, '| wikiFilter:', wikiFilter, '| searchQuery:', searchQuery);
    const result = wikiItems.filter((item) => {
      const normalized = normalizeSubcategory(item.subcategory);
      const matchesCategory =
        wikiFilter === 'Todos' ||
        normalized === wikiFilter;
      const matchesSearch =
        !searchQuery ||
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesCategory) {
        console.log(`[filteredWiki]   ❌ "${item.name}" filtered out — subcategory="${item.subcategory}" normalized="${normalized}" != "${wikiFilter.toLowerCase()}"`);
      }
      return matchesCategory && matchesSearch;
    });
    console.log('[filteredWiki] ✅ filteredWiki count:', result.length);
    return result;
  })();

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
          onAvatarUpdate={(newAvatar) => {
            setWikiItems(prev => prev.map(w =>
              w.id === selectedWikiItem.id
                ? { ...w, metadata: { ...w.metadata, avatar: newAvatar } }
                : w
            ))
          }}
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
            {[
              { id: 'wiki', label: 'Wiki' },
              { id: 'codex', label: 'Codex' },
              { id: 'posts', label: 'Posts' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: 12,
                  backgroundColor: activeTab === tab.id
                    ? tab.id === 'posts' ? 'rgba(225,48,108,0.7)' : 'rgba(99,102,241,0.7)'
                    : 'rgba(255,255,255,0.07)',
                  borderWidth: 1,
                  borderColor: activeTab === tab.id
                    ? tab.id === 'posts' ? 'rgba(225,48,108,0.5)' : 'rgba(99,102,241,0.5)'
                    : 'rgba(255,255,255,0.1)',
                }}
              >
                <Text style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.5)',
                }}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>


          {activeTab === 'posts' ? (
            /* ── Posts tab (Instagram) ── */
            <View style={{ flex: 1 }}>
              {/* Add Post button */}
              <View style={{ paddingHorizontal: 24, marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={() => setShowAddPostModal(true)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    backgroundColor: 'rgba(225,48,108,0.7)', borderRadius: 14, paddingVertical: 12,
                    borderWidth: 1, borderColor: 'rgba(225,48,108,0.5)',
                  }}
                >
                  <Plus size={16} color="#fff" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Agregar post de Instagram</Text>
                </TouchableOpacity>
              </View>

              {/* Add Post Modal */}
              {showAddPostModal && (
                <Modal visible animationType="slide" transparent onRequestClose={() => setShowAddPostModal(false)}>
                  <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1, justifyContent: 'flex-end' }}
                  >
                    <Pressable style={{ flex: 1 }} onPress={() => setShowAddPostModal(false)} />
                    <Pressable onPress={e => e.stopPropagation()}>
                      <View style={{ backgroundColor: '#0a0c1b', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.1)', maxHeight: '90%' }}>
                        <ScrollView
                          contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
                          keyboardShouldPersistTaps="handled"
                          showsVerticalScrollIndicator={false}
                        >
                        <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 16 }}>Agregar post</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, height: 48, marginBottom: 14 }}>
                          <Link size={15} color="rgba(255,255,255,0.4)" />
                          <TextInput
                            value={postUrl}
                            onChangeText={setPostUrl}
                            placeholder="https://www.instagram.com/p/..."
                            placeholderTextColor="rgba(255,255,255,0.25)"
                            style={{ flex: 1, color: '#fff', fontSize: 13, marginLeft: 8 }}
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                          <TouchableOpacity
                            onPress={async () => {
                              const text = await Clipboard.getStringAsync();
                              if (text) setPostUrl(text);
                            }}
                            style={{ padding: 6, marginLeft: 4 }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <ClipboardPaste size={18} color="#fff" />
                          </TouchableOpacity>
                        </View>

                        {extractError && (
                          <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' }}>
                            <Text style={{ fontSize: 12, color: 'rgba(239,68,68,0.9)' }}>{extractError}</Text>
                          </View>
                        )}

                        {extractedPost && (
                          <View style={{ marginBottom: 14 }}>
                            {/* Thumbnail / Carousel */}
                            {extractedPost.extracted_images?.length > 0 && (
                              <View style={{ position: 'relative', marginBottom: 10 }}>
                                <Image
                                  source={{ uri: extractedPost.extracted_images[carouselIndex] }}
                                  style={{ width: '100%', height: 200, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)' }}
                                  resizeMode="cover"
                                />
                                {/* Badge REEL sobre thumbnail en el preview */}
                                {extractedPost.is_reel && (
                                  <View style={{
                                    position: 'absolute', top: 8, left: 8,
                                    backgroundColor: 'rgba(225,48,108,0.85)',
                                    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
                                    flexDirection: 'row', alignItems: 'center', gap: 4,
                                  }}>
                                    <Video size={11} color="#fff" />
                                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 }}>REEL</Text>
                                  </View>
                                )}
                                {extractedPost.extracted_images.length > 1 && (
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', position: 'absolute', top: '50%', width: '100%', paddingHorizontal: 8 }}>
                                    <TouchableOpacity onPress={() => setCarouselIndex(i => Math.max(0, i - 1))} style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 6 }}>
                                      <ChevronLeft size={18} color="#fff" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setCarouselIndex(i => Math.min(extractedPost.extracted_images.length - 1, i + 1))} style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 6 }}>
                                      <ChevronRight size={18} color="#fff" />
                                    </TouchableOpacity>
                                  </View>
                                )}
                                {extractedPost.extracted_images.length > 1 && (
                                  <Text style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{carouselIndex + 1}/{extractedPost.extracted_images.length}</Text>
                                )}
                              </View>
                            )}
                            {extractedPost.author && (
                              <Text style={{ fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>
                                @{extractedPost.author}
                              </Text>
                            )}
                            {extractedPost.description && (
                              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 18, marginBottom: extractedPost.transcription ? 10 : 0 }} numberOfLines={3}>
                                {extractedPost.description}
                              </Text>
                            )}
                            {/* Transcripción preview (solo reels) */}
                            {extractedPost.is_reel && extractedPost.transcription ? (
                              <View style={{
                                backgroundColor: 'rgba(225,48,108,0.08)',
                                borderRadius: 8, padding: 10,
                                borderWidth: 1, borderColor: 'rgba(225,48,108,0.2)',
                              }}>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(225,48,108,0.7)', letterSpacing: 0.6, marginBottom: 4 }}>
                                  TRANSCRIPCIÓN
                                </Text>
                                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 17 }} numberOfLines={5}>
                                  {extractedPost.transcription}
                                </Text>
                              </View>
                            ) : extractedPost.is_reel ? (
                              <View style={{
                                backgroundColor: 'rgba(225,48,108,0.05)',
                                borderRadius: 8, padding: 10,
                                borderWidth: 1, borderColor: 'rgba(225,48,108,0.15)',
                                flexDirection: 'row', alignItems: 'center', gap: 6,
                              }}>
                                <Text style={{ fontSize: 11, color: 'rgba(225,48,108,0.6)' }}>🎙 Sin transcripción disponible</Text>
                              </View>
                            ) : null}
                          </View>
                        )}

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          {!extractedPost ? (
                            <TouchableOpacity
                              onPress={handleExtractPost}
                              disabled={extracting || !postUrl.trim()}
                              style={{ flex: 1, backgroundColor: extracting ? 'rgba(225,48,108,0.3)' : 'rgba(225,48,108,0.7)', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(225,48,108,0.5)' }}
                            >
                              {extracting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Extraer post</Text>}
                            </TouchableOpacity>
                          ) : (
                            <>
                              <TouchableOpacity onPress={() => { setExtractedPost(null); setPostUrl(''); setExtractError(null); }} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                                <Text style={{ fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.6)' }}>Cancelar</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={handleSavePost} disabled={savingPost} style={{ flex: 1, backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(16,185,129,0.5)' }}>
                                {savingPost ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Guardar</Text>}
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                        </ScrollView>
                      </View>
                    </Pressable>
                  </KeyboardAvoidingView>
                </Modal>
              )}

              {/* Posts list */}
              {isLoadingPosts ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="large" color="rgba(225,48,108,0.8)" />
                </View>
              ) : (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                  {instagramPosts.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingTop: 40 }}>
                      <Camera size={32} color="rgba(225,48,108,0.4)" style={{ marginBottom: 12 }} />
                      <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>No hay posts guardados</Text>
                    </View>
                  ) : (
                    instagramPosts.map(post => {
                      const isReel = post.tags?.includes('reel') || post.details?.is_reel;
                      const transcription = post.details?.transcription;
                      const thumbUri = post.thumbnail_url || post.details?.thumbnail_url || post.details?.images?.[0];
                      return <PostCard key={post.id} post={post} isReel={isReel} transcription={transcription} thumbUri={thumbUri} />;
                    })
                  )}
                </ScrollView>
              )}
            </View>
          ) : activeTab === 'wiki' ? (
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
