import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import ItemDetailSheet from '../codex/ItemDetailSheet';
import CreateSnippetSheet from '../codex/CreateSnippetSheet';
import PostDetailSheet from '../posts/PostDetailSheet';
import { itemCompartido } from './api';

const CAMPOS = 'id, name, tipo, description, aliases, tags, details, geo, thumbnail_url, created_at, folder_id';

/** Lo que compartiste, completo: del universo, o un documento de `codex_items`. */
async function traerMio(id) {
  const { data: u, error } = await supabase.from('codex_universe_items').select(CAMPOS).eq('id', id).maybeSingle();
  if (error) throw error;
  if (u) return u;
  const { data: d } = await supabase.from('codex_items').select('id, titulo, tipo, descripcion, url, created_at').eq('id', id).maybeSingle();
  return d ? { id: d.id, name: d.titulo, tipo: d.tipo, description: d.descripcion, details: d.url ? { url: d.url } : {}, created_at: d.created_at } : null;
}

/** Algo de otra persona que te compartió: lo trae el servidor, en lectura. */
async function traerAjeno(id) {
  const it = await itemCompartido(id);
  if (!it) return null;
  return { ...it, name: it.name || it.titulo, description: it.description ?? it.descripcion ?? it.content ?? null, details: it.details || {} };
}

const claveDe = (it) => String(it?.tipo || it?.item_type || '').toLowerCase();

/**
 * Algo tuyo que le compartiste a un agente, abierto con su propia pantalla:
 * el post con su análisis, la nota completa (en lectura) y lo demás en su ficha.
 */
export default function AbrirMio({ id, ajeno = false, topInset = 0, bottomInset = 0, onClose }) {
  const { data: item } = useQuery({
    queryKey: ['codex-mio', id, ajeno],
    queryFn: () => (ajeno ? traerAjeno(id) : traerMio(id)),
    enabled: !!id,
    staleTime: 1000 * 60,
    retry: false,
  });
  if (!item) return null;
  const clave = claveDe(item);
  if (clave === 'post') {
    return <PostDetailSheet post={item} soloLectura onClose={onClose} topInset={topInset} bottomInset={bottomInset} />;
  }
  // La nota de otra persona no se puede cargar en tu hoja de notas (no es
  // tuya): se lee en su ficha.
  if (clave === 'snippet' && !ajeno) {
    return <CreateSnippetSheet restaurarId={item.id} soloLectura onClose={onClose} topInset={topInset} bottomInset={bottomInset} />;
  }
  return <ItemDetailSheet item={item} soloLectura bottomInset={bottomInset} onClose={onClose} />;
}
