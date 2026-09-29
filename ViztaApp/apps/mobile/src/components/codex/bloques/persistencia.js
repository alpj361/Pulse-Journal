import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../../../utils/supabase';
import { aMarkdown, fusionar, validar, versionDeLaBase } from '../../../documento';

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
 *   solo para notas que ya existen: `nota_guardar_bloques` escribe el
 *   documento y su markdown sin tocar el resto de la nota. Una nota nueva se
 *   sigue creando con «guardar», que es donde se decide su título, su espacio
 *   y si es historia.
 *
 * Si la nota cambió en otro lado desde que se abrió acá, la base no escribe
 * y devuelve lo que tiene: se junta bloque por bloque (`fusion.js`), se
 * muestra lo junto y se guarda eso. Nadie pisa lo que escribió el otro.
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

/** ¿Este documento es el de este markdown? Si no, alguien cambió el texto sin él. */
export const coherente = (doc, description) =>
  !!doc && validar(doc).ok && aMarkdown(doc).trim() === String(description || '').trim();

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
 * @returns `{ volcar, esperar, marcarGuardado, cargado }`
 */
export default function usePersistencia(editor, { activo, idRef, base, baseDoc, cargada, onError }) {
  const ultimo = useRef(null); // lo último que quedó en la base: markdown + documento
  const reloj = useRef({ borrador: null, guardar: null });
  const enCurso = useRef(Promise.resolve());

  /**
   * `comprobar`: preguntar a la base aunque acá no haya cambios. Lo usa
   * «guardar», que escribe la nota entera y antes tiene que haber juntado lo
   * que se haya escrito en otro lado.
   */
  const guardarAhora = useCallback((opciones = {}) => {
    clearTimeout(reloj.current.guardar);
    const id = idRef.current;
    if (!id) return Promise.resolve();
    const doc = editor.getState().documento();
    const firma = JSON.stringify(doc);
    const saltar = () => !opciones.comprobar && ultimo.current?.firma === firma;
    if (saltar()) return enCurso.current;
    // Lo que había en la base cuando se empezó a editar, tomado ahora: si
    // mientras tanto se abre otra nota, estos datos siguen siendo los de esta.
    let baseTexto = base?.current ?? null;
    let baseDocumento = baseDoc?.current ?? null;

    // En fila: dos guardados a la vez podrían llegar al revés y dejar en la
    // base el más viejo.
    enCurso.current = enCurso.current
      .catch(() => {})
      .then(async () => {
        if (saltar()) return;
        let enviado = doc;
        // Si la nota cambió en otro lado, se junta y se vuelve a intentar.
        // Tres vueltas alcanzan de sobra: otra más sería alguien escribiendo
        // en otro dispositivo en el mismo segundo, todo el tiempo.
        for (let vuelta = 0; vuelta < 3; vuelta++) {
          const md = aMarkdown(enviado).trim();
          const { data, error } = await supabase.rpc('nota_guardar_bloques', {
            p_id: id,
            p_description: md,
            p_documento: enviado,
            p_base: baseTexto,
          });
          if (error) {
            onError?.(error);
            return;
          }
          const mismaNota = idRef.current === id;
          if (data?.ok) {
            if (mismaNota) {
              ultimo.current = { firma: JSON.stringify(enviado) };
              if (base) base.current = md;
              if (baseDoc) baseDoc.current = enviado;
              // Ya está en la base: el borrador sobra, salvo que se haya
              // seguido escribiendo mientras tanto.
              if (JSON.stringify(editor.getState().documento()) === JSON.stringify(enviado)) borrarBorrador(id);
            }
            return;
          }

          const suyo = versionDeLaBase(
            { description: data?.description, documento: data?.documento },
            baseDocumento || enviado,
            { coherente },
          );
          const nuestro = mismaNota ? editor.getState().documento() : enviado;
          const junto = fusionar(baseDocumento || nuestro, nuestro, suyo);
          if (mismaNota) editor.getState().fusionarCon(junto);
          enviado = mismaNota ? editor.getState().documento() : junto;
          baseTexto = String(data?.description || '').trim();
          baseDocumento = suyo;
        }
      });
    return enCurso.current;
  }, [editor, idRef, base, baseDoc, onError]);

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
        reloj.current.guardar = setTimeout(() => guardarAhora(), GUARDAR_MS);
      }
    });
    return () => {
      quitar();
      clearTimeout(reloj.current.borrador);
      clearTimeout(reloj.current.guardar);
    };
  }, [activo, editor, idRef, base, cargada, guardarAhora]);

  /** Lo que haya pendiente, a la base ya. Para salir de la hoja. */
  const volcar = useCallback(
    (opciones) => {
      clearTimeout(reloj.current.borrador);
      return guardarAhora(opciones);
    },
    [guardarAhora],
  );

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
      if (baseDoc) baseDoc.current = doc;
      borrarBorrador(null);
      if (id) borrarBorrador(id);
    },
    [base, baseDoc],
  );

  /**
   * Se cargó otra cosa en el editor. Si es lo que ya está en la base, no hay
   * nada que guardar hasta que se escriba; si vino de un borrador, sí.
   */
  const cargado = useCallback(
    (doc, { yaEnLaBase, docDeLaBase }) => {
      ultimo.current = yaEnLaBase ? { firma: JSON.stringify(doc) } : null;
      if (baseDoc) baseDoc.current = docDeLaBase;
    },
    [baseDoc],
  );

  return { volcar, esperar, marcarGuardado, cargado };
}
