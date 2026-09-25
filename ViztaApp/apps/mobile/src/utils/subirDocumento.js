import { File } from 'expo-file-system';
import { supabase } from './supabase';
import { asegurarCupo } from '../state/usoStore';

/**
 * `expo-document-picker` se carga al usarlo, no al importar este archivo.
 *
 * Importándolo arriba, un binario sin el módulo nativo lanzaba al evaluar el
 * módulo — y como este archivo lo importa la pantalla del Codex, el fallo se
 * llevaba la pantalla entera en vez de una sola acción. Así, si falta, falla
 * únicamente el botón que lo necesita, con un mensaje que dice qué hacer.
 */
function cargarPicker() {
  try {
    // eslint-disable-next-line global-require
    return require('expo-document-picker');
  } catch {
    throw new Error(
      'El selector de archivos no está en esta versión de la app. Hace falta recompilarla.'
    );
  }
}

/**
 * Elegir un documento del teléfono y subirlo al Codex.
 *
 * Sigue la convención que ya usan los documentos existentes en la base, para no
 * inventar un segundo formato:
 *
 *  · bucket        `digitalstorage` (privado)
 *  · storage_path  `<user_id>/movil/<timestamp>_<nombre_saneado>`
 *  · tabla         `codex_items` con `tipo: 'documento'`
 *
 * Un documento NO va a `codex_universe_items`: esa tabla es de entidades y no
 * tiene columnas de archivo. Los archivos viven en `codex_items`, que sí trae
 * `storage_path`, `nombre_archivo`, `tamano` y `url`.
 *
 * Sobre permisos en iOS: el selector de documentos es una hoja del sistema y no
 * pide permiso aparte — el acto de elegir el archivo ES el consentimiento, y el
 * sistema entrega solo ese archivo. No hay diálogo que pedir. (La galería de
 * fotos sí requiere permiso declarado; eso sería expo-image-picker.)
 */

const BUCKET = 'digitalstorage';

// Lo que el bucket acepta. Filtrar acá evita que el usuario elija algo que el
// servidor va a rechazar después de esperar la subida.
const TIPOS_ACEPTADOS = [
  'image/*',
  'video/*',
  'audio/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/*',
];

// El bucket admite 100 MB, pero subir requiere tener el archivo entero en
// memoria como Uint8Array. 100 MB de bytes en un teléfono es pedir que el
// sistema mate la app, así que el techo real es más bajo y explícito.
const MAX_BYTES = 40 * 1024 * 1024;

/** Nombres de archivo seguros para una ruta de storage, como los ya guardados. */
function sanear(nombre) {
  return String(nombre || 'archivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // tildes y acentos, ya separados por NFD
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-120);
}

/** Título legible: el nombre sin la extensión. */
function tituloDesde(nombre) {
  return String(nombre || 'Documento').replace(/\.[^.]+$/, '') || 'Documento';
}

/**
 * Abre el selector y sube lo elegido.
 *
 * @returns {Promise<{cancelado: boolean, item?: object}>}
 *   `cancelado: true` si el usuario cerró el selector — no es un error y no debe
 *   mostrarse como tal. Cualquier falla real se lanza.
 */
export async function elegirYSubirDocumento({ alEmpezarSubida } = {}) {
  const DocumentPicker = cargarPicker();

  const elegido = await DocumentPicker.getDocumentAsync({
    type: TIPOS_ACEPTADOS,
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (elegido.canceled || !elegido.assets?.length) return { cancelado: true };

  const asset = elegido.assets[0];
  const nombre = asset.name || 'archivo';
  const mime = asset.mimeType || 'application/octet-stream';

  const { data: sesion } = await supabase.auth.getSession();
  const userId = sesion?.session?.user?.id;
  if (!userId) throw new Error('Sin sesión activa');

  const archivo = new File(asset.uri);
  const tamano = asset.size ?? archivo.size ?? 0;

  if (tamano > MAX_BYTES) {
    const mb = (tamano / 1024 / 1024).toFixed(1);
    throw new Error(`El archivo pesa ${mb} MB. El máximo para subir desde el teléfono es 40 MB.`);
  }

  // Recién acá empieza la espera real. El spinner no puede encenderse antes:
  // mientras el usuario navega sus archivos no hay nada subiendo.
  alEmpezarSubida?.({ nombre, tamano });

  const bytes = await archivo.bytes();

  await asegurarCupo('almacenamiento', bytes.length);

  const storagePath = `${userId}/movil/${Date.now()}_${sanear(nombre)}`;
  const { error: errorSubida } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: mime,
    upsert: false,
  });
  if (errorSubida) throw new Error(errorSubida.message || 'No se pudo subir el archivo');

  const fila = {
    user_id: userId,
    tipo: 'documento',
    titulo: tituloDesde(nombre),
    nombre_archivo: nombre,
    tamano,
    storage_path: storagePath,
    // La URL se firma al abrir el archivo. Guardar una URL pública o una firma
    // temporal en la fila rompería la privacidad o quedaría vencida.
    url: null,
    fecha: new Date().toISOString().slice(0, 10),
    proyecto: 'Sin proyecto',
  };

  const { data, error } = await supabase.from('codex_items').insert(fila).select('*').single();

  if (error) {
    // La fila no entró: el archivo quedaría huérfano en el bucket, ocupando
    // espacio sin que nada lo referencie. Se limpia antes de propagar el error.
    try {
      await supabase.storage.from(BUCKET).remove([storagePath]);
    } catch {
      // Si tampoco se pudo limpiar, el error que importa es el de la fila.
    }
    throw new Error(error.message || 'Se subió el archivo pero no se pudo registrar');
  }

  return { cancelado: false, item: data };
}

// ─── Documentos de una nota ───────────────────────────────────────────────────

// Lo que se puede adjuntar a una nota: lo que el servidor sabe leer si la nota
// es una historia. Una foto o un audio tienen su propio botón.
const TIPOS_NOTA = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
];

/**
 * Elegir un documento y subirlo para una nota.
 *
 * No crea fila en `codex_items`: el documento es de la nota, y la nota lo
 * registra en `nota_documentos` al guardarse. Va a `<user_id>/notas/…`, la
 * carpeta que el usuario puede borrar él mismo.
 *
 * @returns {Promise<{cancelado: true} | {cancelado: false, storage_path, nombre, mime, tamano}>}
 */
export async function subirDocumentoNota({ alEmpezarSubida } = {}) {
  const DocumentPicker = cargarPicker();
  const elegido = await DocumentPicker.getDocumentAsync({
    type: TIPOS_NOTA,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (elegido.canceled || !elegido.assets?.length) return { cancelado: true };

  const asset = elegido.assets[0];
  const nombre = asset.name || 'documento';
  const mime = asset.mimeType || 'application/octet-stream';

  const { data: sesion } = await supabase.auth.getSession();
  const userId = sesion?.session?.user?.id;
  if (!userId) throw new Error('Sin sesión activa');

  const archivo = new File(asset.uri);
  const tamano = asset.size ?? archivo.size ?? 0;
  if (tamano > MAX_BYTES) {
    const mb = (tamano / 1024 / 1024).toFixed(1);
    throw new Error(`El archivo pesa ${mb} MB. El máximo es 40 MB.`);
  }

  alEmpezarSubida?.({ nombre, tamano });
  const bytes = await archivo.bytes();
  await asegurarCupo('almacenamiento', bytes.length);

  const storagePath = `${userId}/notas/${Date.now()}_${sanear(nombre)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: mime,
    upsert: false,
  });
  if (error) throw new Error(error.message || 'No se pudo subir el documento');

  return { cancelado: false, storage_path: storagePath, nombre, mime, tamano };
}

/** Borrar el archivo de un documento de nota. Si falla, no rompe nada. */
export async function borrarDocumentoNota(storagePath) {
  if (!storagePath) return;
  try {
    await supabase.storage.from(BUCKET).remove([storagePath]);
  } catch {
    // Queda en el bucket; no hay nada que el usuario pueda hacer al respecto.
  }
}

/** Un enlace temporal para abrir el documento. */
export async function firmarDocumentoNota(storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 10);
  if (error) throw error;
  return data?.signedUrl || null;
}
