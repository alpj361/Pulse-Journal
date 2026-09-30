import { createStore } from 'zustand/vanilla';
import { supabase } from '../../../utils/supabase';

/**
 * Los datasets que se ven en las notas.
 *
 * Un solo almacén para toda la app, no uno por hoja: el mismo dataset puede
 * estar en dos notas, o en un bloque y en la historia a la vez, y lo que se
 * cambia en uno tiene que verse en el otro sin volver a pedirlo.
 *
 * Escribir es optimista: la celda cambia en pantalla al soltarla y la base
 * se entera después (RPC `datasheet_*`). Si la base dice que no, se vuelve a
 * leer el dataset entero: es la única manera honesta de saber qué quedó.
 *
 * Cada entrada: `{ cargando, error, datos }`, con `datos` como lo devuelve
 * `datasheet_leer`: `{ id, nombre, propio, columnas, tipos, total, filas:
 * [{ id, pos, valores, revision }] }`.
 */
export const datasheets = createStore((set, get) => {
  const poner = (id, cambios) =>
    set((s) => ({ porId: { ...s.porId, [id]: { ...s.porId[id], ...cambios } } }));
  const conDatos = (id, fn) => {
    const e = get().porId[id];
    if (e?.datos) poner(id, { datos: fn(e.datos) });
  };
  const enVuelo = new Map();
  // Cuántas veces se escribió en cada dataset desde acá: la hoja lo mira
  // para rearmar la historia cuando la historia es ese dataset.
  const escrito = (id) => set((s) => ({ cambios: { ...s.cambios, [id]: (s.cambios[id] || 0) + 1 } }));

  const cargar = async (id, { forzar = false } = {}) => {
    if (!id) return null;
    const e = get().porId[id];
    if (!forzar && (e?.datos || enVuelo.has(id))) return e?.datos ?? enVuelo.get(id);
    poner(id, { cargando: true, error: null });
    const pedido = (async () => {
      const { data, error } = await supabase.rpc('datasheet_leer', { p_dataset: id });
      if (error) throw error;
      return data;
    })();
    enVuelo.set(id, pedido);
    try {
      const datos = await pedido;
      poner(id, { cargando: false, datos, error: datos ? null : 'No se encontró el dataset.' });
      return datos;
    } catch (err) {
      poner(id, { cargando: false, error: 'No se pudo leer el dataset.' });
      return null;
    } finally {
      enVuelo.delete(id);
    }
  };

  /** Si algo falló al escribir: lo que diga la base. */
  const releer = (id) => cargar(id, { forzar: true });

  return {
    porId: {},
    cambios: {},
    cargar,
    releer,

    async celda(id, filaId, columna, valor) {
      const antes = get().porId[id]?.datos?.filas?.find((f) => f.id === filaId);
      if (!antes || textoDeCelda(antes.valores?.[columna]) === valor) return;
      conDatos(id, (d) => ({
        ...d,
        filas: d.filas.map((f) => (f.id === filaId ? { ...f, valores: { ...f.valores, [columna]: valor } } : f)),
      }));
      const { data, error } = await supabase.rpc('datasheet_celda', {
        p_dataset: id,
        p_fila: filaId,
        p_columna: columna,
        p_valor: valor,
      });
      if (error || !data?.ok) {
        releer(id);
        throw error || new Error('No se pudo guardar la celda.');
      }
      escrito(id);
      // La base puede haberlo guardado como número.
      conDatos(id, (d) => ({
        ...d,
        filas: d.filas.map((f) =>
          f.id === filaId ? { ...f, revision: data.revision, valores: { ...f.valores, [columna]: data.valor } } : f,
        ),
      }));
    },

    async filaNueva(id) {
      const { data, error } = await supabase.rpc('datasheet_fila_nueva', { p_dataset: id });
      if (error || !data?.id) {
        releer(id);
        throw error || new Error('No se pudo agregar la fila.');
      }
      conDatos(id, (d) => ({ ...d, total: (d.total || 0) + 1, filas: [...d.filas, data] }));
      escrito(id);
      return data;
    },

    async quitarFila(id, filaId) {
      conDatos(id, (d) => ({ ...d, total: Math.max(0, (d.total || 0) - 1), filas: d.filas.filter((f) => f.id !== filaId) }));
      const { error } = await supabase.rpc('datasheet_fila_quitar', { p_dataset: id, p_fila: filaId });
      // En los datasets de siempre, quitar corre las de abajo: se relee igual.
      releer(id);
      if (error) throw error;
      escrito(id);
    },

    async columnaNueva(id, nombre) {
      const limpio = String(nombre || '').trim();
      if (!limpio) return;
      const { data, error } = await supabase.rpc('datasheet_columna_nueva', { p_dataset: id, p_nombre: limpio });
      if (error) {
        releer(id);
        throw error;
      }
      if (data?.ok === false && data.motivo === 'existe') throw new Error('Ya hay una columna con ese nombre.');
      if (data?.columnas) conDatos(id, (d) => ({ ...d, columnas: data.columnas }));
      escrito(id);
    },
  };
});

/** Los datasets que se pueden conectar: los propios primero. */
export async function listarDatasets() {
  const { data, error } = await supabase.rpc('datasheet_listar');
  if (error) throw error;
  return data || [];
}

/**
 * Un dataset nuevo a partir de una tabla: la primera fila son las columnas
 * si la tabla tiene encabezado. Las columnas sin nombre o repetidas se
 * nombran solas —un dataset no puede tener dos columnas iguales—.
 */
export function columnasYFilas(filas, { encabezado = true } = {}) {
  const ancho = Math.max(1, ...filas.map((f) => f.length));
  const cabeza = encabezado && filas.length ? filas[0] : [];
  const vistas = new Set();
  const columnas = Array.from({ length: ancho }, (_, c) => {
    let nombre = String(cabeza[c] ?? '').trim() || `Columna ${c + 1}`;
    for (let n = 2; vistas.has(nombre.toLowerCase()); n++) nombre = `${String(cabeza[c] ?? '').trim() || 'Columna'} ${n}`;
    vistas.add(nombre.toLowerCase());
    return nombre;
  });
  const cuerpo = (encabezado ? filas.slice(1) : filas)
    .map((f) => Array.from({ length: ancho }, (_, c) => String(f[c] ?? '')))
    // Las filas enteramente vacías no son datos.
    .filter((f) => f.some((x) => x.trim()));
  return { columnas, filas: cuerpo };
}

export async function datasetDesdeTabla(nombre, filas, opciones) {
  const { columnas, filas: cuerpo } = columnasYFilas(filas, opciones);
  const { data, error } = await supabase.rpc('datasheet_desde_tabla', {
    p_nombre: String(nombre || '').trim() || 'Tabla sin título',
    p_columnas: columnas,
    p_filas: cuerpo,
  });
  if (error || !data) throw error || new Error('No se pudo crear el dataset.');
  return data;
}

/** Un valor de celda como texto, sea número, booleano o nada. */
export const textoDeCelda = (v) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
