import { useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Bookmark, BookmarkCheck, FileText, GraduationCap, List, Play, Quote, AudioLines, School, Link2 } from 'lucide-react-native';
import { INK, SERIF } from '../theme';
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
export default function GuardadosDelPost({ postId, items = [], destacar = false }) {
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

  const abrir = (it) => (it.bookmark?.url ? () => { roce(); Linking.openURL(it.bookmark.url).catch(() => {}); } : undefined);
  // En un post breve, lo guardado es lo principal: el primero va grande.
  const [primero, ...resto] = destacar ? items : [null, ...items];
  return (
    <View style={{ marginTop: 18, marginBottom: 8 }}>
      {primero ? <Protagonista item={primero} ocupado={ocupado === primero.id} onAbrir={abrir(primero)} onRevisado={() => alternarRevisado(primero)} /> : null}
      {resto.length ? <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, marginBottom: 4, marginTop: primero ? 18 : 0 }}>en tu biblioteca</Text> : null}
      {resto.map((it) => (
        <FilaGuardado key={it.id} item={it} ocupado={ocupado === it.id}
          onAbrir={abrir(it)}
          onRevisado={() => alternarRevisado(it)} />
      ))}
    </View>
  );
}

/**
 * Lo que el post presenta, en grande: la carátula o el ícono del tipo, el
 * nombre en la serif de los titulares, su tipo y, si tiene enlace, para abrirlo.
 */
function Protagonista({ item: it, ocupado, onAbrir, onRevisado }) {
  const tipo = tipoDeBookmark(it);
  const info = infoTipo(tipo);
  const revisado = it.bookmark?.status === 'reviewed';
  const Marca = revisado ? BookmarkCheck : Bookmark;
  const imagen = it.bookmark?.image_url;
  return (
    <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
      {imagen ? (
        <Image source={{ uri: imagen }} style={{ width: 84, height: 120, borderRadius: 10, backgroundColor: 'rgba(28,43,34,0.06)' }} />
      ) : (
        <View style={{ width: 84, height: 84, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: `${info.color}14` }}>
          <IconoGuardado tipo={tipo} size={30} />
        </View>
      )}
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <IconoGuardado tipo={tipo} size={13} />
          <Text style={{ fontFamily: MONO, fontSize: 11.5, color: info.color }}>{info.etiqueta}</Text>
        </View>
        <Text style={{ fontFamily: SERIF, fontSize: 28, lineHeight: 31, color: INK.title }}>{it.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 }}>
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
