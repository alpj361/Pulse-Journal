import { useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, BookmarkCheck, FileText, GraduationCap, List, Play, Quote, AudioLines, School, Link2 } from 'lucide-react-native';
import { INK } from '../theme';
import { MONO } from '../codex/mono';
import IconoMaterial from '../codex/IconoMaterial';
import { MATERIAL } from '../codex/materiales';
import { cambiarEstado, fechaGuardado, infoTipo, tipoDeBookmark, traerBookmarks } from './bookmarks';
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
export default function GuardadosDelPost({ postId, items = [] }) {
  const cliente = useQueryClient();
  const [ocupado, setOcupado] = useState(null);
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

  return (
    <View style={{ marginTop: 18, marginBottom: 8 }}>
      <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, marginBottom: 4 }}>en tu biblioteca</Text>
      {items.map((it) => (
        <FilaGuardado key={it.id} item={it} ocupado={ocupado === it.id}
          onAbrir={it.bookmark?.url ? () => { roce(); Linking.openURL(it.bookmark.url).catch(() => {}); } : undefined}
          onRevisado={() => alternarRevisado(it)} />
      ))}
    </View>
  );
}

/** Un guardado: imagen o ícono, nombre, tipo y fecha, y la marca de revisado. */
export function FilaGuardado({ item: it, ocupado = false, onAbrir, onRevisado }) {
  const tipo = tipoDeBookmark(it);
  const info = infoTipo(tipo);
  const revisado = it.bookmark?.status === 'reviewed';
  const Marca = revisado ? BookmarkCheck : Bookmark;
  const fecha = fechaGuardado(it.bookmark?.saved_at);
  const imagen = it.bookmark?.image_url;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: RAYA }}>
      <Pressable onPress={onAbrir} disabled={!onAbrir} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.55 : 1 })}
        accessibilityRole="button" accessibilityLabel={`${it.name}, ${info.etiqueta}${fecha ? `, guardado el ${fecha}` : ''}`}>
        {imagen ? (
          <Image source={{ uri: imagen }} style={{ width: 40, height: 56, borderRadius: 6, backgroundColor: 'rgba(28,43,34,0.06)' }} />
        ) : (
          <View style={{ width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: `${info.color}14` }}>
            <IconoGuardado tipo={tipo} size={17} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{ fontFamily: MONO, fontSize: 13, color: INK.title, lineHeight: 18 }}>{it.name}</Text>
          <Text style={{ fontFamily: MONO, fontSize: 11, color: TENUE, marginTop: 3 }}>
            <Text style={{ color: info.color }}>{info.etiqueta}</Text>
            {fecha ? ` · ${fecha}` : ''}
          </Text>
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
