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
  Alert,
  Animated,
} from 'react-native';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// `Animated` de react-native ya está tomado arriba; reanimated entra como `Rea`.
import Rea, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { INK, GLASS, CARD_SHADOW } from '../../components/theme';
import SpacesStack from '../../components/codex/SpacesStack';
import ItemDetailSheet from '../../components/codex/ItemDetailSheet';
import CreateSnippetSheet from '../../components/codex/CreateSnippetSheet';
import AgregarSheet, { SubiendoDocumento } from '../../components/codex/AgregarSheet';
import { elegirYSubirDocumento } from '../../utils/subirDocumento';
import SegmentedSlider from '../../components/SegmentedSlider';
import CreateSpaceSheet from '../../components/codex/CreateSpaceSheet';
import CodexAccessGate from '../../components/codex/CodexAccessGate';
import { listSpaces, loadSpace } from '../../utils/codexSpaces';
import { useUltimoLugarStore, useRecordarLugar } from '../../state/ultimoLugarStore';

/** Los lugares que vivan en el Codex, y que esta pantalla puede olvidar. */
const TIPOS_CODEX = ['item', 'espacio'];
import { BookOpen, FileText, Search, Link, Headphones, Video, AlertCircle, X, Camera, Plus, ChevronLeft, ChevronRight, ClipboardPaste, Eye, EyeOff, Pencil, Database, Table, Trash2, Lock, Globe, ChevronDown, ChevronUp, Heart, Repeat2, MessageCircle } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { usePulseConnectionStore } from '../../state/pulseConnectionStore';
import { supabase } from '../../utils/supabase';
import { ponerFila, useEnVivo, useFilasEnVivo } from '../../utils/enVivo';

// Una ficha de `codex_universe_items` con la forma de las de `wiki_items`.
const deUniverso = (item) => ({
  id: `universe_${item.id}`,
  _sourceId: item.id,
  _source: 'universe',
  name: item.name,
  subcategory: item.tipo, // Actor, Entidad, Evento, etc. — normalizeSubcategory handles these
  description: item.description || '',
  tags: item.tags || [],
  metadata: { details: item.details },
  created_at: item.created_at,
});
import { Avatar, AvatarBuilderModal } from '../../components/avatar';

const EXTRACTORW_URL = process.env.EXPO_PUBLIC_EXTRACTORW_URL || 'https://server.standatpd.com';
const EXTRACTORT_URL = process.env.EXPO_PUBLIC_EXTRACTORT_URL || 'https://api.standatpd.com';

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
        backgroundColor: GLASS.fill,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: GLASS.rim,
        padding: 16,
        marginBottom: 10,
        ...CARD_SHADOW,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: actorAvatar ? 10 : 0 }}>
          {actorAvatar && (
            <Avatar config={actorAvatar} seed={item.name} size={40} showBorder={false} />
          )}
          <Text style={{ fontSize: 15, fontWeight: '700', color: INK.title, flex: 1 }} numberOfLines={1}>
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
          style={{ fontSize: 13, color: INK.meta, lineHeight: 19, marginTop: 6 }}
        >
          {item.description}
        </Text>
      ) : null}
      {item.tags?.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
          {item.tags.map((tag, i) => (
            <View key={i} style={{
              backgroundColor: 'rgba(255,255,255,0.6)',
              borderRadius: 5,
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderWidth: 1,
              borderColor: 'rgba(28,43,34,0.09)',
            }}>
              <Text style={{ fontSize: 10, color: INK.meta, fontWeight: '600' }}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Wiki Item Edit Modal ───────────────────────────────────────────────────────

// Claves internas que NO se muestran como campos editables (igual que ThePulse/CodexPage.tsx)
const INTERNAL_KEYS = new Set([
  'source', 'datasets', 'dataset_visibility', 'actor_type',
  'research', 'research_last_updated', 'relevance_score',
  'category', 'subcategory', 'wiki_id', 'consulta_history',
  // wiki_items internals
  'avatar',
]);

// Presets por tipo (espejo exacto de PRESETS en CodexPage.tsx)
const EDIT_PRESETS = {
  Actor: [
    { label: 'Cargo',                type: 'texto'    },
    { label: 'Partido / Afiliacion', type: 'texto'    },
    { label: 'Pais',                 type: 'texto'    },
    { label: 'Inicio en cargo',      type: 'fecha'    },
    { label: 'Fin en cargo',         type: 'fecha'    },
    { label: 'Patrimonio declarado', type: 'numero'   },
    { label: 'No. Expediente',       type: 'texto'    },
    { label: 'En activo',            type: 'booleano' },
    { label: 'Perfil LinkedIn',      type: 'link'     },
  ],
  Entidad: [
    { label: 'Sector',               type: 'texto'    },
    { label: 'Pais',                 type: 'texto'    },
    { label: 'Fecha de fundacion',   type: 'fecha'    },
    { label: 'Presupuesto anual',    type: 'numero'   },
    { label: 'Sitio web',            type: 'link'     },
    { label: 'Vigente',              type: 'booleano' },
    { label: 'No. Empleados',        type: 'numero'   },
  ],
  Evento: [
    { label: 'Fecha inicio',         type: 'fecha'    },
    { label: 'Fecha fin',            type: 'fecha'    },
    { label: 'Ambito / Sector',      type: 'texto'    },
    { label: 'Pais',                 type: 'texto'    },
    { label: 'Resultado',            type: 'texto'    },
    { label: 'Fuente principal',     type: 'link'     },
  ],
  Evidencia: [
    { label: 'Tipo de evidencia',    type: 'texto'    },
    { label: 'Fecha de obtencion',   type: 'fecha'    },
    { label: 'URL del documento',    type: 'link'     },
    { label: 'Clasificacion',        type: 'texto'    },
    { label: 'Verificado',           type: 'booleano' },
  ],
  Biblioteca: [
    { label: 'Autor',                type: 'texto'    },
    { label: 'Fecha de publicacion', type: 'fecha'    },
    { label: 'URL',                  type: 'link'     },
    { label: 'Tema',                 type: 'texto'    },
  ],
  Territorio: [
    { label: 'Pais',                 type: 'texto'    },
    { label: 'Region / Departamento',type: 'texto'    },
    { label: 'Poblacion',            type: 'numero'   },
    { label: 'Coordenadas',          type: 'texto'    },
  ],
  Fuente: [
    { label: 'Medio / Organizacion', type: 'texto'    },
    { label: 'Pais',                 type: 'texto'    },
    { label: 'URL base',             type: 'link'     },
    { label: 'Confiabilidad (1-10)', type: 'numero'   },
    { label: 'Activa',               type: 'booleano' },
  ],
};

const FIELD_TYPE_ICONS = { texto: 'T', numero: '#', fecha: '📅', booleano: '◉', link: '↗' };
const FIELD_TYPES = ['texto', 'numero', 'fecha', 'booleano', 'link'];

// Convierte el objeto rawDetails/metadata a lista de campos editables
function rawToFields(raw) {
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw)
    .filter(([key, v]) => {
      if (INTERNAL_KEYS.has(key.toLowerCase())) return false;
      if (v === null || v === undefined) return false;
      if (typeof v === 'object') return false;
      if (String(v).trim() === '') return false;
      return true;
    })
    .map(([label, value]) => ({ id: `f_${label}`, label, type: 'texto', value: String(value) }));
}

function EditWikiModal({ item, onClose, onSuccess, bottomInset = 0 }) {
  const catKey = normalizeSubcategory(item?.subcategory);
  const catColors = WIKI_CATEGORY_COLORS[catKey] || {
    bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.15)', text: 'rgba(255,255,255,0.6)',
  };
  const isUniverse = item?._source === 'universe';

  const [name, setName] = useState(item?.name || '');
  const [description, setDescription] = useState(item?.description || '');
  const [relevance, setRelevance] = useState(item?.relevance_score ?? 50);
  const [tags, setTags] = useState(item?.tags || []);
  const [tagInput, setTagInput] = useState('');

  // La fuente de campos dinámicos varía según el origen del item
  const rawDetails = isUniverse
    ? (item?.metadata?.details || {})
    : (() => {
        const m = item?.metadata || {};
        const { research, avatar, research_last_updated, ...rest } = m;
        return rest;
      })();

  const [extraFields, setExtraFields] = useState(() => rawToFields(rawDetails));
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customType, setCustomType] = useState('texto');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // ── Relaciones semánticas (solo universe items) ───────────────────────────
  const [relations, setRelations] = useState([]);        // [{ id, subject_id, verb, object_id, note?, date? }]
  const [relationsLoading, setRelationsLoading] = useState(false);
  const [newVerb, setNewVerb] = useState('');
  const [showVerbPicker, setShowVerbPicker] = useState(false);
  const [newObjSearch, setNewObjSearch] = useState('');
  const [newObjResults, setNewObjResults] = useState([]);
  const [newObjTarget, setNewObjTarget] = useState(null); // { id (uuid), name, subcategory }
  const [searchingObj, setSearchingObj] = useState(false);
  const [customVerb, setCustomVerb] = useState('');
  const [verbLibrary, setVerbLibrary] = useState([]);    // verbos personalizados de sesión

  const VERBS_BY_TIPO = {
    Actor:     ['aliado de','enfrenta','persigue a','coordina con','responde a','apoya a','bloquea a','financia a','nombro a','acuso a','defiende a','negocia con','representa a','controla a','investiga a','supervisado por','denuncia a','traiciona a'],
    Entidad:   ['dirigido por','presidida por','alberga a','financia a','regula a','supervisa','coordina con','controla','integrada por','avalada por','impugna a','protege a','investiga a','acusa a','defiende a','responde ante','administrada por'],
    Evento:    ['protagonizado por','resulto en','disputado por','dirigida contra','provocada por','avalado por','antecedente de','consecuencia de','relacionado con','organizado por','financiado por','afecto a','suspendio a','genero'],
    Evidencia: ['vincula a','contradice a','confirma a','presentada por','obtenida de','referencia a','incrimina a','exonera a','apoya a','refuta a'],
    Biblioteca:['analiza a','referencia a','critica a','apoya a','publicada por','escrita por','cita a','contradice a','complementa a'],
    Territorio:['incluye a','gobernado por','disputado por','fronterizo con','sede de','afectado por','habitado por','administrado por'],
    Fuente:    ['publicó sobre','citó a','critico a','defende a','investigó a','financiada por','aliada de','reporto sobre','cubre a'],
  };
  const tipoVerbs = VERBS_BY_TIPO[catKey] || [];
  const allVerbs = [...new Set([...tipoVerbs, ...verbLibrary])];

  // Mapa de uuid → { name, tipo } para mostrar nombres en relaciones existentes
  const [relNamesMap, setRelNamesMap] = useState({});

  // Cargar relaciones existentes al abrir (solo universe) + resolver nombres
  useEffect(() => {
    if (!isUniverse || !item._sourceId) return;
    setRelationsLoading(true);
    supabase
      .from('codex_relations')
      .select('*')
      .or(`subject_id.eq.${item._sourceId},object_id.eq.${item._sourceId}`)
      .order('created_at', { ascending: false })
      .then(async ({ data: rels }) => {
        const loaded = rels || [];
        setRelations(loaded);
        // Recopilar todos los UUIDs del otro extremo para resolver nombres
        const otherIds = [...new Set(loaded.map(r =>
          r.subject_id === item._sourceId ? r.object_id : r.subject_id
        ))];
        if (otherIds.length > 0) {
          const { data: others } = await supabase
            .from('codex_universe_items')
            .select('id, name, tipo')
            .in('id', otherIds);
          const map = {};
          (others || []).forEach(o => { map[o.id] = { name: o.name, tipo: o.tipo }; });
          setRelNamesMap(map);
        }
        setRelationsLoading(false);
      });
  }, [isUniverse, item._sourceId]);

  // Búsqueda de objeto destino (debounced)
  useEffect(() => {
    if (!newObjSearch.trim() || newObjSearch.trim().length < 2) {
      setNewObjResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingObj(true);
      const { data } = await supabase
        .from('codex_universe_items')
        .select('id, name, tipo')
        .ilike('name', `%${newObjSearch.trim()}%`)
        .neq('id', item._sourceId || '')
        .limit(8);
      setNewObjResults(data || []);
      setSearchingObj(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [newObjSearch, item._sourceId]);

  const handleAddRelation = async () => {
    if (!newVerb || !newObjTarget || !item._sourceId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: newRel, error } = await supabase
      .from('codex_relations')
      .insert({ user_id: user.id, subject_id: item._sourceId, verb: newVerb, object_id: newObjTarget.id })
      .select()
      .single();
    if (!error && newRel) {
      setRelations(prev => [newRel, ...prev]);
      // Agregar el nombre del objeto al mapa
      setRelNamesMap(prev => ({
        ...prev,
        [newObjTarget.id]: { name: newObjTarget.name, tipo: newObjTarget.tipo },
      }));
      setNewVerb(''); setNewObjTarget(null); setNewObjSearch(''); setNewObjResults([]);
      setShowVerbPicker(false);
    }
  };

  const handleDeleteRelation = async (relId) => {
    const { error } = await supabase.from('codex_relations').delete().eq('id', relId);
    if (!error) setRelations(prev => prev.filter(r => r.id !== relId));
  };

  // Resuelve el nombre del otro extremo de la relación
  const getOtherSide = (rel) => {
    // subject_id es el item actual → objeto es object_id, y viceversa
    if (rel.subject_id === item._sourceId) {
      return { direction: 'out', otherId: rel.object_id };
    }
    return { direction: 'in', otherId: rel.subject_id };
  };

  const updateField = (id, value) =>
    setExtraFields(prev => prev.map(f => f.id === id ? { ...f, value } : f));
  const removeField = (id) =>
    setExtraFields(prev => prev.filter(f => f.id !== id));
  const addPreset = (label, type) => {
    if (extraFields.find(f => f.label === label)) return;
    setExtraFields(prev => [...prev, { id: `f_${label}_${Date.now()}`, label, type, value: '' }]);
    setShowAddMenu(false);
  };
  const addCustomField = () => {
    const l = customLabel.trim();
    if (!l) return;
    if (extraFields.find(f => f.label === l)) return;
    setExtraFields(prev => [...prev, { id: `f_${l}_${Date.now()}`, label: l, type: customType, value: '' }]);
    setCustomLabel('');
    setShowCustomInput(false);
    setShowAddMenu(false);
  };

  const unusedPresets = (EDIT_PRESETS[catKey] || []).filter(
    p => !extraFields.find(f => f.label === p.label)
  );

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Serializar campos como { label: value }
      const stringFields = Object.fromEntries(extraFields.map(f => [f.label, f.value]));

      let error;
      if (isUniverse) {
        // Preservar claves internas de tipo objeto/array (consulta_history, research, etc.)
        const systemFields = Object.fromEntries(
          Object.entries(item.metadata?.details || {}).filter(([, v]) => typeof v === 'object' && v !== null)
        );
        ({ error } = await supabase.from('codex_universe_items').update({
          name: name.trim(),
          description: description.trim() || null,
          tags,
          details: { ...systemFields, ...stringFields },
          updated_at: new Date().toISOString(),
        }).eq('id', item._sourceId));
      } else {
        // wiki_items: preservar claves internas del metadata (research, avatar, etc.)
        const systemFields = Object.fromEntries(
          Object.entries(item.metadata || {}).filter(([, v]) => typeof v === 'object' && v !== null)
        );
        ({ error } = await supabase.from('wiki_items').update({
          name: name.trim(),
          description: description.trim() || null,
          relevance_score: relevance,
          tags,
          metadata: { ...systemFields, ...stringFields },
        }).eq('id', item.id));
      }

      if (error) throw error;

      const newStringFields = Object.fromEntries(extraFields.map(f => [f.label, f.value]));
      onSuccess?.({
        ...item,
        name: name.trim(),
        description: description.trim() || null,
        ...(isUniverse ? {} : { relevance_score: relevance }),
        tags,
        metadata: isUniverse
          ? { ...item.metadata, details: { ...(item.metadata?.details || {}), ...newStringFields } }
          : { ...item.metadata, ...newStringFields },
      });
    } catch (e) {
      setSaveError(e.message || 'Error al guardar');
      setSaving(false);
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) { setTags([...tags, t]); setTagInput(''); }
  };
  const removeTag = (tag) => setTags(tags.filter(t => t !== tag));

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        {/* Overlay oscuro que cubre toda la pantalla incluyendo el tab bar */}
        <Pressable
          style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' }}
          onPress={onClose}
        />

        {/* Sheet — no toca el borde inferior de pantalla */}
        <View style={{
          backgroundColor: '#0a0c1b',
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
          maxHeight: '92%',
          // Eleva el sheet sobre el tab bar nativo
          overflow: 'hidden',
        }}>
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' }} />
          </View>

          {/* Header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 22, paddingTop: 10, paddingBottom: 14,
            borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              {catKey ? (
                <View style={{ backgroundColor: catColors.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: catColors.border }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: catColors.text }}>{catKey}</Text>
                </View>
              ) : null}
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>Editar</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}
              activeOpacity={0.75}
            >
              <X size={15} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          {/* Scroll — sin los botones de acción adentro */}
          <ScrollView
            contentContainerStyle={{ padding: 22, paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
              {/* Nombre */}
              <Text style={editStyles.sectionLabel}>NOMBRE</Text>
              <View style={editStyles.inputWrapper}>
                <TextInput
                  style={editStyles.input}
                  placeholder="Nombre del item"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              {/* Descripción */}
              <Text style={editStyles.sectionLabel}>DESCRIPCIÓN</Text>
              <View style={editStyles.textareaWrapper}>
                <TextInput
                  style={editStyles.textarea}
                  placeholder="Descripción o resumen"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={5}
                />
              </View>

              {/* ── Campos dinámicos ── */}
              <Text style={editStyles.sectionLabel}>DETALLES</Text>

              {extraFields.map(f => (
                <View key={f.id} style={{ marginBottom: 10 }}>
                  {/* Label row con badge de tipo y botón eliminar */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <View style={{ backgroundColor: 'rgba(99,102,241,0.12)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)' }}>
                      <Text style={{ fontSize: 9, color: '#a5b4fc', fontWeight: '700' }}>
                        {FIELD_TYPE_ICONS[f.type]} {f.type}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600', flex: 1 }}>{f.label}</Text>
                    <TouchableOpacity onPress={() => removeField(f.id)} style={{ padding: 4 }} activeOpacity={0.7}>
                      <X size={12} color="rgba(255,255,255,0.3)" />
                    </TouchableOpacity>
                  </View>

                  {/* Input según tipo */}
                  {f.type === 'booleano' ? (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {['Si', 'No'].map(opt => (
                        <TouchableOpacity
                          key={opt}
                          onPress={() => updateField(f.id, opt)}
                          activeOpacity={0.75}
                          style={{
                            paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8, borderWidth: 1,
                            backgroundColor: f.value === opt ? 'rgba(99,102,241,0.25)' : 'transparent',
                            borderColor: f.value === opt ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)',
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '700', color: f.value === opt ? '#a5b4fc' : 'rgba(255,255,255,0.4)' }}>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <View style={editStyles.inputWrapper}>
                      <TextInput
                        style={editStyles.input}
                        placeholder={f.type === 'fecha' ? 'YYYY-MM-DD' : f.type === 'link' ? 'https://' : f.type === 'numero' ? '0' : f.label + '...'}
                        placeholderTextColor="rgba(255,255,255,0.25)"
                        value={f.value}
                        onChangeText={v => updateField(f.id, v)}
                        keyboardType={f.type === 'numero' ? 'numeric' : 'default'}
                        autoCapitalize={f.type === 'link' ? 'none' : 'sentences'}
                      />
                    </View>
                  )}
                </View>
              ))}

              {/* Botón agregar detalle */}
              <TouchableOpacity
                onPress={() => { setShowAddMenu(p => !p); setShowCustomInput(false); }}
                activeOpacity={0.75}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  paddingHorizontal: 14, paddingVertical: 9,
                  borderRadius: 10, borderWidth: 1,
                  borderStyle: 'dashed', borderColor: 'rgba(99,102,241,0.4)',
                  alignSelf: 'flex-start', marginTop: 4,
                }}
              >
                <Plus size={13} color="#a5b4fc" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#a5b4fc' }}>Agregar detalle</Text>
              </TouchableOpacity>

              {/* Menú presets + campo personalizado */}
              {showAddMenu && (
                <View style={{
                  marginTop: 8, borderRadius: 12, borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(15,17,35,0.98)',
                  overflow: 'hidden',
                }}>
                  {/* Presets del tipo */}
                  {unusedPresets.length > 0 && (
                    <>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 }}>
                        PRESETS PARA {catKey?.toUpperCase() || 'ESTE TIPO'}
                      </Text>
                      {unusedPresets.map(p => (
                        <TouchableOpacity
                          key={p.label}
                          onPress={() => addPreset(p.label, p.type)}
                          activeOpacity={0.7}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.04)' }}
                        >
                          <Text style={{ fontSize: 11, color: '#a5b4fc', width: 16, textAlign: 'center' }}>{FIELD_TYPE_ICONS[p.type]}</Text>
                          <Text style={{ fontSize: 13, color: '#fff', flex: 1 }}>{p.label}</Text>
                          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{p.type}</Text>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}

                  {/* Campo personalizado */}
                  <Text style={{ fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.3)', letterSpacing: 0.8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 }}>
                    CAMPO PERSONALIZADO
                  </Text>
                  {!showCustomInput ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingBottom: 10, gap: 6 }}>
                      {FIELD_TYPES.map(ft => (
                        <TouchableOpacity
                          key={ft}
                          onPress={() => { setCustomType(ft); setShowCustomInput(true); }}
                          activeOpacity={0.75}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)' }}
                        >
                          <Text style={{ fontSize: 11, color: '#a5b4fc' }}>{FIELD_TYPE_ICONS[ft]}</Text>
                          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{ft}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                        Nombre del campo ({customType}):
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, height: 38, justifyContent: 'center' }}>
                          <TextInput
                            style={{ color: '#fff', fontSize: 13 }}
                            placeholder="Ej: Número de caso"
                            placeholderTextColor="rgba(255,255,255,0.25)"
                            value={customLabel}
                            onChangeText={setCustomLabel}
                            autoFocus
                            onSubmitEditing={addCustomField}
                            returnKeyType="done"
                          />
                        </View>
                        <TouchableOpacity
                          onPress={addCustomField}
                          style={{ paddingHorizontal: 14, height: 38, borderRadius: 8, backgroundColor: 'rgba(99,102,241,0.3)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.5)', alignItems: 'center', justifyContent: 'center' }}
                          activeOpacity={0.8}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#a5b4fc' }}>Añadir</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Relevancia (solo wiki_items) */}
              {!isUniverse && (
                <>
                  <Text style={editStyles.sectionLabel}>RELEVANCIA</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 2 }}>
                    <TouchableOpacity onPress={() => setRelevance(r => Math.max(0, r - 5))} style={editStyles.stepperBtn} activeOpacity={0.75}>
                      <Text style={editStyles.stepperBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff', minWidth: 40, textAlign: 'center' }}>{relevance}</Text>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '600' }}>/100</Text>
                    <TouchableOpacity onPress={() => setRelevance(r => Math.min(100, r + 5))} style={editStyles.stepperBtn} activeOpacity={0.75}>
                      <Text style={editStyles.stepperBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Etiquetas */}
              <Text style={editStyles.sectionLabel}>ETIQUETAS</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, height: 44, justifyContent: 'center' }}>
                  <TextInput
                    style={{ color: '#fff', fontSize: 13 }}
                    placeholder="Nueva etiqueta"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={tagInput}
                    onChangeText={setTagInput}
                    onSubmitEditing={addTag}
                    returnKeyType="done"
                  />
                </View>
                <TouchableOpacity onPress={addTag} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(99,102,241,0.2)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.4)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.75}>
                  <Plus size={18} color="#a5b4fc" />
                </TouchableOpacity>
              </View>
              {tags.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {tags.map((tag, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>{tag}</Text>
                      <TouchableOpacity onPress={() => removeTag(tag)} style={{ padding: 2 }} activeOpacity={0.7}>
                        <X size={11} color="rgba(255,255,255,0.4)" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* ── Relaciones semánticas (solo universe items) ── */}
              {isUniverse && (
                <>
                  <Text style={editStyles.sectionLabel}>RELACIONES</Text>

                  {/* Relaciones existentes */}
                  {relationsLoading ? (
                    <ActivityIndicator size="small" color="rgba(99,102,241,0.6)" style={{ alignSelf: 'flex-start', marginBottom: 10 }} />
                  ) : relations.length > 0 ? (
                    <View style={{ gap: 6, marginBottom: 8 }}>
                      {relations.map(rel => {
                        const { direction, otherId } = getOtherSide(rel);
                        const otherInfo = relNamesMap[otherId];
                        const otherName = otherInfo?.name || '…';
                        const otherTipo = normalizeSubcategory(otherInfo?.tipo || '');
                        const otherColors = WIKI_CATEGORY_COLORS[otherTipo] || { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.12)', text: 'rgba(255,255,255,0.5)' };
                        const subjectName = direction === 'out' ? item.name : otherName;
                        const objectName  = direction === 'out' ? otherName : item.name;
                        return (
                          <View key={rel.id} style={{
                            backgroundColor: 'rgba(255,255,255,0.04)',
                            borderRadius: 10, borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.08)',
                            padding: 10,
                          }}>
                            {/* Frase: [Sujeto] verbo [Objeto] */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, flex: 1 }}>
                              <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }} numberOfLines={1}>{subjectName}</Text>
                              <Text style={{ fontSize: 12, fontStyle: 'italic', color: '#fcd34d' }}>{rel.verb}</Text>
                              <Text style={{ fontSize: 12, fontWeight: '800', color: '#a5b4fc' }} numberOfLines={1}>{objectName}</Text>
                              {otherTipo ? (
                                <View style={{ backgroundColor: otherColors.bg, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: otherColors.border }}>
                                  <Text style={{ fontSize: 9, fontWeight: '700', color: otherColors.text }}>{otherTipo}</Text>
                                </View>
                              ) : null}
                              {/* Botón eliminar alineado al final */}
                              <TouchableOpacity
                                onPress={() => handleDeleteRelation(rel.id)}
                                style={{ marginLeft: 'auto', padding: 4 }}
                                activeOpacity={0.7}
                              >
                                <X size={13} color="rgba(239,68,68,0.5)" />
                              </TouchableOpacity>
                            </View>
                            {rel.note ? (
                              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }} numberOfLines={2}>{rel.note}</Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginBottom: 10 }}>
                      Sin relaciones aún
                    </Text>
                  )}

                  {/* ── Agregar nueva relación ── */}
                  <View style={{
                    backgroundColor: 'rgba(99,102,241,0.06)',
                    borderRadius: 12, borderWidth: 1,
                    borderColor: 'rgba(99,102,241,0.2)',
                    padding: 12,
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(99,102,241,0.7)', letterSpacing: 0.6, marginBottom: 10 }}>
                      + NUEVA RELACIÓN
                    </Text>

                    {/* Fila: [este item] — [VERBO] — [OBJETO] */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {/* Nombre del item actual */}
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }} numberOfLines={1}>
                        {item.name}
                      </Text>

                      {/* Picker de verbo */}
                      <TouchableOpacity
                        onPress={() => setShowVerbPicker(p => !p)}
                        activeOpacity={0.8}
                        style={{
                          paddingHorizontal: 10, paddingVertical: 5,
                          borderRadius: 8, borderWidth: 1,
                          borderStyle: newVerb ? 'solid' : 'dashed',
                          borderColor: newVerb ? 'rgba(252,211,77,0.5)' : 'rgba(255,255,255,0.2)',
                          backgroundColor: newVerb ? 'rgba(252,211,77,0.08)' : 'transparent',
                        }}
                      >
                        <Text style={{ fontSize: 12, fontStyle: 'italic', color: newVerb ? '#fcd34d' : 'rgba(255,255,255,0.35)' }}>
                          {newVerb || 'verbo…'}
                        </Text>
                      </TouchableOpacity>

                      {/* Objeto: input de búsqueda o nombre seleccionado */}
                      {newObjTarget ? (
                        <TouchableOpacity
                          onPress={() => { setNewObjTarget(null); setNewObjSearch(''); setNewObjResults([]); }}
                          style={{
                            paddingHorizontal: 10, paddingVertical: 5,
                            borderRadius: 8, borderWidth: 1,
                            borderColor: 'rgba(165,180,252,0.4)',
                            backgroundColor: 'rgba(99,102,241,0.12)',
                            flexDirection: 'row', alignItems: 'center', gap: 5,
                          }}
                          activeOpacity={0.75}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#a5b4fc' }} numberOfLines={1}>{newObjTarget.name}</Text>
                          <X size={10} color="rgba(165,180,252,0.5)" />
                        </TouchableOpacity>
                      ) : (
                        <View style={{
                          flex: 1, minWidth: 100,
                          backgroundColor: 'rgba(255,255,255,0.06)',
                          borderRadius: 8, borderWidth: 1,
                          borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.15)',
                          paddingHorizontal: 10, height: 32, justifyContent: 'center',
                        }}>
                          <TextInput
                            style={{ color: '#fff', fontSize: 12 }}
                            placeholder="buscar objeto…"
                            placeholderTextColor="rgba(255,255,255,0.25)"
                            value={newObjSearch}
                            onChangeText={setNewObjSearch}
                          />
                        </View>
                      )}

                      {/* Botón confirmar */}
                      {newVerb && newObjTarget && (
                        <TouchableOpacity
                          onPress={handleAddRelation}
                          style={{
                            width: 32, height: 32, borderRadius: 16,
                            backgroundColor: 'rgba(99,102,241,0.4)',
                            borderWidth: 1, borderColor: 'rgba(99,102,241,0.6)',
                            alignItems: 'center', justifyContent: 'center',
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={{ fontSize: 16, color: '#fff', lineHeight: 20 }}>✓</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Dropdown verbo */}
                    {showVerbPicker && (
                      <View style={{
                        marginTop: 8, borderRadius: 10, borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.1)',
                        backgroundColor: 'rgba(10,12,27,0.99)',
                        maxHeight: 200, overflow: 'hidden',
                      }}>
                        <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                          {/* Verbos del tipo */}
                          {allVerbs.map(v => (
                            <TouchableOpacity
                              key={v}
                              onPress={() => { setNewVerb(v); setShowVerbPicker(false); }}
                              activeOpacity={0.7}
                              style={{
                                paddingHorizontal: 14, paddingVertical: 9,
                                borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
                                backgroundColor: newVerb === v ? 'rgba(252,211,77,0.08)' : 'transparent',
                              }}
                            >
                              <Text style={{ fontSize: 13, fontStyle: 'italic', color: newVerb === v ? '#fcd34d' : 'rgba(255,255,255,0.65)' }}>{v}</Text>
                            </TouchableOpacity>
                          ))}
                          {/* Verbo personalizado */}
                          <View style={{ flexDirection: 'row', gap: 6, padding: 10, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, paddingHorizontal: 10, height: 34, justifyContent: 'center' }}>
                              <TextInput
                                style={{ color: '#fff', fontSize: 12 }}
                                placeholder="Verbo personalizado…"
                                placeholderTextColor="rgba(255,255,255,0.25)"
                                value={customVerb}
                                onChangeText={setCustomVerb}
                                onSubmitEditing={() => {
                                  if (customVerb.trim()) {
                                    setVerbLibrary(prev => [...new Set([...prev, customVerb.trim()])]);
                                    setNewVerb(customVerb.trim());
                                    setCustomVerb('');
                                    setShowVerbPicker(false);
                                  }
                                }}
                                returnKeyType="done"
                              />
                            </View>
                          </View>
                        </ScrollView>
                      </View>
                    )}

                    {/* Resultados búsqueda objeto */}
                    {newObjSearch.trim().length >= 2 && !newObjTarget && (
                      <View style={{
                        marginTop: 6, borderRadius: 10, borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.1)',
                        backgroundColor: 'rgba(10,12,27,0.99)',
                        overflow: 'hidden',
                      }}>
                        {searchingObj ? (
                          <ActivityIndicator size="small" color="rgba(99,102,241,0.6)" style={{ margin: 12 }} />
                        ) : newObjResults.length === 0 ? (
                          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', padding: 12 }}>Sin resultados</Text>
                        ) : newObjResults.map(r => {
                          const rCatKey = normalizeSubcategory(r.tipo);
                          const rColors = WIKI_CATEGORY_COLORS[rCatKey] || { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.15)', text: 'rgba(255,255,255,0.6)' };
                          return (
                            <TouchableOpacity
                              key={r.id}
                              onPress={() => { setNewObjTarget(r); setNewObjSearch(''); setNewObjResults([]); }}
                              activeOpacity={0.7}
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.04)' }}
                            >
                              <Text style={{ fontSize: 13, color: '#fff', flex: 1 }} numberOfLines={1}>{r.name}</Text>
                              <View style={{ backgroundColor: rColors.bg, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: rColors.border }}>
                                <Text style={{ fontSize: 9, fontWeight: '700', color: rColors.text }}>{rCatKey || r.tipo}</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </>
              )}

              {/* Error */}
              {saveError ? (
                <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
                  <Text style={{ fontSize: 13, color: '#f87171', lineHeight: 18 }}>{saveError}</Text>
                </View>
              ) : null}
            </ScrollView>

          {/* Botones sticky — fuera del scroll, respetan safe area */}
          <View style={{
            flexDirection: 'row', gap: 10,
            paddingHorizontal: 22,
            paddingTop: 12,
            paddingBottom: bottomInset > 0 ? bottomInset : 20,
            borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
            backgroundColor: '#0a0c1b',
          }}>
            <TouchableOpacity
              onPress={onClose}
              style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}
              activeOpacity={0.75}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.6)' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || !name.trim()}
              style={{
                flex: 1.4, height: 48, borderRadius: 12,
                backgroundColor: (saving || !name.trim()) ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.85)',
                borderWidth: 1, borderColor: 'rgba(99,102,241,0.5)',
                alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
              }}
              activeOpacity={0.8}
            >
              {saving && <ActivityIndicator size="small" color="#a5b4fc" />}
              <Text style={{ fontSize: 15, fontWeight: '700', color: (saving || !name.trim()) ? 'rgba(255,255,255,0.4)' : '#fff' }}>
                Guardar Cambios
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const editStyles = {
  sectionLabel: {
    fontSize: 11, fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.8,
    marginBottom: 8, marginTop: 18,
  },
  inputWrapper: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    height: 48,
    justifyContent: 'center',
  },
  input: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  textareaWrapper: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    minHeight: 100,
  },
  textarea: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  stepperBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(99,102,241,0.2)',
    borderWidth: 1, borderColor: 'rgba(99,102,241,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepperBtnText: {
    color: '#a5b4fc', fontSize: 20, fontWeight: '700', lineHeight: 22,
  },
};

// ── Wiki Item Detail Modal ─────────────────────────────────────────────────────

function WikiSearchModal({ item, onClose, onAvatarUpdate, onEdit }) {
  const catKey = normalizeSubcategory(item.subcategory);
  const catColors = WIKI_CATEGORY_COLORS[catKey] || { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.15)', text: 'rgba(255,255,255,0.6)' };
  const isActor = catKey === 'Actor';

  const [localAvatar, setLocalAvatar] = useState(item.metadata?.avatar ?? null);
  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false);
  const [localResearch, setLocalResearch] = useState(item.metadata?.research || {});

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
                {onEdit && (
                  <TouchableOpacity
                    onPress={() => onEdit(item)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 14, paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: 'rgba(99,102,241,0.2)',
                      borderWidth: 1, borderColor: 'rgba(99,102,241,0.45)',
                      marginLeft: 8,
                    }}
                    activeOpacity={0.75}
                  >
                    <Pencil size={13} color="#a5b4fc" />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#a5b4fc' }}>Editar</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={onClose} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}>
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

              {/* Investigación guardada */}
              {hasSavedResearch && (
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

              {/* Tags */}
              {item.tags?.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {item.tags.map((tag, i) => (
                    <View key={i} style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '600' }}>{tag}</Text>
                    </View>
                  ))}
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

// ── Helpers de color (definidos antes de los componentes) ─────────────────────
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Paleta de colores para carpetas ──────────────────────────────────────────
const FOLDER_COLORS = [
  { hex: '#E1306C', label: 'Rosa' },
  { hex: '#6366F1', label: 'Índigo' },
  { hex: '#10B981', label: 'Verde' },
  { hex: '#F59E0B', label: 'Ámbar' },
  { hex: '#3B82F6', label: 'Azul' },
  { hex: '#8B5CF6', label: 'Violeta' },
  { hex: '#EF4444', label: 'Rojo' },
  { hex: '#EC4899', label: 'Pink' },
];

// ── FolderCard: réplica fiel del componente 3D web ───────────────────────────
// Estructura: back layer → tab → project cards flotantes → front layer → shine
function FolderCard({ folder, postCount, previewThumbs = [], onPress, onLongPress }) {
  const openAnim = useRef(new Animated.Value(0)).current; // 0=cerrado, 1=abierto
  const cardScaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(openAnim, {
        toValue: 1, useNativeDriver: true,
        tension: 60, friction: 8,
      }),
      Animated.spring(cardScaleAnim, {
        toValue: 0.97, useNativeDriver: true,
        tension: 80, friction: 10,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(openAnim, {
        toValue: 0, useNativeDriver: true,
        tension: 60, friction: 10,
      }),
      Animated.spring(cardScaleAnim, {
        toValue: 1, useNativeDriver: true,
        tension: 80, friction: 10,
      }),
    ]).start();
  };

  const accent = folder.color || '#E1306C';

  // ── Rotaciones 3D de las capas (simulando perspective rotateX) ──
  // Back: rota hacia arriba (negativo en mobile = inclinación hacia arriba)
  const backRotateX = openAnim.interpolate({
    inputRange: [0, 1], outputRange: ['0deg', '-18deg'],
  });
  // Tab: igual pero más pronunciado
  const tabRotateX = openAnim.interpolate({
    inputRange: [0, 1], outputRange: ['0deg', '-28deg'],
  });
  const tabTranslateY = openAnim.interpolate({
    inputRange: [0, 1], outputRange: [0, -3],
  });
  // Front: rota hacia abajo y baja un poco
  const frontRotateX = openAnim.interpolate({
    inputRange: [0, 1], outputRange: ['0deg', '28deg'],
  });
  const frontTranslateY = openAnim.interpolate({
    inputRange: [0, 1], outputRange: [0, 10],
  });

  // ── Project cards salen disparadas ──
  const thumbs = previewThumbs.slice(0, 3);
  // Web: translateY(-90px), translateX(-55/0/55px), rotate(-12/0/12deg)
  const cardTranslations = [-50, 0, 50];
  const cardRotations = ['-14deg', '0deg', '14deg'];
  const cardDelays = [0, 80, 160]; // ms de stagger

  // Creamos 3 valores animados para los project cards
  const cardAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const handlePressInFull = () => {
    handlePressIn();
    // Stagger cards: each starts slightly after the previous
    cardAnims.forEach((anim, i) => {
      Animated.delay = cardDelays[i];
      Animated.spring(anim, {
        toValue: 1, useNativeDriver: true,
        tension: 55, friction: 7,
        delay: cardDelays[i],
      }).start();
    });
  };

  const handlePressOutFull = () => {
    handlePressOut();
    cardAnims.forEach((anim) => {
      Animated.spring(anim, {
        toValue: 0, useNativeDriver: true,
        tension: 60, friction: 10,
      }).start();
    });
  };

  // Dimensiones de la zona del folder
  const FOLDER_W = 128;
  const FOLDER_H = 96;
  const CARD_W = 56;
  const CARD_H = 72;

  return (
    <Animated.View style={{ transform: [{ scale: cardScaleAnim }], flex: 1, margin: 5 }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressInFull}
        onPressOut={handlePressOutFull}
        style={{
          borderRadius: 20,
          borderWidth: 1,
          borderColor: hexToRgba(accent, 0.28),
          minHeight: 168,
          alignItems: 'center',
          overflow: 'hidden',
          paddingBottom: 16,
          paddingTop: 12,
        }}
      >
        {/* Fondo card neutro — el accent solo en borde y tab, no compite con el fondo */}
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(255,255,255,0.6)',
          borderRadius: 20,
        }} />
        <LinearGradient
          colors={['rgba(255,255,255,0.03)', 'rgba(0,0,0,0.12)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20 }}
        />

        {/* ── Zona del folder 3D ── */}
        <View style={{
          width: FOLDER_W + 40,
          height: FOLDER_H + 36,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 10,
        }}>

          {/* ── FOLDER BACK LAYER ── */}
          <Animated.View style={{
            position: 'absolute',
            width: FOLDER_W, height: FOLDER_H,
            backgroundColor: hexToRgba(accent, 0.55),
            borderRadius: 10,
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
            transform: [
              { perspective: 600 },
              { rotateX: backRotateX },
            ],
          }} />

          {/* ── FOLDER TAB (lengüeta esquina sup-izq) ── */}
          <Animated.View style={{
            position: 'absolute',
            width: 44, height: 14,
            backgroundColor: hexToRgba(accent, 0.72),
            borderTopLeftRadius: 6, borderTopRightRadius: 6,
            // Posición: borde-izq del folder + 16px (igual que el original web)
            top: '50%',
            left: '50%',
            marginTop: -(FOLDER_H / 2) - 13,
            marginLeft: -(FOLDER_W / 2) + 16,
            transform: [
              { perspective: 600 },
              { rotateX: tabRotateX },
              { translateY: tabTranslateY },
            ],
          }} />

          {/* ── PROJECT CARDS (flotan entre back y front) ── */}
          {thumbs.length > 0 ? (
            thumbs.map((uri, i) => {
              const cardTranslateY = cardAnims[i].interpolate({
                inputRange: [0, 1], outputRange: [0, -52],
              });
              const cardTranslateX = cardAnims[i].interpolate({
                inputRange: [0, 1], outputRange: [0, cardTranslations[i]],
              });
              const cardOpacity = cardAnims[i].interpolate({
                inputRange: [0, 0.2, 1], outputRange: [0, 0.8, 1],
              });
              const cardScale = cardAnims[i].interpolate({
                inputRange: [0, 1], outputRange: [0.5, 1],
              });
              return (
                <Animated.View
                  key={i}
                  style={{
                    position: 'absolute',
                    width: CARD_W, height: CARD_H,
                    borderRadius: 8,
                    overflow: 'hidden',
                    borderWidth: 1.5,
                    borderColor: 'rgba(28,43,34,0.09)',
                    shadowColor: '#000',
                    shadowOpacity: 0.45,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 6,
                    zIndex: 20 + i,
                    opacity: cardOpacity,
                    transform: [
                      { translateY: cardTranslateY },
                      { translateX: cardTranslateX },
                      { rotate: cardRotations[i] },
                      { scale: cardScale },
                    ],
                  }}
                >
                  <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.62)']}
                    style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%' }}
                  />
                </Animated.View>
              );
            })
          ) : (
            // Empty folder — líneas de documento
            <Animated.View style={{
              position: 'absolute',
              zIndex: 20,
              opacity: cardAnims[0].interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            }}>
              <View style={{
                width: CARD_W, height: CARD_H, borderRadius: 8,
                backgroundColor: hexToRgba(accent, 0.1),
                borderWidth: 1.5, borderColor: hexToRgba(accent, 0.22),
                borderStyle: 'dashed',
                alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <View style={{ width: 22, height: 2.5, backgroundColor: hexToRgba(accent, 0.4), borderRadius: 2 }} />
                <View style={{ width: 16, height: 2.5, backgroundColor: hexToRgba(accent, 0.25), borderRadius: 2 }} />
                <View style={{ width: 19, height: 2.5, backgroundColor: hexToRgba(accent, 0.18), borderRadius: 2 }} />
              </View>
            </Animated.View>
          )}

          {/* ── FOLDER FRONT LAYER ── */}
          <Animated.View style={{
            position: 'absolute',
            width: FOLDER_W, height: FOLDER_H,
            backgroundColor: hexToRgba(accent, 0.78),
            borderRadius: 10,
            top: '50%',
            marginTop: -(FOLDER_H / 2) + 4,
            shadowColor: '#000',
            shadowOpacity: 0.35,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
            zIndex: 30,
            transform: [
              { perspective: 600 },
              { rotateX: frontRotateX },
              { translateY: frontTranslateY },
            ],
          }}>
            {/* Shine: gradiente diagonal encima de la tapa */}
            <LinearGradient
              colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0.06)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                borderRadius: 10,
              }}
            />
          </Animated.View>

        </View>

        {/* ── Nombre + count ── */}
        <Animated.Text
          numberOfLines={1}
          style={{
            fontSize: 13.5, fontWeight: '700', color: INK.title,
            textAlign: 'center', letterSpacing: -0.2,
            paddingHorizontal: 12,
            transform: [{ translateY: openAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }) }],
          }}
        >
          {folder.name}
        </Animated.Text>

        <Text style={{
          fontSize: 11, fontWeight: '600', marginTop: 3,
          color: hexToRgba(accent, 0.8),
          textAlign: 'center',
        }}>
          {postCount} post{postCount !== 1 ? 's' : ''}
        </Text>

        {/* Hint "mantén para eliminar" — solo visible en reposo, se oculta al presionar */}
        <Animated.Text style={{
          position: 'absolute', bottom: 8,
          fontSize: 10, color: hexToRgba(accent, 0.45),
          fontWeight: '500', letterSpacing: 0.2,
          opacity: openAnim.interpolate({ inputRange: [0, 0.3], outputRange: [1, 0] }),
        }}>
          mantén para eliminar
        </Animated.Text>

      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Carpeta "Todos los posts" (misma estructura 3D pero con grid de colores) ──
function AllPostsFolder({ count, onPress }) {
  const openAnim = useRef(new Animated.Value(0)).current;
  const cardScaleAnim = useRef(new Animated.Value(1)).current;

  const FOLDER_W = 128;
  const FOLDER_H = 96;

  const accent = '#6366F1'; // indigo fijo para "Todos"

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(openAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
      Animated.spring(cardScaleAnim, { toValue: 0.97, useNativeDriver: true, tension: 80, friction: 10 }),
    ]).start();
  };
  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(openAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
      Animated.spring(cardScaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }),
    ]).start();
  };

  const backRotateX = openAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-18deg'] });
  const tabRotateX = openAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-28deg'] });
  const tabTranslateY = openAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const frontRotateX = openAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '28deg'] });
  const frontTranslateY = openAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 10] });

  // 4 mini-bloques de colores salen en abanico
  const miniAnims = useRef([0,1,2,3].map(() => new Animated.Value(0))).current;
  const miniTargets = [
    { x: -28, y: -38, rot: '-18deg', color: 'rgba(99,102,241,0.85)' },
    { x: 12,  y: -46, rot: '6deg',   color: 'rgba(225,48,108,0.85)' },
    { x: -10, y: -40, rot: '-6deg',  color: 'rgba(16,185,129,0.85)' },
    { x: 28,  y: -34, rot: '18deg',  color: 'rgba(245,158,11,0.85)' },
  ];

  const handlePressInFull = () => {
    handlePressIn();
    miniAnims.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: 1, useNativeDriver: true,
        tension: 55, friction: 7,
        delay: i * 60,
      }).start();
    });
  };
  const handlePressOutFull = () => {
    handlePressOut();
    miniAnims.forEach((anim) => {
      Animated.spring(anim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();
    });
  };

  return (
    <Animated.View style={{ transform: [{ scale: cardScaleAnim }], flex: 1, margin: 5 }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressInFull}
        onPressOut={handlePressOutFull}
        style={{
          borderRadius: 20, borderWidth: 1,
          borderColor: 'rgba(99,102,241,0.28)',
          minHeight: 168, alignItems: 'center',
          overflow: 'hidden', paddingBottom: 16, paddingTop: 12,
        }}
      >
        {/* Fondo */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 20 }} />
        <LinearGradient
          colors={['rgba(99,102,241,0.16)', 'transparent']}
          start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20 }}
        />

        <View style={{
          width: FOLDER_W + 40, height: FOLDER_H + 36,
          alignItems: 'center', justifyContent: 'center', marginBottom: 10,
        }}>

          {/* Back */}
          <Animated.View style={{
            position: 'absolute', width: FOLDER_W, height: FOLDER_H,
            backgroundColor: 'rgba(99,102,241,0.45)', borderRadius: 10,
            shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 4 },
            transform: [{ perspective: 600 }, { rotateX: backRotateX }],
          }} />

          {/* Tab */}
          <Animated.View style={{
            position: 'absolute', width: 44, height: 14,
            backgroundColor: 'rgba(99,102,241,0.65)',
            borderTopLeftRadius: 6, borderTopRightRadius: 6,
            top: '50%', left: '50%',
            marginTop: -(FOLDER_H / 2) - 13,
            marginLeft: -(FOLDER_W / 2) + 16,
            transform: [{ perspective: 600 }, { rotateX: tabRotateX }, { translateY: tabTranslateY }],
          }} />

          {/* Mini bloques coloreados en abanico */}
          {miniTargets.map((t, i) => {
            const ty = miniAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0, t.y] });
            const tx = miniAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0, t.x] });
            const op = miniAnims[i].interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.6, 1] });
            const sc = miniAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
            return (
              <Animated.View key={i} style={{
                position: 'absolute',
                width: 34, height: 44, borderRadius: 7,
                backgroundColor: t.color,
                borderWidth: 1.5, borderColor: 'rgba(28,43,34,0.09)',
                zIndex: 20 + i,
                shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
                opacity: op,
                transform: [
                  { translateY: ty },
                  { translateX: tx },
                  { rotate: t.rot },
                  { scale: sc },
                ],
              }} />
            );
          })}

          {/* Front */}
          <Animated.View style={{
            position: 'absolute', width: FOLDER_W, height: FOLDER_H,
            backgroundColor: 'rgba(99,102,241,0.72)', borderRadius: 10,
            top: '50%', marginTop: -(FOLDER_H / 2) + 4,
            shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 },
            zIndex: 30,
            transform: [{ perspective: 600 }, { rotateX: frontRotateX }, { translateY: frontTranslateY }],
          }}>
            <LinearGradient
              colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.05)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 10 }}
            />
          </Animated.View>

        </View>

        <Animated.Text style={{
          fontSize: 13.5, fontWeight: '700', color: INK.title,
          textAlign: 'center', letterSpacing: -0.2, paddingHorizontal: 12,
          transform: [{ translateY: openAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }) }],
        }}>
          Todos
        </Animated.Text>
        <Text style={{ fontSize: 11, color: 'rgba(99,102,241,0.85)', marginTop: 3, fontWeight: '600' }}>
          {count} post{count !== 1 ? 's' : ''}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── PostCard: tarjeta de Instagram post/reel/Twitter con transcripción expandible ──
function PostCard({ post, isReel, isTwitter, transcription, thumbUri, onLongPress }) {
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

  // ── Accent color per platform ──
  const accentColor = isTwitter ? 'rgba(29,161,242,0.9)' : 'rgba(225,48,108,0.9)';
  const accentBorder = isTwitter ? 'rgba(29,161,242,0.25)' : isReel ? 'rgba(225,48,108,0.25)' : 'rgba(255,255,255,0.1)';
  const accentSubtle = isTwitter ? 'rgba(29,161,242,0.12)' : 'rgba(225,48,108,0.12)';

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onLongPress={onLongPress}
      delayLongPress={450}
      style={{
        backgroundColor: 'rgba(12,14,28,0.85)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: accentBorder,
        overflow: 'hidden',
        marginBottom: 12,
      }}
    >

      {/* ── Thumbnail ── */}
      {thumbUri ? (
        <View style={{ position: 'relative' }}>
          <Image
            source={{ uri: thumbUri }}
            style={{ width: '100%', height: 200, backgroundColor: 'rgba(255,255,255,0.6)' }}
            resizeMode="cover"
          />
          {/* Gradient overlay bottom */}
          <LinearGradient
            colors={['transparent', 'rgba(12,14,28,0.88)']}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 }}
          />
          {/* Platform badge overlay */}
          <View style={{
            position: 'absolute', top: 10, left: 10,
            flexDirection: 'row', alignItems: 'center', gap: 5,
            backgroundColor: 'rgba(0,0,0,0.55)',
            borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
            borderWidth: 1, borderColor: 'rgba(28,43,34,0.09)',
          }}>
            {isReel && (
              <>
                <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: '#E1306C', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 7, fontWeight: '900', color: '#fff' }}>IG</Text>
                </View>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.3 }}>Reel</Text>
              </>
            )}
            {isTwitter && (
              <Text style={{ fontSize: 12, fontWeight: '900', color: '#fff' }}>𝕏</Text>
            )}
            {!isReel && !isTwitter && (
              <Text style={{ fontSize: 10, fontWeight: '700', color: INK.body }}>Post</Text>
            )}
          </View>
        </View>
      ) : (
        /* No thumbnail — compact platform pill con altura mínima consistente */
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          paddingHorizontal: 14, paddingTop: 14, paddingBottom: 2,
          minHeight: 48,
        }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 5,
            backgroundColor: accentSubtle,
            borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5,
            borderWidth: 1, borderColor: accentBorder,
          }}>
            {isReel && (
              <>
                <View style={{ width: 13, height: 13, borderRadius: 3.5, backgroundColor: '#E1306C', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 7, fontWeight: '900', color: '#fff' }}>IG</Text>
                </View>
                <Text style={{ fontSize: 10, fontWeight: '800', color: INK.title, letterSpacing: 0.3 }}>Reel</Text>
              </>
            )}
            {isTwitter && (
              <Text style={{ fontSize: 11, fontWeight: '900', color: INK.title }}>𝕏</Text>
            )}
            {!isReel && !isTwitter && (
              <Text style={{ fontSize: 10, fontWeight: '700', color: INK.body }}>Post</Text>
            )}
          </View>
        </View>
      )}

      {/* ── Body ── */}
      <View style={{ padding: 14 }}>

        {/* Title + analyze button */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: INK.title, flex: 1, marginRight: 10, lineHeight: 21, letterSpacing: -0.2 }} numberOfLines={2}>
            {post.name}
          </Text>
          <TouchableOpacity
            onPress={handleAnalyze}
            activeOpacity={0.75}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={{
              width: 44, height: 44, borderRadius: 12,
              backgroundColor: analysisOpen ? 'rgba(99,102,241,0.22)' : 'rgba(255,255,255,0.07)',
              borderWidth: 1,
              borderColor: analysisOpen ? 'rgba(99,102,241,0.45)' : 'rgba(255,255,255,0.1)',
              alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {analysisLoading
              ? <ActivityIndicator size="small" color="rgba(99,102,241,0.9)" />
              : <Eye size={15} color={analysisOpen ? 'rgba(99,102,241,0.9)' : 'rgba(255,255,255,0.4)'} />
            }
          </TouchableOpacity>
        </View>

        {/* Description */}
        {post.description ? (
          <Text style={{ fontSize: 13, color: INK.meta, lineHeight: 19, marginBottom: 10, letterSpacing: -0.1 }} numberOfLines={3}>
            {post.description}
          </Text>
        ) : null}

        {/* Tweet metrics — color azul X, diferenciado de texto editorial */}
        {isTwitter && post.details?.tweet_metrics ? (
          <View style={{ flexDirection: 'row', gap: 14, marginBottom: 10 }}>
            {post.details.tweet_metrics.likes > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Heart size={12} color="rgba(249,24,128,0.7)" />
                <Text style={{ fontSize: 11, color: 'rgba(249,24,128,0.7)', fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                  {post.details.tweet_metrics.likes.toLocaleString()}
                </Text>
              </View>
            )}
            {post.details.tweet_metrics.retweets > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Repeat2 size={12} color="rgba(0,186,124,0.8)" />
                <Text style={{ fontSize: 11, color: 'rgba(0,186,124,0.8)', fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                  {post.details.tweet_metrics.retweets.toLocaleString()}
                </Text>
              </View>
            )}
            {post.details.tweet_metrics.replies > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MessageCircle size={12} color="rgba(29,161,242,0.8)" />
                <Text style={{ fontSize: 11, color: 'rgba(29,161,242,0.8)', fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                  {post.details.tweet_metrics.replies.toLocaleString()}
                </Text>
              </View>
            )}
            {post.details.tweet_metrics.views > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Eye size={12} color={INK.faint} />
                <Text style={{ fontSize: 11, color: INK.faint, fontWeight: '500', fontVariant: ['tabular-nums'] }}>
                  {post.details.tweet_metrics.views.toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {/* Date */}
        {date && (
          <Text style={{ fontSize: 11, color: INK.faint, marginBottom: transcription ? 10 : 0, letterSpacing: 0.1 }}>
            {date}
          </Text>
        )}

        {/* ── Transcription + analysis panel ── */}
        {(isReel || isTwitter) && transcription ? (
          <View style={{
            backgroundColor: 'rgba(99,102,241,0.08)',
            borderRadius: 12, padding: 12, marginTop: 4,
            borderWidth: 1, borderColor: 'rgba(99,102,241,0.18)',
          }}>

            {/* Analysis view tabs */}
            {analysisOpen && !analysisLoading && (
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {[
                  { key: 'anotado',    label: 'Transcripción' },
                  { key: 'organizado', label: 'Organizado' },
                ].map(v => (
                  <TouchableOpacity
                    key={v.key}
                    onPress={() => setAnalysisView(v.key)}
                    activeOpacity={0.75}
                    style={{
                      paddingHorizontal: 11, paddingVertical: 6, borderRadius: 8,
                      backgroundColor: analysisView === v.key ? 'rgba(99,102,241,0.28)' : 'rgba(255,255,255,0.05)',
                      borderWidth: 1,
                      borderColor: analysisView === v.key ? 'rgba(99,102,241,0.55)' : 'rgba(255,255,255,0.08)',
                    }}
                  >
                    <Text style={{
                      fontSize: 11, fontWeight: '700',
                      color: analysisView === v.key ? 'rgba(160,162,255,1)' : 'rgba(255,255,255,0.35)',
                    }}>
                      {v.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Loading state */}
            {analysisOpen && analysisLoading && (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <ActivityIndicator color="rgba(99,102,241,0.8)" />
                <Text style={{ fontSize: 11, color: INK.faint, marginTop: 8 }}>Analizando contenido…</Text>
              </View>
            )}

            {/* Error state */}
            {analysisOpen && !analysisLoading && analysisData?.error && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                <AlertCircle size={13} color="rgba(255,80,80,0.8)" style={{ marginTop: 2 }} />
                <Text style={{ fontSize: 12, color: 'rgba(255,80,80,0.8)', lineHeight: 17, flex: 1 }}>
                  {analysisData.error}
                </Text>
              </View>
            )}

            {/* Transcription view */}
            {(!analysisOpen || (analysisOpen && !analysisLoading && analysisView === 'anotado')) && (
              <>
                <TouchableOpacity
                  onPress={() => setExpanded(e => !e)}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}
                >
                  {!analysisOpen && (
                    <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(99,102,241,0.65)', letterSpacing: 0.8 }}>
                      TRANSCRIPCIÓN
                    </Text>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: analysisOpen ? 'auto' : 0 }}>
                    <Text style={{ fontSize: 11, color: 'rgba(99,102,241,0.6)', fontWeight: '600' }}>
                      {expanded ? 'Ocultar' : 'Ver completa'}
                    </Text>
                    {expanded
                      ? <ChevronUp size={13} color="rgba(99,102,241,0.6)" />
                      : <ChevronDown size={13} color="rgba(99,102,241,0.6)" />
                    }
                  </View>
                </TouchableOpacity>
                <Text style={{ fontSize: 12.5, lineHeight: 20 }} numberOfLines={expanded ? undefined : 4}>
                  {analysisOpen && analysisData && !analysisData.error
                    ? (analysisData.anotadoSegments || []).map((seg, i) => {
                        if (seg.type === 'actor')   return <Text key={i} style={{ color: 'rgba(251,191,36,1)',  fontWeight: '700' }}>{seg.text}</Text>;
                        if (seg.type === 'entidad') return <Text key={i} style={{ color: 'rgba(99,102,241,1)', fontWeight: '700' }}>{seg.text}</Text>;
                        if (seg.type === 'hecho')   return <Text key={i} style={{ color: 'rgba(52,211,153,1)', fontWeight: '700' }}>{seg.text}</Text>;
                        return <Text key={i} style={{ color: INK.meta }}>{seg.text}</Text>;
                      })
                    : <Text style={{ color: INK.meta }}>{transcription}</Text>
                  }
                </Text>
              </>
            )}

            {/* Organizado view */}
            {analysisOpen && !analysisLoading && analysisData && !analysisData.error && analysisView === 'organizado' && (
              <View style={{ gap: 14 }}>

                {/* Temas */}
                {analysisData.temas?.length > 0 && (
                  <View>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(99,102,241,0.7)', marginBottom: 7, letterSpacing: 0.9 }}>
                      TEMAS
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                      {analysisData.temas.map((t, i) => (
                        <View key={i} style={{ backgroundColor: 'rgba(99,102,241,0.14)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(99,102,241,0.28)' }}>
                          <Text style={{ fontSize: 11, color: 'rgba(200,201,255,0.92)', fontWeight: '600' }}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Actores */}
                {analysisData.actores?.length > 0 && (
                  <View>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(251,191,36,0.75)', marginBottom: 7, letterSpacing: 0.9 }}>
                      ACTORES
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                      {analysisData.actores.map((a, i) => (
                        <View key={i} style={{ backgroundColor: 'rgba(251,191,36,0.09)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(251,191,36,0.28)' }}>
                          <Text style={{ fontSize: 11, color: 'rgba(251,191,36,0.92)', fontWeight: '600' }}>{a}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Entidades */}
                {analysisData.entidades?.length > 0 && (
                  <View>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(52,211,153,0.75)', marginBottom: 7, letterSpacing: 0.9 }}>
                      ENTIDADES
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                      {analysisData.entidades.map((e, i) => (
                        <View key={i} style={{ backgroundColor: 'rgba(52,211,153,0.09)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(52,211,153,0.28)' }}>
                          <Text style={{ fontSize: 11, color: 'rgba(52,211,153,0.92)', fontWeight: '600' }}>{e}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Contexto */}
                {analysisData.contexto && (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: 'rgba(99,102,241,0.45)' }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(99,102,241,0.7)', marginBottom: 5, letterSpacing: 0.9 }}>
                      POSTURA / CONTEXTO
                    </Text>
                    <Text style={{ fontSize: 12.5, color: INK.body, lineHeight: 19 }}>
                      {analysisData.contexto}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
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
      backgroundColor: GLASS.fill,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: GLASS.rim,
      padding: 16,
      marginBottom: 10,
      ...CARD_SHADOW,
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
          <Text style={{ fontSize: 15, fontWeight: '700', color: INK.title, lineHeight: 21 }} numberOfLines={2}>
            {item.titulo}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 }}>
            <TypeBadge type={item.tipo} colorMap={CODEX_TYPE_COLORS} />
            {item.proyecto && (
              <Text style={{ fontSize: 11, color: INK.faint }} numberOfLines={1}>
                {item.proyecto}
              </Text>
            )}
          </View>
          {formattedDate && (
            <Text style={{ fontSize: 11, color: INK.faint, marginTop: 6 }}>
              {formattedDate}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ── DATASETS ────────────────────────────────────────────────────────────────

const DATASET_COL_TYPES = ['texto', 'número', 'fecha', 'checkbox', 'url'];

function DatasetListItem({ dataset, onPress, onLongPress }) {
  const isPublic = dataset._visibility === 'public';
  const rowCount = Array.isArray(dataset.json_data) ? dataset.json_data.length : 0;
  const colCount = Array.isArray(dataset.schema_definition) ? dataset.schema_definition.length : 0;
  const updatedAt = dataset.updated_at
    ? new Date(dataset.updated_at).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <TouchableOpacity
      onPress={() => onPress(dataset)}
      onLongPress={() => onLongPress(dataset)}
      delayLongPress={600}
      activeOpacity={0.75}
      style={{
        backgroundColor: GLASS.fill,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: isPublic ? 'rgba(99,102,241,0.25)' : GLASS.rim,
        padding: 16,
        marginBottom: 10,
        ...CARD_SHADOW,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View style={{
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: isPublic ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.07)',
            borderWidth: 1,
            borderColor: isPublic ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.12)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Table size={18} color={isPublic ? '#a5b4fc' : 'rgba(255,255,255,0.5)'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: INK.title }} numberOfLines={1}>
              {dataset.name}
            </Text>
            {dataset.description ? (
              <Text style={{ fontSize: 12, color: INK.meta, marginTop: 2 }} numberOfLines={1}>
                {dataset.description}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: isPublic ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.06)',
            borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
            borderWidth: 1, borderColor: isPublic ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.1)',
          }}>
            {isPublic
              ? <Globe size={10} color="#a5b4fc" />
              : <Lock size={10} color={INK.meta} />}
            <Text style={{ fontSize: 10, fontWeight: '700', color: isPublic ? '#a5b4fc' : 'rgba(255,255,255,0.4)' }}>
              {isPublic ? 'Público' : 'Privado'}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 16, marginTop: 10, alignItems: 'center' }}>
        <Text style={{ fontSize: 12, color: INK.meta }}>
          <Text style={{ fontWeight: '700', color: INK.body }}>{rowCount}</Text> filas
        </Text>
        <Text style={{ fontSize: 12, color: INK.meta }}>
          <Text style={{ fontWeight: '700', color: INK.body }}>{colCount}</Text> cols
        </Text>
        {updatedAt && (
          <Text style={{ fontSize: 11, color: INK.faint, marginLeft: 'auto' }}>
            {updatedAt}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Row Detail / Edit Modal ────────────────────────────────────────────────
function RowDetailModal({ row, schema, rowIndex, onClose, onSave, bottomInset = 0 }) {
  const [editedRow, setEditedRow] = useState({ ...row });
  const [saving, setSaving] = useState(false);

  const setVal = (col, val) => setEditedRow(prev => ({ ...prev, [col]: val }));

  const handleSave = async () => {
    setSaving(true);
    await onSave(rowIndex, editedRow);
    setSaving(false);
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <Pressable style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' }} onPress={onClose} />
        <View style={{
          backgroundColor: '#0a0c1b',
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)',
          maxHeight: '90%', overflow: 'hidden',
        }}>
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' }} />
          </View>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 22, paddingTop: 10, paddingBottom: 14,
            borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#fff' }}>Fila {rowIndex + 1}</Text>
            <TouchableOpacity onPress={onClose} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
              <X size={15} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {(schema || []).map(col => {
              const val = editedRow[col.name] ?? '';
              const isCheckbox = col.type === 'checkbox';
              return (
                <View key={col.name} style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 0.8, marginBottom: 6 }}>
                    {col.name.toUpperCase()}
                  </Text>
                  {isCheckbox ? (
                    <TouchableOpacity
                      onPress={() => setVal(col.name, !val)}
                      activeOpacity={0.75}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 10,
                        paddingHorizontal: 14, paddingVertical: 10,
                        borderRadius: 10, borderWidth: 1,
                        borderColor: val ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)',
                        backgroundColor: val ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                      }}
                    >
                      <View style={{
                        width: 20, height: 20, borderRadius: 6, borderWidth: 2,
                        borderColor: val ? '#a5b4fc' : 'rgba(255,255,255,0.3)',
                        backgroundColor: val ? 'rgba(99,102,241,0.4)' : 'transparent',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        {val && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>}
                      </View>
                      <Text style={{ fontSize: 14, color: val ? '#a5b4fc' : 'rgba(255,255,255,0.5)', fontWeight: '600' }}>
                        {val ? 'Sí' : 'No'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, height: 46, justifyContent: 'center' }}>
                      <TextInput
                        style={{ color: '#fff', fontSize: 14 }}
                        placeholder={col.type === 'fecha' ? 'YYYY-MM-DD' : col.type === 'url' ? 'https://' : col.type === 'número' ? '0' : col.name + '...'}
                        placeholderTextColor="rgba(255,255,255,0.25)"
                        value={String(val)}
                        onChangeText={v => setVal(col.name, v)}
                        keyboardType={col.type === 'número' ? 'numeric' : 'default'}
                        autoCapitalize={col.type === 'url' ? 'none' : 'sentences'}
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
          <View style={{
            flexDirection: 'row', gap: 10, paddingHorizontal: 22,
            paddingTop: 12, paddingBottom: bottomInset > 0 ? bottomInset : 20,
            borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.07)', backgroundColor: '#0a0c1b',
          }}>
            <TouchableOpacity onPress={onClose} style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.75}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.6)' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={saving} style={{ flex: 1.4, height: 48, borderRadius: 12, backgroundColor: saving ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.85)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.5)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }} activeOpacity={0.8}>
              {saving && <ActivityIndicator size="small" color="#a5b4fc" />}
              <Text style={{ fontSize: 15, fontWeight: '700', color: saving ? 'rgba(255,255,255,0.4)' : '#fff' }}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Dataset Detail Modal (tabla scrollable) ───────────────────────────────
function DatasetDetailModal({ dataset, onClose, onDataUpdated, bottomInset = 0 }) {
  const [rows, setRows] = useState(Array.isArray(dataset.json_data) ? dataset.json_data : []);
  const [schema] = useState(Array.isArray(dataset.schema_definition) ? dataset.schema_definition : []);
  const [searchText, setSearchText] = useState('');
  const [editingRow, setEditingRow] = useState(null); // { row, rowIndex }
  const [addingRow, setAddingRow] = useState(false);
  const [saving, setSaving] = useState(false);

  const table = dataset._visibility === 'public' ? 'public_datasets' : 'private_datasets';

  const filteredRows = rows.filter(row =>
    !searchText.trim() ||
    Object.values(row).some(v => String(v ?? '').toLowerCase().includes(searchText.toLowerCase()))
  );

  const updateDataset = async (newRows) => {
    const { error } = await supabase
      .from(table)
      .update({ json_data: newRows, row_count: newRows.length, updated_at: new Date().toISOString() })
      .eq('id', dataset.id);
    if (error) throw error;
    setRows(newRows);
    onDataUpdated?.({ ...dataset, json_data: newRows, row_count: newRows.length });
  };

  const handleSaveRow = async (rowIndex, editedRow) => {
    try {
      const newRows = rows.map((r, i) => i === rowIndex ? editedRow : r);
      await updateDataset(newRows);
      setEditingRow(null);
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo guardar la fila');
    }
  };

  const handleAddRow = async (newRow) => {
    try {
      const newRows = [...rows, newRow];
      await updateDataset(newRows);
      setAddingRow(false);
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo agregar la fila');
    }
  };

  const CELL_WIDTH = 140;
  const ROW_HEIGHT = 44;

  // Extrae el texto más legible de cualquier valor de celda — espejo de InlineDatasetEditor web
  const formatCellValue = (val) => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? 'Sí' : 'No';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'string') return val || '—';
    if (Array.isArray(val)) {
      if (val.length === 0) return '—';
      return val.map(v => formatCellValue(v)).filter(s => s && s !== '—').join(', ') || '—';
    }
    if (typeof val === 'object') {
      // ── Ubicación (LocationColumn) ──────────────────────────────────────
      // Detectado por: municipality | department | coordinates | formatted_address
      if ('municipality' in val || 'department' in val || 'formatted_address' in val || 'coordinates' in val) {
        if (val.municipality) return String(val.municipality);
        if (val.department) return String(val.department);
        if (val.formatted_address) return String(val.formatted_address);
        return 'Ubicación';
      }

      // ── Actor / Entidad / Empresa (EntityColumn) ─────────────────────────
      // Todos usan .name como campo de display
      if ('name' in val && typeof val.name === 'string' && val.name.trim()) {
        return val.name.trim();
      }

      // ── GeoJSON Feature → leer properties ──────────────────────────────
      if (val.type === 'Feature' && val.properties) {
        const fromProps = formatCellValue(val.properties);
        if (fromProps !== '—') return fromProps;
      }

      // ── GeoJSON Point → coordenadas como último recurso ─────────────────
      if (val.type === 'Point' && Array.isArray(val.coordinates)) {
        const [lng, lat] = val.coordinates;
        return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
      }

      // ── Objeto genérico: primer string no vacío ─────────────────────────
      const firstStr = Object.values(val).find(v => typeof v === 'string' && v.trim().length > 0 && v.length < 120);
      if (firstStr) return firstStr.trim();

      return '—';
    }
    return String(val);
  };

  return (
    <>
      <Modal visible animationType="slide" transparent onRequestClose={onClose}>
        {/* Overlay + sheet ocupa 94% de la pantalla con flex layout correcto */}
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

          {/* Sheet con altura fija = 94% de pantalla para que la tabla pueda tomar flex:1 */}
          <View style={{
            backgroundColor: '#0a0c1b',
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            height: '94%',   // height fijo en vez de maxHeight — permite flex interno
            flexDirection: 'column',
          }}>
            {/* Handle */}
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' }} />
            </View>

            {/* Header */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: 22, paddingTop: 8, paddingBottom: 14,
              borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#fff' }} numberOfLines={1}>{dataset.name}</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                  {rows.length} filas · {schema.length} columnas
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setAddingRow(true)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
                  backgroundColor: 'rgba(99,102,241,0.2)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.4)',
                  marginRight: 10,
                }}
                activeOpacity={0.75}
              >
                <Plus size={13} color="#a5b4fc" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#a5b4fc' }}>Fila</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                <X size={15} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              marginHorizontal: 22, marginTop: 12, marginBottom: 10,
              backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
              paddingHorizontal: 10, height: 38,
            }}>
              <Search size={14} color="rgba(255,255,255,0.4)" />
              <TextInput
                style={{ flex: 1, color: '#fff', fontSize: 13, marginLeft: 8 }}
                placeholder="Buscar en datos..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>

            {/* Table — flex:1 para que ocupe el espacio restante */}
            {schema.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>Dataset sin columnas</Text>
              </View>
            ) : (
              /* ScrollView horizontal ocupa el resto del espacio */
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                style={{ flex: 1 }}
                contentContainerStyle={{ flexDirection: 'column' }}
              >
                <View style={{ flex: 1 }}>
                  {/* Header fijo de columnas */}
                  <View style={{ flexDirection: 'row', backgroundColor: 'rgba(99,102,241,0.12)', borderBottomWidth: 1, borderColor: 'rgba(99,102,241,0.25)' }}>
                    <View style={{ width: 40, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontWeight: '700' }}>#</Text>
                    </View>
                    {schema.map(col => (
                      <View key={col.name} style={{ width: CELL_WIDTH, paddingHorizontal: 12, paddingVertical: 10, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#a5b4fc', letterSpacing: 0.5 }} numberOfLines={1}>
                          {col.name}
                        </Text>
                        <Text style={{ fontSize: 9, color: 'rgba(165,180,252,0.4)', marginTop: 1 }}>{col.type}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Filas — scroll vertical interno */}
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                    style={{ flex: 1 }}
                  >
                    {filteredRows.length === 0 ? (
                      <View style={{ width: schema.length * CELL_WIDTH + 40, paddingVertical: 40, alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
                          {searchText ? 'Sin resultados' : 'Sin filas — usa el botón + Fila'}
                        </Text>
                      </View>
                    ) : filteredRows.map((row, i) => {
                      const realIndex = rows.indexOf(row);
                      return (
                        <TouchableOpacity
                          key={i}
                          onPress={() => setEditingRow({ row, rowIndex: realIndex })}
                          activeOpacity={0.75}
                          style={{
                            flexDirection: 'row',
                            borderBottomWidth: 1,
                            borderColor: 'rgba(255,255,255,0.05)',
                            backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                            minHeight: ROW_HEIGHT,
                          }}
                        >
                          <View style={{ width: 40, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontWeight: '600' }}>{realIndex + 1}</Text>
                          </View>
                          {schema.map(col => {
                            const val = row[col.name];
                            return (
                              <View key={col.name} style={{ width: CELL_WIDTH, minHeight: ROW_HEIGHT, paddingHorizontal: 12, justifyContent: 'center', borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.04)' }}>
                                {col.type === 'checkbox' || typeof val === 'boolean' ? (
                                  <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: val ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.2)', backgroundColor: val ? 'rgba(99,102,241,0.3)' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                                    {val && <Text style={{ color: '#a5b4fc', fontSize: 11, fontWeight: '800' }}>✓</Text>}
                                  </View>
                                ) : (
                                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }} numberOfLines={2}>
                                    {formatCellValue(val)}
                                  </Text>
                                )}
                              </View>
                            );
                          })}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </ScrollView>
            )}

            {/* Bottom safe area */}
            <View style={{ height: bottomInset > 0 ? bottomInset : 20, backgroundColor: '#0a0c1b' }} />
          </View>
        </View>
      </Modal>

      {/* Row edit modal */}
      {editingRow && (
        <RowDetailModal
          row={editingRow.row}
          schema={schema}
          rowIndex={editingRow.rowIndex}
          onClose={() => setEditingRow(null)}
          onSave={handleSaveRow}
          bottomInset={bottomInset}
        />
      )}

      {/* Add row modal */}
      {addingRow && (
        <RowDetailModal
          row={Object.fromEntries((schema || []).map(c => [c.name, c.type === 'checkbox' ? false : '']))}
          schema={schema}
          rowIndex={rows.length}
          onClose={() => setAddingRow(false)}
          onSave={async (_, newRow) => { await handleAddRow(newRow); }}
          bottomInset={bottomInset}
        />
      )}
    </>
  );
}

// ── Create Dataset Modal ──────────────────────────────────────────────────
function CreateDatasetModal({ onClose, onSuccess, bottomInset = 0 }) {
  const [dsName, setDsName] = useState('');
  const [dsDesc, setDsDesc] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [columns, setColumns] = useState([{ id: 'c0', name: '', type: 'texto' }]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const addColumn = () =>
    setColumns(prev => [...prev, { id: `c${Date.now()}`, name: '', type: 'texto' }]);
  const removeColumn = (id) =>
    setColumns(prev => prev.length > 1 ? prev.filter(c => c.id !== id) : prev);
  const updateColName = (id, name) =>
    setColumns(prev => prev.map(c => c.id === id ? { ...c, name } : c));
  const updateColType = (id, type) =>
    setColumns(prev => prev.map(c => c.id === id ? { ...c, type } : c));

  const canSave = dsName.trim() && columns.every(c => c.name.trim());

  const handleCreate = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const schemaDefinition = columns.map(c => ({ name: c.name.trim(), type: c.type, nullable: true }));
      const table = isPublic ? 'public_datasets' : 'private_datasets';

      const payload = {
        name: dsName.trim(),
        description: dsDesc.trim() || null,
        schema_definition: schemaDefinition,
        json_data: [],
        row_count: 0,
        owner_id: user.id,
      };

      const { data, error } = await supabase
        .from(table)
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      onSuccess?.({ ...data, _visibility: isPublic ? 'public' : 'private' });
    } catch (e) {
      setSaveError(e.message || 'Error al crear');
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <Pressable style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' }} onPress={onClose} />
        <View style={{
          backgroundColor: '#0a0c1b',
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)', maxHeight: '92%', overflow: 'hidden',
        }}>
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' }} />
          </View>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 22, paddingTop: 10, paddingBottom: 14,
            borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }}>Nuevo Dataset</Text>
            <TouchableOpacity onPress={onClose} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
              <X size={15} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Nombre */}
            <Text style={editStyles.sectionLabel}>NOMBRE</Text>
            <View style={editStyles.inputWrapper}>
              <TextInput style={editStyles.input} placeholder="Nombre del dataset" placeholderTextColor="rgba(255,255,255,0.25)" value={dsName} onChangeText={setDsName} />
            </View>

            {/* Descripción */}
            <Text style={editStyles.sectionLabel}>DESCRIPCIÓN (opcional)</Text>
            <View style={editStyles.textareaWrapper}>
              <TextInput style={[editStyles.textarea, { minHeight: 70 }]} placeholder="Para qué sirve este dataset..." placeholderTextColor="rgba(255,255,255,0.25)" value={dsDesc} onChangeText={setDsDesc} multiline numberOfLines={3} />
            </View>

            {/* Visibilidad */}
            <Text style={editStyles.sectionLabel}>VISIBILIDAD</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
              {[
                { label: 'Privado', val: false, icon: <Lock size={13} color={!isPublic ? '#a5b4fc' : 'rgba(255,255,255,0.4)'} /> },
                { label: 'Público', val: true, icon: <Globe size={13} color={isPublic ? '#a5b4fc' : 'rgba(255,255,255,0.4)'} /> },
              ].map(opt => (
                <TouchableOpacity
                  key={String(opt.val)}
                  onPress={() => setIsPublic(opt.val)}
                  activeOpacity={0.75}
                  style={{
                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                    height: 44, borderRadius: 12, borderWidth: 1,
                    backgroundColor: isPublic === opt.val ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                    borderColor: isPublic === opt.val ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)',
                  }}
                >
                  {opt.icon}
                  <Text style={{ fontSize: 14, fontWeight: '700', color: isPublic === opt.val ? '#a5b4fc' : 'rgba(255,255,255,0.4)' }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Columnas */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 8 }}>
              <Text style={[editStyles.sectionLabel, { marginTop: 0, marginBottom: 0 }]}>COLUMNAS</Text>
              <TouchableOpacity onPress={addColumn} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(99,102,241,0.4)', backgroundColor: 'rgba(99,102,241,0.08)' }}>
                <Plus size={12} color="#a5b4fc" />
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#a5b4fc' }}>Añadir</Text>
              </TouchableOpacity>
            </View>

            {columns.map((col, idx) => (
              <View key={col.id} style={{ flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                {/* Nombre */}
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, height: 42, justifyContent: 'center' }}>
                  <TextInput
                    style={{ color: '#fff', fontSize: 13 }}
                    placeholder={`Col ${idx + 1}`}
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={col.name}
                    onChangeText={v => updateColName(col.id, v)}
                  />
                </View>
                {/* Tipo — ciclo entre tipos */}
                <TouchableOpacity
                  onPress={() => {
                    const currentIdx = DATASET_COL_TYPES.indexOf(col.type);
                    const nextIdx = (currentIdx + 1) % DATASET_COL_TYPES.length;
                    updateColType(col.id, DATASET_COL_TYPES[nextIdx]);
                  }}
                  activeOpacity={0.75}
                  style={{
                    paddingHorizontal: 10, height: 42, borderRadius: 10, borderWidth: 1,
                    borderColor: 'rgba(99,102,241,0.3)', backgroundColor: 'rgba(99,102,241,0.1)',
                    alignItems: 'center', justifyContent: 'center', minWidth: 72,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#a5b4fc' }}>{col.type}</Text>
                </TouchableOpacity>
                {/* Eliminar */}
                <TouchableOpacity onPress={() => removeColumn(col.id)} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.75}>
                  <X size={14} color="rgba(239,68,68,0.6)" />
                </TouchableOpacity>
              </View>
            ))}

            {saveError && (
              <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
                <Text style={{ fontSize: 13, color: '#f87171', lineHeight: 18 }}>{saveError}</Text>
              </View>
            )}
          </ScrollView>

          <View style={{
            flexDirection: 'row', gap: 10, paddingHorizontal: 22,
            paddingTop: 12, paddingBottom: bottomInset > 0 ? bottomInset : 20,
            borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.07)', backgroundColor: '#0a0c1b',
          }}>
            <TouchableOpacity onPress={onClose} style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.75}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.6)' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCreate} disabled={saving || !canSave} style={{ flex: 1.4, height: 48, borderRadius: 12, backgroundColor: (saving || !canSave) ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.85)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.5)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }} activeOpacity={0.8}>
              {saving && <ActivityIndicator size="small" color="#a5b4fc" />}
              <Text style={{ fontSize: 15, fontWeight: '700', color: (saving || !canSave) ? 'rgba(255,255,255,0.4)' : '#fff' }}>Crear Dataset</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function CodexScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isConnected, isConnecting, error: connError, connectWithApple, connectedUser } =
    usePulseConnectionStore();

  /**
   * Posts es solo para admins. Las cuentas `phone` —las que nacen en el
   * teléfono con Apple— ven Codex y nada más.
   *
   * Se lee del rol que el store ya trajo de `profiles` al conectar, en vez de
   * llamar a `is_admin` otra vez: es el mismo dato y evita un viaje. Esto
   * decide qué se MUESTRA; lo que protege de verdad es el RLS de cada tabla,
   * que sigue aplicando aunque alguien fuerce la pestaña.
   */
  const esAdmin = connectedUser?.role === 'admin';



  const [instagramPosts, setInstagramPosts] = useState([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [showAddPostModal, setShowAddPostModal] = useState(false);
  const [postUrl, setPostUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractedPost, setExtractedPost] = useState(null);
  const [extractError, setExtractError] = useState(null);
  const [savingPost, setSavingPost] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // ── Carpetas de posts ──────────────────────────────────────────────────────
  const [folders, setFolders] = useState([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState(null); // null = "Todos"
  const [showFolderView, setShowFolderView] = useState(true);     // true = grid de carpetas, false = lista
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0].hex);
  const [savingFolder, setSavingFolder] = useState(false);
  // Modal para mover post a carpeta
  const [movingPost, setMovingPost] = useState(null); // post object | null
  const [showMoveModal, setShowMoveModal] = useState(false);

  const [activeTab, setActiveTab] = useState('codex'); // 'codex' | 'posts' (admin)

  // Si la pestaña activa dejó de estar disponible —el perfil cargó tarde y no
  // es admin, o se cerró sesión— se vuelve a Codex en vez de quedar en una
  // pestaña que ya no se puede elegir.
  //
  // Va después de declarar `activeTab`: el arreglo de dependencias se evalúa
  // al renderizar, y usarlo antes de su `const` tiraba un ReferenceError apenas
  // se abría esta pestaña.
  useEffect(() => {
    if (activeTab === 'datasets' || (activeTab === 'posts' && !esAdmin)) setActiveTab('codex');
  }, [activeTab, esAdmin]);
  const [wikiFilter, setWikiFilter] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Espacios (spaces) + modo de la pila
  const [spaces, setSpaces] = useState([]);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);
  const [stackMode, setStackMode] = useState('espacios'); // 'espacios' | 'todo'
  const [openSpace, setOpenSpace] = useState(null);
  const [detailItem, setDetailItem] = useState(null);

  /**
   * Dónde se quedó la persona dentro del Codex.
   *
   * La precedencia la resuelve esta pantalla y no el store, porque es la única
   * que sabe que una ficha abierta sobre un espacio es una ficha: cerrarla no
   * lleva al feed, lleva al espacio, y por eso el espacio viaja junto al item.
   */
  useRecordarLugar(
    detailItem?.id
      ? { tipo: 'item', id: detailItem.id, espacioId: openSpace?.id || null }
      : openSpace?.id
        ? { tipo: 'espacio', id: openSpace.id }
        : null,
    TIPOS_CODEX
  );

  const porRestaurar = useUltimoLugarStore((s) => s.porRestaurar);
  const consumirLugar = useUltimoLugarStore((s) => s.consumir);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  useEffect(() => {
    const tipo = porRestaurar?.tipo;
    if (tipo !== 'item' && tipo !== 'espacio') return;

    const lugar = consumirLugar(tipo);
    if (!lugar) return;

    (async () => {
      try {
        // El espacio primero: si la ficha se pintara antes, cargar el espacio
        // después la reemplazaría en pantalla y se vería un parpadeo.
        if (lugar.espacioId || tipo === 'espacio') {
          const space = await loadSpace(lugar.espacioId || lugar.id);
          // Sin `origen` la vista se abre sin la animación de crecer desde la
          // pill: no hay pill de la cual crecer cuando nadie tocó nada.
          if (montado.current && space) {
            setOpenSpace(space);
          }
        }

        if (tipo !== 'item' || !montado.current) return;

        const { data } = await supabase
          .from('codex_universe_items')
          .select('id, name, tipo, description, tags, aliases, details, mentions, created_at')
          .eq('id', lugar.id)
          .maybeSingle();

        if (montado.current && data) setDetailItem(data);
      } catch {
        // Un item borrado desde la web, o sin red al arrancar: se abre el Codex
        // como siempre. Volver al lugar equivocado es peor que no volver, y el
        // registro ya se consumió, así que esto no se reintenta solo.
      }
    })();

    // El corte va por desmontaje y no por el cleanup del efecto: consumir el
    // encargo pone `porRestaurar` en null, o sea que cambia una dependencia y
    // el efecto se vuelve a correr enseguida. Con `return () => vivo = false`
    // ese re-run cancelaría la búsqueda que él mismo acaba de lanzar, y nunca
    // se restauraría nada.
  }, [porRestaurar?.tipo, consumirLugar]);

  const [showCreateItem, setShowCreateItem] = useState(false);
  // El «+» ya no abre la hoja de crear directo: primero se elige qué se agrega.
  // `crearTipo` guarda con qué tipo arranca la ficha en modo crear.
  const [showAgregar, setShowAgregar] = useState(false);
  const [showCreateSnippet, setShowCreateSnippet] = useState(false);
  const [crearTipo, setCrearTipo] = useState('Actor');
  // Lo que se acaba de crear desde «nuevo». Crear no cierra la ficha: queda
  // abierta mostrando el item ya guardado, y desde ahí se sigue editando.
  const [itemCreado, setItemCreado] = useState(null);
  const borradorItem = useMemo(
    () => ({ tipo: crearTipo, name: '', description: '', details: {} }),
    [crearTipo]
  );
  const [subiendoDoc, setSubiendoDoc] = useState(null); // { nombre } mientras sube
  const [showCreateSpace, setShowCreateSpace] = useState(false);

  const [wikiItems, setWikiItems] = useState([]);
  const [codexItems, setCodexItems] = useState([]);
  const [isLoadingWiki, setIsLoadingWiki] = useState(false);
  const [isLoadingCodex, setIsLoadingCodex] = useState(false);
  const [wikiError, setWikiError] = useState(null);
  const [codexError, setCodexError] = useState(null);

  const [selectedWikiItem, setSelectedWikiItem] = useState(null);

  // ── Datasets ──────────────────────────────────────────────────────────────
  const [datasets, setDatasets] = useState([]);
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(false);
  const [datasetsError, setDatasetsError] = useState(null);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [showCreateDataset, setShowCreateDataset] = useState(false);
  const [datasetSearchQuery, setDatasetSearchQuery] = useState('');


  const fetchInstagramPosts = async ({ callado = false } = {}) => {
    if (!callado) setIsLoadingPosts(true);
    const { data, error } = await supabase
      .from('codex_universe_items')
      .select('id, name, tipo, description, tags, thumbnail_url, details, created_at, folder_id')
      .eq('tipo', 'post')
      .order('created_at', { ascending: false })
      .limit(100);
    setIsLoadingPosts(false);
    if (!error) setInstagramPosts(data || []);
  };

  const fetchFolders = async ({ callado = false } = {}) => {
    if (!callado) setIsLoadingFolders(true);
    const { data, error } = await supabase
      .from('post_folders')
      .select('id, name, color, icon, position, created_at')
      // `post_folders` la comparten los Posts y las notas del historial. Sin el
      // scope, una carpeta de notas aparecería en esta grilla siempre vacía.
      .eq('scope', 'post')
      .order('position', { ascending: true });
    setIsLoadingFolders(false);
    if (!error) setFolders(data || []);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setSavingFolder(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    const { error } = await supabase.from('post_folders').insert({
      name: newFolderName.trim(),
      color: newFolderColor,
      icon: 'folder',
      scope: 'post',
      position: folders.length,
      ...(userId ? { user_id: userId } : {}),
    });
    setSavingFolder(false);
    if (!error) {
      setNewFolderName('');
      setNewFolderColor(FOLDER_COLORS[0].hex);
      setShowCreateFolderModal(false);
      fetchFolders();
    }
  };

  const handleDeleteFolder = (folder) => {
    Alert.alert(
      'Eliminar carpeta',
      `¿Eliminar "${folder.name}"? Los posts quedarán sin carpeta.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive', onPress: async () => {
            await supabase.from('post_folders').delete().eq('id', folder.id);
            if (selectedFolderId === folder.id) { setSelectedFolderId(null); setShowFolderView(true); }
            fetchFolders();
            fetchInstagramPosts();
          }
        },
      ]
    );
  };

  const handleMovePostToFolder = async (folderId) => {
    if (!movingPost) return;
    await supabase.from('codex_universe_items')
      .update({ folder_id: folderId })
      .eq('id', movingPost.id);
    setShowMoveModal(false);
    setMovingPost(null);
    fetchInstagramPosts();
  };

  // ── Instagram: extract + save automáticamente (cierra modal, muestra loader en lista) ──
  // Detecta si es reel (/reel/) → usa /instagram/transcribe en ExtractorT
  // Si es post normal (/p/) → usa /api/instagram/extract en ExtractorW
  const handleExtractPost = async () => {
    if (!postUrl.trim()) return;
    const url = postUrl.trim();

    // Cerrar modal inmediatamente y mostrar loader en la lista
    setShowAddPostModal(false);
    setPostUrl('');
    setExtractedPost(null);
    setExtractError(null);
    setCarouselIndex(0);
    setIsLoadingPosts(true);

    try {
      const isTwitter = url.includes('twitter.com/') || url.includes('x.com/');
      const isReel = !isTwitter && url.includes('/reel/');
      let postData = null;

      if (isTwitter) {
        // Tweets → ExtractorW /api/x/media (retorna media + metadata enriquecida)
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const res = await fetch(`${EXTRACTORW_URL}/api/x/media`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ url }),
        });
        const json = await res.json();
        if (json.success) {
          postData = {
            success: true,
            source_url: url,
            author: json.author_handle || null,
            author_name: json.author_name || null,
            description: json.tweet_text || null,
            is_reel: false,
            is_twitter: true,
            thumbnail_url: json.thumbnail_url || json.images?.[0] || null,
            video_url: json.video_url || null,
            transcription: json.transcription || null,
            post_id: json.post_id || null,
            extracted_images: json.images || [],
            tweet_metrics: json.tweet_metrics || null,
          };
        } else {
          throw new Error(json.error?.message || json.error || 'No se pudo extraer el tweet');
        }
      } else if (isReel) {
        // Reels → ExtractorT /instagram/transcribe (incluye audio→Whisper)
        const res = await fetch(`${EXTRACTORT_URL}/instagram/transcribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const json = await res.json();
        if (json.success) {
          postData = {
            success: true,
            source_url: url,
            author: json.author || null,
            description: json.description || null,
            is_reel: true,
            is_twitter: false,
            thumbnail_url: json.thumbnail_url || null,
            video_url: json.video_url || null,
            transcription: json.transcription || null,
            post_id: json.post_id || null,
            extracted_images: json.thumbnail_url ? [json.thumbnail_url] : [],
          };
        } else {
          throw new Error(json.error || 'No se pudo transcribir el reel');
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
          postData = json;
        } else {
          throw new Error(json.error?.message || 'No se pudo extraer el post');
        }
      }

      // Guardar directamente en DB sin paso intermedio de preview
      if (postData) {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;

        const name = postData.is_twitter
          ? (postData.author
            ? `@${postData.author}${postData.description ? ' — ' + postData.description.slice(0, 60) : ''}`
            : postData.description?.slice(0, 80) || 'Tweet de X')
          : (postData.author
            ? `@${postData.author}${postData.description ? ' — ' + postData.description.slice(0, 60) : ''}`
            : postData.description?.slice(0, 80) || 'Post de Instagram');

        const { error: insertError } = await supabase.from('codex_universe_items').insert({
          name,
          tipo: 'post',
          description: postData.description || '',
          thumbnail_url: postData.thumbnail_url || postData.extracted_images?.[0] || null,
          tags: [
            ...(postData.is_twitter ? ['twitter', 'x'] : ['instagram']),
            ...(postData.is_reel ? ['reel', 'video'] : []),
            ...(postData.video_url && postData.is_twitter ? ['video'] : []),
          ],
          aliases: postData.author ? [`@${postData.author}`] : [],
          details: {
            source_url: postData.source_url,
            images: postData.extracted_images || [],
            author: postData.author,
            author_name: postData.author_name || null,
            is_reel: postData.is_reel || false,
            is_twitter: postData.is_twitter || false,
            video_url: postData.video_url || null,
            thumbnail_url: postData.thumbnail_url || null,
            transcription: postData.transcription || null,
            post_id: postData.post_id || null,
            tweet_metrics: postData.tweet_metrics || null,
          },
          mentions: [],
          datasets: [],
          ...(userId ? { user_id: userId } : {}),
        });

        if (insertError) throw new Error(insertError.message);
      }
    } catch (e) {
      // Mostrar error brevemente (en la pantalla principal, no en modal)
      console.error('[handleExtractPost] Error:', e.message);
    } finally {
      // Siempre refrescar la lista — si hubo éxito mostrará el nuevo post
      await fetchInstagramPosts();
    }
  };

  // ── Instagram: save post (legacy, kept for compatibility) ──
  const handleSavePost = async () => {
    // No-op: el guardado ahora es parte de handleExtractPost
  };

  // Cargar posts y carpetas cuando el tab está activo
  useEffect(() => {
    if (!isConnected || activeTab !== 'posts') return;
    fetchInstagramPosts();
    fetchFolders();
  }, [isConnected, activeTab]);

  // Cargar datasets cuando el tab está activo
  useEffect(() => {
    if (!isConnected || activeTab !== 'datasets') return;
    fetchDatasets();
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
    fetchSpaces();
  }, [isConnected]);

  // Lo que cambia en la base entra al momento, sin cerrar y volver a abrir.
  //
  // El universo son más de mil fichas: no se vuelve a bajar entero por cada
  // tecla de una nota. Llega la fila que cambió y se pone en su lugar. Recién
  // al volver a la app, que es cuando pudo perderse algo, se pide todo.
  useFilasEnVivo(
    'codex_universe_items',
    'id, name, tipo, description, tags, aliases, details, mentions, thumbnail_url, created_at, folder_id',
    ({ id, fila }) => {
      const esPost = fila?.tipo === 'post';
      setInstagramPosts((prev) => ponerFila(prev, id, fila, () => esPost));
      setWikiItems((prev) => {
        // Igual que al cargar: si la wiki ya tiene una ficha con ese nombre,
        // la del universo no se muestra dos veces.
        const nombre = fila?.name?.toLowerCase();
        const repetida = prev.some((w) => w._source !== 'universe' && w.name?.toLowerCase() === nombre);
        return ponerFila(prev, `universe_${id}`, fila && !esPost && !repetida ? deUniverso(fila) : null);
      });
    },
    () => {
      fetchWiki(undefined, { callado: true });
      fetchCodex({ callado: true });
      fetchSpaces({ callado: true });
      if (activeTab === 'posts') fetchInstagramPosts({ callado: true });
    },
    { activo: isConnected }
  );
  useEnVivo(['codex_items'], () => fetchCodex({ callado: true }), { activo: isConnected });
  useEnVivo(['spaces', 'workspace_resources'], () => fetchSpaces({ callado: true }), { activo: isConnected });
  useEnVivo(['post_folders'], () => fetchFolders({ callado: true }), { activo: isConnected });
  useEnVivo(['wiki_items'], () => fetchWiki(undefined, { callado: true }), { activo: isConnected });

  const fetchSpaces = async ({ callado = false } = {}) => {
    if (!callado) setIsLoadingSpaces(true);
    try {
      setSpaces(await listSpaces());
    } catch (e) {
      console.warn('[fetchSpaces] falló:', e.message);
      setSpaces([]);
    } finally {
      setIsLoadingSpaces(false);
    }
  };

  const detailSheet = detailItem ? (
    <ItemDetailSheet
      item={detailItem}
      onClose={() => setDetailItem(null)}
      // La ficha se edita a sí misma; ya no abre un segundo modal. Acá solo se
      // refleja lo guardado en las listas para que no haya que recargar.
      onSaved={(actualizado) => {
        setDetailItem(actualizado);
        const mismo = (w) => (w._sourceId || w.id) === (actualizado._sourceId || actualizado.id);
        setWikiItems((prev) => prev.map((w) => (mismo(w) ? { ...w, ...actualizado } : w)));
        setCodexItems((prev) => prev.map((w) => (mismo(w) ? { ...w, ...actualizado } : w)));
      }}
      bottomInset={insets.bottom}
    />
  ) : null;

  const spaceSheet = showCreateSpace ? (
    <CreateSpaceSheet
      onClose={() => setShowCreateSpace(false)}
      onCreated={(espacio) => setSpaces((prev) => [espacio, ...prev])}
      bottomInset={insets.bottom}
    />
  ) : null;

  const registrarNuevo = (nuevo) =>
    setWikiItems((prev) => [{ ...nuevo, _source: 'universe' }, ...prev]);

  /**
   * «Media» abre el selector de archivos del sistema y sube lo elegido como
   * documento. El archivo va a `codex_items` (que es la tabla con columnas de
   * archivo), no a `codex_universe_items`.
   */
  const subirDocumento = async () => {
    try {
      const { cancelado, item } = await elegirYSubirDocumento({
        alEmpezarSubida: ({ nombre }) => setSubiendoDoc({ nombre }),
      });
      // Cerrar el selector sin elegir nada no es un error: no se dice nada.
      if (!cancelado && item) setCodexItems((prev) => [item, ...prev]);
    } catch (e) {
      Alert.alert('No se pudo subir', e?.message || 'Intentá de nuevo.');
    } finally {
      setSubiendoDoc(null);
    }
  };

  const createSheet = subiendoDoc ? (
    <SubiendoDocumento nombre={subiendoDoc.nombre} />
  ) : showAgregar ? (
    <AgregarSheet
      onClose={() => setShowAgregar(false)}
      bottomInset={insets.bottom}
      onElegir={(cual) => {
        setShowAgregar(false);
        if (cual === 'snippet') {
          setShowCreateSnippet(true);
          return;
        }
        if (cual === 'media') {
          subirDocumento();
          return;
        }
        setCrearTipo('Actor');
        setShowCreateItem(true);
      }}
    />
  ) : showCreateSnippet ? (
    <CreateSnippetSheet
      onClose={() => setShowCreateSnippet(false)}
      onCreated={registrarNuevo}
      topInset={insets.top}
      bottomInset={insets.bottom}
    />
  ) : showCreateItem ? (
    // Crear y ver son la misma ficha: un borrador sin id que al guardar se
    // inserta. Tener dos pantallas distintas para el mismo objeto obligaba a
    // mantener dos veces el catálogo, los tipos de dato y el guardado.
    <ItemDetailSheet
      item={itemCreado || borradorItem}
      creando={!itemCreado}
      onClose={() => {
        setShowCreateItem(false);
        setItemCreado(null);
      }}
      onSaved={(guardado) => {
        const listo = { ...guardado, _source: 'universe' };
        if (!itemCreado) registrarNuevo(guardado);
        else {
          const mismo = (w) => (w._sourceId || w.id) === (listo._sourceId || listo.id);
          setWikiItems((prev) => prev.map((w) => (mismo(w) ? { ...w, ...listo } : w)));
        }
        setItemCreado(listo);
      }}
      bottomInset={insets.bottom}
    />
  ) : null;

  // Índice para resolver los ids que guarda cada espacio en data.canvasItems.
  // Apuntan a codex_universe_items y codex_items indistintamente, así que el
  // índice mezcla ambas fuentes.
  const itemsById = useMemo(() => {
    const map = new Map();
    // Los items del universo se guardan en `wikiItems` con el id prefijado
    // (`universe_<uuid>`) y el uuid real en `_sourceId`. `data.canvasItems` de
    // un espacio guarda el uuid crudo, así que el índice tiene que ir por el
    // uuid — con el id prefijado no resolvía casi nada y el preview del
    // espacio salía vacío.
    for (const it of wikiItems) map.set(it._sourceId || it.id, it);
    for (const it of codexItems) map.set(it._sourceId || it.id, it);
    return map;
  }, [wikiItems, codexItems]);

  // Refresca la wiki cada vez que el tab recibe foco (ej: se agregó un item desde otra pantalla)
  useFocusEffect(
    useCallback(() => {
      if (!isConnected) return;
      fetchWiki();
    }, [isConnected])
  );

  const fetchWiki = async (sessionOverride, { callado = false } = {}) => {
    console.log('[fetchWiki] 🚀 START — isConnected:', isConnected);
    if (!callado) setIsLoadingWiki(true);
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

    // Supabase corta en 1000 filas por defecto. El universo pasa de eso, así
    // que se pagina: sin esto la pila y el buscador mostraban ~250 elementos
    // de menos sin avisar.
    const fetchAllUniverse = async () => {
      const PAGE = 1000;
      const acc = [];
      for (let desde = 0; ; desde += PAGE) {
        const { data, error } = await supabase
          .from('codex_universe_items')
          .select('id, name, tipo, description, tags, aliases, details, mentions, created_at')
          .neq('tipo', 'post')
          .order('created_at', { ascending: false })
          .range(desde, desde + PAGE - 1);
        if (error) return { data: acc, error };
        acc.push(...(data || []));
        if (!data || data.length < PAGE) break;
      }
      return { data: acc, error: null };
    };

    // Fetch both tables in parallel
    const [wikiResult, universeResult] = await Promise.all([
      supabase
        .from('wiki_items')
        .select('id, name, subcategory, description, relevance_score, tags, metadata, created_at')
        .order('created_at', { ascending: false }),
      fetchAllUniverse(),
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
    const universeItems = (universeResult.data || []).map(deUniverso);

    // Merge: wiki_items first (they have research/metadata), then universe items not already in wiki
    const wikiNames = new Set((wikiResult.data || []).map(w => w.name?.toLowerCase()));
    const deduplicatedUniverse = universeItems.filter(u => !wikiNames.has(u.name?.toLowerCase()));

    const merged = [...(wikiResult.data || []), ...deduplicatedUniverse]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    console.log('[fetchWiki] ✅ Merged wikiItems:', merged.length, '(wiki:', wikiResult.data?.length ?? 0, '+ universe:', deduplicatedUniverse.length, ')');
    setWikiItems(merged);
  };

  const fetchCodex = async ({ callado = false } = {}) => {
    if (!callado) setIsLoadingCodex(true);
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

  const fetchDatasets = async () => {
    setIsLoadingDatasets(true);
    setDatasetsError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoadingDatasets(false); return; }

      const [privateRes, publicRes] = await Promise.all([
        supabase
          .from('private_datasets')
          .select('id, name, description, schema_definition, json_data, row_count, owner_id, created_at, updated_at')
          .eq('owner_id', user.id)
          .order('updated_at', { ascending: false }),
        supabase
          .from('public_datasets')
          .select('id, name, description, schema_definition, json_data, row_count, owner_id, created_at, updated_at')
          .order('updated_at', { ascending: false }),
      ]);

      const privateDs = (privateRes.data || []).map(d => ({ ...d, _visibility: 'private' }));
      const publicDs = (publicRes.data || []).map(d => ({ ...d, _visibility: 'public' }));

      const combined = [...privateDs, ...publicDs]
        .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

      setDatasets(combined);
    } catch (e) {
      setDatasetsError(e.message || 'Error al cargar datasets');
    } finally {
      setIsLoadingDatasets(false);
    }
  };

  const handleDeleteDataset = async (dataset) => {
    const isPublic = dataset._visibility === 'public';
    Alert.alert(
      'Eliminar dataset',
      `¿Eliminar "${dataset.name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isPublic) {
                // Verificar admin
                const { data: isAdmin, error: adminErr } = await supabase.rpc('is_admin', {
                  check_user_id: (await supabase.auth.getUser()).data.user?.id,
                });
                if (adminErr || !isAdmin) {
                  Alert.alert('Sin permiso', 'Solo los administradores pueden eliminar datasets públicos.');
                  return;
                }
              }
              const table = isPublic ? 'public_datasets' : 'private_datasets';
              const { error } = await supabase.from(table).delete().eq('id', dataset.id);
              if (error) throw error;
              setDatasets(prev => prev.filter(d => !(d.id === dataset.id && d._visibility === dataset._visibility)));
            } catch (e) {
              Alert.alert('Error', e.message || 'No se pudo eliminar el dataset');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" />

      {/* Wiki detail + research modal */}
      {selectedWikiItem && (
        <WikiSearchModal
          item={selectedWikiItem}
          onClose={() => setSelectedWikiItem(null)}
          onEdit={(item) => {
            // Ya no hay modal de edición aparte: la ficha se edita a sí misma.
            setSelectedWikiItem(null);
            setDetailItem(item);
          }}
          onAvatarUpdate={(newAvatar) => {
            setWikiItems(prev => prev.map(w =>
              w.id === selectedWikiItem.id
                ? { ...w, metadata: { ...w.metadata, avatar: newAvatar } }
                : w
            ))
          }}
        />
      )}

      {/* Dataset detail modal */}
      {selectedDataset && (
        <DatasetDetailModal
          dataset={selectedDataset}
          onClose={() => setSelectedDataset(null)}
          onDataUpdated={(updated) => {
            setDatasets(prev => prev.map(d =>
              d.id === updated.id && d._visibility === updated._visibility ? updated : d
            ));
          }}
          bottomInset={insets.bottom}
        />
      )}

      {/* Create dataset modal */}
      {showCreateDataset && (
        <CreateDatasetModal
          onClose={() => setShowCreateDataset(false)}
          onSuccess={(newDs) => {
            setDatasets(prev => [newDs, ...prev]);
            setShowCreateDataset(false);
          }}
          bottomInset={insets.bottom}
        />
      )}

      {/* Espacio abierto: su nota principal, en la hoja de notas. El documento
          de un espacio ya no es un editor de bloques aparte, es una nota. */}
      {openSpace ? (
        <CreateSnippetSheet
          espacioPrincipal={{ id: openSpace.id, name: openSpace.name }}
          onClose={() => setOpenSpace(null)}
          onCreated={registrarNuevo}
          topInset={insets.top}
          bottomInset={insets.bottom}
        />
      ) : (
        <>
          {detailSheet}
          {createSheet}
          {spaceSheet}
        </>
      )}

      {!isConnected ? (
        /* ── Puerta de acceso ── */
        <CodexAccessGate
          conectando={isConnecting}
          error={connError}
          onApple={connectWithApple}
          onPortal={() => router.navigate('/(tabs)/settings')}
        />
      ) : (
        /* ── Connected content ── */
        <View style={{ flex: 1, paddingTop: insets.top + 20 }}>
          {/* Header. Sin subtítulo: la palabra sola manda más, y la línea
              explicativa se leía una vez y después solo ocupaba lugar. */}
          <Rea.View
            entering={FadeInDown.duration(420).springify().damping(18)}
            style={{ paddingHorizontal: 24, marginBottom: 18 }}
          >
            <Text
              style={{
                fontSize: 44,
                fontWeight: '800',
                color: INK.title,
                letterSpacing: -1.4,
                lineHeight: 48,
              }}
            >
              Codex
            </Text>
          </Rea.View>

          {/* Segmentos con indicador deslizante */}
          <Rea.View
            entering={FadeInDown.delay(70).duration(420).springify().damping(18)}
            style={{ paddingHorizontal: 24, marginBottom: 16 }}
          >
            <SegmentedSlider
              valor={activeTab}
              onChange={setActiveTab}
              tabs={[
                { id: 'codex', label: 'Codex', accent: 'rgba(79,70,229,0.16)', ink: '#4338CA' },
                // Datos queda fuera por ahora.
                ...(esAdmin
                  ? [{ id: 'posts', label: 'Posts', accent: 'rgba(225,48,108,0.15)', ink: '#BE1E56' }]
                  : []),
              ]}
            />
          </Rea.View>


          {activeTab === 'posts' ? (
            /* ── Posts tab con sistema de carpetas ── */
            <View style={{ flex: 1 }}>

              {/* ── Modales ── */}

              {/* Modal: Agregar post */}
              {showAddPostModal && (
                <Modal visible animationType="slide" transparent onRequestClose={() => setShowAddPostModal(false)}>
                  <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1, justifyContent: 'flex-end' }}
                  >
                    <Pressable style={{ flex: 1 }} onPress={() => setShowAddPostModal(false)} />
                    <Pressable onPress={e => e.stopPropagation()}>
                      <View style={{
                        backgroundColor: '#0d0f20',
                        borderTopLeftRadius: 28, borderTopRightRadius: 28,
                        borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
                        borderColor: 'rgba(255,255,255,0.09)',
                        paddingBottom: insets.bottom + 16,
                        shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
                        shadowOpacity: 0.5, shadowRadius: 24,
                      }}>
                        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
                          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)' }} />
                        </View>
                        <View style={{ paddingHorizontal: 22, paddingTop: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                            <View>
                              <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.4 }}>Agregar post</Text>
                              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.32)', marginTop: 3, lineHeight: 18 }}>Pega un enlace de Instagram o X</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowAddPostModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                              <X size={14} color="rgba(255,255,255,0.45)" />
                            </TouchableOpacity>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, borderWidth: 1, borderColor: postUrl.trim() ? 'rgba(225,48,108,0.45)' : 'rgba(255,255,255,0.09)', paddingHorizontal: 14, height: 52, marginBottom: 14 }}>
                            <Link size={15} color="rgba(255,255,255,0.3)" />
                            <TextInput value={postUrl} onChangeText={setPostUrl} placeholder="https://instagram.com/reel/... o x.com/..." placeholderTextColor="rgba(255,255,255,0.2)" style={{ flex: 1, color: '#fff', fontSize: 13.5, marginLeft: 10 }} autoCapitalize="none" autoCorrect={false} autoFocus />
                            <TouchableOpacity onPress={async () => { const text = await Clipboard.getStringAsync(); if (text) setPostUrl(text); }} style={{ padding: 7, marginLeft: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <ClipboardPaste size={15} color="rgba(255,255,255,0.45)" />
                            </TouchableOpacity>
                          </View>
                          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', lineHeight: 17, marginBottom: 22 }}>
                            Funciona con reels, videos y posts que tengan voz o texto visible.
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
                              <Text style={{ fontSize: 13, fontWeight: '900', color: '#fff' }}>𝕏</Text>
                              <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.75)' }}>Twitter</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: 'rgba(225,48,108,0.12)', borderWidth: 1, borderColor: 'rgba(225,48,108,0.35)' }}>
                              <LinearGradient colors={['#f09433', '#e6683c', '#dc2743', '#cc2366', '#bc1888']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ width: 18, height: 18, borderRadius: 5, alignItems: 'center', justifyContent: 'center' }}>
                                <View style={{ width: 9, height: 9, borderRadius: 4.5, borderWidth: 1.5, borderColor: '#fff' }} />
                                <View style={{ position: 'absolute', top: 2.5, right: 2.5, width: 2.5, height: 2.5, borderRadius: 1.25, backgroundColor: '#fff' }} />
                              </LinearGradient>
                              <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>Instagram</Text>
                            </View>
                          </View>
                          <TouchableOpacity onPress={handleExtractPost} disabled={!postUrl.trim()} activeOpacity={0.8}
                            style={{ backgroundColor: postUrl.trim() ? 'rgba(225,48,108,0.88)' : 'rgba(225,48,108,0.15)', borderRadius: 16, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: postUrl.trim() ? 'rgba(225,48,108,0.55)' : 'rgba(225,48,108,0.18)' }}>
                            <Text style={{ fontSize: 15, fontWeight: '800', letterSpacing: -0.2, color: postUrl.trim() ? '#fff' : 'rgba(255,255,255,0.22)' }}>Extraer</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </Pressable>
                  </KeyboardAvoidingView>
                </Modal>
              )}

              {/* Modal: Crear carpeta */}
              {showCreateFolderModal && (
                <Modal visible animationType="slide" transparent onRequestClose={() => setShowCreateFolderModal(false)}>
                  <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <Pressable style={{ flex: 1 }} onPress={() => setShowCreateFolderModal(false)} />
                    <Pressable onPress={e => e.stopPropagation()}>
                      <View style={{ backgroundColor: '#0d0f20', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.09)', paddingBottom: insets.bottom + 16, shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.5, shadowRadius: 24 }}>
                        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
                          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)' }} />
                        </View>
                        <View style={{ paddingHorizontal: 22, paddingTop: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                            <Text style={{ fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.4 }}>Nueva carpeta</Text>
                            <TouchableOpacity onPress={() => setShowCreateFolderModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                              <X size={14} color="rgba(255,255,255,0.45)" />
                            </TouchableOpacity>
                          </View>

                          {/* Nombre */}
                          <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 0.8, marginBottom: 8 }}>NOMBRE</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, borderWidth: 1, borderColor: newFolderName.trim() ? hexToRgba(newFolderColor, 0.5) : 'rgba(255,255,255,0.09)', paddingHorizontal: 14, height: 50, marginBottom: 22 }}>
                            <TextInput value={newFolderName} onChangeText={setNewFolderName} placeholder="Ej: Política, Economía, Deportes..." placeholderTextColor="rgba(255,255,255,0.2)" style={{ flex: 1, color: '#fff', fontSize: 14 }} autoFocus maxLength={40} />
                          </View>

                          {/* Color picker */}
                          <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 0.8, marginBottom: 10 }}>COLOR</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 }}>
                            {FOLDER_COLORS.map(c => (
                              <TouchableOpacity key={c.hex} onPress={() => setNewFolderColor(c.hex)} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.hex, alignItems: 'center', justifyContent: 'center', borderWidth: newFolderColor === c.hex ? 2.5 : 0, borderColor: '#fff', shadowColor: c.hex, shadowOpacity: newFolderColor === c.hex ? 0.7 : 0, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: newFolderColor === c.hex ? 4 : 0 }}>
                                {newFolderColor === c.hex && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' }} />}
                              </TouchableOpacity>
                            ))}
                          </View>

                          {/* Preview */}
                          <View style={{ backgroundColor: hexToRgba(newFolderColor, 0.08), borderRadius: 14, borderWidth: 1, borderColor: hexToRgba(newFolderColor, 0.25), paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: newFolderColor }} />
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', flex: 1 }} numberOfLines={1}>{newFolderName || 'Mi carpeta'}</Text>
                            <Text style={{ fontSize: 11, color: hexToRgba(newFolderColor, 0.8), fontWeight: '600' }}>0 posts</Text>
                          </View>

                          <TouchableOpacity onPress={handleCreateFolder} disabled={!newFolderName.trim() || savingFolder} activeOpacity={0.8} style={{ backgroundColor: newFolderName.trim() ? newFolderColor : hexToRgba(newFolderColor, 0.2), borderRadius: 16, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' }}>
                            {savingFolder ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontSize: 15, fontWeight: '800', color: newFolderName.trim() ? '#fff' : 'rgba(255,255,255,0.25)', letterSpacing: -0.2 }}>Crear carpeta</Text>}
                          </TouchableOpacity>
                        </View>
                      </View>
                    </Pressable>
                  </KeyboardAvoidingView>
                </Modal>
              )}

              {/* Modal: Mover post a carpeta */}
              {showMoveModal && movingPost && (
                <Modal visible animationType="slide" transparent onRequestClose={() => { setShowMoveModal(false); setMovingPost(null); }}>
                  <Pressable style={{ flex: 1 }} onPress={() => { setShowMoveModal(false); setMovingPost(null); }} />
                  <View style={{ backgroundColor: '#0d0f20', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.09)', paddingBottom: insets.bottom + 16, shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.5, shadowRadius: 24 }}>
                    <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
                      <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)' }} />
                    </View>
                    <View style={{ paddingHorizontal: 22, paddingTop: 4, paddingBottom: 8 }}>
                      <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 4 }}>Mover a carpeta</Text>
                      <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 20 }} numberOfLines={1}>{movingPost.name}</Text>

                      {/* Sin carpeta */}
                      {(() => {
                        const isCurrentlyUncategorized = !movingPost.folder_id;
                        return (
                          <TouchableOpacity
                            onPress={() => handleMovePostToFolder(null)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: isCurrentlyUncategorized ? 'rgba(255,255,255,0.1)' : 'transparent', marginBottom: 6 }}
                          >
                            <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 18, gap: 2 }}>
                                {[0,1,2,3].map(i => <View key={i} style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' }} />)}
                              </View>
                            </View>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff', flex: 1 }}>Sin carpeta</Text>
                            {isCurrentlyUncategorized && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: '500' }}>Actual</Text>
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })()}

                      {/* Carpetas del usuario */}
                      {folders.map(folder => {
                        const isCurrentFolder = movingPost.folder_id === folder.id;
                        return (
                          <TouchableOpacity key={folder.id} onPress={() => handleMovePostToFolder(folder.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: isCurrentFolder ? hexToRgba(folder.color, 0.15) : 'transparent', marginBottom: 4, borderWidth: isCurrentFolder ? 1 : 0, borderColor: hexToRgba(folder.color, 0.3) }}>
                            <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: hexToRgba(folder.color, 0.18), alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: hexToRgba(folder.color, 0.35) }}>
                              <View style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: hexToRgba(folder.color, 0.7), borderTopLeftRadius: 1 }} />
                            </View>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff', flex: 1 }}>{folder.name}</Text>
                            <Text style={{ fontSize: 11, color: hexToRgba(folder.color, 0.7), fontWeight: '600' }}>{instagramPosts.filter(p => p.folder_id === folder.id).length}</Text>
                            {isCurrentFolder && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ fontSize: 10, color: hexToRgba(folder.color, 0.65), fontWeight: '500' }}>Actual</Text>
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: folder.color }} />
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}

                      {folders.length === 0 && (
                        <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>No tienes carpetas aún.</Text>
                          <TouchableOpacity onPress={() => { setShowMoveModal(false); setMovingPost(null); setShowCreateFolderModal(true); }} style={{ marginTop: 10 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#E1306C' }}>Crear carpeta</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                </Modal>
              )}

              {/* ── Vista principal: grid carpetas o lista posts ── */}
              {showFolderView ? (
                /* Vista de carpetas */
                <View style={{ flex: 1 }}>
                  {/* Header bar: título + botones */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 8, gap: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: INK.body, flex: 1 }} numberOfLines={1}>
                      {instagramPosts.length} post{instagramPosts.length !== 1 ? 's' : ''}
                    </Text>
                    <TouchableOpacity onPress={() => setShowCreateFolderModal(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: 'rgba(28,43,34,0.09)' }}>
                      <Plus size={13} color={INK.meta} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: INK.meta }}>Carpeta</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowAddPostModal(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 11, backgroundColor: '#E1306C' }}>
                      <Plus size={13} color="#fff" />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Post</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Hint de gestión — visible antes de entrar a cualquier carpeta */}
                  {folders.length > 0 && instagramPosts.length > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 24, marginBottom: 12 }}>
                      <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.6)' }} />
                      <Text style={{ fontSize: 11, color: INK.faint, fontStyle: 'italic' }}>
                        Entra a una carpeta y mantén presionado un post para moverlo
                      </Text>
                    </View>
                  )}

                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 19, paddingBottom: 48 }}>
                    {isLoadingPosts || isLoadingFolders ? (
                      <View style={{ paddingTop: 60, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="rgba(225,48,108,0.8)" />
                      </View>
                    ) : (
                      <>
                        {/* Grid 2 columnas */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                          {/* Todos los posts */}
                          <View style={{ width: '50%' }}>
                            <AllPostsFolder
                              count={instagramPosts.length}
                              onPress={() => { setSelectedFolderId(null); setShowFolderView(false); }}
                            />
                          </View>

                          {/* Carpetas del usuario */}
                          {folders.map(folder => {
                            const folderPosts = instagramPosts.filter(p => p.folder_id === folder.id);
                            const thumbs = folderPosts.slice(0, 3).map(p => p.thumbnail_url || p.details?.thumbnail_url || p.details?.images?.[0]).filter(Boolean);
                            return (
                              <View key={folder.id} style={{ width: '50%' }}>
                                <FolderCard
                                  folder={folder}
                                  postCount={folderPosts.length}
                                  previewThumbs={thumbs}
                                  onPress={() => { setSelectedFolderId(folder.id); setShowFolderView(false); }}
                                  onLongPress={() => handleDeleteFolder(folder)}
                                />
                              </View>
                            );
                          })}

                          {/* Sin carpeta — solo si hay posts sin asignar */}
                          {instagramPosts.filter(p => !p.folder_id).length > 0 && (
                            <View style={{ width: '50%' }}>
                              <FolderCard
                                folder={{ id: '__uncategorized__', name: 'Sin carpeta', color: '#B0A8A4' }}
                                postCount={instagramPosts.filter(p => !p.folder_id).length}
                                previewThumbs={instagramPosts.filter(p => !p.folder_id).slice(0, 3).map(p => p.thumbnail_url || p.details?.thumbnail_url || p.details?.images?.[0]).filter(Boolean)}
                                onPress={() => { setSelectedFolderId('__uncategorized__'); setShowFolderView(false); }}
                                onLongPress={() => {
                                  Alert.alert(
                                    'Posts sin carpeta',
                                    `Tienes ${instagramPosts.filter(p => !p.folder_id).length} post${instagramPosts.filter(p => !p.folder_id).length !== 1 ? 's' : ''} sin organizar. Entra y usa "mantén presionado" en cada post para moverlos a una carpeta.`,
                                    [
                                      { text: 'Entrar', onPress: () => { setSelectedFolderId('__uncategorized__'); setShowFolderView(false); } },
                                      { text: 'Cancelar', style: 'cancel' },
                                    ]
                                  );
                                }}
                              />
                            </View>
                          )}
                        </View>

                        {/* Empty state */}
                        {instagramPosts.length === 0 && folders.length === 0 && (
                          <View style={{ alignItems: 'center', paddingTop: 40 }}>
                            <Camera size={32} color="rgba(225,48,108,0.4)" style={{ marginBottom: 12 }} />
                            <Text style={{ fontSize: 15, fontWeight: '700', color: INK.meta, marginBottom: 6 }}>Sin posts aún</Text>
                            <Text style={{ fontSize: 13, color: INK.faint, textAlign: 'center', lineHeight: 19 }}>Agrega tu primer post o crea una carpeta para organizarlos.</Text>
                          </View>
                        )}
                      </>
                    )}
                  </ScrollView>
                </View>
              ) : (
                /* Vista de lista de posts (dentro de una carpeta) */
                <View style={{ flex: 1 }}>
                  {/* Back + título */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 14, gap: 10 }}>
                    <TouchableOpacity onPress={() => setShowFolderView(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: 'rgba(28,43,34,0.09)', alignItems: 'center', justifyContent: 'center' }}>
                      <ChevronLeft size={18} color={INK.body} />
                    </TouchableOpacity>
                    {(() => {
                      if (selectedFolderId === null) return <Text style={{ fontSize: 17, fontWeight: '800', color: INK.title, flex: 1 }}>Todos los posts</Text>;
                      if (selectedFolderId === '__uncategorized__') return <Text style={{ fontSize: 17, fontWeight: '800', color: INK.title, flex: 1 }}>Sin carpeta</Text>;
                      const f = folders.find(f => f.id === selectedFolderId);
                      return (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: f?.color || '#E1306C' }} />
                          <Text style={{ fontSize: 17, fontWeight: '800', color: INK.title }}>{f?.name || 'Carpeta'}</Text>
                        </View>
                      );
                    })()}
                    <TouchableOpacity onPress={() => setShowAddPostModal(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10, backgroundColor: '#E1306C' }}>
                      <Plus size={13} color="#fff" />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Agregar</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Lista filtrada */}
                  {isLoadingPosts ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <ActivityIndicator size="large" color="rgba(225,48,108,0.8)" />
                    </View>
                  ) : (() => {
                    const filtered = selectedFolderId === null
                      ? instagramPosts
                      : selectedFolderId === '__uncategorized__'
                      ? instagramPosts.filter(p => !p.folder_id)
                      : instagramPosts.filter(p => p.folder_id === selectedFolderId);
                    return (
                      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
                        {filtered.length === 0 ? (
                          <View style={{ alignItems: 'center', paddingTop: 48 }}>
                            <Camera size={28} color="rgba(225,48,108,0.35)" style={{ marginBottom: 10 }} />
                            <Text style={{ fontSize: 14, color: INK.faint }}>No hay posts en esta carpeta</Text>
                            <Text style={{ fontSize: 12, color: INK.faint, marginTop: 4, textAlign: 'center' }}>Mantén presionado cualquier post para moverlo aquí</Text>
                          </View>
                        ) : (
                          <>
                            {/* Hint sutil de mover — solo si hay carpetas disponibles */}
                            {folders.length > 0 && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, paddingHorizontal: 4 }}>
                                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.6)' }} />
                                <Text style={{ fontSize: 11, color: INK.faint, fontStyle: 'italic' }}>
                                  Mantén presionado un post para moverlo a otra carpeta
                                </Text>
                              </View>
                            )}
                            {filtered.map(post => {
                              const isReel = post.tags?.includes('reel') || post.details?.is_reel;
                              const isTwitter = post.tags?.includes('twitter') || post.tags?.includes('x') || post.details?.is_twitter;
                              const transcription = post.details?.transcription;
                              const thumbUri = post.thumbnail_url || post.details?.thumbnail_url || post.details?.images?.[0];
                              return (
                                <PostCard
                                  key={post.id}
                                  post={post}
                                  isReel={isReel}
                                  isTwitter={isTwitter}
                                  transcription={transcription}
                                  thumbUri={thumbUri}
                                  onLongPress={() => { setMovingPost(post); setShowMoveModal(true); }}
                                />
                              );
                            })}
                          </>
                        )}
                      </ScrollView>
                    );
                  })()}
                </View>
              )}
            </View>
          ) : (
            /* ── Codex: la pila (Espacios / Todo) ── */
            <SpacesStack
              spaces={spaces}
              universeItems={wikiItems}
              loading={isLoadingWiki || isLoadingSpaces}
              mode={stackMode}
              onModeChange={setStackMode}
              onOpenItem={(item) => setDetailItem(item)}
              onOpenSpace={(space, origen) => {
                setOpenSpace(space);
              }}
              onNewItem={() => setShowAgregar(true)}
              onNewSpace={() => setShowCreateSpace(true)}
            />
          )}
        </View>
      )}
    </View>
  );
}
