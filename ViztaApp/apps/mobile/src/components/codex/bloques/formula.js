import { supabase } from '../../../utils/supabase';
import { EXTRACTORW_URL } from '../../../utils/servicios';

/**
 * Una fórmula en LaTeX, dibujada como SVG por el servidor (MathJax en
 * ExtractorW). Se pide una vez, al salir del bloque, y el SVG se guarda en el
 * bloque: después se ve sin conexión y sin esperar. Sin WebView: el SVG lo
 * pinta `react-native-svg`.
 *
 * Devuelve `{ svg, ancho, alto }` (en puntos) o lanza si no se pudo.
 */
export async function dibujarFormula(latex) {
  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (!token) throw new Error('Sin sesión activa');

  const res = await fetch(`${EXTRACTORW_URL}/api/latex/svg`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ latex, display: true }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success || !json.svg) {
    throw new Error(json?.message || `El servicio respondió ${res.status}`);
  }
  return { svg: json.svg, ancho: json.ancho, alto: json.alto };
}
