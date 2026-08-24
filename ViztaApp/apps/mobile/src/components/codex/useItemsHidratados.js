import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../utils/supabase';

/**
 * Trae la fila completa de los items mencionados.
 *
 * Por qué hace falta: el índice de menciones se baja con `id, name, tipo,
 * aliases` y nada más, porque lo único que necesita es *reconocer* nombres, y
 * arrastrar el `details` de ~1300 items en cada apertura de la nota sería pagar
 * un blob enorme para no mostrarlo casi nunca.
 *
 * Pero esos items recortados después se le pasan a `ItemDetailSheet`, que no
 * consulta la base: dibuja exactamente el objeto que recibe. Con un item sin
 * `details`, la ficha decía «Ningún campo tiene dato todavía» sobre un actor que
 * en la base tiene la ficha llena. Lo mismo dejaba a los chips sin foto, porque
 * el retrato vive en `details.foto`.
 *
 * La solución no es engordar el índice sino hidratar lo poco que se muestra: los
 * mencionados de una nota son un puñado, y se piden por id en una sola consulta.
 * El cache es por id y vive mientras la hoja esté abierta, así que nombrar a
 * alguien, borrarlo y volverlo a nombrar no vuelve a pedir nada.
 */
export default function useItemsHidratados(items) {
  const [completos, setCompletos] = useState({});
  const pedidos = useRef(new Set());

  /**
   * Dejar en el cache la versión recién guardada de un item.
   *
   * El cache no se vence solo, y esa es su gracia mientras se escribe: nombrar a
   * alguien, borrarlo y volverlo a nombrar no vuelve a pedir nada. Pero un item
   * que se acaba de editar queda viejo acá adentro, y al reabrir su ficha se veía
   * la versión anterior.
   *
   * **Se reemplaza en vez de borrar, y esa diferencia es el bug entero.** Borrar
   * la entrada obliga a que la próxima lectura la vuelva a pedir, y entre el
   * borrado y la respuesta el chip queda recortado — solo lo que trae el índice,
   * sin `geo`, sin descripción y sin campos. Si en esa ventana alguien abre la
   * ficha, ve «sin ubicación» para un municipio que tiene su polígono cargado.
   *
   * `guardar()` ya devuelve la fila completa, así que no hay nada que ir a
   * buscar: se guarda y listo. Y se fusiona sobre lo que hubiera, para que si lo
   * guardado viniera incompleto no se pierdan claves que ya teníamos.
   */
  const actualizar = useCallback((fila) => {
    if (!fila?.id) return;
    pedidos.current.add(fila.id);
    setCompletos((prev) => ({ ...prev, [fila.id]: { ...(prev[fila.id] || {}), ...fila } }));
  }, []);

  const ids = items.map((i) => i.id).sort().join(',');

  useEffect(() => {
    const faltantes = items.map((i) => i.id).filter((id) => id && !pedidos.current.has(id));
    if (faltantes.length === 0) return;

    faltantes.forEach((id) => pedidos.current.add(id));

    let vivo = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('codex_universe_items')
          .select('id, name, tipo, description, aliases, tags, details, geo, thumbnail_url, created_at')
          .in('id', faltantes);
        if (error) throw error;
        if (!vivo || !data?.length) return;

        setCompletos((prev) => {
          const siguiente = { ...prev };
          for (const fila of data) siguiente[fila.id] = fila;
          return siguiente;
        });
      } catch {
        // Si falla, se sigue mostrando el item recortado: el chip conserva su
        // nombre y su color, solo que sin foto. Preferible a que desaparezca.
        faltantes.forEach((id) => pedidos.current.delete(id));
      }
    })();

    return () => {
      vivo = false;
    };
    // `ids` es la firma estable del conjunto; `items` cambia de identidad en
    // cada tecla aunque contenga exactamente los mismos mencionados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  // La marca de procedencia va acá y no solo en la fila traída, porque también
  // hay que ponérsela al item recortado que llega del índice: si alguien toca un
  // chip antes de que termine la hidratación, el que abre la ficha es ese.
  //
  // Sin esta marca, `useCamposEditables` da `isUniverse` en falso y manda el
  // UPDATE a `wiki_items` con un id del universo: cero filas, sin error, y la
  // pantalla diciendo que guardó. Todo lo que sale de este hook es del universo
  // —lo trae de `codex_universe_items`—, así que la marca es un hecho, no una
  // suposición.
  return {
    items: items.map((i) => ({ ...(completos[i.id] || i), _source: 'universe' })),
    actualizar,
  };
}
