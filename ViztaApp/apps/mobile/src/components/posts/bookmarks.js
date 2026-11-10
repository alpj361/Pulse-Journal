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
  modelo: { etiqueta: 'modelo', plural: 'modelos', color: '#7C3AED' },
};
const PAPER = { etiqueta: 'paper', plural: 'papers', color: '#1E3A8A' };

/** El tipo con que se muestra: «paper» es un artículo con la etiqueta `paper`. */
export function tipoDeBookmark(item) {
  const kind = item?.bookmark?.kind || 'other';
  if (kind === 'article' && (item?.tags || []).includes('paper')) return 'paper';
  // Un modelo de lenguaje (GPT-6, Claude) es una herramienta, pero no la app que lo usa.
  if (kind === 'tool' && (item?.tags || []).includes('modelo')) return 'modelo';
  return MATERIAL[kind] || OTROS[kind] ? kind : 'other';
}

/**
 * La imagen de un guardado, si es suya. Los guardados viejos traían la
 * miniatura del post como imagen: no es del material, y se descarta.
 */
export function imagenDe(item, miniaturaDelPost = null) {
  const url = item?.bookmark?.image_url || null;
  if (!url) return null;
  if (miniaturaDelPost && url === miniaturaDelPost) return null;
  if (/cdninstagram\.com|fbcdn\.net|twimg\.com/.test(url)) return null;
  return url;
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

// ─── Identidad desde Wikidata: el logo y si es un modelo ──────────────────────

const ES_MODELO = /modelo de lenguaje|language model|modelo de (inteligencia artificial|ia)\b/i;
const ES_APLICACION = /\bbot\b|chatbot|aplicaci[oó]n|application|asistente|assistant|servicio|sitio web|plataforma/i;

/** ¿La descripción de Wikidata es la de un modelo (GPT-6) y no la de una app (ChatGPT)? */
export const esModelo = (descripcion) => ES_MODELO.test(descripcion || '') && !ES_APLICACION.test(descripcion || '');

/** El id de Wikidata de un guardado identificado ahí (`https://www.wikidata.org/wiki/Q…`). */
export const qDe = (item) => String(item?.bookmark?.url || '').match(/wikidata\.org\/wiki\/(Q\d+)/)?.[1] || null;

/** La imagen de Commons de un archivo de Wikidata, en PNG de 256 px. */
export const archivoACommons = (archivo) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(String(archivo).replace(/ /g, '_'))}?width=256`;

/**
 * Logo (P154, o imagen P18) y si es modelo, para varios ids de Wikidata en una
 * consulta. `{ Q…: { logo, modelo } }`. Si falla, vacío: el guardado queda con
 * el ícono de su tipo.
 */
export async function identidadesWikidata(ids = []) {
  const lista = [...new Set(ids.filter(Boolean))].slice(0, 50);
  if (!lista.length) return {};
  try {
    const res = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims%7Cdescriptions&languages=es%7Cen&ids=${lista.join('%7C')}`
    );
    const j = await res.json();
    const out = {};
    for (const id of lista) {
      const e = j?.entities?.[id];
      if (!e) continue;
      const c = e.claims || {};
      const archivo = [...(c.P154 || []), ...(c.P18 || [])].map((x) => x?.mainsnak?.datavalue?.value).find((v) => typeof v === 'string');
      const descripcion = e.descriptions?.es?.value || e.descriptions?.en?.value || '';
      out[id] = { logo: archivo ? archivoACommons(archivo) : null, modelo: esModelo(descripcion) };
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Los guardados de un post, ordenados para mostrarse: cada uno con su imagen
 * (la suya o el logo de Wikidata, nunca la miniatura del post) y su tipo (un
 * modelo es «modelo»). Los modelos van dentro de la herramienta del mismo post
 * que los usa (GPT-6 Astra en ChatGPT): no son otra herramienta al mismo nivel.
 * Devuelve `{ principal, modelos, resto }`.
 */
export function ordenarGuardados(items = [], identidades = {}, miniaturaDelPost = null) {
  const vistos = items.map((it) => {
    const wd = identidades[qDe(it)] || null;
    const tipo = wd?.modelo ? 'modelo' : tipoDeBookmark(it);
    return { item: it, tipo, imagen: imagenDe(it, miniaturaDelPost) || wd?.logo || null };
  });
  const herramienta = vistos.find((v) => v.tipo === 'tool');
  const modelos = herramienta ? vistos.filter((v) => v.tipo === 'modelo') : [];
  const principal = herramienta || vistos.find((v) => v.tipo !== 'modelo') || vistos[0] || null;
  const resto = vistos.filter((v) => v !== principal && !modelos.includes(v));
  return { principal, modelos, resto };
}
