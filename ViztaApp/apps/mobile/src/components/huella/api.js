import { EXTRACTORW_URL } from '../../utils/servicios';
import { supabase } from '../../utils/supabase';

/**
 * Cliente de la huella de autor (`huella_profunda/2`, impresiones, lectura
 * breve, caracterización e identidad; ExtractorW PRs #77 y #83–#87).
 *
 * Usa la sesión de la persona: el servidor deriva el usuario de ahí, la app no
 * elige `user_id`. Los errores llevan el estado HTTP y el código para que la
 * pantalla sepa qué decir (ver `motivoDeError` en logica.js).
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

/**
 * El estado del trabajo y, si terminó, el resumen: `impresiones` (sin
 * tarjetas), `lectura_breve`, `caracterizacion`, `cobertura`, `base_id`.
 */
export const leerHuella = (autorId) => pedir(`/${id(autorId)}`);

/** Tarjetas con sus citas, paginadas (hasta 100 por página, 500 en total). */
export const tarjetasDe = (autorId, { offset = 0, limit = 100, nivel } = {}) =>
  pedir(`/${id(autorId)}/impresiones`, { query: { offset, limit, nivel } });

/** Pide recalcular. Responde 202 con `estado: 'en_cola'`; tiene 30 s de enfriamiento. */
export const actualizarHuella = (autorId) => pedir(`/${id(autorId)}/actualizar`, { method: 'POST', body: {} });

/** Las revisiones de identidad guardadas: `{ config: { aliases, voces } }`. */
export const leerIdentidad = (autorId) => pedir(`/${id(autorId)}/identidad`);

/**
 * Dice quién habla en una voz local de una publicación. `operacion` es `voz`
 * (con `rol` y `relacion`) o `quitar_voz`. Lleva motivo; responde 202 y la
 * huella se vuelve a calcular.
 */
export const revisarVoz = (autorId, operacion, { post_id, voz, rol, relacion, motivo }) =>
  pedir(`/${id(autorId)}/identidad/${operacion}`, {
    method: 'POST',
    body: operacion === 'voz' ? { post_id, voz, rol, relacion, motivo } : { post_id, voz, motivo },
  });
