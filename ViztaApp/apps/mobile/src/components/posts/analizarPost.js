import { supabase } from '../../utils/supabase';
import { EXTRACTORW_URL } from '../../utils/servicios';

/**
 * Extraer los detalles de un post con IA.
 *
 * Manda el texto —la transcripción si el post es un video, si no la
 * descripción— a `/api/ai/analyze-content` de ExtractorW, que por dentro usa
 * un modelo vía OpenRouter y devuelve actores, entidades, territorios, eventos,
 * hechos y una narrativa.
 *
 * El resultado se guarda en `details.analysis`. Eso no es cache por ahorrar: es
 * para que el análisis siga estando la próxima vez que se abra el post, en otro
 * teléfono o en la web. Analizar dos veces el mismo texto cuesta plata y puede
 * dar respuestas distintas, que es peor que cualquier ahorro.
 *
 * Al guardar se releen los `details` actuales y se escriben de vuelta enteros:
 * `update` sobre una columna jsonb reemplaza todo el objeto, así que sin ese
 * paso el análisis borraría la transcripción, el autor y el enlace.
 */
export default async function analizarPost(post) {
  const texto = post?.details?.transcription || post?.description || post?.name || '';
  if (!texto.trim()) throw new Error('Este post no tiene texto para analizar.');

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const res = await fetch(`${EXTRACTORW_URL}/api/ai/analyze-content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text: texto, title: post?.name || '' }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || json?.message || `El servicio respondió ${res.status}`);
  }

  const d = json.analysis || {};
  const analisis = {
    actores: d.actores || [],
    // Territorios y entidades se muestran juntos: en un post nadie separa «el
    // Congreso» de «Quetzaltenango», los dos son el dónde y el quién.
    entidades: [...(d.entidades || []), ...(d.territorios || [])],
    temas: d.eventos || [],
    hechos: d.hechos || [],
    contexto: d.narrativa || '',
    resumen: d.hechos?.[0] || (d.narrativa || '').slice(0, 140),
    analyzed_at: new Date().toISOString(),
  };

  try {
    const { data: actual } = await supabase
      .from('codex_universe_items')
      .select('details')
      .eq('id', post.id)
      .single();

    await supabase
      .from('codex_universe_items')
      .update({ details: { ...(actual?.details || {}), analysis: analisis } })
      .eq('id', post.id);
  } catch {
    // Que no se pueda guardar no invalida el análisis: ya está en pantalla.
    // Se perderá al cerrar, y volver a pedirlo es una molestia, no un error.
  }

  return analisis;
}
