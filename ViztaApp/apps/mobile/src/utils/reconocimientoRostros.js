import { supabase } from './supabase';
import { useCapacidadesStore } from '../state/capacidadesStore';
import { EXTRACTORW_URL } from './servicios';

/**
 * Reconocimiento en Posts — lo que la app necesita saber y hacer.
 *
 * **Dos llaves, y la app mira las dos.** El feature flag dice si la función
 * existe para esta cuenta; lo decide la base y se puede apagar de forma remota
 * sin publicar una versión. La preferencia dice si la persona la quiere usar.
 * Sin el flag, la app no muestra ni el interruptor ni las sugerencias: para
 * quien no la tiene, la función no existe.
 *
 * El servidor verifica lo mismo por su lado (`puede_reconocer_rostros`): una
 * pantalla escondida no es un permiso.
 */

export const FLAG = 'posts.face_recognition';

/** Si esta cuenta tiene la función. Se lee de las capacidades, en vivo. */
export function useReconocimientoDisponible() {
  return useCapacidadesStore((s) => s.capacidades?.features?.[FLAG]?.availability === 'enabled');
}

async function miId() {
  const { data } = await supabase.auth.getSession();
  const id = data?.session?.user?.id;
  if (!id) throw new Error('Sin sesión activa');
  return id;
}

/** Si la persona prendió el interruptor. Apagado mientras no diga lo contrario. */
export async function leerPreferencia() {
  const userId = await miId();
  const { data } = await supabase
    .from('user_preferences')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.preferences?.[FLAG] === true;
}

/**
 * Prender o apagar.
 *
 * Se lee y se mezcla antes de escribir: la fila guarda todas las preferencias
 * de la persona, y escribir solo esta clave con un `upsert` directo borraría
 * las demás el día que existan.
 */
export async function guardarPreferencia(activo) {
  const userId = await miId();
  const { data: actual } = await supabase
    .from('user_preferences')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle();

  const preferences = { ...(actual?.preferences || {}), [FLAG]: Boolean(activo) };
  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, preferences, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
  return preferences[FLAG];
}

/**
 * «Sí, es esa persona.»
 *
 * Deja al hablante confirmado en el post y marca la sugerencia como resuelta.
 * `codex_details_merge` escribe solo esas dos claves: el análisis, la
 * transcripción y lo demás del post no se tocan.
 */
export async function confirmarHablante(post, reconocimiento, hablante) {
  const s = reconocimiento?.sugerencia;
  if (!post?.id || !s?.actor_id) throw new Error('No hay sugerencia que confirmar');

  const ahora = new Date().toISOString();
  const { data, error } = await supabase.rpc('codex_details_merge', {
    p_id: post.id,
    p_set: {
      hablante: {
        ...(hablante || {}),
        actor_id: s.actor_id,
        nombre: s.actor_nombre,
        fuente: 'rostro',
        confirmado: true,
        confirmado_en: ahora,
      },
      reconocimiento: { ...reconocimiento, estado: 'confirmado', resuelto_en: ahora },
    },
  });
  if (error) throw error;
  return data;
}

/** «No es.» La sugerencia se retira y no vuelve a aparecer para este post. */
export async function descartarHablante(post, reconocimiento) {
  if (!post?.id) throw new Error('Sin post');
  const { data, error } = await supabase.rpc('codex_details_merge', {
    p_id: post.id,
    p_set: {
      reconocimiento: { ...reconocimiento, estado: 'descartado', resuelto_en: new Date().toISOString() },
    },
  });
  if (error) throw error;
  return data;
}

// ─── Indexar fotos de actores ─────────────────────────────────────────────────


/**
 * Lo que puede salir mal al indexar, dicho como lo entiende quien usa la app.
 * El servidor manda un código; acá se convierte en una frase corta.
 */
const MENSAJE_INDEXAR = {
  sin_creditos: 'Necesitás créditos para esto.',
  limite: 'Llegaste al máximo de fotos para reconocer.',
  varias_caras: 'Hay más de una persona en la foto.',
  calidad: 'La cara no se ve lo bastante clara.',
  sin_cara: 'No encontramos una cara en esta foto.',
  sin_acceso: 'No está disponible en tu cuenta.',
  limite_alcanzado: 'Hay mucha demanda ahora. Probá en un rato.',
};

async function llamar(metodo, cuerpo) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Sin sesión activa');

  const res = await fetch(`${EXTRACTORW_URL}/api/reconocimiento/indexar`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(cuerpo),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const e = new Error(MENSAJE_INDEXAR[json?.code] || 'No se pudo. Probá de nuevo.');
    e.code = json?.code || 'error';
    throw e;
  }
  return json;
}

/** Usar esta foto del actor para reconocerlo en posts. Cobra en créditos. */
export const indexarFoto = (actorId, archivoId) =>
  llamar('POST', { actor_id: actorId, archivo_id: archivoId });

/** Dejar de usarla. */
export const quitarFoto = (actorId, archivoId) =>
  llamar('DELETE', { actor_id: actorId, archivo_id: archivoId });

/**
 * Si esta foto ya está en uso para reconocer al actor.
 *
 * Se lee directo de la tabla —la seguridad por filas deja ver solo lo propio—
 * contra la ruta del archivo, que es lo que identifica a la foto.
 */
export async function fotoIndexada(actorId, storagePath) {
  if (!actorId || !storagePath) return false;
  const { data } = await supabase
    .from('codex_face_index')
    .select('id')
    .eq('universe_item_id', actorId)
    .eq('image_storage_path', storagePath)
    .eq('status', 'indexed')
    .limit(1);
  return Boolean(data?.length);
}
