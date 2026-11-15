import { supabase } from '../../utils/supabase';
import { EXTRACTORW_URL } from '../../utils/servicios';

/**
 * Analizar un caso con el buscador legal.
 *
 * El caso es un snippet del usuario (o un documento PDF/Word de su biblioteca,
 * que entra enlazado a un snippet). El servidor lo lee, el buscador legal trae
 * los artículos e iniciativas que lo tocan y el análisis general (perfil
 * `caso_legal`) arma la matriz: hechos, leyes, fundamentos, contraargumentos,
 * contradicciones, lo que falta saber, iniciativas y preguntas.
 *
 * Es privado y lo paga el usuario. El resultado queda en el snippet
 * (`details.analisis_legal`), así que reabrir el caso trae el análisis sin
 * volver a pedirlo.
 *
 *  - POST /api/general-analysis  { perfil: 'caso_legal', entrada: { type: 'snippet', id } }
 *  - GET  /api/general-analysis/:id
 */

const TIPOS_SNIPPET = ['Snippet', 'snippet'];
const DOCUMENTO = /\.(pdf|docx)$/i;

async function sesion() {
  const { data } = await supabase.auth.getSession();
  const s = data?.session;
  if (!s?.access_token) throw new Error('sin_sesion');
  return s;
}

/** Los snippets recientes del usuario, con el análisis legal que ya tengan. */
export async function traerCasosRecientes(limite = 6) {
  const s = await sesion();
  const { data, error } = await supabase
    .from('codex_universe_items')
    .select('id, name, updated_at, analisis:details->analisis_legal, origen:details->>documento_origen')
    .eq('user_id', s.user.id)
    .in('tipo', TIPOS_SNIPPET)
    .order('updated_at', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data || []).map(deSnippet);
}

export const deSnippet = (r) => ({
  id: r.id,
  titulo: (r.name || '').trim() || 'Nota sin título',
  actualizado: r.updated_at || null,
  analisis: r.analisis?.analysis_id ? { id: r.analisis.analysis_id, fecha: r.analisis.fecha || null } : null,
  documento: r.origen || null,
});

/** Los documentos PDF o Word de la biblioteca del usuario. */
export async function traerDocumentos(limite = 8) {
  const s = await sesion();
  const { data, error } = await supabase
    .from('codex_items')
    .select('id, titulo, nombre_archivo, created_at')
    .eq('user_id', s.user.id)
    .not('storage_path', 'is', null)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data || [])
    .filter((d) => DOCUMENTO.test(d.nombre_archivo || ''))
    .slice(0, limite)
    .map((d) => ({ id: d.id, titulo: (d.titulo || d.nombre_archivo || 'Documento').trim(), formato: /\.pdf$/i.test(d.nombre_archivo) ? 'PDF' : 'Word' }));
}

/**
 * El snippet de un documento: el caso siempre vive en un snippet, para que el
 * análisis tenga dónde quedarse. Si el documento ya tiene uno, se usa ese.
 */
export async function snippetDeDocumento(documento) {
  const s = await sesion();
  const { data: ya, error: e1 } = await supabase
    .from('codex_universe_items')
    .select('id, name, updated_at, analisis:details->analisis_legal, origen:details->>documento_origen')
    .eq('user_id', s.user.id)
    .in('tipo', TIPOS_SNIPPET)
    .eq('details->>documento_origen', documento.id)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (e1) throw e1;
  if (ya?.length) return deSnippet(ya[0]);
  const { data, error } = await supabase
    .from('codex_universe_items')
    .insert({
      user_id: s.user.id,
      tipo: 'Snippet',
      name: `Caso · ${documento.titulo}`,
      description: `Caso a partir del documento «${documento.titulo}».`,
      details: { documento_origen: documento.id },
      thumbnail_url: null,
    })
    .select('id, name, updated_at, analisis:details->analisis_legal, origen:details->>documento_origen')
    .single();
  if (error) throw error;
  return deSnippet(data);
}

async function pedir(metodo, ruta, cuerpo) {
  const s = await sesion();
  const res = await fetch(`${EXTRACTORW_URL}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${s.access_token}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const e = new Error(json?.code || json?.error || 'analisis_fallo');
    e.codigo = res.status === 402 ? 'sin_cupo' : (json?.code || 'analisis_fallo');
    throw e;
  }
  return json;
}

/**
 * Pide el análisis del caso. La clave lleva cuándo se editó el snippet: si no
 * cambió, el servidor devuelve el mismo análisis en vez de cobrarlo de nuevo.
 */
export const pedirAnalisisDeCaso = (caso) => pedir('POST', '/api/general-analysis', {
  perfil: 'caso_legal',
  entrada: { type: 'snippet', id: caso.id },
  idempotency_key: `caso_legal:${caso.id}:${caso.actualizado || ''}`,
});

export const leerAnalisisDeCaso = (id) => pedir('GET', `/api/general-analysis/${encodeURIComponent(id)}`);

// ── Lectura del resultado ────────────────────────────────────────────────────

export const ESTADOS_TRABAJO = { queued: 'en_curso', processing: 'en_curso', completed: 'listo', failed: 'fallido' };

const TITULOS = {
  hechos: 'Lo que cuenta el caso',
  leyes_aplicables: 'Las leyes que lo tocan',
  fundamentos: 'Fundamentos',
  contraargumentos: 'Contraargumentos',
  contradicciones: 'Contradicciones',
  incertidumbres: 'Lo que falta saber',
  iniciativas_relacionadas: 'En el Congreso',
  preguntas: 'Para seguir',
};
export const ORDEN_SECCIONES = Object.keys(TITULOS);

/** Lo recuperado por el buscador, por referencia («A3» → el artículo). */
export function referencias(recuperado) {
  const mapa = new Map();
  for (const r of Array.isArray(recuperado) ? recuperado : []) {
    if (!r?.ref) continue;
    mapa.set(r.ref, r.tipo === 'iniciativa'
      ? { ref: r.ref, tipo: 'iniciativa', numero: r.numero, titulo: r.titulo || null, etapa: r.etapa || null }
      : { ref: r.ref, tipo: 'articulo', articuloId: r.articulo_id, normaId: r.norma_id || null, numero: String(r.articulo || '').replace(/^art\.?\s*/i, '') || null, ley: r.norma || null });
  }
  return mapa;
}

/**
 * El trabajo del servidor, listo para la app: estado, resumen, las secciones
 * con datos (en el orden del perfil) y el mapa de referencias. Las
 * referencias que el modelo nombró y no están entre lo recuperado se quitan.
 */
export function leerTrabajo(json) {
  const estado = ESTADOS_TRABAJO[json?.status] || 'fallido';
  if (estado !== 'listo') return { estado, id: json?.id || null, error: json?.error_code || null };
  const refs = referencias(json?.metadata?.source_metadata?.recuperado);
  const valida = (r) => refs.has(r);
  const secciones = (Array.isArray(json?.result?.sections) ? json.result.sections : [])
    .filter((s) => TITULOS[s?.key] && Array.isArray(s.data) && s.data.length)
    .map((s) => ({
      key: s.key,
      titulo: TITULOS[s.key],
      items: s.data.map((x) => ({
        ...x,
        refs: [...new Set([...(Array.isArray(x.refs) ? x.refs : []), ...(x.ref ? [x.ref] : [])])].filter(valida),
      })).filter((x) => !['leyes_aplicables', 'iniciativas_relacionadas'].includes(s.key) || x.refs.length),
    }))
    .filter((s) => s.items.length)
    .sort((a, b) => ORDEN_SECCIONES.indexOf(a.key) - ORDEN_SECCIONES.indexOf(b.key));
  return {
    estado,
    id: json.id,
    resumen: typeof json?.result?.summary === 'string' ? json.result.summary.trim() : '',
    secciones,
    refs,
    limitaciones: (Array.isArray(json?.result?.limitations) ? json.result.limitations : []).filter((l) => typeof l === 'string' && !/^[a-z_]+: No se encontró contenido/.test(l)),
  };
}

/** El paso que se muestra mientras corre, por el tiempo que lleva: extracción, búsqueda y matriz. */
export function pasoPorTiempo(segundos) {
  if (segundos < 6) return 0;
  if (segundos < 16) return 1;
  return 2;
}
