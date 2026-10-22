import { EXTRACTORW_URL } from '../../utils/servicios';
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

/** El Codex propio de un colaborador. Misma forma que /api/codex/items. */
export const itemsDeColaborador = (colaboradorId, { limit = 30, offset = 0, tipo } = {}) =>
  pedir(`/colaboradores/${encodeURIComponent(colaboradorId)}/items`, { query: { limit, offset, tipo } });

/** Sumar un agente: nace activo, con leer y crear. No devuelve token. */
export const crearAgente = (nombre) => pedir('/colaboraciones/agentes', { method: 'POST', body: { nombre } });

/** Cambiar permisos (leer, crear, editar, eliminar) o estado de un colaborador del Codex. */
export const cambiarColaborador = (id, cambios) =>
  pedir(`/codex/colaboradores/${encodeURIComponent(id)}`, { method: 'PATCH', body: cambios });

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

/** Envía texto como bloque. Los adjuntos van como bloques `attachment`. */
export async function enviarMensaje(conversacionId, { texto, adjuntos = [] }) {
  const blocks = [];
  if (texto && texto.trim()) blocks.push({ id: 't1', type: 'text', version: '1', payload: { text: texto.trim() } });
  adjuntos.forEach((a, i) => blocks.push({ id: `a${i + 1}`, type: 'attachment', version: '1', payload: a }));
  const r = await pedir(`/colaboraciones/conversaciones/${encodeURIComponent(conversacionId)}/mensajes`, {
    method: 'POST',
    body: { schema_version: 'openui.v1', blocks },
  });
  return r.mensaje;
}

/** Contestar un bloque con botones (click). */
export const registrarAccion = (conversacionId, { mensajeId, blockId, action, label }) =>
  pedir(`/colaboraciones/conversaciones/${encodeURIComponent(conversacionId)}/action_events`, {
    method: 'POST',
    body: { mensaje_id: mensajeId, block_id: blockId, tipo: 'click', payload: { action, label } },
  });

// ─── Compartir, solicitudes y merge ──────────────────────────────────────────

export const listarCompartidos = async () => (await pedir('/colaboraciones/compartidos')).compartidos || [];
export const compartir = (body) => pedir('/colaboraciones/compartidos', { method: 'POST', body });
export const dejarDeCompartir = (id) => pedir(`/colaboraciones/compartidos/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const listarSolicitudes = async () => (await pedir('/colaboraciones/solicitudes')).solicitudes || [];
export const crearSolicitud = (body) => pedir('/colaboraciones/solicitudes', { method: 'POST', body });
export const aprobarSolicitud = (id) => pedir(`/colaboraciones/solicitudes/${encodeURIComponent(id)}/aprobar`, { method: 'POST', body: {} });
export const rechazarSolicitud = (id) => pedir(`/colaboraciones/solicitudes/${encodeURIComponent(id)}/rechazar`, { method: 'POST', body: {} });

/** Antes y después por campo, y si la versión ya cambió. */
export const previsualizarMerge = (body) => pedir('/colaboraciones/merge/preview', { method: 'POST', body });
export const aplicarMerge = (body) => pedir('/colaboraciones/merge', { method: 'POST', body });

// ─── Avisos, artifacts, deshacer ─────────────────────────────────────────────

export const listarAvisos = async () => (await pedir('/colaboraciones/notificaciones')).notificaciones || [];
export const marcarAvisoLeido = (id) => pedir(`/colaboraciones/notificaciones/${encodeURIComponent(id)}/leer`, { method: 'POST', body: {} });

export const leerArtifact = async (id) => (await pedir(`/colaboraciones/artifacts/${encodeURIComponent(id)}`)).artifact;

export const previsualizarDeshacer = (body) => pedir('/colaboraciones/deshacer/preview', { method: 'POST', body });
export const aplicarDeshacer = (body) => pedir('/colaboraciones/deshacer', { method: 'POST', body });

/**
 * Traer a mi Codex un ítem de otra cuenta. El backend todavía no lo tiene
 * (pedido a Vizta Dev, 21-oct): queda acá para conectarlo con una línea.
 */
export async function traerAMiCodex() {
  throw new ErrorColab('no_disponible_aun', 'Traer a tu Codex todavía no está disponible.');
}

/**
 * ¿El servidor ya acepta colaborar entre personas? Hoy COLAB_HUMANOS=0 y no
 * hay endpoint que lo diga: la app lo deja en falso y la pantalla cambia sola
 * el día que esto devuelva true.
 */
export const humanosHabilitados = () => false;
