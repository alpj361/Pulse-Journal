import { EXTRACTORW_URL } from '../../utils/servicios';
import { supabase } from '../../utils/supabase';

/**
 * Cliente de la huella de autor (contrato `autor_huella/1`, ExtractorW PR #72).
 *
 * Usa la sesión de la persona: el servidor deriva el usuario de ahí, la app no
 * elige `user_id`. Los errores llevan el estado HTTP para que la pantalla sepa
 * qué decir (ver `motivoDeError` en logica.js).
 */
export class ErrorHuella extends Error {
  constructor(status, code, message, extra = {}) {
    super(message || code || `http_${status}`);
    this.status = status;
    this.code = code || null;
    Object.assign(this, extra);
  }
}

async function pedir(ruta, { method = 'GET', body, query } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new ErrorHuella(401, 'sin_sesion');
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
    : '';
  let res;
  try {
    res = await fetch(`${EXTRACTORW_URL}/api/huellas-autor${ruta}${qs ? `?${qs}` : ''}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ErrorHuella(0, 'sin_red');
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new ErrorHuella(res.status, json?.code || null, json?.message, { estado: json?.estado });
  }
  return json || {};
}

const id = (v) => encodeURIComponent(v);

/** Autores vinculados a una ficha Actor o Entidad. Lista vacía si no hay; no crea fichas. */
export const autoresDeFicha = (itemId) => pedir(`/items/${id(itemId)}`);

/** Estado del trabajo y, si está vigente, el perfil (lecturas con `evidencias_total`, sin evidencias). */
export const leerHuella = (autorId) => pedir(`/${id(autorId)}`);

/** Evidencias de una lectura, paginadas (máximo 100). Trae `huella_id` y `total`. */
export const evidenciasDe = (autorId, clave, { offset = 0, limit = 25 } = {}) =>
  pedir(`/${id(autorId)}/evidencias`, { query: { lectura: clave, offset, limit } });

/** Pide recalcular. Responde 202 con `estado: 'en_cola'`; tiene 30 s de enfriamiento. */
export const actualizarHuella = (autorId) => pedir(`/${id(autorId)}/actualizar`, { method: 'POST', body: {} });

/** Acepta o descarta una lectura vigente (descartar lleva comentario). Responde 202 `en_cola`. */
export const corregirLectura = (autorId, { huella_id, clave, decision, comentario }) =>
  pedir(`/${id(autorId)}/correcciones`, {
    method: 'POST',
    body: { huella_id, clave, decision, ...(comentario ? { comentario } : {}) },
  });
