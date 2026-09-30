import { useCallback, useEffect, useRef } from 'react';
import { createStore } from 'zustand/vanilla';
import { supabase } from '../../../utils/supabase';
import { renglonesPorBloque } from '../../../documento';
import { aDocumento, conTexto, textoDe } from '../../../documento/editor';
import { armarPedido, tramosDeBloque } from './rastreo';

const ESPERA_MS = 700;
// Respuestas guardadas por hash. Una nota larga tiene unos cientos de bloques
// con nombres; con esto entran varias notas y sus versiones recientes.
const TOPE_CACHE = 3000;

/**
 * Lo que la base dijo de cada bloque. Un store aparte del editor: cambia
 * cuando llega una respuesta, no cuando se escribe, y los bloques se
 * suscriben solo a lo suyo.
 *
 *   filas        hash → filas de `codex_resolver_bloques` para ese bloque
 *   hashPorKey   key → hash del último ciclo (qué respuesta le toca)
 *   textoPorKey  key → texto con el que se calculó ese hash: si el bloque ya
 *                cambió, la respuesta no es suya y se usa lo que se recordaba
 *   guardadas    `item|firma` → veredicto ya decidido sobre esta nota
 *   fallo        la base no contestó: se pinta todo lo reconocido
 */
export function crearRastreo() {
  return createStore(() => ({
    filas: new Map(),
    hashPorKey: {},
    textoPorKey: {},
    guardadas: new Map(),
    fallo: false,
  }));
}

async function miId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id || null;
}

/**
 * Corre el rastreo del editor: una pausa después de la última tecla, arma el
 * pedido con los bloques cuyo hash no tiene respuesta, y lo manda en una sola
 * llamada. Solo entran bloques donde la app ya reconoce algún nombre: el
 * resto no tiene nada que decidir.
 *
 * @returns `releer()` — después de decidir una mención, todo se vuelve a
 *   preguntar: una decisión cambia lo que valen las reglas en otros lugares.
 */
export default function useRastreoBloques(editor, rastreo, { activo, indice, notaId }) {
  const indiceRef = useRef(indice);
  indiceRef.current = indice;
  const programar = useRef(() => {});

  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    let reloj = null;
    let enCurso = false;
    let otraVez = false;

    const ciclo = async () => {
      if (enCurso) {
        otraVez = true;
        return;
      }
      enCurso = true;
      try {
        const { estado } = editor.getState();
        const idx = indiceRef.current;
        const conNombres = new Set();
        const textoPorKey = {};
        for (const k of estado.orden) {
          const b = estado.porKey[k];
          if (!conTexto(b)) continue;
          textoPorKey[k] = textoDe(b.children);
          if (idx?.size && tramosDeBloque(b, idx).some((x) => x.item)) conNombres.add(k);
        }

        const renglones = renglonesPorBloque(aDocumento(estado));
        const { hashes, pedido } = armarPedido(renglones, conNombres, rastreo.getState().filas);
        rastreo.setState({ hashPorKey: hashes, textoPorKey });
        if (!pedido.length) return;

        const uid = await miId();
        if (!uid || !vivo) return;
        const { data, error } = await supabase.rpc('codex_resolver_bloques', {
          p_user: uid,
          p_bloques: pedido.map(({ hash, ...p }) => p),
        });
        if (!vivo) return;
        if (error) {
          rastreo.setState({ fallo: true });
          return;
        }

        const porK = new Map();
        for (const f of data || []) {
          if (!porK.has(f.k)) porK.set(f.k, []);
          porK.get(f.k).push(f);
        }
        let filas = new Map(rastreo.getState().filas);
        for (const p of pedido) filas.set(p.hash, porK.get(p.k) || []);
        if (filas.size > TOPE_CACHE) filas = new Map([...filas].slice(-TOPE_CACHE));
        rastreo.setState({ filas, fallo: false });
      } catch {
        if (vivo) rastreo.setState({ fallo: true });
      } finally {
        enCurso = false;
        if (otraVez && vivo) {
          otraVez = false;
          reloj = setTimeout(ciclo, ESPERA_MS);
        }
      }
    };

    programar.current = (ms = ESPERA_MS) => {
      clearTimeout(reloj);
      reloj = setTimeout(ciclo, ms);
    };

    // La primera vez se pregunta ya: una nota que se abre no tiene por qué
    // esperar a que alguien teclee.
    programar.current(0);
    const quitar = editor.subscribe((s, prev) => {
      if (s.version !== prev.version) programar.current(ESPERA_MS);
    });
    return () => {
      vivo = false;
      clearTimeout(reloj);
      quitar();
      programar.current = () => {};
    };
  }, [activo, editor, rastreo]);

  // Si el índice del Codex llega después que el texto, recién ahí hay algo que preguntar.
  useEffect(() => {
    if (activo && indice?.size) programar.current(0);
  }, [activo, indice]);

  // Lo ya decidido sobre esta nota —por la huella o por la persona— vale más
  // que las reglas, que solo miran la frase.
  // Cada pedido lleva número: si se abre otra nota antes de que conteste, la
  // respuesta vieja no pisa a la nueva.
  const pedidoGuardadas = useRef(0);
  const traerGuardadas = useCallback(async () => {
    if (!notaId) {
      rastreo.setState({ guardadas: new Map() });
      return;
    }
    const pedido = ++pedidoGuardadas.current;
    const { data } = await supabase
      .from('codex_menciones_resueltas')
      .select('item_id, firma, veredicto, origen')
      .eq('fuente', 'snippet')
      .eq('ref_id', notaId)
      .in('origen', ['huella', 'usuario']);
    if (pedido !== pedidoGuardadas.current) return;
    rastreo.setState({ guardadas: new Map((data || []).map((g) => [`${g.item_id}|${g.firma}`, g.veredicto])) });
  }, [notaId, rastreo, pedidoGuardadas]);

  useEffect(() => {
    if (activo) traerGuardadas();
  }, [activo, traerGuardadas]);

  const activoRef = useRef(activo);
  activoRef.current = activo;
  return useCallback(() => {
    // Con el editor apagado no hay nada que releer: el rastreo de la nota
    // entera se encarga.
    if (!activoRef.current) return;
    rastreo.setState({ filas: new Map() });
    traerGuardadas();
    programar.current(0);
  }, [rastreo, traerGuardadas]);
}
