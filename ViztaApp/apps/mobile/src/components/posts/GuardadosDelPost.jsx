import { useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Bookmark, BookmarkCheck, BrainCircuit, FileText, GraduationCap, List, Play, Quote, AudioLines, School, Link2 } from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import { MONO } from '../codex/mono';
import IconoMaterial from '../codex/IconoMaterial';
import { MATERIAL } from '../codex/materiales';
import { cambiarEstado, fechaGuardado, identidadesWikidata, infoTipo, ordenarGuardados, qDe, traerBookmarks } from './bookmarks';
import { roce, toque, falla } from '../../utils/haptics';

const TENUE = 'rgba(28,43,34,0.35)';
const RAYA = 'rgba(28,43,34,0.07)';

const ICONOS_OTROS = {
  article: FileText,
  paper: GraduationCap,
  list: List,
  reference: Quote,
  post: Link2,
  video: Play,
  audio: AudioLines,
  course: School,
  other: Bookmark,
  modelo: BrainCircuit,
};

/** El ícono de un tipo de guardado: el del material si lo es, si no uno propio. */
export function IconoGuardado({ tipo, size = 14 }) {
  if (MATERIAL[tipo]) return <IconoMaterial material={tipo} size={size} />;
  const Icono = ICONOS_OTROS[tipo] || Bookmark;
  return <Icono size={size} color={infoTipo(tipo).color} strokeWidth={2} />;
}

/** Lo que se guardó en la biblioteca desde un post (Bookmarks con ese origen). */
export function useGuardadosDelPost(postId, activo = true) {
  return useQuery({
    queryKey: ['bookmarks-del-post', postId],
    enabled: activo && !!postId,
    staleTime: 30 * 1000,
    queryFn: async () => (await traerBookmarks({ originId: postId, limit: 50 })).items.filter((it) => it.bookmark?.status !== 'archived'),
  });
}

/**
 * Lo que se guardó en la biblioteca desde este post: la obra de la que habla,
 * el libro o la lista que menciona. Llega solo cuando el análisis lo identifica
 * o desde la hoja de compartir. Cada fila abre su enlace; la marca de la
 * derecha la da por revisada. Sin guardados, la sección no aparece.
 */
export default function GuardadosDelPost({ postId, items = [], destacar = false, miniatura = null }) {
  const cliente = useQueryClient();
  const [ocupado, setOcupado] = useState(null);
  // El logo y si es un modelo, de Wikidata (donde se identificó la herramienta).
  const ids = [...new Set(items.map(qDe).filter(Boolean))].sort();
  const { data: identidades = {} } = useQuery({
    queryKey: ['wikidata-identidad', ids.join(',')],
    queryFn: () => identidadesWikidata(ids),
    enabled: ids.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
  });
  if (!items.length) return null;

  const alternarRevisado = async (it) => {
    if (ocupado) return;
    setOcupado(it.id);
    const nuevo = it.bookmark?.status === 'reviewed' ? 'pending' : 'reviewed';
    try {
      await cambiarEstado(it, nuevo);
      toque();
      cliente.setQueryData(['bookmarks-del-post', postId], (prev = []) =>
        prev.map((x) => (x.id === it.id ? { ...x, bookmark: { ...x.bookmark, status: nuevo, revision: (x.bookmark?.revision || 0) + 1 } } : x))
      );
    } catch {
      falla();
      cliente.invalidateQueries({ queryKey: ['bookmarks-del-post', postId] });
    } finally {
      setOcupado(null);
    }
  };

  const abrir = (it) => (it.bookmark?.url ? () => { roce(); Linking.openURL(it.bookmark.url).catch(() => {}); } : undefined);
  // Los modelos van dentro de la herramienta que los usa; el resto, en fila.
  const { principal, modelos, resto } = ordenarGuardados(items, identidades, miniatura);
  const fila = (v, conModelos = []) => (
    <FilaGuardado key={v.item.id} guardado={v} modelos={conModelos} ocupado={ocupado === v.item.id}
      onAbrir={abrir(v.item)} onRevisado={() => alternarRevisado(v.item)} />
  );
  return (
    <View style={{ marginTop: 18, marginBottom: 8 }}>
      {destacar && principal ? (
        <Protagonista guardado={principal} modelos={modelos} ocupado={ocupado === principal.item.id}
          onAbrir={abrir(principal.item)} onRevisado={() => alternarRevisado(principal.item)} />
      ) : null}
      {(destacar ? resto : [principal, ...resto].filter(Boolean)).length ? (
        <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, marginBottom: 4, marginTop: destacar ? 18 : 0 }}>en tu biblioteca</Text>
      ) : null}
      {destacar ? resto.map((v) => fila(v)) : [principal, ...resto].filter(Boolean).map((v) => fila(v, v === principal ? modelos : []))}
    </View>
  );
}

/**
 * La imagen de un guardado: su logo o póster; sin imagen, el ícono de su tipo
 * en un recuadro. Es el único ícono del tipo: al lado no se repite.
 */
function Imagen({ guardado: v, grande = false }) {
  const info = infoTipo(v.tipo);
  const esLogo = ['tool', 'modelo', 'website', 'product'].includes(v.tipo);
  const lado = grande ? 84 : 40;
  if (v.imagen && esLogo) {
    // Un logo va entero y con aire, sobre blanco.
    const aire = grande ? 14 : 7;
    return (
      <View style={{ width: lado, height: lado, borderRadius: grande ? 18 : 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(28,43,34,0.08)', padding: aire }}>
        <Image source={{ uri: v.imagen }} resizeMode="contain" style={{ width: lado - aire * 2 - 2, height: lado - aire * 2 - 2 }} />
      </View>
    );
  }
  if (v.imagen) {
    return <Image source={{ uri: v.imagen }} resizeMode="cover" style={{ width: lado, height: grande ? 120 : 56, borderRadius: grande ? 10 : 6, backgroundColor: 'rgba(28,43,34,0.06)' }} />;
  }
  return (
    <View style={{ width: lado, height: lado, borderRadius: grande ? 18 : 10, alignItems: 'center', justifyContent: 'center', backgroundColor: `${info.color}14` }}>
      <IconoGuardado tipo={v.tipo} size={grande ? 30 : 17} />
    </View>
  );
}

/** «modelo GPT-6 Astra»: los modelos que usa la herramienta, en una línea. */
function LineaModelos({ modelos }) {
  if (!modelos.length) return null;
  return (
    <Text style={{ fontFamily: MONO, fontSize: 12, color: INK.meta, marginTop: 2 }}>
      {modelos.length === 1 ? 'modelo ' : 'modelos '}
      <Text style={{ color: INK.title }}>{modelos.map((m) => m.item.name).join(', ')}</Text>
    </Text>
  );
}

/**
 * Lo que el post presenta, en grande: su logo o carátula (o el ícono de su
 * tipo), el tipo en palabra, el nombre en la serif de los titulares, los
 * modelos que usa si es una herramienta, y para abrirlo.
 */
function Protagonista({ guardado: v, modelos = [], ocupado, onAbrir, onRevisado }) {
  const it = v.item;
  const info = infoTipo(v.tipo);
  const revisado = it.bookmark?.status === 'reviewed';
  const Marca = revisado ? BookmarkCheck : Bookmark;
  return (
    <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
      <Imagen guardado={v} grande />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontFamily: MONO, fontSize: 11.5, color: info.color }}>{info.etiqueta}</Text>
        <Text style={{ fontFamily: SERIF, fontSize: 28, lineHeight: 31, color: INK.title }}>{it.name}</Text>
        <LineaModelos modelos={modelos} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 }}>
          {onAbrir ? (
            <Pressable onPress={onAbrir} hitSlop={8} accessibilityRole="link" accessibilityLabel={`Abrir ${it.name}`}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: pressed ? 0.5 : 1 })}>
              <Text style={{ fontFamily: MONO, fontSize: 12.5, color: INK.title }}>abrir</Text>
              <ArrowUpRight size={14} color={INK.title} />
            </Pressable>
          ) : null}
          <Pressable onPress={onRevisado} disabled={ocupado} hitSlop={8} accessibilityRole="button" accessibilityState={{ checked: revisado }}
            accessibilityLabel={revisado ? `${it.name}, revisado. Marcar por revisar` : `${it.name}, por revisar. Marcar revisado`}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, opacity: ocupado ? 0.4 : pressed ? 0.5 : 1 })}>
            <Marca size={15} color={revisado ? info.color : INK.meta} strokeWidth={1.8} />
            <Text style={{ fontFamily: MONO, fontSize: 12.5, color: revisado ? info.color : INK.meta }}>{revisado ? 'revisado' : 'por revisar'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** Un guardado en fila: su imagen, nombre, tipo y fecha, y la marca de revisado. */
export function FilaGuardado({ guardado: v, modelos = [], ocupado = false, onAbrir, onRevisado }) {
  const it = v.item;
  const info = infoTipo(v.tipo);
  const revisado = it.bookmark?.status === 'reviewed';
  const Marca = revisado ? BookmarkCheck : Bookmark;
  const fecha = fechaGuardado(it.bookmark?.saved_at);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: RAYA }}>
      <Pressable onPress={onAbrir} disabled={!onAbrir} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.55 : 1 })}
        accessibilityRole="button" accessibilityLabel={`${it.name}, ${info.etiqueta}${fecha ? `, guardado el ${fecha}` : ''}`}>
        <Imagen guardado={v} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{ fontFamily: MONO, fontSize: 13, color: INK.title, lineHeight: 18 }}>{it.name}</Text>
          <Text style={{ fontFamily: MONO, fontSize: 11, color: TENUE, marginTop: 3 }}>
            <Text style={{ color: info.color }}>{info.etiqueta}</Text>
            {fecha ? ` · ${fecha}` : ''}
          </Text>
          <LineaModelos modelos={modelos} />
        </View>
      </Pressable>
      {onRevisado ? (
        <Pressable onPress={onRevisado} disabled={ocupado} hitSlop={10} style={{ padding: 6, opacity: ocupado ? 0.4 : 1 }}
          accessibilityRole="button" accessibilityState={{ checked: revisado }}
          accessibilityLabel={revisado ? `${it.name}, revisado. Marcar por revisar` : `${it.name}, por revisar. Marcar revisado`}>
          <Marca size={18} color={revisado ? info.color : 'rgba(28,43,34,0.35)'} strokeWidth={1.8} />
        </Pressable>
      ) : null}
    </View>
  );
}
