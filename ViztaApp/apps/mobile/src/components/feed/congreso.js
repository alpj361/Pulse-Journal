import { supabase } from '../../utils/supabase';

/**
 * El feed del Congreso: lo que publica el Congreso cada día, ya juntado en la
 * base (`congreso_items_app_view`). Son sus noticias, las publicaciones de su
 * cuenta que las cubren, y el noticiero legislativo.
 */

const COLUMNAS =
  'id, digest_date, tipo, titulo, url, iniciativa_numero, video_id, summary, stage, result, votes, card_type, card_data';

const COLUMNAS_VOTACION = 'id, fecha, sesion, asunto, resultado, a_favor, en_contra, ausentes, licencia, iniciativa_numero';

/** Los últimos días con algo, cada uno con su noticiero y sus títulos. */
export async function traerCongreso() {
  const { data, error } = await supabase
    .from('congreso_items_app_view')
    .select(COLUMNAS)
    .order('digest_date', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(80);
  if (error) throw error;

  await completarTitulos(data || []);

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
  // El noticiero también llega como «noticia» del sitio, con el mismo título:
  // ya está arriba como salto al video, y repetido no dice nada.
  for (const d of dias) d.items = d.items.filter((i) => i.tipo === 'noticiero' || !/^\s*noticiero legislativo/i.test(i.titulo || ''));
  const visibles = dias.slice(0, 7);

  // Las votaciones del pleno de esos días. Vienen de su propio registro, con
  // los 160 votos contados; se juntan con las noticias solo por la fecha, que
  // es lo único que de verdad comparten. Si fallan, el día se muestra igual.
  if (visibles.length) {
    const { data: votaciones } = await supabase
      .from('votaciones')
      .select(COLUMNAS_VOTACION)
      .in('fecha', visibles.map((d) => d.fecha))
      .order('created_at', { ascending: true });
    for (const d of visibles) {
      const delDia = (votaciones || []).filter((v) => v.fecha === d.fecha);
      // Primero lo que decide algo; aprobar el orden del día es trámite.
      const tramite = (v) => /orden del d[ií]a|acta de la sesi[oó]n/i.test(v.asunto || '');
      d.votaciones = delDia.sort((a, b) => tramite(a) - tramite(b));
    }
  }
  return visibles;
}

const CORTADO = /(\.\.\.|…)\s*$/;
const plano = (t) =>
  String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Los títulos que el sitio del Congreso cortó («…DEL RÍO...»), enteros.
 *
 * El listado del sitio los corta, pero cuando la nota se leyó completa su
 * título entero viene como encabezado dentro del texto. Se toma de ahí, y solo
 * si empieza igual que el cortado: así no se le pone a una nota el título de
 * otra. Las que no se leyeron completas —las que llegaron por tweets— quedan
 * cortadas: el título entero no está guardado en ningún lado.
 */
async function completarTitulos(items) {
  const cortados = items.filter((i) => CORTADO.test(i.titulo || ''));
  if (!cortados.length) return;
  const { data } = await supabase
    .from('congreso_items_app_view')
    .select('id, gap_content')
    .in('id', cortados.map((i) => i.id))
    .not('gap_content', 'is', null);
  const textos = new Map((data || []).map((f) => [f.id, f.gap_content]));
  for (const item of cortados) {
    const texto = textos.get(item.id);
    if (!texto) continue;
    const inicio = plano(item.titulo.replace(CORTADO, ''));
    const entero = texto
      .split('\n')
      .filter((l) => /^#{1,3}\s+\S/.test(l))
      .map((l) => l.replace(/^#{1,3}\s+/, '').trim())
      .find((l) => inicio.length >= 8 && plano(l).startsWith(inicio));
    if (entero) item.titulo = entero;
  }
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
