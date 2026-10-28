import { useCallback, useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { actualizarHuella, corregirLectura, evidenciasDe, leerHuella } from './api';
import { ENFRIAMIENTO_MS, SONDEO_MAX_MS, SONDEO_MS, enCurso, validarCorreccion } from './logica';

export const claveHuella = (autorId) => ['huella-autor', autorId];
const claveEvidencias = (autorId) => ['huella-evidencias', autorId];

/** Recordado por autor mientras la app sigue abierta: el enfriamiento no se reinicia al cerrar la hoja. */
const ULTIMO_PEDIDO = new Map();

/**
 * La huella de un autor: lee el estado, sondea mientras se calcula (cada 4 s,
 * hasta 3 min; se corta al desmontar) y expone actualizar y corregir.
 *
 * Sin huella vigente (`huella: null`) se descartan las evidencias guardadas de
 * la versión anterior: nunca se muestra como vigente algo superado.
 */
export default function useHuellaAutor(autorId) {
  const queryClient = useQueryClient();
  const desde = useRef(null);
  const [ultimoPedido, setUltimoPedido] = useState(() => ULTIMO_PEDIDO.get(autorId) || null);
  const [ahora, setAhora] = useState(Date.now());

  const consulta = useQuery({
    queryKey: claveHuella(autorId),
    queryFn: () => leerHuella(autorId),
    enabled: !!autorId,
    staleTime: 1000 * 30,
    retry: (n, e) => n < 1 && ![401, 403, 404, 422].includes(e?.status),
    refetchInterval: (q) => {
      const r = q.state.data;
      const recalcular = enCurso(r) || (r && !r.huella && r.estado === 'listo');
      if (!recalcular) {
        desde.current = null;
        return false;
      }
      if (!desde.current) desde.current = Date.now();
      return Date.now() - desde.current < SONDEO_MAX_MS ? SONDEO_MS : false;
    },
  });

  const vigenteId = consulta.data?.huella?.id || null;
  useEffect(() => {
    if (consulta.data && !vigenteId) queryClient.removeQueries({ queryKey: claveEvidencias(autorId) });
  }, [consulta.data, vigenteId, autorId, queryClient]);

  // El contador del enfriamiento, solo mientras corre.
  useEffect(() => {
    if (!ultimoPedido || Date.now() - ultimoPedido >= ENFRIAMIENTO_MS) return undefined;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ultimoPedido, ahora]);

  const recargar = useCallback(() => {
    desde.current = null;
    return queryClient.invalidateQueries({ queryKey: claveHuella(autorId) });
  }, [queryClient, autorId]);

  const actualizar = useCallback(async () => {
    const t = Date.now();
    ULTIMO_PEDIDO.set(autorId, t);
    setUltimoPedido(t);
    setAhora(t);
    try {
      return await actualizarHuella(autorId);
    } finally {
      await recargar();
    }
  }, [autorId, recargar]);

  /** Aceptar o descartar una lectura. Un 409 (versión superada) recarga la huella. */
  const corregir = useCallback(
    async ({ clave, decision, comentario }) => {
      const invalido = validarCorreccion({ decision, comentario });
      if (invalido) throw Object.assign(new Error(invalido), { status: 400, message: invalido });
      try {
        return await corregirLectura(autorId, { huella_id: vigenteId, clave, decision, comentario: String(comentario || '').trim() });
      } finally {
        await recargar();
      }
    },
    [autorId, vigenteId, recargar]
  );

  return { consulta, respuesta: consulta.data, ultimoPedido, ahora, actualizar, corregir, recargar };
}

/**
 * Las evidencias de una lectura, de a 25. La clave lleva el id de la huella:
 * una versión nueva empieza de cero. Un 409 recarga la huella.
 */
export function useEvidencias(autorId, clave, huellaId) {
  const queryClient = useQueryClient();
  return useInfiniteQuery({
    queryKey: [...claveEvidencias(autorId), clave, huellaId],
    enabled: !!autorId && !!clave && !!huellaId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      try {
        return await evidenciasDe(autorId, clave, { offset: pageParam, limit: 25 });
      } catch (e) {
        if (e?.status === 409) queryClient.invalidateQueries({ queryKey: claveHuella(autorId) });
        throw e;
      }
    },
    getNextPageParam: (ultima) => {
      const siguiente = (ultima?.offset || 0) + (ultima?.evidencias?.length || 0);
      return ultima?.evidencias?.length && siguiente < (ultima?.total || 0) ? siguiente : undefined;
    },
    retry: false,
    staleTime: 1000 * 60,
  });
}
