import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../../utils/supabase';

/**
 * Mirar el análisis de un post llegar.
 *
 * El trabajo corre en el servidor, así que el resultado no vuelve por la
 * llamada que lo pidió: aparece en la fila. Esto se suscribe a esa fila y avisa
 * cuando cambia.
 *
 * Va por Realtime y no por sondeo porque la app ya lo usa —el feed y el mapa
 * escuchan `postgres_changes`— y porque un sondeo cada pocos segundos sobre una
 * espera que puede durar medio minuto es tráfico que no hace falta.
 *
 * **Se relee al volver del segundo plano.** Una suscripción no sobrevive
 * necesariamente a un rato con la pantalla apagada, y si el análisis terminó
 * mientras tanto el evento ya pasó sin nadie escuchando. La relectura es lo que
 * hace que volver a la app muestre el resultado y no una espera congelada —que
 * es justo lo que este cambio venía a arreglar.
 *
 * @returns `{ analisis, estado, error, hablante, reconocimiento }` —
 *          `estado` es `'procesando'`, `'error'` o `null` cuando no hay nada
 *          en curso. `hablante` y `reconocimiento` son lo que dejó el servidor
 *          sobre quién habla en el video (ver `hablantePost` en ExtractorW).
 */
export default function useAnalisisPost(postId, inicial) {
  const [analisis, setAnalisis] = useState(inicial?.analysis || null);
  const [estado, setEstado] = useState(inicial?.analysis_estado || null);
  const [error, setError] = useState(inicial?.analysis_error || null);
  // Quién habla, y si el reconocimiento sugirió a alguien. Llegan por la misma
  // fila y por la misma vía: pueden terminar un rato después que la carga.
  const [hablante, setHablante] = useState(inicial?.hablante || null);
  const [reconocimiento, setReconocimiento] = useState(inicial?.reconocimiento || null);

  // Lo último aplicado, para no re-renderizar con lo mismo.
  const visto = useRef(null);

  useEffect(() => {
    if (!postId) return;
    let vivo = true;

    const aplicar = (details) => {
      if (!vivo || !details) return;
      const firma = JSON.stringify([details.analysis, details.analysis_estado, details.hablante, details.reconocimiento]);
      if (firma === visto.current) return;
      visto.current = firma;

      setAnalisis(details.analysis || null);
      setEstado(details.analysis_estado || null);
      setError(details.analysis_error || null);
      setHablante(details.hablante || null);
      setReconocimiento(details.reconocimiento || null);
    };

    const releer = async () => {
      const { data } = await supabase
        .from('codex_universe_items')
        .select('details')
        .eq('id', postId)
        .maybeSingle();
      aplicar(data?.details);
    };

    // Una lectura al montar: el análisis puede haber terminado mientras la hoja
    // estaba cerrada, y en ese caso no va a llegar ningún evento.
    releer();

    const canal = supabase
      .channel(`post-analisis-${postId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'codex_universe_items', filter: `id=eq.${postId}` },
        (payload) => aplicar(payload.new?.details)
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
  }, [postId]);

  return { analisis, estado, error, hablante, reconocimiento };
}
