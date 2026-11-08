import { supabase } from '../../utils/supabase';
import { EXTRACTORW_URL } from '../../utils/servicios';
import { MATERIAL } from '../codex/materiales';

/**
 * Los guardados de la biblioteca (Bookmarks, STA-299 / STA-334).
 *
 * Un Bookmark es algo que la persona guardó para revisar después: una película
 * de la que habla un reel, un artículo, un paper, una lista. Llegan solos
 * (el servidor los crea cuando un post identifica una obra) o desde la hoja de
 * compartir. Se leen del servidor, no de la tabla: el contrato (`bookmark/1`)
 * cuida la cuenta, la revisión y los vínculos rotos.
 *
 * Contrato: ExtractorW docs/backend/BOOKMARK_AUXILIAR.md.
 */

/** Los tipos que no son materiales del Codex; los demás toman nombre y color de `MATERIAL`. */
const OTROS = {
  article: { etiqueta: 'artículo', plural: 'artículos', color: '#1D4ED8' },
  list: { etiqueta: 'lista', plural: 'listas', color: '#4D7C0F' },
  reference: { etiqueta: 'referencia', plural: 'referencias', color: '#6D28D9' },
  post: { etiqueta: 'post', plural: 'posts', color: '#DB2777' },
  video: { etiqueta: 'video', plural: 'videos', color: '#DC2626' },
  audio: { etiqueta: 'audio', plural: 'audios', color: '#9333EA' },
  course: { etiqueta: 'curso', plural: 'cursos', color: '#0369A1' },
  other: { etiqueta: 'guardado', plural: 'guardados', color: '#64748B' },
};
const PAPER = { etiqueta: 'paper', plural: 'papers', color: '#1E3A8A' };

/** El tipo con que se muestra: «paper» es un artículo con la etiqueta `paper`. */
export function tipoDeBookmark(item) {
  const kind = item?.bookmark?.kind || 'other';
  if (kind === 'article' && (item?.tags || []).includes('paper')) return 'paper';
  return MATERIAL[kind] || OTROS[kind] ? kind : 'other';
}

/** Nombre, plural y color de un tipo. */
export function infoTipo(tipo) {
  if (tipo === 'paper') return PAPER;
  return MATERIAL[tipo] || OTROS[tipo] || OTROS.other;
}

/** Los tipos presentes en una lista, en el orden en que más aparecen. */
export function tiposPresentes(items = []) {
  const cuenta = new Map();
  for (const it of items) {
    const t = tipoDeBookmark(it);
    cuenta.set(t, (cuenta.get(t) || 0) + 1);
  }
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1]).map(([tipo, n]) => ({ tipo, n }));
}

/** «8 nov»: la fecha en que se guardó (no la de la obra). */
export function fechaGuardado(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const mismoAnio = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('es-GT', { day: 'numeric', month: 'short', ...(mismoAnio ? {} : { year: 'numeric' }) });
}

const plano = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** ¿Hay un guardado de esta obra? El nombre automático es «Título (año)». */
export function guardadoDeLaObra(items = [], obra) {
  if (!obra?.titulo) return null;
  const t = plano(obra.titulo);
  return items.find((it) => plano(it.name).replace(/\s*\(\d{4}\)$/, '') === t) || null;
}

async function pedir(ruta, opciones = {}) {
  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (!token) throw new Error('Sin sesión activa');
  const res = await fetch(`${EXTRACTORW_URL}/api/codex/bookmarks${ruta}`, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opciones.headers || {}) },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) throw new Error(json?.message || `El servicio respondió ${res.status}`);
  return json;
}

/** Una página de guardados: `{ items, total, siguiente }`. Con `originId`, los de un post. */
export async function traerBookmarks({ originId = null, kind = null, status = null, limit = 50, offset = 0 } = {}) {
  const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (originId) q.set('origin_id', originId);
  if (kind) q.set('kind', kind);
  if (status) q.set('status', status);
  const json = await pedir(`?${q.toString()}`);
  const items = json.items || json.bookmarks || [];
  const p = json.pagination || {};
  return { items, total: p.total ?? items.length, siguiente: p.has_more ? p.next_offset : null };
}

/** Marcar revisado, archivado o pendiente. Devuelve el guardado con su revisión nueva. */
export async function cambiarEstado(item, status) {
  const json = await pedir(`/${item.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ expected_revision: item.bookmark?.revision, bookmark: { status } }),
  });
  return json.item || json;
}
