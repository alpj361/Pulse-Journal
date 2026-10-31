import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { actualizarHuella, leerHuella, leerIdentidad, revisarVoz, tarjetasDe } from './api';
import { ENFRIAMIENTO_MS, SONDEO_MAX_MS, SONDEO_MS, hayQueSondear, postsDe, validarMotivo } from './logica';

export const claveHuella = (autorId) => ['huella-autor', autorId];
const claveTarjetas = (autorId) => ['huella-tarjetas', autorId];
const claveIdentidad = (autorId) => ['huella-identidad', autorId];

/** Recordado por autor mientras la app sigue abierta: el enfriamiento no se reinicia al cerrar la hoja. */
const ULTIMO_PEDIDO = new Map();
const TOPE_TARJETAS = 500;

/**
 * La huella de un autor: lee el estado, sondea mientras se calcula (cada 4 s,
 * hasta 3 min; se corta al desmontar), trae la cuenta, las tarjetas y las
 * revisiones de identidad, y expone actualizar y revisar una voz.
 *
 * Las tarjetas van atadas a `base_id`: una revisión nueva empieza de cero y
 * nunca se muestra como vigente algo superado.
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
      if (!hayQueSondear(q.state.data)) {
        desde.current = null;
        return false;
      }
      if (!desde.current) desde.current = Date.now();
      return Date.now() - desde.current < SONDEO_MAX_MS ? SONDEO_MS : false;
    },
  });
  const baseId = consulta.data?.base_id || null;

  // La cuenta: el GET con huella solo trae `autor_id`; la tabla es de la persona (RLS).
  const cuenta = useQuery({
    queryKey: ['huella-cuenta', autorId],
    enabled: !!autorId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase.from('autores').select('id, nombre, usuario, plataforma, usuario_confirmado').eq('id', autorId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const tarjetas = useQuery({
    queryKey: [...claveTarjetas(autorId), baseId],
    enabled: !!autorId && !!baseId,
    staleTime: 1000 * 60,
    retry: false,
    queryFn: async () => {
      const todas = [];
      for (let offset = 0; offset < TOPE_TARJETAS; offset += 100) {
        const r = await tarjetasDe(autorId, { offset, limit: 100 });
        if (r.base_id && r.base_id !== baseId) {
          queryClient.invalidateQueries({ queryKey: claveHuella(autorId) });
          break;
        }
        const pagina = r.impresiones?.tarjetas || [];
        todas.push(...pagina);
        if (pagina.length < 100 || todas.length >= (r.impresiones?.total_filtrado || 0)) break;
      }
      return todas;
    },
  });

  // Los títulos de las publicaciones que citan las tarjetas, de una sola vez.
  const ids = postsDe(tarjetas.data);
  const posts = useQuery({
    queryKey: ['huella-posts', autorId, ids.join(',')],
    enabled: ids.length > 0,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase.from('codex_universe_items').select('id, name').in('id', ids);
      if (error) throw error;
      return Object.fromEntries((data || []).map((p) => [p.id, p.name]));
    },
  });

  const identidad = useQuery({
    queryKey: claveIdentidad(autorId),
    enabled: !!autorId && !!baseId,
    staleTime: 1000 * 60,
    retry: false,
    queryFn: () => leerIdentidad(autorId),
  });

  // Sin base vigente se descartan las tarjetas guardadas de la revisión anterior.
  useEffect(() => {
    if (consulta.data && !baseId) queryClient.removeQueries({ queryKey: claveTarjetas(autorId) });
  }, [consulta.data, baseId, autorId, queryClient]);

  // El contador del enfriamiento, solo mientras corre.
  useEffect(() => {
    if (!ultimoPedido || Date.now() - ultimoPedido >= ENFRIAMIENTO_MS) return undefined;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ultimoPedido, ahora]);

  const recargar = useCallback(() => {
    desde.current = null;
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: claveHuella(autorId) }),
      queryClient.invalidateQueries({ queryKey: claveIdentidad(autorId) }),
    ]);
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

  /** Dice quién habla en una voz (o quita lo dicho). Encola una revisión nueva. */
  const revisar = useCallback(
    async (operacion, datos) => {
      const invalido = validarMotivo(datos?.motivo);
      if (invalido) throw Object.assign(new Error(invalido), { status: 400, message: invalido });
      try {
        return await revisarVoz(autorId, operacion, { ...datos, motivo: String(datos.motivo).trim() });
      } finally {
        await recargar();
      }
    },
    [autorId, recargar]
  );

  return {
    consulta,
    respuesta: consulta.data,
    cuenta: cuenta.data || null,
    tarjetas,
    titulos: posts.data || {},
    identidad: identidad.data || null,
    ultimoPedido,
    ahora,
    actualizar,
    revisar,
    recargar,
  };
}
