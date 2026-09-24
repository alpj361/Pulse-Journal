import { supabase } from '../../utils/supabase';
import { EXTRACTORW_URL } from '../../utils/servicios';

/**
 * Pedirle al servidor que analice un post.
 *
 * **No espera el resultado.** Devuelve apenas el servidor acepta el trabajo, y
 * el análisis sigue allá: lo escribe él en la fila del post.
 *
 * Antes esto era al revés —la app llamaba al modelo, esperaba, y guardaba ella
 * misma— y cerrar la app a mitad mataba el `fetch`: el trabajo se perdía
 * entero, ya pagado y sin guardar. Ahora cerrar la app no cambia nada; al
 * volver, el análisis está. Lo mismo si lo abrís después desde la web.
 *
 * Quien llama no recibe el análisis: lo ve llegar mirando la fila. Ver
 * `useAnalisisPost`.
 */
export default async function pedirAnalisis(post) {
  const texto = post?.details?.transcription || post?.description || post?.name || '';
  if (texto.trim().length < 10) throw new Error('Este post no tiene texto para analizar.');

  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (!token) throw new Error('Sin sesión activa');

  const res = await fetch(`${EXTRACTORW_URL}/api/analisis-post`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ postId: post.id }),
  });

  const json = await res.json().catch(() => null);

  // Sin cupo o sin créditos: el motivo va en `code`, no en el texto.
  if (res.status === 402) {
    const e = new Error(json?.message || 'No podés analizar por ahora.');
    e.code = json?.code || 'sin_cupo';
    e.creditos = json?.creditos;
    throw e;
  }

  if (!res.ok || !json?.success) {
    throw new Error(json?.message || `El servicio respondió ${res.status}`);
  }

  return { estado: json.estado, yaEstaba: !!json.yaEstaba };
}
