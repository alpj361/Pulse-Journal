import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabase';

/**
 * Lo que cambia en la base, visto al momento.
 *
 * Un solo canal para toda la app. Cada pantalla que muestra una lista se
 * anota a las tablas que le importan; cuando una fila cambia —acá, en otro
 * teléfono, o porque el servidor terminó de traer un post— la lista se entera
 * sin que haya que cerrar y volver a abrir.
 *
 * Del evento se usa solo **qué fila cambió**, no su contenido. Postgres no
 * manda las columnas largas que no se tocaron (`details`, el texto de una
 * nota), así que copiar el evento a la lista borraría justo eso. La fila se
 * vuelve a pedir, con las columnas que esa lista usa.
 *
 * Sin filtro por usuario a propósito: el filtro no aplica a los borrados, y lo
 * que cada quien puede ver ya lo decide la base.
 */

// Tienen que estar en la publicación `supabase_realtime` de la base; una tabla
// que no está no falla, simplemente nunca avisa.
const TABLAS = [
  'codex_universe_items',
  'codex_items',
  'codex_relations',
  'wiki_items',
  'spaces',
  'workspace_resources',
  'post_folders',
  'nota_documentos',
];

const oyentes = new Set(); // { tablas: Set, fn }
const alReconectar = new Set();
let canal = null;
let yaConecto = false;

function repartir(tabla, payload) {
  const ev = {
    tabla,
    tipo: payload.eventType,
    id: payload.new?.id ?? payload.old?.id ?? null,
  };
  for (const o of oyentes) {
    if (o.tablas.has(tabla)) o.fn(ev);
  }
}

function abrir() {
  if (canal) return;
  let c = supabase.channel('vizta-en-vivo');
  for (const tabla of TABLAS) {
    c = c.on('postgres_changes', { event: '*', schema: 'public', table: tabla }, (p) => repartir(tabla, p));
  }
  canal = c.subscribe((estado) => {
    if (estado !== 'SUBSCRIBED') return;
    // La primera vez no hay nada que recuperar. Las siguientes son una
    // reconexión: lo que pasó con el canal caído no va a llegar nunca.
    if (yaConecto) for (const fn of alReconectar) fn();
    yaConecto = true;
  });
}

function cerrarSiNadie() {
  if (!canal || oyentes.size || alReconectar.size) return;
  supabase.removeChannel(canal);
  canal = null;
  yaConecto = false;
}

/** Anota una función a los cambios de unas tablas. Devuelve cómo quitarla. */
export function escuchar(tablas, fn) {
  const o = { tablas: new Set(tablas), fn };
  oyentes.add(o);
  abrir();
  return () => {
    oyentes.delete(o);
    cerrarSiNadie();
  };
}

/**
 * «Algo cambió en estas tablas»: para listas cortas que se vuelven a pedir
 * enteras (carpetas, espacios).
 *
 * Los cambios seguidos se juntan en un solo aviso. También avisa al volver a la
 * app y al reconectar, que es cuando pudo haberse perdido algo.
 */
export function useEnVivo(tablas, alCambiar, { espera = 400, activo = true } = {}) {
  const fn = useRef(alCambiar);
  fn.current = alCambiar;
  const clave = tablas.join(',');

  useEffect(() => {
    if (!activo) return undefined;
    let reloj = null;
    const avisar = () => {
      clearTimeout(reloj);
      reloj = setTimeout(() => fn.current?.(), espera);
    };
    const soltar = escuchar(clave.split(','), avisar);
    alReconectar.add(avisar);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') avisar();
    });
    return () => {
      clearTimeout(reloj);
      soltar();
      alReconectar.delete(avisar);
      sub.remove();
      cerrarSiNadie();
    };
  }, [clave, espera, activo]);
}

/**
 * Las filas que cambiaron, ya leídas, para listas largas que no conviene pedir
 * enteras cada vez (las notas, los posts, el Codex).
 *
 * `alCambiar({ id, fila })` llega una vez por fila: `fila` es la fila fresca con
 * `campos`, o `null` si se borró o dejó de verse. `alVolver` avisa cuando hay
 * que recargar todo: al volver a la app y al reconectar.
 */
export function useFilasEnVivo(tabla, campos, alCambiar, alVolver, { espera = 250, activo = true } = {}) {
  const fn = useRef(alCambiar);
  fn.current = alCambiar;
  const volver = useRef(alVolver);
  volver.current = alVolver;

  useEffect(() => {
    if (!activo) return undefined;
    let vivo = true;
    let reloj = null;
    const pendientes = new Map(); // id → borrada

    const despachar = async () => {
      const lote = new Map(pendientes);
      pendientes.clear();
      const pedir = [...lote].filter(([, borrada]) => !borrada).map(([id]) => id);
      const frescas = new Map();
      if (pedir.length) {
        const { data, error } = await supabase.from(tabla).select(campos).in('id', pedir);
        // Si la lectura falla no se toca nada: sacar la fila de la lista por un
        // corte de red la haría desaparecer estando intacta.
        if (error || !vivo) return;
        for (const f of data || []) frescas.set(f.id, f);
      }
      if (!vivo) return;
      for (const [id] of lote) fn.current?.({ id, fila: frescas.get(id) || null });
    };

    const soltar = escuchar([tabla], (ev) => {
      if (!ev.id) return;
      pendientes.set(ev.id, ev.tipo === 'DELETE');
      clearTimeout(reloj);
      reloj = setTimeout(despachar, espera);
    });

    const recargar = () => volver.current?.();
    alReconectar.add(recargar);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') recargar();
    });

    return () => {
      vivo = false;
      clearTimeout(reloj);
      soltar();
      alReconectar.delete(recargar);
      sub.remove();
      cerrarSiNadie();
    };
  }, [tabla, campos, espera, activo]);
}

/**
 * Pone una fila fresca en una lista ordenada por fecha, la más nueva arriba.
 *
 * `fila` nula, o una que `acepta` rechaza (se movió de tipo, ya no es de esta
 * lista), sale. Una que ya estaba se reemplaza en su lugar; una nueva entra
 * donde le toca por fecha.
 */
export function ponerFila(lista, id, fila, acepta = () => true) {
  const actual = lista || [];
  const esta = actual.some((x) => x.id === id);
  if (!fila || !acepta(fila)) return esta ? actual.filter((x) => x.id !== id) : actual;
  if (esta) return actual.map((x) => (x.id === id ? { ...x, ...fila } : x));
  const t = new Date(fila.created_at || 0).getTime();
  const i = actual.findIndex((x) => new Date(x.created_at || 0).getTime() < t);
  return i === -1 ? [...actual, fila] : [...actual.slice(0, i), fila, ...actual.slice(i)];
}
