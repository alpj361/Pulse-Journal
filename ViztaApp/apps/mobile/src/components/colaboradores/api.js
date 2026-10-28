import AsyncStorage from '@react-native-async-storage/async-storage';
import { EXTRACTORW_URL } from '../../utils/servicios';
import { conTareasVivas, normalizarHallazgo, normalizarSeguimiento } from './logica';
import { supabase } from '../../utils/supabase';

/**
 * Colaboradores: lo que la app pide a ExtractorW (STA-259).
 *
 * Todo pide sesión. El servidor decide si la cuenta entra:
 *  · `colab_apagado` (404): el equipo lo apagó (COLAB_BACKEND=0).
 *  · `solo_beta` (403): la cuenta no es alfa, beta ni admin.
 * Esos dos casos llegan como `NoDisponible` para que la pantalla muestre su
 * estado y no un error genérico.
 *
 * Contrato: ExtractorW docs/VIZTA_V4.6.0_STA259_COLABORACIONES.md. Diseño:
 * apps/mobile/docs/colaboraciones/.
 */

export class NoDisponible extends Error {
  constructor(motivo) {
    super(motivo);
    this.motivo = motivo; // 'apagado' | 'beta' | 'sesion'
  }
}

export class ErrorColab extends Error {
  constructor(code, message, status) {
    super(message || code);
    this.code = code;
    this.status = status;
  }
}

async function pedir(ruta, { method = 'GET', body, query } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new NoDisponible('sesion');
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
    : '';
  const res = await fetch(`${EXTRACTORW_URL}/api${ruta}${qs ? `?${qs}` : ''}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  const code = json?.code || json?.error;
  if (code === 'colab_apagado') throw new NoDisponible('apagado');
  if (code === 'solo_beta') throw new NoDisponible('beta');
  if (res.status === 401) throw new NoDisponible('sesion');
  if (!res.ok || json?.success === false) throw new ErrorColab(code || `http_${res.status}`, json?.message, res.status);
  return json;
}

// ─── Colaboradores ───────────────────────────────────────────────────────────

/** Los colaboradores de la cuenta: permisos, pendientes y último mensaje. */
export const listarColaboradores = async () => (await pedir('/colaboradores')).colaboradores || [];

/**
 * El Codex propio de un colaborador. Mezcla documentos (`codex_items`) y
 * fichas del universo (Actor, Entidad, Source…); `origen_tabla` dice de cuál.
 */
export const itemsDeColaborador = (colaboradorId, { limit = 30, offset = 0, tipo } = {}) =>
  pedir(`/colaboradores/${encodeURIComponent(colaboradorId)}/items`, { query: { limit, offset, tipo } });

/** Un ítem completo de un colaborador (con su contenido y sus campos). */
export const itemDeColaborador = async (colaboradorId, itemId) =>
  (await pedir(`/colaboradores/${encodeURIComponent(colaboradorId)}/items/${encodeURIComponent(itemId)}`)).item;

/**
 * Cambiar permisos (leer, crear, editar, eliminar) o estado de un colaborador
 * del Codex. Los permisos que no van se quedan como estaban.
 */
export const cambiarColaborador = (id, { permisos, estado }) =>
  pedir(`/codex/colaboradores/${encodeURIComponent(id)}`, { method: 'PATCH', body: { permisos, estado } });

/** Quitarle el acceso. */
export const revocarColaborador = (id) =>
  pedir(`/codex/colaboradores/${encodeURIComponent(id)}/revoke`, { method: 'POST', body: {} });

// ─── Chat ────────────────────────────────────────────────────────────────────

export const listarConversaciones = async () => (await pedir('/colaboraciones/conversaciones')).conversaciones || [];

/** Abre un chat 1:1 (`directo`) o un grupo (con título). Las cuentas son {tipo, id}. */
export const crearConversacion = async ({ participantes, titulo, tipo }) =>
  (await pedir('/colaboraciones/conversaciones', { method: 'POST', body: { participantes, titulo, tipo } })).conversacion;

/** Una página de mensajes, de la más vieja a la más nueva; `next_cursor` trae los anteriores. */
export const leerMensajes = (conversacionId, { limit = 30, antes } = {}) =>
  pedir(`/colaboraciones/conversaciones/${encodeURIComponent(conversacionId)}/mensajes`, { query: { limit, antes } });

/**
 * Envía texto como bloque. Los adjuntos van como bloques `attachment`.
 *
 * El texto va también en `cuerpo`: la fila de la lista (`ultimo_mensaje`) y el
 * aviso al otro lado leen `cuerpo`, no los bloques. Sin él, la lista mostraría
 * el chat vacío aunque hubiera mensajes.
 */
export async function enviarMensaje(conversacionId, { texto, adjuntos = [] }) {
  const limpio = texto && texto.trim() ? texto.trim() : null;
  const blocks = [];
  if (limpio) blocks.push({ id: 't1', type: 'text', version: '1', payload: { text: limpio } });
  adjuntos.forEach((a, i) => blocks.push({ id: `a${i + 1}`, type: 'attachment', version: '1', payload: a }));
  const r = await pedir(`/colaboraciones/conversaciones/${encodeURIComponent(conversacionId)}/mensajes`, {
    method: 'POST',
    body: { schema_version: 'openui.v1', blocks, ...(limpio ? { cuerpo: limpio } : {}) },
  });
  return r.mensaje;
}

/**
 * El chat 1:1 con un colaborador.
 *
 * `GET /conversaciones` no trae los participantes, así que no hay cómo saber
 * cuál es el de este agente. Se resuelve así: el del último mensaje (lo trae
 * la lista), si no el que este teléfono ya abrió, y si no ninguno: el chat
 * nace con el primer mensaje, no al abrirlo.
 */
const CHATS = 'vizta-colab-chats';

export async function leerChats() {
  try {
    return JSON.parse((await AsyncStorage.getItem(CHATS)) || '{}');
  } catch {
    return {};
  }
}

export async function chatDe(colaborador) {
  const delServidor = colaborador?.ultimo_mensaje?.conversacion_id;
  if (delServidor) return delServidor;
  return (await leerChats())[colaborador?.id] || null;
}

export async function abrirChat(colaborador) {
  const ya = await chatDe(colaborador);
  if (ya) return ya;
  const conv = await crearConversacion({
    participantes: [{ tipo: colaborador.cuenta_tipo, id: colaborador.cuenta_id }],
    tipo: 'directo',
  });
  const chats = await leerChats();
  chats[colaborador.id] = conv.id;
  await AsyncStorage.setItem(CHATS, JSON.stringify(chats)).catch(() => {});
  return conv.id;
}

/** Contestar un bloque con botones (click). */
export const registrarAccion = (conversacionId, { mensajeId, blockId, action, label }) =>
  pedir(`/colaboraciones/conversaciones/${encodeURIComponent(conversacionId)}/action_events`, {
    method: 'POST',
    body: { mensaje_id: mensajeId, block_id: blockId, tipo: 'click', payload: { action, label } },
  });

// ─── Compartir, solicitudes y merge ──────────────────────────────────────────

export const listarCompartidos = async () => (await pedir('/colaboraciones/compartidos')).compartidos || [];
/**
 * Lo que nos compartimos con una persona, en los dos sentidos. Cada fila trae
 * `titulo`, `tipo`, `direccion` (enviado | recibido) y `categoria` (codex |
 * monitoreos). PR #75.
 */
export const compartidosCon = async (humanoId) =>
  ((await pedir('/colaboraciones/compartidos', { query: { con: humanoId } })).compartidos || []).filter((f) => f.estado !== 'revocado');
/** Algo que te compartieron, completo (lectura). */
export const itemCompartido = async (id) => (await pedir(`/colaboraciones/codex/items/${encodeURIComponent(id)}`)).item;
/** Un monitoreo compartido: el tema y su estructura (sin secretos). PR #75. */
export const monitoreoCompartido = (id) => pedir(`/colaboraciones/seguimientos/${encodeURIComponent(id)}`);
/** Ponerlo a correr con uno de tus agentes (o a tu nombre). PR #75. */
export const usarMonitoreo = (id, body = {}) => pedir(`/colaboraciones/seguimientos/${encodeURIComponent(id)}/aplicar`, { method: 'POST', body });
export const compartir = (body) => pedir('/colaboraciones/compartidos', { method: 'POST', body });
export const dejarDeCompartir = (id) => pedir(`/colaboraciones/compartidos/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const listarSolicitudes = async () => (await pedir('/colaboraciones/solicitudes')).solicitudes || [];
export const crearSolicitud = (body) => pedir('/colaboraciones/solicitudes', { method: 'POST', body });
/** Aprobar. Con `campos`, solo esos (aprobación parcial, PR #56). */
export const aprobarSolicitud = (id, { campos } = {}) =>
  pedir(`/colaboraciones/solicitudes/${encodeURIComponent(id)}/aprobar`, {
    method: 'POST',
    body: Array.isArray(campos) && campos.length ? { campos } : {},
  });
export const rechazarSolicitud = (id) => pedir(`/colaboraciones/solicitudes/${encodeURIComponent(id)}/rechazar`, { method: 'POST', body: {} });

/** Antes y después por campo, y si la versión ya cambió. */
export const previsualizarMerge = (body) => pedir('/colaboraciones/merge/preview', { method: 'POST', body });
export const aplicarMerge = (body) => pedir('/colaboraciones/merge', { method: 'POST', body });

/**
 * La vista previa de una solicitud de merge, contra la versión de ahora.
 * `conflicto` dice si el recurso cambió desde que se hizo la propuesta.
 */
export const vistaDeSolicitud = (s) =>
  previsualizarMerge({
    recurso_tipo: s.tipo === 'merge_investigacion' ? 'proyecto' : 'item',
    recurso_id: s.recurso_id,
    parche: s.payload?.parche || s.payload,
    version_base: s.version_base,
  });

/**
 * El título de cada recurso de las solicitudes, en dos consultas. Son ítems e
 * investigaciones de la propia cuenta, así que se leen directo de la base.
 */
export async function titulosDeRecursos(solicitudes) {
  const ids = (tipo) => [...new Set((solicitudes || []).filter((s) => s.recurso_id && tipo(s)).map((s) => s.recurso_id))];
  const items = ids((s) => s.tipo !== 'merge_investigacion' && s.recurso_tipo !== 'proyecto');
  const proyectos = ids((s) => s.tipo === 'merge_investigacion' || s.recurso_tipo === 'proyecto');
  const titulos = {};
  const [a, b] = await Promise.all([
    items.length ? supabase.from('codex_items').select('id, titulo').in('id', items) : { data: [] },
    proyectos.length ? supabase.from('projects').select('id, title').in('id', proyectos) : { data: [] },
  ]);
  (a.data || []).forEach((r) => {
    titulos[r.id] = r.titulo;
  });
  (b.data || []).forEach((r) => {
    titulos[r.id] = r.title;
  });
  return titulos;
}

// ─── Avisos, artifacts, deshacer ─────────────────────────────────────────────

/**
 * Los títulos de las fuentes de un artifact que son del Codex (documentos o
 * fichas). Las demás se nombran por su tipo.
 */
export async function titulosDeFuentes(fuentes) {
  const ids = [...new Set((fuentes || []).filter((f) => f?.tipo === 'codex' && f.id).map((f) => f.id))];
  if (!ids.length) return {};
  const [a, b] = await Promise.all([
    supabase.from('codex_items').select('id, titulo').in('id', ids),
    supabase.from('codex_universe_items').select('id, name').in('id', ids),
  ]);
  const titulos = {};
  (a.data || []).forEach((r) => {
    titulos[r.id] = r.titulo;
  });
  (b.data || []).forEach((r) => {
    titulos[r.id] = r.name;
  });
  return titulos;
}

/**
 * Buscar en mi Codex para adjuntar: documentos y fichas, por título. Sin
 * texto, lo más reciente. Se lee directo de la base (es la propia cuenta).
 */
/**
 * Los tipos por los que se filtra al adjuntar, con cómo se guardan. El universo
 * guarda el tipo con mayúscula (y «post» de las dos formas); los documentos
 * viven en `codex_items`.
 */
export const TIPOS_PARA_ADJUNTAR = [
  { clave: 'dashboard', artifacts: true },
  { clave: 'actor', universo: ['Actor'] },
  { clave: 'entidad', universo: ['Entidad'] },
  { clave: 'territorio', universo: ['Territorio'] },
  { clave: 'evento', universo: ['Evento'] },
  { clave: 'post', universo: ['post', 'Post'] },
  { clave: 'snippet', universo: ['Snippet'] },
  { clave: 'source', universo: ['Source'] },
  { clave: 'objeto', universo: ['Objeto', 'Artefacto'] },
];

const limpiarBusqueda = (texto) => String(texto || '').trim().replace(/[%_,()]/g, ' ');

/** Las dos consultas (universo y documentos) con el mismo filtro; `null` si ese lado no aplica. */
function consultasDeMiCodex(userId, { tipo, ids, columnas, cabeza = false }) {
  const def = TIPOS_PARA_ADJUNTAR.find((t) => t.clave === tipo);
  const opciones = cabeza ? { count: 'exact', head: true } : undefined;
  // Los documentos (`codex_items`) no se comparten todavía: del otro lado no
  // hay cómo leerlos.
  let a = null;
  let b = def?.items || def?.artifacts ? null : supabase.from('codex_universe_items').select(columnas.universo, opciones).eq('user_id', userId);
  // Los dashboards guardados viven en `artifacts`, a nombre de la persona.
  let c =
    (def && !def.artifacts) || ids
      ? null
      : supabase.from('artifacts').select(columnas.artifacts || 'id', opciones).eq('dueno_tipo', 'humano').eq('dueno_id', userId).eq('tipo', 'dashboard');
  if (b && def?.universo) b = b.in('tipo', def.universo);
  // Las historias de un espacio no se comparten (por ahora); los hechos son
  // parte de su post.
  else if (b) b = b.not('tipo', 'in', '("Historia","Fact","Documento")');
  if (ids) {
    if (a) a = a.in('id', ids);
    if (b) b = b.in('id', ids);
  }
  return { a, b, c };
}

/**
 * Lo de mi Codex para adjuntar: lo más reciente, o lo que coincide con el
 * texto. Se puede acotar a un tipo y a los elementos de un espacio (`ids`).
 */
export async function buscarEnMiCodex(texto, userId, { tipo = null, ids = null } = {}) {
  const q = limpiarBusqueda(texto);
  let { a, b, c } = consultasDeMiCodex(userId, {
    tipo,
    ids,
    columnas: { items: 'id, titulo, tipo, created_at', universo: 'id, name, tipo, thumbnail_url, created_at', artifacts: 'id, titulo, created_at' },
  });
  const tope = ids || tipo ? 60 : 20;
  if (a) a = a.order('created_at', { ascending: false }).limit(tope);
  if (b) b = b.order('created_at', { ascending: false }).limit(tope);
  if (c) c = c.order('created_at', { ascending: false }).limit(tope);
  if (q) {
    if (a) a = a.ilike('titulo', `%${q}%`);
    if (b) b = b.ilike('name', `%${q}%`);
    if (c) c = c.ilike('titulo', `%${q}%`);
  }
  const [ra, rb, rc] = await Promise.all([a || { data: [] }, b || { data: [] }, c || { data: [] }]);
  if (ra.error) throw ra.error;
  if (rb.error) throw rb.error;
  const filas = [
    ...(ra.data || []).map((r) => ({ id: r.id, titulo: r.titulo, tipo: r.tipo, created_at: r.created_at })),
    ...(rb.data || []).map((r) => ({ id: r.id, titulo: r.name, tipo: r.tipo, imagen: r.thumbnail_url || null, created_at: r.created_at })),
    ...(rc?.data || []).map((r) => ({ id: r.id, titulo: r.titulo, tipo: 'dashboard', origen_tabla: 'artifacts', created_at: r.created_at })),
  ];
  return filas.sort((x, y) => String(y.created_at).localeCompare(String(x.created_at))).slice(0, tope);
}

/** Cuántos hay de cada tipo (en todo el Codex o en un espacio). Los que no tienen, no vienen. */
export async function tiposDeMiCodex(userId, { ids = null } = {}) {
  const cuentas = await Promise.all(
    TIPOS_PARA_ADJUNTAR.map(async ({ clave }) => {
      const { a, b, c } = consultasDeMiCodex(userId, { tipo: clave, ids, columnas: { items: 'id', universo: 'id' }, cabeza: true });
      const [ra, rb, rc] = await Promise.all([a || { count: 0 }, b || { count: 0 }, c || { count: 0 }]);
      return { clave, n: (ra.count || 0) + (rb.count || 0) + (rc.count || 0) };
    }),
  );
  return cuentas.filter((c) => c.n > 0).sort((x, y) => y.n - x.n);
}

/** Mis espacios, con lo que tiene cada uno (lienzo y recursos). */
export async function misEspaciosParaAdjuntar(userId) {
  const [rs, rr] = await Promise.all([
    supabase.from('spaces').select('id, name, updated_at, data->canvasItems').eq('user_id', userId).or('cuenta_tipo.is.null,cuenta_tipo.eq.humano').order('updated_at', { ascending: false }).limit(40),
    supabase.from('workspace_resources').select('space_id, resource_id').eq('user_id', userId).eq('resource_type', 'codex_item').limit(5000),
  ]);
  if (rs.error) throw rs.error;
  const recursos = new Map();
  for (const r of rr.data || []) {
    if (!recursos.has(r.space_id)) recursos.set(r.space_id, new Set());
    recursos.get(r.space_id).add(r.resource_id);
  }
  return (rs.data || [])
    .map((e) => {
      const ids = new Set([...(Array.isArray(e.canvasItems) ? e.canvasItems : []), ...(recursos.get(e.id) || [])]);
      return { id: e.id, nombre: e.name || 'Sin nombre', ids: [...ids].filter((x) => typeof x === 'string').slice(0, 300) };
    })
    .filter((e) => e.ids.length > 0);
}

// ─── Lo que sigue el agente (sus monitoreos) ─────────────────────────────────
//
// Contrato propuesto a Vizta Dev (25-oct). Mientras la ruta no exista
// (404), `seguimientosDe` devuelve null y la app no muestra la sección.

const base = (colaboradorId) => `/colaboradores/${encodeURIComponent(colaboradorId)}/seguimientos`;

/** Los temas que sigue un agente, con lo nuevo de cada uno. `null` si todavía no existe. */
export async function seguimientosDe(colaboradorId) {
  try {
    const r = await pedir(base(colaboradorId));
    return (r.seguimientos || r.items || []).map(normalizarSeguimiento);
  } catch (e) {
    if (e instanceof ErrorColab && (e.status === 404 || e.code === 'http_404')) return null;
    throw e;
  }
}

/** Lo que encontró en un tema, de lo más nuevo a lo más viejo. */
export async function hallazgosDe(colaboradorId, seguimientoId, { limit = 30, antes, solo } = {}) {
  const r = await pedir(`${base(colaboradorId)}/${encodeURIComponent(seguimientoId)}/hallazgos`, { query: { limit, antes, solo } });
  return { ...r, items: (r.items || r.hallazgos || []).map(normalizarHallazgo) };
}

/** «importa» o «no es»: lo que opinás de un hallazgo. */
export const opinarHallazgo = (colaboradorId, seguimientoId, hallazgoId, veredicto) =>
  pedir(`${base(colaboradorId)}/${encodeURIComponent(seguimientoId)}/hallazgos/${encodeURIComponent(hallazgoId)}/veredicto`, {
    method: 'POST',
    body: { veredicto },
  });

/** Pausar o seguir (`estado`), cuándo avisar (`modo_aviso`: urgentes, todos, silencio) y a qué horas mira (`horas`). */
export const cambiarSeguimiento = (colaboradorId, seguimientoId, cambios) =>
  pedir(`${base(colaboradorId)}/${encodeURIComponent(seguimientoId)}`, { method: 'PATCH', body: cambios });

/** Ya lo viste: lo nuevo deja de contar como nuevo. */
export const marcarSeguimientoVisto = (colaboradorId, seguimientoId) =>
  pedir(`${base(colaboradorId)}/${encodeURIComponent(seguimientoId)}/visto`, { method: 'POST', body: {} });

/**
 * Si el agente se entera al momento: si se conectó a sus avisos, qué recibe y
 * cuándo le llegó el último. `null` si el backend todavía no lo tiene.
 */
export async function avisosDeAgente(colaboradorId) {
  try {
    return await pedir(`/colaboradores/${encodeURIComponent(colaboradorId)}/avisos-agente`);
  } catch (e) {
    if (e instanceof ErrorColab && (e.status === 404 || e.code === 'http_404')) return null;
    throw e;
  }
}

/** Silenciarlo (`activo`) o elegir qué le llega (`eventos`). */
export const cambiarAvisosDeAgente = (colaboradorId, cambios) =>
  pedir(`/colaboradores/${encodeURIComponent(colaboradorId)}/avisos-agente`, { method: 'PATCH', body: cambios });

export const desconectarAvisosDeAgente = (colaboradorId) =>
  pedir(`/colaboradores/${encodeURIComponent(colaboradorId)}/avisos-agente`, { method: 'DELETE' });

// --- Ficha del agente: tareas, fuentes y espacios ---------------------------
// Cada una devuelve `null` si el backend todavía no la tiene (404), y la
// sección no se muestra.

const ficha = (id, resto = '') => `/colaboradores/${encodeURIComponent(id)}/${resto}`;

async function oNull(promesa) {
  try {
    return await promesa;
  } catch (e) {
    if (e instanceof ErrorColab && (e.status === 404 || e.code === 'http_404')) return null;
    throw e;
  }
}

export const tareasDe = (id) => oNull(pedir(ficha(id, 'tareas'))).then((d) => conTareasVivas(d));
export const crearTarea = (id, tarea) => pedir(ficha(id, 'tareas'), { method: 'POST', body: tarea });
export const cambiarTarea = (id, tid, cambios) => pedir(ficha(id, `tareas/${encodeURIComponent(tid)}`), { method: 'PATCH', body: cambios });
export const borrarTarea = (id, tid) => pedir(ficha(id, `tareas/${encodeURIComponent(tid)}`), { method: 'DELETE' });

export const fuentesDe = (id) => oNull(pedir(ficha(id, 'fuentes')));
/** Un medio o cuenta: dónde aparece en su Codex y lo que encontró de él. */
export const fuenteDe = (id, clave) => oNull(pedir(ficha(id, `fuentes/${encodeURIComponent(clave)}`)));
/** `confiabilidad`: confiable, no_confiable o sin_calificar. */
export const calificarFuente = (id, fuente) =>
  pedir(ficha(id, `fuentes/${encodeURIComponent(fuente.clave)}`), { method: 'PATCH', body: fuente });

/** Los Espacios del agente, cada uno con lo que recuerda ahí. */
export const espaciosDe = (id) => oNull(pedir(ficha(id, 'espacios')));
/** Lo que hay adentro de uno de sus Espacios. `null` si el backend todavía no lo tiene. */
export const espacioDe = (id, eid) => oNull(pedir(ficha(id, `espacios/${encodeURIComponent(eid)}`)));
export const quitarRecuerdo = (id, mid) => pedir(ficha(id, `memoria/${encodeURIComponent(mid)}`), { method: 'DELETE' });

// --- Autorizar un cliente MCP (ChatGPT, Claude…) desde la app -------------

/** Las solicitudes de conexión que esperan tu decisión. */
export const solicitudesOAuth = async () => (await pedir('/mcp/solicitudes-oauth')).solicitudes || [];
/** Una por su `req_id` o por el código corto que se ve en el navegador. */
export const solicitudOAuth = async (reqOCodigo) => {
  const r = await pedir(`/mcp/solicitudes-oauth/${encodeURIComponent(reqOCodigo)}`);
  return r.solicitud || r;
};
/** `permisos`: { leer, crear, modificar, borrar }. */
export const aprobarOAuth = (reqId, permisos) =>
  pedir(`/mcp/solicitudes-oauth/${encodeURIComponent(reqId)}/aprobar`, { method: 'POST', body: { permisos } });
export const rechazarOAuth = (reqId) => pedir(`/mcp/solicitudes-oauth/${encodeURIComponent(reqId)}/rechazar`, { method: 'POST', body: {} });

export const listarAvisos = async () => (await pedir('/colaboraciones/notificaciones')).notificaciones || [];
export const marcarAvisoLeido = (id) => pedir(`/colaboraciones/notificaciones/${encodeURIComponent(id)}/leer`, { method: 'POST', body: {} });

export const leerArtifact = async (id) => (await pedir(`/colaboraciones/artifacts/${encodeURIComponent(id)}`)).artifact;

export const previsualizarDeshacer = (body) => pedir('/colaboraciones/deshacer/preview', { method: 'POST', body });
export const aplicarDeshacer = (body) => pedir('/colaboraciones/deshacer', { method: 'POST', body });

/** Guardar en mi Codex un dashboard de otra cuenta: queda una copia mía (PR #75). */
export const guardarDashboard = async (id) =>
  (await pedir(`/colaboraciones/artifacts/${encodeURIComponent(id)}/copiar`, { method: 'POST', body: {} })).artifact;

/** ¿Ya tengo este dashboard? Mío, o una copia mía de él. */
export async function tengoDashboard(id, userId) {
  if (!id || !userId) return false;
  const { data, error } = await supabase
    .from('artifacts')
    .select('id')
    .eq('dueno_tipo', 'humano')
    .eq('dueno_id', userId)
    .or(`id.eq.${id},contenido->>copiado_de_id.eq.${id}`)
    .limit(1);
  if (error) throw error;
  return (data || []).length > 0;
}

/** Traer a mi Codex un ítem de otra cuenta: queda una copia mía (v4.6.2). */
export const traerAMiCodex = async (itemId) =>
  (await pedir(`/colaboraciones/codex/items/${encodeURIComponent(itemId)}/copiar`, { method: 'POST', body: {} })).item;

/** Tu nombre y usuario: con eso te encuentran para escribirte (PR #76). */
export const leerPerfil = async () => (await pedir('/colaboraciones/perfil')).perfil || null;
export const guardarPerfil = async (cambios) => (await pedir('/colaboraciones/perfil', { method: 'PATCH', body: cambios })).perfil;

/** Colaborar entre personas: encendido en el servidor (COLAB_HUMANOS=1, 28-oct). */
export const humanosHabilitados = () => true;

/** Buscar personas por nombre o usuario (mín. 2 letras, hasta 10; sin correo). */
export async function buscarPersonas(q) {
  const texto = String(q || '').trim();
  if (texto.length < 2) return [];
  const r = await pedir('/colaboraciones/personas', { query: { q: texto } });
  return r.personas || r.resultados || r.items || [];
}

/**
 * Empezar el chat con una persona: la conversación la suma a tus
 * colaboradores. Devuelve el colaborador ya en la lista (o null si el
 * servidor tarda en mostrarlo) y deja el chat recordado para no abrir otro.
 */
export async function empezarConPersona(persona) {
  const conv = await crearConversacion({ participantes: [{ tipo: 'humano', id: persona.id }], tipo: 'directo' });
  const lista = await listarColaboradores();
  const c = lista.find((x) => x.cuenta_tipo === 'humano' && x.cuenta_id === persona.id) || null;
  if (c) {
    const chats = await leerChats();
    chats[c.id] = conv.id;
    await AsyncStorage.setItem(CHATS, JSON.stringify(chats)).catch(() => {});
  }
  return c;
}
