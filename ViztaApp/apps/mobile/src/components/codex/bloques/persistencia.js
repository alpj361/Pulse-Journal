import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../../../utils/supabase';
import { aMarkdown, validar } from '../../../documento';

/**
 * Que nada se pierda.
 *
 * Dos capas, con tiempos distintos:
 *
 * - **Borrador local** (`expo-sqlite`, clave-valor): se escribe casi en cada
 *   pausa. Si la app se cierra de golpe —el sistema la mata, se acaba la
 *   batería— al volver a abrir la nota el texto sigue ahí. Es local y no
 *   cuesta nada.
 * - **Guardado en la base** a los 1,5 s de dejar de escribir y al salir,
 *   solo para notas que ya existen: `nota_guardar_documento` escribe el
 *   documento y su markdown sin tocar el resto de la nota. Una nota nueva se
 *   sigue creando con «guardar», que es donde se decide su título, su espacio
 *   y si es historia.
 */

const BORRADOR_MS = 400;
const GUARDAR_MS = 1500;

// El almacén se pide recién al usarlo y puede no estar: en la web no hay
// SQLite sin configurar el servidor, y un fallo acá no puede tumbar la nota.
let almacen;
function kv() {
  if (almacen === undefined) {
    try {
      almacen = Platform.OS === 'web' ? null : require('expo-sqlite/kv-store').Storage;
    } catch {
      almacen = null;
    }
  }
  return almacen;
}

const claveDe = (id) => `nota-borrador:${id || 'nueva'}`;

/**
 * El borrador de una nota, si hay uno que valga: `{ doc, base }`. `base` es el
 * markdown de la nota tal como estaba en la base cuando se empezó a editar;
 * si la base cambió desde entonces —se editó en otro lado—, el borrador es
 * viejo y no se usa.
 */
export function leerBorrador(id) {
  try {
    const crudo = kv()?.getItemSync(claveDe(id));
    if (!crudo) return null;
    const b = JSON.parse(crudo);
    return b?.doc && validar(b.doc).ok ? b : null;
  } catch {
    return null;
  }
}

export function borrarBorrador(id) {
  try {
    kv()?.removeItemSync(claveDe(id));
  } catch {
    // Sin almacén no hay nada que borrar.
  }
}

function escribirBorrador(id, doc, base) {
  try {
    kv()
      ?.setItem(claveDe(id), JSON.stringify({ doc, base, ts: Date.now() }))
      .catch(() => {});
  } catch {
    // Sin almacén la nota funciona igual; solo no sobrevive a un cierre de golpe.
  }
}

/**
 * @param editor   el store del editor
 * @param idRef    ref con la nota abierta, o null si es nueva
 * @param base     ref con el markdown de la base al abrir (lo actualiza quien carga)
 * @param cargada  ref con la `version` del editor después de la última carga:
 *                 una carga no es una edición y no se guarda
 * @returns `{ volcar, marcarGuardado }`
 */
export default function usePersistencia(editor, { activo, idRef, base, cargada, onError }) {
  const ultimo = useRef(null); // lo último que quedó en la base: markdown + documento
  const reloj = useRef({ borrador: null, guardar: null });
  const enCurso = useRef(Promise.resolve());

  const guardarAhora = useCallback(() => {
    clearTimeout(reloj.current.guardar);
    const id = idRef.current;
    if (!id) return Promise.resolve();
    const doc = editor.getState().documento();
    const md = aMarkdown(doc).trim();
    const firma = JSON.stringify(doc);
    if (ultimo.current?.firma === firma) return enCurso.current;
    // En fila: dos guardados a la vez podrían llegar al revés y dejar en la
    // base el más viejo.
    enCurso.current = enCurso.current
      .catch(() => {})
      .then(async () => {
        if (ultimo.current?.firma === firma) return;
        const { error } = await supabase.rpc('nota_guardar_documento', {
          p_id: id,
          p_description: md,
          p_documento: doc,
        });
        if (error) {
          onError?.(error);
          return;
        }
        ultimo.current = { firma };
        if (base) base.current = md;
        // Ya está en la base: el borrador sobra, salvo que se haya seguido
        // escribiendo mientras tanto.
        if (JSON.stringify(editor.getState().documento()) === firma) borrarBorrador(id);
      });
    return enCurso.current;
  }, [editor, idRef, base, onError]);

  useEffect(() => {
    if (!activo) return undefined;
    const quitar = editor.subscribe((s, prev) => {
      if (s.version === prev.version || s.version === cargada?.current) return;
      clearTimeout(reloj.current.borrador);
      reloj.current.borrador = setTimeout(() => {
        escribirBorrador(idRef.current, editor.getState().documento(), base?.current ?? '');
      }, BORRADOR_MS);
      if (idRef.current) {
        clearTimeout(reloj.current.guardar);
        reloj.current.guardar = setTimeout(guardarAhora, GUARDAR_MS);
      }
    });
    return () => {
      quitar();
      clearTimeout(reloj.current.borrador);
      clearTimeout(reloj.current.guardar);
    };
  }, [activo, editor, idRef, base, cargada, guardarAhora]);

  /** Lo que haya pendiente, a la base ya. Para salir de la hoja. */
  const volcar = useCallback(() => {
    clearTimeout(reloj.current.borrador);
    return guardarAhora();
  }, [guardarAhora]);

  /**
   * Antes de que «guardar» escriba: cancelar el guardado que estaba por
   * salir y esperar al que ya salió. Si no, uno en vuelo con texto de hace un
   * segundo podría llegar después y dejar en la base lo más viejo.
   */
  const esperar = useCallback(() => {
    clearTimeout(reloj.current.guardar);
    return enCurso.current.catch(() => {});
  }, []);

  /** «Guardar» ya escribió esto: el guardado automático no tiene que repetirlo. */
  const marcarGuardado = useCallback(
    (doc, id) => {
      ultimo.current = { firma: JSON.stringify(doc) };
      if (base) base.current = aMarkdown(doc).trim();
      borrarBorrador(null);
      if (id) borrarBorrador(id);
    },
    [base],
  );

  /**
   * Se cargó otra cosa en el editor. Si es lo que ya está en la base, no hay
   * nada que guardar hasta que se escriba; si vino de un borrador, sí.
   */
  const cargado = useCallback((doc, { yaEnLaBase }) => {
    ultimo.current = yaEnLaBase ? { firma: JSON.stringify(doc) } : null;
  }, []);

  return { volcar, esperar, marcarGuardado, cargado };
}
