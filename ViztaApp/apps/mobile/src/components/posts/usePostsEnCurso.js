import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../../utils/supabase';

const COLUMNAS = 'id, name, tipo, description, tags, thumbnail_url, details, aliases, created_at';

// En curso es que se esté trayendo o que se esté analizando. El servidor lanza
// el análisis solo apenas termina de traer el post, así que un post nuevo pasa
// de uno al otro sin quedar libre en el medio: sin mirar las dos marcas, la
// grilla dejaría de escucharlo justo antes de que llegue el análisis, y el
// autofiltro no se enteraría hasta cerrar y volver a abrir.
const enCurso = (d) => d?.carga === 'procesando' || d?.analysis_estado === 'procesando';

/**
 * Ver completarse los posts que están en curso: trayéndose o analizándose.
 *
 * El servidor trae el post y llena la fila, así que el resultado no vuelve por
 * la llamada que lo pidió. Esto escucha esa fila y avisa cuando cambió.
 *
 * Va por Realtime y no por sondeo porque la app ya lo usa —el feed y el mapa
 * escuchan `postgres_changes`— y porque un reel puede tardar un minuto: sondear
 * todo ese rato es tráfico que no hace falta.
 *
 * **Se relee al volver del segundo plano.** Una suscripción no sobrevive
 * necesariamente a un rato con la pantalla apagada, y si el post terminó
 * mientras tanto el evento ya pasó sin nadie escuchando. Sin esta relectura,
 * volver a la app mostraría un post congelado en «trayendo» — que es justo lo
 * que este cambio venía a arreglar.
 *
 * @param posts    la lista actual
 * @param alCambiar  recibe la fila actualizada
 */
export default function usePostsEnCurso(posts, alCambiar) {
  // La lista cambia con cada render y el efecto no puede depender de ella: se
  // resuscribiría a cada tecla. Se mira por referencia.
  const vivos = useRef([]);
  vivos.current = (posts || []).filter((p) => enCurso(p?.details)).map((p) => p.id);

  const avisar = useRef(alCambiar);
  avisar.current = alCambiar;

  useEffect(() => {
    let vivo = true;

    const releer = async () => {
      if (!vivos.current.length) return;
      const { data } = await supabase
        .from('codex_universe_items')
        .select(COLUMNAS)
        .in('id', vivos.current);

      if (!vivo || !data) return;
      // Solo las que dejaron de estar en curso: re-emitir las que siguen
      // igual haría re-renderizar la grilla entera cada vez que se vuelve.
      for (const fila of data) {
        if (!enCurso(fila?.details)) avisar.current?.(fila);
      }
    };

    const canal = supabase
      .channel('posts-en-curso')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'codex_universe_items' },
        (payload) => {
          const fila = payload.new;
          // El filtro por id no se puede poner en la suscripción: cambia con
          // cada post que se agrega, y rehacer el canal cada vez perdería
          // eventos en el hueco entre desuscribirse y volver a suscribirse.
          if (fila?.id && vivos.current.includes(fila.id)) avisar.current?.(fila);
        }
      )
      .subscribe();

    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') releer();
    });

    return () => {
      vivo = false;
      supabase.removeChannel(canal);
      sub.remove();
    };
  }, []);
}
