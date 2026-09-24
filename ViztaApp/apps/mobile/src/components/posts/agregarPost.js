import { supabase } from '../../utils/supabase';
import { EXTRACTORW_URL } from '../../utils/servicios';

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
/**
 * Las plataformas de las que se puede traer un post.
 *
 * Vive acá, al lado de los tres caminos de extracción, para que no se
 * desincronicen: agregar un servicio nuevo abajo y olvidarse de esta lista
 * dejaría enlaces que la app sabe traer pero no reconoce al pegarlos.
 */
const PLATAFORMAS = /^https?:\/\/(?:[a-z0-9-]+\.)*(?:x\.com|twitter\.com|instagram\.com)\//i;

/**
 * ¿Este texto es el enlace de un post?
 *
 * Devuelve el enlace limpio, o `null` si lo que hay no lo es.
 *
 * Se pide que sea de una plataforma conocida y no solo que parezca una URL,
 * porque esto decide qué se pega solo en el campo. Rellenarlo con cualquier
 * cosa que ande en el portapapeles —una dirección, un texto copiado, el enlace
 * de otra app— es peor que dejarlo vacío: obliga a borrar antes de escribir, y
 * convierte una ayuda en un estorbo.
 */
export function enlaceDePost(texto) {
  const url = String(texto || '').trim();
  return PLATAFORMAS.test(url) ? url : null;
}

/**
 * Pedirle al servidor que traiga un post.
 *
 * **No espera a que esté completo.** El servidor crea la fila con el enlace y
 * contesta; la trae él, y va llenando esa misma fila.
 *
 * Antes todo esto corría acá: la app llamaba a ExtractorW o a ExtractorT,
 * esperaba —un reel pasa por descarga de audio y Whisper, lo más lento de
 * todo— y recién entonces insertaba la fila. Cerrar la app a mitad mataba el
 * `fetch` y no quedaba nada: ni el post, ni la transcripción ya pagada.
 *
 * Devuelve la fila a medio llenar, con `details.carga === \'procesando\'`. La
 * grilla la pinta con su estado de carga y la ve completarse sola. Ver
 * `usePostsEnCurso`.
 */
export default async function agregarPost(urlCruda) {
  const url = String(urlCruda || '').trim();
  if (!enlaceDePost(url)) throw new Error('Pegá un enlace de X o de Instagram');

  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (!token) throw new Error('Sin sesión activa');

  const res = await fetch(`${EXTRACTORW_URL}/api/agregar-post`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url }),
  });

  const json = await res.json().catch(() => null);

  // 402 no es una falla del servicio: es que no alcanza —el plan no lo trae, se
  // acabó el cupo, o no hay créditos—. El motivo va en `code`.
  if (res.status === 402) {
    const e = new Error(json?.message || 'No podés agregar posts por ahora.');
    e.status = 402;
    e.categoria = 'plan';
    e.code = json?.code || 'sin_cupo';
    e.creditos = json?.creditos;
    throw e;
  }

  if (!res.ok || !json?.success) {
    const e = new Error(json?.message || 'No se pudo agregar el post');
    e.status = res.status;
    e.categoria = res.status >= 400 && res.status < 500 ? 'enlace' : 'servicio';
    throw e;
  }

  return json.post;
}
