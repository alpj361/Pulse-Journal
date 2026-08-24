import { supabase } from '../../utils/supabase';
import { EXTRACTORT_URL, EXTRACTORW_URL } from '../../utils/servicios';

/**
 * Agregar un post a partir de su enlace.
 *
 * Tres caminos según de dónde venga, porque cada plataforma se extrae distinto:
 *
 *  · **X / Twitter** → ExtractorW `/api/x/media`, que además trae métricas.
 *  · **Reels** → ExtractorT `/instagram/transcribe`, que baja el audio y lo pasa
 *    por Whisper. Es el único que devuelve transcripción, y es la razón por la
 *    que un reel no se puede extraer con el mismo endpoint que un post normal.
 *  · **Resto de Instagram** → ExtractorW `/api/instagram/extract`.
 *
 * La lógica es la misma que ya usaba el Codex web; se movió a su propio archivo
 * para poder llamarla desde la vista nueva sin importar nada de la pantalla
 * vieja, que vive en un archivo de ruta y arrastra medio Codex consigo.
 *
 * Devuelve la fila insertada. Lanza con un mensaje legible si algo falla: quien
 * llama decide cómo mostrarlo.
 */
export default async function agregarPost(urlCruda) {
  const url = String(urlCruda || '').trim();
  if (!/^https?:\/\//i.test(url)) throw new Error('Pegá un enlace que empiece con http');

  const esTwitter = url.includes('twitter.com/') || url.includes('x.com/');
  const esReel = !esTwitter && url.includes('/reel/');

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw new Error('Sin sesión activa');

  const auth = token ? { Authorization: `Bearer ${token}` } : {};
  let d = null;

  if (esTwitter) {
    const json = await pedir(`${EXTRACTORW_URL}/api/x/media`, { url }, auth);
    if (!json.success) throw fallo(200, mensaje(json), 'enlace');
    d = {
      source_url: url,
      author: json.author_handle || null,
      author_name: json.author_name || null,
      description: json.tweet_text || null,
      is_reel: false,
      is_twitter: true,
      thumbnail_url: json.thumbnail_url || json.images?.[0] || null,
      video_url: json.video_url || null,
      transcription: json.transcription || null,
      post_id: json.post_id || null,
      extracted_images: json.images || [],
      tweet_metrics: json.tweet_metrics || null,
    };
  } else if (esReel) {
    // ExtractorT no pide token: es el servicio de scraping, no el de negocio.
    const json = await pedir(`${EXTRACTORT_URL}/instagram/transcribe`, { url });
    if (!json.success) throw fallo(200, mensaje(json), 'enlace');
    d = {
      source_url: url,
      author: json.author || null,
      description: json.description || null,
      is_reel: true,
      is_twitter: false,
      thumbnail_url: json.thumbnail_url || null,
      video_url: json.video_url || null,
      transcription: json.transcription || null,
      post_id: json.post_id || null,
      extracted_images: json.thumbnail_url ? [json.thumbnail_url] : [],
    };
  } else {
    const json = await pedir(`${EXTRACTORW_URL}/api/instagram/extract`, { url }, auth);
    if (!json.success) throw fallo(200, mensaje(json), 'enlace');
    d = { ...json, source_url: json.source_url || url };
  }

  const nombre = d.author
    ? `@${d.author}${d.description ? ' — ' + d.description.slice(0, 60) : ''}`
    : d.description?.slice(0, 80) || (d.is_twitter ? 'Tweet de X' : 'Post de Instagram');

  const { data: fila, error } = await supabase
    .from('codex_universe_items')
    .insert({
      user_id: userId,
      tipo: 'post',
      name: nombre,
      description: d.description || '',
      thumbnail_url: d.thumbnail_url || d.extracted_images?.[0] || null,
      tags: [
        ...(d.is_twitter ? ['twitter', 'x'] : ['instagram']),
        ...(d.is_reel ? ['reel', 'video'] : []),
        ...(d.video_url && d.is_twitter ? ['video'] : []),
      ],
      aliases: d.author ? [`@${d.author}`] : [],
      details: {
        source_url: d.source_url,
        images: d.extracted_images || [],
        author: d.author,
        author_name: d.author_name || null,
        is_reel: d.is_reel || false,
        is_twitter: d.is_twitter || false,
        video_url: d.video_url || null,
        thumbnail_url: d.thumbnail_url || null,
        transcription: d.transcription || null,
        post_id: d.post_id || null,
        tweet_metrics: d.tweet_metrics || null,
      },
      mentions: [],
      datasets: [],
    })
    .select('id, name, tipo, description, tags, thumbnail_url, details, aliases, created_at')
    .single();

  if (error) throw new Error(error.message);
  return fila;
}

async function pedir(endpoint, cuerpo, extra = {}) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extra },
    body: JSON.stringify(cuerpo),
  });

  const texto = await res.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    // No siempre contestan JSON: un 502 de nginx llega como HTML, y ahí
    // «Unexpected token <» no le dice nada a nadie.
    throw new Error(`El servicio respondió ${res.status}`);
  }

  if (!res.ok) throw fallo(res.status, mensaje(json));

  return json;
}

/**
 * Un error listo para mostrar, sin contar de más.
 *
 * Lo que devuelve el servicio no se puede poner en pantalla. Un 502 de acá
 * llegó a decir literalmente «This request requires at least $0.50 in balance
 * for audio»: eso le cuenta a cualquiera que use la app cómo está facturada la
 * infraestructura por dentro, y además no le sirve de nada — no es algo que
 * pueda arreglar.
 *
 * Así que en pantalla van dos mensajes nada más, según lo único que le importa
 * a quien está del otro lado: **¿puedo hacer algo o no?**
 *
 *  · El enlace está mal o el post es privado → puede probar con otro.
 *  · Cualquier otra cosa (servicio caído, sin saldo, timeout) → no puede hacer
 *    nada, y decirle más sería filtrar detalles internos.
 *
 * El motivo real queda en `causa` y sale por consola, que es donde sirve.
 */
function fallo(status, detalle, categoria) {
  // 4xx del lado del pedido: casi siempre el enlace. 404 y 422 incluidos.
  // `categoria` permite forzarlo cuando el status no alcanza para decidir.
  const esDelEnlace =
    categoria === 'enlace' ||
    (categoria !== 'servicio' && status >= 400 && status < 500 && status !== 401 && status !== 403);

  const e = new Error(
    esDelEnlace
      ? 'No pudimos leer ese enlace. Revisá que sea correcto y que el post sea público.'
      : 'El servicio no está disponible en este momento. Probá de nuevo más tarde.'
  );
  e.status = status;
  e.causa = detalle || null;
  e.categoria = esDelEnlace ? 'enlace' : 'servicio';

  // A consola, no a la pantalla.
  console.log('[agregarPost] fallo', status, detalle || '(sin detalle)');
  return e;
}

/**
 * El texto de error que devuelve el servicio, mire donde mire.
 *
 * Cada uno lo pone en un lugar distinto: ExtractorT es FastAPI y usa `detail`,
 * ExtractorW usa `error` (a veces cadena, a veces objeto con `message`). Sin
 * `detail` los errores del transcriptor llegaban vacíos.
 */
function mensaje(json) {
  if (!json) return null;

  const d = json.detail;
  if (typeof d === 'string' && d.trim()) return d;
  // FastAPI también manda `detail` como lista cuando falla la validación.
  if (Array.isArray(d) && d.length) return d.map((x) => x?.msg || String(x)).join('; ');
  if (d && typeof d === 'object' && d.message) return d.message;

  const e = json.error;
  if (typeof e === 'string' && e.trim()) return e;
  if (e && typeof e === 'object' && e.message) return e.message;

  return typeof json.message === 'string' && json.message.trim() ? json.message : null;
}
