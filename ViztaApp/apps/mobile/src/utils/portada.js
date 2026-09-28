import { useEffect, useState } from 'react';
import { firmarMedio } from './subirMedio';

/**
 * La portada de un elemento del Codex, lista para `<Image>`.
 *
 * Las notas guardan su portada como ruta privada (`details.portada_path`) y no
 * como enlace: sus fotos son privadas y un enlace firmado vence en una hora. Las
 * notas guardadas antes no tienen esa clave, pero sí sus fotos con ruta, y la
 * primera es la portada. El resto del Codex —retratos del Congreso, posts— sigue
 * con un enlace público en `thumbnail_url` o `details.foto`.
 *
 * La ruta privada va primero: una nota vieja puede tener además un enlace
 * público de cuando el bucket lo era, y ese enlace ya no abre.
 */

// La misma clave donde CreateSnippetSheet guarda las fotos de una nota.
const CLAVE_FOTOS = 'usr_imagenes';

// Un enlace firmado dura una hora; se reusa 50 minutos para que una lista no
// firme la misma foto en cada render ni cada vez que se vuelve a abrir.
const VIGENCIA_MS = 50 * 60 * 1000;
const firmadas = new Map(); // ruta → { url, hasta } | { promesa }

/** La ruta privada de la portada, si la hay. */
export function rutaPortada(item) {
  const d = item?.details || {};
  if (typeof d.portada_path === 'string' && d.portada_path) return d.portada_path;
  const fotos = Array.isArray(d[CLAVE_FOTOS]) ? d[CLAVE_FOTOS] : [];
  return fotos.find((f) => typeof f?.storage_path === 'string' && f.storage_path)?.storage_path || null;
}

/** El enlace público de la portada, si la hay. */
export function enlacePortada(item) {
  const d = item?.details || {};
  const uri = item?.thumbnail_url || d.foto || d.Foto || null;
  return typeof uri === 'string' && /^https?:\/\//.test(uri) ? uri : null;
}

function firmar(ruta) {
  const guardada = firmadas.get(ruta);
  if (guardada?.url && guardada.hasta > Date.now()) return Promise.resolve(guardada.url);
  if (guardada?.promesa) return guardada.promesa;
  const promesa = firmarMedio(ruta)
    .then((url) => {
      if (url) firmadas.set(ruta, { url, hasta: Date.now() + VIGENCIA_MS });
      else firmadas.delete(ruta);
      return url;
    })
    .catch(() => {
      firmadas.delete(ruta);
      return null;
    });
  firmadas.set(ruta, { promesa });
  return promesa;
}

/** Una ruta privada del bucket, firmada y lista para `<Image>`. `null` mientras firma. */
export function useRutaFirmada(ruta) {
  const [firmada, setFirmada] = useState(() => {
    const g = ruta ? firmadas.get(ruta) : null;
    return g?.url && g.hasta > Date.now() ? g.url : null;
  });
  useEffect(() => {
    if (!ruta) {
      setFirmada(null);
      return undefined;
    }
    let vivo = true;
    firmar(ruta).then((url) => {
      if (vivo) setFirmada(url);
    });
    return () => {
      vivo = false;
    };
  }, [ruta]);
  return ruta ? firmada : null;
}

/** La portada de un elemento: firmada si es privada, o su enlace público. */
export default function usePortada(item) {
  const ruta = rutaPortada(item);
  const enlace = ruta ? null : enlacePortada(item);
  const [firmada, setFirmada] = useState(() => {
    const g = ruta ? firmadas.get(ruta) : null;
    return g?.url && g.hasta > Date.now() ? g.url : null;
  });

  useEffect(() => {
    if (!ruta) {
      setFirmada(null);
      return undefined;
    }
    let vivo = true;
    firmar(ruta).then((url) => {
      if (vivo) setFirmada(url);
    });
    return () => {
      vivo = false;
    };
  }, [ruta]);

  return ruta ? firmada : enlace;
}
