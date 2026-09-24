import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  celdasDeVisita,
  detenerExploracion,
  donde,
  escuchar,
  explorandoSolo,
  iniciarExploracion,
  pedirEnUso,
  pedirSiempre,
  permisoActual,
  recogerPendientes,
} from '../../services/ubicacion';
import { useNieblaStore } from '../../state/nieblaStore';

/**
 * Mi punto en el mapa, y lo que voy destapando al andar.
 *
 * **Andar no dibuja una línea: destapa la niebla.** Los pasos no se guardan
 * como un recorrido —eso es otra cosa, algo que alguien traza a propósito y
 * le pone nombre— sino como celdas descubiertas del mapa raspable, que es
 * donde «estuve por acá» ya tiene significado y ya se persiste.
 *
 * **No pide nada al montar.** Abrir un mapa no es autorizar que te sigan: el
 * permiso se pide cuando alguien toca el botón. Si ya estaba concedido, el
 * punto aparece solo.
 */
export default function useMiUbicacion(abierto) {
  const [permiso, setPermiso] = useState('ninguno');
  const [yo, setYo] = useState(null);
  const [explorando, setExplorando] = useState(false);
  const suscripcion = useRef(null);
  const raspar = useNieblaStore((s) => s.raspar);

  // Lo ya concedido, y si el descubrimiento venía andando: la geocerca
  // sobrevive al cierre de la app, así que el botón tiene que reflejar el
  // estado del sistema y no el de esta sesión.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const [p, activo] = await Promise.all([permisoActual(), explorandoSolo()]);
      if (!vivo) return;
      setPermiso(p);
      setExplorando(activo);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  /** Lo que la tarea anotó mientras la app no estaba. */
  const recoger = useCallback(async () => {
    const claves = await recogerPendientes();
    if (claves.length) raspar(claves);
  }, [raspar]);

  useEffect(() => {
    recoger();
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') recoger();
    });
    return () => sub.remove();
  }, [recoger]);

  // El punto en vivo, mientras el mapa esté abierto y la app al frente. Cada
  // lectura destapa lo que hay alrededor: estar en un lugar es haberlo visto.
  useEffect(() => {
    let vivo = true;
    const parar = () => {
      suscripcion.current?.remove?.();
      suscripcion.current = null;
    };

    const arrancar = async () => {
      if (!abierto || permiso === 'ninguno' || suscripcion.current) return;
      try {
        const s = await escuchar((p) => {
          setYo(p);
          raspar(celdasDeVisita(p.lat, p.lng));
        });
        if (!vivo) return s.remove();
        suscripcion.current = s;
      } catch {
        // Ubicación apagada en el sistema o sin señal: el mapa funciona igual,
        // lo único que se pierde es el punto.
      }
    };

    arrancar();
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') arrancar();
      else parar();
    });

    return () => {
      vivo = false;
      sub.remove();
      parar();
    };
  }, [abierto, permiso, raspar]);

  /** El botón de ubicarme: pide permiso la primera vez, centra siempre. */
  const ubicar = useCallback(async () => {
    let p = permiso;
    if (p === 'ninguno') {
      p = await pedirEnUso();
      setPermiso(p);
      if (p === 'ninguno') return null;
    }
    try {
      const aqui = await donde();
      setYo(aqui);
      raspar(celdasDeVisita(aqui.lat, aqui.lng));
      return aqui;
    } catch {
      return null;
    }
  }, [permiso, raspar]);

  /**
   * Prender o apagar el descubrimiento automático.
   *
   * Acá se pide «siempre», y no antes: iOS muestra ese diálogo una sola vez, y
   * preguntarlo cuando la persona ya dijo «quiero que el mapa se vaya
   * destapando solo» es la única forma de que se entienda.
   */
  const alternarExploracion = useCallback(async () => {
    if (explorando) {
      await detenerExploracion();
      setExplorando(false);
      return 'detenido';
    }
    // Pedirlo de nuevo está bien —el botón sigue ahí y tocarlo vuelve a
    // preguntar—; lo que no está bien es encadenar dos diálogos en un solo
    // toque, y de eso se encarga `pedirSiempre`.
    const p = await pedirSiempre();
    if (p === 'negado') return 'negado';
    setPermiso(p);
    if (p !== 'siempre') return 'sin_permiso';
    await iniciarExploracion();
    await recoger();
    setExplorando(true);
    return 'explorando';
  }, [explorando, recoger]);

  return { permiso, yo, explorando, ubicar, alternarExploracion };
}
