import { EXTRACTORW_URL } from '../../utils/servicios';
import { supabase } from '../../utils/supabase';

/**
 * Pedir una medición fresca, porque alguien abrió el tráfico.
 *
 * El servidor mide de fondo cada 15 minutos; esto le pide que mida ya si lo
 * último que tiene es viejo. El tope lo pone él —no mide más de una vez cada
 * diez minutos, por más que se abra y se cierre—, así que acá se llama sin
 * cuidado. Devuelve `true` si hay datos nuevos que volver a leer.
 *
 * No lanza: si falla, el mapa muestra lo último que haya, con su hora.
 */
export default async function refrescarTrafico() {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return false;
    const res = await fetch(`${EXTRACTORW_URL}/api/trafico/refrescar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => null);
    return !!json?.refrescado;
  } catch {
    return false;
  }
}
