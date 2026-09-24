import { supabase } from '../../utils/supabase';
import { EXTRACTORW_URL } from '../../utils/servicios';

/**
 * Pedir más de un material de un post: sinopsis, reparto, géneros, o
 * resultados de la web si no hay base para esa clase.
 *
 * Lo consulta el servidor y lo guarda con la mención, así que la segunda vez
 * que se sostiene la misma película sale de ahí, sin consultar de nuevo.
 */
export default async function pedirDetalle(postId, texto) {
  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (!token) throw new Error('Sin sesión activa');

  const res = await fetch(`${EXTRACTORW_URL}/api/material/detalle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ postId, texto }),
  });

  const json = await res.json().catch(() => null);

  // Sin cupo o sin créditos para salir a la web.
  if (res.status === 402) {
    const e = new Error(json?.message || 'No podés buscar más por ahora.');
    e.code = json?.code || 'sin_cupo';
    throw e;
  }

  if (!res.ok || !json?.success) {
    throw new Error(json?.message || `El servicio respondió ${res.status}`);
  }
  return json.detalle;
}
