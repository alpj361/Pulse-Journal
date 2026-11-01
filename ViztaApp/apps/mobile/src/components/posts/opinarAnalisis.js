import { supabase } from '../../utils/supabase';
import { EXTRACTORW_URL } from '../../utils/servicios';

/**
 * Lo que la persona dice del análisis de un post.
 *
 * - `arriba`: quedó bien.
 * - `abajo` + `modelo`: el análisis se equivocó. El servidor lo rehace con lo
 *   que la persona escribió, sin cobrar, y la regla que saca el modelo entra en
 *   sus análisis siguientes. El post vuelve a «analizándose» y llega corregido
 *   por la fila, como cualquier análisis.
 * - `abajo` + `funcion`: a Vizta le falta algo que el modelo no arregla solo;
 *   queda para revisar a mano.
 */
export default async function opinarAnalisis(post, { voto, tipo = null, texto = '' }) {
  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (!token) throw new Error('Sin sesión activa');

  const res = await fetch(`${EXTRACTORW_URL}/api/analisis-post/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ postId: post.id, voto, tipo, texto }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    // Sin mensaje del servidor no se muestra el código: no le dice nada a quien lee.
    const e = new Error(json?.message || 'No se pudo enviar. Puede intentarse de nuevo.');
    e.code = json?.code;
    throw e;
  }
  return { estado: json.estado };
}
