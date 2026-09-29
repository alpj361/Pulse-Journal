/**
 * Los bloques que no son texto corrido: código, fórmula, dibujo, tabla,
 * separador y medios (foto, audio, documento) en medio del texto.
 *
 * Mismas reglas que `operaciones.js`: puras, `{ estado, foco }`, el mismo
 * estado si no cambió nada.
 */

import { nuevaClave } from '../esquema.js';
import { conTexto } from './estado.js';
import { textoDe } from './spans.js';

/** Un bloque especial vacío, listo para llenar. */
export function bloqueEspecial(tipo, clave = nuevaClave, datos = {}) {
  const _key = clave();
  switch (tipo) {
    case 'codigo':
      return { _type: 'codigo', _key, lenguaje: '', texto: '', ...datos };
    case 'formula':
      return { _type: 'formula', _key, latex: '', ...datos };
    case 'dibujo':
      return { _type: 'dibujo', _key, ancho: 1, alto: 0.6, trazos: [], ...datos };
    case 'tabla':
      return { _type: 'tabla', _key, encabezado: true, filas: [['', ''], ['', '']], ...datos };
    case 'separador':
      return { _type: 'separador', _key, estilo: 'fina', ...datos };
    case 'medio':
      return { _type: 'medio', _key, tipo: 'foto', ...datos };
    case 'datasheet':
      // Sin `dataset_id` todavía: el bloque pregunta cuál conectar.
      return { _type: 'datasheet', _key, dataset_id: null, vista: 'tabla', ...datos };
    default:
      return null;
  }
}

/**
 * Meter un bloque después de `despuesDe`. Si ese es un renglón vacío, el
 * bloque ocupa su lugar: tocar «tabla» en un renglón en blanco no tiene por
 * qué dejar el renglón en blanco arriba.
 */
export function insertarBloque(estado, despuesDe, bloque) {
  if (!bloque) return { estado };
  const actual = estado.porKey[despuesDe];
  const vacio = actual && conTexto(actual) && actual._type === 'block' && !actual.listItem && !textoDe(actual.children).trim();
  const i = despuesDe ? estado.orden.indexOf(despuesDe) : estado.orden.length - 1;
  const orden = [...estado.orden];
  const porKey = { ...estado.porKey, [bloque._key]: bloque };
  const padre = { ...estado.padre, [bloque._key]: despuesDe ? estado.padre[despuesDe] ?? null : null };
  // Un renglón vacío que es el último de la página se deja: es donde se sigue
  // escribiendo después del bloque.
  const ultimo = i === orden.length - 1;
  if (vacio && !ultimo) {
    orden.splice(i, 1, bloque._key);
    delete porKey[despuesDe];
    delete padre[despuesDe];
  } else if (vacio && ultimo) {
    orden.splice(i, 0, bloque._key);
  } else {
    orden.splice(i + 1, 0, bloque._key);
  }
  return { estado: { ...estado, orden, porKey, padre, pendiente: null }, foco: { key: bloque._key, especial: true } };
}

/** Cambiar datos de un bloque especial (el texto del código, el LaTeX, los trazos…). */
export function editarBloque(estado, key, cambios) {
  const b = estado.porKey[key];
  if (!b || conTexto(b)) return { estado };
  if (Object.entries(cambios).every(([k, v]) => b[k] === v)) return { estado };
  return { estado: { ...estado, porKey: { ...estado.porKey, [key]: { ...b, ...cambios } } } };
}

/**
 * Cambiar un bloque especial por otro en el mismo lugar y con la misma
 * clave: la tabla simple que pasa a ser un datasheet sigue siendo «ese»
 * bloque para la fusión y para deshacer.
 */
export function reemplazarEspecial(estado, key, nuevo) {
  const b = estado.porKey[key];
  if (!b || conTexto(b) || !nuevo) return { estado };
  return { estado: { ...estado, porKey: { ...estado.porKey, [key]: { ...nuevo, _key: key } } } };
}

// ── Tabla ───────────────────────────────────────────────────────────────────

const conFilas = (estado, key, fn) => {
  const b = estado.porKey[key];
  if (b?._type !== 'tabla') return { estado };
  const filas = fn((b.filas || []).map((f) => [...f]));
  if (!filas) return { estado };
  return editarBloque(estado, key, { filas });
};

const columnas = (filas) => Math.max(1, ...filas.map((f) => f.length));

export const editarCelda = (estado, key, f, c, texto) =>
  conFilas(estado, key, (filas) => {
    if (!filas[f] || (filas[f][c] ?? '') === texto) return null;
    filas[f][c] = texto;
    return filas;
  });

export const agregarFila = (estado, key) => conFilas(estado, key, (filas) => [...filas, Array(columnas(filas)).fill('')]);

export const agregarColumna = (estado, key) => conFilas(estado, key, (filas) => filas.map((f) => [...f, '']));

export const quitarFila = (estado, key, f) =>
  conFilas(estado, key, (filas) => (filas.length <= 1 ? null : filas.filter((_, i) => i !== f)));

export const quitarColumna = (estado, key, c) =>
  conFilas(estado, key, (filas) => (columnas(filas) <= 1 ? null : filas.map((fila) => fila.filter((_, i) => i !== c))));

// ── Medios ──────────────────────────────────────────────────────────────────

/**
 * Un medio se mete en el texto apenas se adjunta, antes de terminar de
 * subir: se lo reconoce por `ref` —el id de la subida— hasta que tiene su
 * ruta en el almacenamiento.
 */
const esEse = (b, ref) => b?._type === 'medio' && (b.ref === ref || (b.storage_path && b.storage_path === ref));

export function actualizarMedio(estado, ref, datos) {
  const k = estado.orden.find((x) => esEse(estado.porKey[x], ref));
  if (!k) return { estado };
  const junto = { ...estado.porKey[k], ...datos };
  // Con la ruta puesta, la referencia provisoria sobra.
  if (junto.storage_path) delete junto.ref;
  return { estado: { ...estado, porKey: { ...estado.porKey, [k]: junto } } };
}

export function quitarMedio(estado, ref) {
  const k = estado.orden.find((x) => esEse(estado.porKey[x], ref));
  if (!k) return { estado };
  const porKey = { ...estado.porKey };
  const padre = { ...estado.padre };
  delete porKey[k];
  delete padre[k];
  return { estado: { ...estado, orden: estado.orden.filter((x) => x !== k), porKey, padre } };
}

/** Las rutas de los medios que están en el texto, en cualquier página. */
export function mediosEnElTexto(doc) {
  const rutas = new Set();
  const recorrer = (bloques) => {
    for (const b of bloques || []) {
      if (b._type === 'medio') {
        if (b.storage_path) rutas.add(b.storage_path);
        if (b.ref) rutas.add(b.ref);
      }
      if (b._type === 'toggle') recorrer(b.bloques);
    }
  };
  for (const p of doc?.paginas || []) recorrer(p.bloques);
  return rutas;
}

/**
 * Lo mismo que `mediosEnElTexto`, pero sobre el estado del editor y como una
 * cadena: la hoja se suscribe a esto para saber qué adjuntos ya se ven en el
 * texto, y una cadena igual no la vuelve a pintar.
 */
export function firmaDeMedios(estado) {
  const salida = [];
  for (const k of estado.orden) {
    const b = estado.porKey[k];
    if (b?._type !== 'medio') continue;
    if (b.storage_path) salida.push(b.storage_path);
    if (b.ref) salida.push(b.ref);
  }
  // Las otras páginas están en `resto`; la abierta, en `porKey`.
  const otras = { ...estado.resto, paginas: (estado.resto?.paginas || []).filter((p) => p._key !== estado.pagina) };
  for (const r of mediosEnElTexto(otras)) salida.push(r);
  return salida.sort().join('\n');
}
