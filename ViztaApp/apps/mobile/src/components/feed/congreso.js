import { supabase } from '../../utils/supabase';

/**
 * El feed del Congreso: lo que publica el Congreso cada día, ya juntado en la
 * base (`congreso_items_app_view`). Son sus noticias, las publicaciones de su
 * cuenta que las cubren, y el noticiero legislativo.
 */

const COLUMNAS =
  'id, digest_date, tipo, titulo, url, coverage_status, thumbnail_url, tweet_urls, tweet_count, iniciativa_numero, iniciativa_titulo, iniciativa_estado, iniciativa_url, norma_titulo, norma_decreto, video_id';

/** Los últimos días con algo, cada uno con su noticiero y sus títulos. */
export async function traerCongreso() {
  const { data, error } = await supabase
    .from('congreso_items_app_view')
    .select(COLUMNAS)
    .order('digest_date', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(80);
  if (error) throw error;

  const dias = [];
  for (const item of data || []) {
    let dia = dias.find((d) => d.fecha === item.digest_date);
    if (!dia) {
      dia = { fecha: item.digest_date, items: [] };
      dias.push(dia);
    }
    dia.items.push(item);
  }
  // El noticiero arriba de cada día: es el resumen de todo lo demás.
  for (const d of dias) d.items.sort((a, b) => (b.tipo === 'noticiero') - (a.tipo === 'noticiero'));
  return dias.slice(0, 3);
}

/**
 * El titular, legible.
 *
 * El Congreso los publica en MAYÚSCULAS y a veces cortados («…EN...»). En
 * mayúsculas corridas un titular en serif grita; se pasa a oración. Se pierde
 * la mayúscula de algún nombre propio, que es menos grave que diez titulares
 * gritando uno abajo del otro. Las siglas cortas se respetan.
 */
export function titular(crudo) {
  const t = String(crudo || '').trim().replace(/\\/g, '').replace(/\s*\.\.\.$/, '…').replace(/^#\w+:\s*/, '');
  const letras = t.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '');
  const gritando = letras.length > 6 && letras === letras.toUpperCase();
  if (!gritando) return t;
  const SIGLAS = /^(IGSS|SAT|ONU|OEA|CC|CSJ|MP|TSE|USAC|IVA|ISR|IUSI|PNC|INE|CONRED|EEUU|UE)$/;
  const frase = t
    .split(/(\s+)/)
    .map((p) => (SIGLAS.test(p.replace(/[^A-ZÁÉÍÓÚÑ]/g, '')) ? p : p.toLowerCase()))
    .join('');
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

/** «martes 6 de octubre», y «hoy» o «ayer» cuando corresponde. */
export function nombreDelDia(fecha) {
  const [a, m, d] = String(fecha).split('-').map(Number);
  const dia = new Date(a, m - 1, d);
  const hoy = new Date();
  const dif = Math.round((new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) - dia) / 86400000);
  if (dif === 0) return 'hoy';
  if (dif === 1) return 'ayer';
  return dia.toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** A dónde lleva el noticiero: su video en YouTube. */
export function enYouTube(item) {
  if (item.video_id) return `https://www.youtube.com/watch?v=${item.video_id}`;
  return /youtu\.?be/.test(item.url || '') ? item.url : null;
}
