import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { aMarkdown, desdeMarkdown, esDocumento, validar } from '../../../documento';
import { conTexto, textoDe } from '../../../documento/editor';
import { crearEditor } from './store';
import useRastreoBloques, { crearRastreo } from './useRastreoBloques';
import usePersistencia, { leerBorrador } from './persistencia';
import { anotar, lugaresDe, memoriaNueva, tramosDeBloque } from './rastreo';

const EMITIR_MS = 300;
const LEJOS = Number.MAX_SAFE_INTEGER;

/**
 * El editor de bloques, enchufado a la hoja de la nota.
 *
 * La hoja sigue hablando en `cuerpo` —el markdown—, porque de ahí salen el
 * título, el índice de la historia, el modo Vizta y el guardado. El editor
 * lo mantiene al día sin que la hoja entera se vuelva a pintar en cada
 * tecla: lo manda con una pausa corta. Y en la otra dirección, si `cuerpo`
 * cambia por algo que no fue el editor —se abrió otra nota, la conversación
 * con Vizta se plegó a la nota, se empezó una nueva—, el editor se recarga
 * desde ahí.
 *
 * Al cargar se prefiere, en este orden:
 *  1. el borrador local, si es de esta misma versión de la nota y tiene
 *     cambios que no llegaron a la base;
 *  2. `details.documento`, si coincide con `description` (si no coincide,
 *     alguien editó el texto en otro lado y el documento quedó viejo);
 *  3. `description` leída como markdown.
 */
export default function useEditorDeNota({ activo, cuerpo, setCuerpo, notaId, indice, onErrorGuardado }) {
  const editor = useMemo(() => crearEditor(), []);
  const rastreo = useMemo(() => crearRastreo(), []);

  const emitido = useRef(null);
  const documentoAlAbrir = useRef(null);
  const base = useRef('');
  const cargada = useRef(-1);
  const reloj = useRef(null);
  // De qué nota es lo que está en el editor. Lo fija la carga —con el id de
  // la nota que se abre, antes de que la hoja lo tenga— y lo actualiza el
  // primer «guardar» de una nota nueva.
  const idActual = useRef(notaId);
  useEffect(() => {
    idActual.current = notaId;
  }, [notaId]);

  const persistencia = usePersistencia(editor, { activo, idRef: idActual, base, cargada, onError: onErrorGuardado });
  const releer = useRastreoBloques(editor, rastreo, { activo, indice, notaId });

  // ── Afuera → editor ──
  useEffect(() => {
    if (!activo) {
      // Al volver, lo que haya en `cuerpo` se vuelve a leer. Y una nota
      // abierta mientras tanto ya no es la que se está abriendo.
      emitido.current = null;
      documentoAlAbrir.current = null;
      return;
    }
    if (cuerpo === emitido.current) return;

    // Lo que quedó pendiente de la nota anterior va a la base **antes** de
    // cargar la nueva: el guardado lee el editor al dispararse, y después de
    // cargar leería el texto de la otra nota.
    persistencia.volcar();

    const md = String(cuerpo || '');
    const plano = md.trim();
    let doc = null;

    // La nota que se está abriendo, si se está abriendo una. Se toma de acá y
    // no de `notaId`: la hoja cambia el cuerpo antes que el id.
    const abriendo = documentoAlAbrir.current;
    documentoAlAbrir.current = null;
    const id = abriendo ? abriendo.id : notaId;
    const guardado = abriendo?.documento;
    if (esDocumento(guardado) && validar(guardado).ok && aMarkdown(guardado).trim() === plano) doc = guardado;

    let restaurado = false;
    const borrador = leerBorrador(id);
    if (borrador && (borrador.base ?? '') === plano && aMarkdown(borrador.doc).trim() !== plano) {
      doc = borrador.doc;
      restaurado = true;
    }

    if (!doc) doc = desdeMarkdown(md);
    idActual.current = id;
    base.current = plano;
    persistencia.cargado(doc, { yaEnLaBase: !restaurado && !!id });
    editor.getState().cargar(doc);
    cargada.current = editor.getState().version;

    // Lo restaurado es texto que la hoja todavía no conoce.
    const final = restaurado ? aMarkdown(doc) : md;
    emitido.current = final;
    if (restaurado) setCuerpo(final);
    // `notaId` no va en las dependencias: guardar una nota nueva le da id sin
    // que cambie el texto, y eso no es una carga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, cuerpo]);

  // ── Editor → afuera ──
  const pendiente = useRef(false);
  const emitir = useCallback(() => {
    clearTimeout(reloj.current);
    pendiente.current = false;
    const doc = editor.getState().documento();
    const md = aMarkdown(doc);
    if (md !== emitido.current) {
      emitido.current = md;
      setCuerpo(md);
    }
    return { md, doc };
  }, [editor, setCuerpo]);

  useEffect(() => {
    if (!activo) return undefined;
    const quitar = editor.subscribe((s, prev) => {
      if (s.version === prev.version || s.version === cargada.current) return;
      clearTimeout(reloj.current);
      pendiente.current = true;
      reloj.current = setTimeout(emitir, EMITIR_MS);
    });
    return () => {
      quitar();
      // Si se deja el editor —se entra al modo Vizta— con letras que la hoja
      // todavía no tiene, se le mandan ahora: la pregunta arranca de ahí.
      if (pendiente.current) emitir();
      clearTimeout(reloj.current);
    };
  }, [activo, editor, emitir]);

  /**
   * Las menciones de toda la nota, para el panel: quién está nombrado y qué
   * falta confirmar. Se recalculan cuando contesta la base o cuando se deja
   * de escribir, no en cada tecla.
   */
  const [tramos, setTramos] = useState([]);
  const memorias = useRef(new Map());
  const ultimaFirma = useRef('');
  useEffect(() => {
    if (!activo) {
      ultimaFirma.current = '';
      setTramos((t) => (t.length ? [] : t));
      return undefined;
    }
    let reloj2 = null;
    const calcular = () => {
      const { estado } = editor.getState();
      const r = rastreo.getState();
      const salida = [];
      for (const k of estado.orden) {
        const b = estado.porKey[k];
        if (!conTexto(b)) continue;
        const reconocidos = tramosDeBloque(b, indice);
        if (!reconocidos.some((x) => x.item)) continue;
        const t = textoDe(b.children);
        const filas = r.textoPorKey[k] === t ? r.filas.get(r.hashPorKey[k]) : undefined;
        if (!memorias.current.has(k)) memorias.current.set(k, memoriaNueva());
        const { tramos: anotados } = anotar(reconocidos, filas ? lugaresDe(filas, r.guardadas) : null, memorias.current.get(k), {
          fallo: r.fallo,
          porId: indice?.porId,
          ahora: LEJOS,
        });
        let desde = 0;
        for (const x of anotados) {
          if (x.item) {
            salida.push({ ...x, contexto: t.slice(Math.max(0, desde - 140), desde + x.texto.length + 140) });
          }
          desde += x.texto.length;
        }
      }
      // Solo si cambió algo: el panel se vuelve a pintar con cada lista nueva.
      const firma = salida.map((x) => `${x.item?.id}|${x.estado}|${x.firma}|${x.texto}`).join('\n');
      if (firma === ultimaFirma.current) return;
      ultimaFirma.current = firma;
      setTramos(salida);
    };
    const programar = () => {
      clearTimeout(reloj2);
      reloj2 = setTimeout(calcular, EMITIR_MS);
    };
    calcular();
    const a = editor.subscribe((s, prev) => s.version !== prev.version && programar());
    const b = rastreo.subscribe(programar);
    return () => {
      clearTimeout(reloj2);
      a();
      b();
    };
  }, [activo, editor, rastreo, indice]);

  /** Antes de guardar a mano: el markdown y el documento de este instante. */
  const volcar = emitir;

  /** Lo que tiene que hacer `abrirNota` antes de cambiar `cuerpo`. */
  const alAbrir = useCallback((nota) => {
    documentoAlAbrir.current = { id: nota?.id || null, documento: nota?.details?.documento || null };
  }, []);

  return {
    editor,
    rastreo,
    releer,
    tramos,
    volcar,
    alAbrir,
    guardarYa: persistencia.volcar,
    esperarGuardado: persistencia.esperar,
    marcarGuardado: persistencia.marcarGuardado,
  };
}
