import { supabase } from './supabase';

/**
 * «Posts analizados al llegar» — la preferencia.
 *
 * Prendida, el servidor analiza cada post apenas termina de traerlo: lo mismo
 * que tocar el ojo, sin tocarlo. Vive en `user_preferences`, donde el servidor
 * la lee; por eso no es un ajuste guardado en el teléfono.
 */
export const CLAVE = 'posts.auto_analysis';

async function miId() {
  const { data } = await supabase.auth.getSession();
  const id = data?.session?.user?.id;
  if (!id) throw new Error('Sin sesión activa');
  return id;
}

/** Apagado mientras la persona no diga lo contrario. */
export async function leerAutomatico() {
  const userId = await miId();
  const { data } = await supabase.from('user_preferences').select('preferences').eq('user_id', userId).maybeSingle();
  return data?.preferences?.[CLAVE] === true;
}

/** Se lee y se mezcla antes de escribir: la fila guarda todas las preferencias. */
export async function guardarAutomatico(activo) {
  const userId = await miId();
  const { data: actual } = await supabase.from('user_preferences').select('preferences').eq('user_id', userId).maybeSingle();
  const preferences = { ...(actual?.preferences || {}), [CLAVE]: Boolean(activo) };
  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, preferences, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
  return preferences[CLAVE];
}
