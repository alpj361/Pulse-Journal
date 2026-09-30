import { File } from 'expo-file-system';
import { supabase } from './supabase';
import { asegurarCupo, refrescarUso } from './../state/usoStore';

/**
 * Subir lo que se adjunta a una nota: fotos y audio.
 *
 * Vive aparte de `subirDocumento` porque hace algo que aquél no puede hacer: la
 * foto se **rehace** antes de subirla. Un documento se sube tal cual —cambiarlo
 * sería entregar otro archivo—, pero una foto recién tomada son 12 MP y entre 3
 * y 5 MB, y subir en este proyecto exige tener el archivo entero en memoria como
 * `Uint8Array` (ver el techo de 40 MB en `subirDocumento`). Adjuntar cuatro
 * fotos a una nota sin achicarlas es pedirle al sistema que mate la app.
 *
 * El destino sí es el mismo bucket con la misma forma de ruta, para no inventar
 * un segundo lugar donde viven los archivos del teléfono.
 *
 * **No se crea fila en `codex_items`.** Una foto adjunta a una nota es parte de
 * la nota, no un documento suelto del Codex: registrarla como documento llenaría
 * la lista de archivos con cada foto de cada nota. La referencia vive en el
 * `details` del Snippet; acá solo viajan los bytes.
 */

const BUCKET = 'digitalstorage';

// El lado mayor al que se reduce. 1600 es lo que se ve nítido a pantalla
// completa en un teléfono —el lado largo de la pantalla ronda los 900 puntos, o
// sea ~2700 px reales, pero una foto adjunta nunca se mira con lupa— y deja el
// archivo en unos pocos cientos de KB en vez de varios MB.
const LADO_MAX = 1600;

// JPEG y no PNG: una foto en PNG pesa varias veces más sin verse mejor, porque
// PNG no tiene pérdida y una cámara no produce zonas planas que comprimir.
const CALIDAD = 0.82;

/** Crear una URL temporal para mirar o reproducir un archivo privado. */
export async function firmarMedio(storagePath, segundos = 60 * 60) {
  if (!storagePath) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, segundos);
  if (error) throw new Error(error.message || 'No se pudo abrir el archivo');
  return data?.signedUrl || null;
}

/**
 * Achicar, si hace falta.
 *
 * `resize` con **un solo lado** conserva la proporción; pasar los dos la
 * deformaría. Y si la imagen ya entra en el techo no se toca: reencodear algo
 * que ya está chico solo le saca calidad.
 */
async function normalizar(uri, ancho, alto) {
  // eslint-disable-next-line global-require
  const { manipulateAsync, SaveFormat } = require('expo-image-manipulator');

  const mayor = Math.max(ancho || 0, alto || 0);
  const acciones =
    mayor > LADO_MAX
      ? [(ancho || 0) >= (alto || 0) ? { resize: { width: LADO_MAX } } : { resize: { height: LADO_MAX } }]
      : [];

  return manipulateAsync(uri, acciones, { compress: CALIDAD, format: SaveFormat.JPEG });
}

/**
 * Sube una foto y devuelve cómo referirse a ella.
 *
 * @param uri  archivo local (`file://`). Un `ph://` del carrete **no** sirve:
 *             hay que resolverlo antes con `MediaLibrary.getAssetInfoAsync`,
 *             que es lo que hace la bandeja.
 * @param carpeta dónde, dentro de la carpeta de la persona: `notas` o `espacios`.
 * @returns    `{ url, storage_path, ancho, alto, tamano }`
 */
export async function subirImagen(uri, { ancho, alto, carpeta = 'notas' } = {}) {
  const { data: sesion } = await supabase.auth.getSession();
  const userId = sesion?.session?.user?.id;
  if (!userId) throw new Error('Sin sesión activa');

  const listo = await normalizar(uri, ancho, alto);

  const archivo = new File(listo.uri);
  const bytes = await archivo.bytes();

  // Lo que pesa de verdad, contra lo que queda del plan.
  await asegurarCupo('almacenamiento', bytes.length);

  const storagePath = `${userId}/movil/${carpeta}/${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(error.message || 'No se pudo subir la foto');

  return {
    url: await firmarMedio(storagePath),
    storage_path: storagePath,
    ancho: listo.width,
    alto: listo.height,
    tamano: archivo.size ?? bytes.length,
  };
}

/**
 * Borrar una foto del bucket.
 *
 * No lanza: la foto ya no está en la nota, que es lo que la persona pidió, y un
 * archivo huérfano no es algo que valga interrumpirle la escritura para contar.
 *
 * **Pero el fallo no se pierde.** Supabase devuelve los errores de `remove` en
 * `{ error }` y no como excepción, así que un `try/catch` solo no ve nada: un
 * borrado rechazado —permisos, ruta mal, el objeto ya no está— se veía
 * exactamente igual que uno exitoso, y la foto se quedaba en el bucket para
 * siempre sin que nadie lo supiera. Ahora el resultado se mira y queda en el
 * log, que es donde se puede actuar.
 *
 * @returns `true` si se borró. Quien llama puede usarlo para reintentar o
 *          anotar la ruta; ninguno lo hace hoy, y por eso el log importa.
 */
export async function borrarMedio(storagePath) {
  if (!storagePath) return false;

  try {
    const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
    if (error) {
      console.warn('[subirMedio] no se pudo borrar', storagePath, '—', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[subirMedio] no se pudo borrar', storagePath, '—', e?.message);
    return false;
  }
}


/**
 * Subir un audio ya grabado.
 *
 * El archivo ya existe en el temporal del grabador: acá solo se manda. No hay
 * techo de tamaño como en las fotos porque la duración ya lo pone —una nota de
 * voz de diez minutos en m4a ronda los 5 MB— y cortar una grabación por peso,
 * después de haberla hecho, sería perderla sin aviso.
 */
export async function subirGrabacion(uri, { duracionMs } = {}) {
  const { data: sesion } = await supabase.auth.getSession();
  const userId = sesion?.session?.user?.id;
  if (!userId) throw new Error('Sin sesión activa');

  const archivo = new File(uri);
  const bytes = await archivo.bytes();

  // La extensión sale del propio archivo: el grabador usa .m4a en iOS y .m4a o
  // .3gp en Android según el preset, y el reproductor elige el decodificador
  // por ella.
  const ext = (uri.match(/\.([a-zA-Z0-9]{1,5})$/)?.[1] || 'm4a').toLowerCase();
  const storagePath = `${userId}/movil/notas/${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  await asegurarCupo('almacenamiento', bytes.length);

  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: ext === 'm4a' ? 'audio/mp4' : `audio/${ext}`,
    upsert: false,
  });
  if (error) throw new Error(error.message || 'No se pudo subir la grabación');

  return {
    url: await firmarMedio(storagePath),
    storage_path: storagePath,
    nombre: 'Nota de voz',
    tamano: archivo.size ?? bytes.length,
    duracion_ms: duracionMs || 0,
  };
}
