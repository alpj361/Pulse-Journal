/**
 * Páginas y bloques enteros: lo que no es escribir adentro de un bloque.
 *
 * - **Páginas.** Una nota larga se parte en capítulos: un bloque «página» en
 *   la nota abre una subpágina con sus propios bloques. El editor muestra una
 *   página a la vez (`estado.pagina`); abrir otra es volver a aplanar el
 *   documento desde esa página.
 * - **Selección de bloques.** React Native no deja seleccionar texto de un
 *   campo a otro, así que para mover, copiar o borrar varios renglones se
 *   seleccionan bloques enteros, como en Craft.
 *
 * Mismas reglas que `operaciones.js`: funciones puras que devuelven
 * `{ estado, foco }` y el mismo estado si no cambió nada.
 */

import { nuevaClave } from '../esquema.js';
import { aMarkdown } from '../aMarkdown.js';
import { aDocumento, ancestros, conTexto, desdeDocumento, raizDe, visible } from './estado.js';
import { normalizar, textoDe } from './spans.js';

// ── Páginas ─────────────────────────────────────────────────────────────────

/** La página que tiene el bloque que abre a `key`, o null si es la raíz. */
export function paginaMadre(doc, key) {
  const contiene = (bloques) =>
    (bloques || []).some((b) => (b._type === 'pagina' && b.pagina === key) || (b._type === 'toggle' && contiene(b.bloques)));
  return doc.paginas.find((p) => p._key !== key && contiene(p.bloques)) || null;
}

/** El bloque que abre a la página `key` adentro de su madre. */
function bloqueQueAbre(pagina, key) {
  const buscar = (bloques) => {
    for (const b of bloques || []) {
      if (b._type === 'pagina' && b.pagina === key) return b._key;
      if (b._type === 'toggle') {
        const r = buscar(b.bloques);
        if (r) return r;
      }
    }
    return null;
  };
  return buscar(pagina?.bloques);
}

/** Mostrar otra página. El cursor va al principio de su primer renglón. */
export function abrirPagina(estado, key) {
  const doc = aDocumento(estado);
  if (!doc.paginas.some((p) => p._key === key) || key === estado.pagina) return { estado };
  const siguiente = desdeDocumento(doc, key);
  return { estado: { ...siguiente, pendiente: null } };
}

/** Volver a la página de arriba, con el cursor en el bloque que abre la que se deja. */
export function volver(estado) {
  const doc = aDocumento(estado);
  if (estado.pagina === raizDe(doc)) return { estado };
  const madre = paginaMadre(doc, estado.pagina) || doc.paginas[0];
  const siguiente = desdeDocumento(doc, madre._key);
  const k = bloqueQueAbre(madre, estado.pagina);
  return { estado: { ...siguiente, pendiente: null }, foco: k ? { key: k, pos: 0, bloque: true } : null };
}

/**
 * Una página nueva, abierta, lista para ponerle título. El bloque que la
 * abre va después de `despuesDe` —o toma su lugar, si es un renglón vacío—.
 */
export function nuevaPagina(estado, despuesDe, { clave = nuevaClave } = {}) {
  const paginaKey = clave();
  const vacio = { _type: 'block', _key: clave(), style: 'normal', children: normalizar([], clave), markDefs: [] };
  const bloque = { _type: 'pagina', _key: clave(), pagina: paginaKey };

  const actual = estado.porKey[despuesDe];
  const reemplaza = actual && conTexto(actual) && actual._type === 'block' && !actual.listItem && !textoDe(actual.children);
  const i = despuesDe ? estado.orden.indexOf(despuesDe) : estado.orden.length - 1;
  const orden = [...estado.orden];
  const porKey = { ...estado.porKey, [bloque._key]: bloque };
  const padre = { ...estado.padre, [bloque._key]: despuesDe ? estado.padre[despuesDe] ?? null : null };
  if (reemplaza) {
    orden.splice(i, 1, bloque._key);
    delete porKey[despuesDe];
    delete padre[despuesDe];
  } else {
    orden.splice(i + 1, 0, bloque._key);
  }

  const resto = { ...estado.resto, paginas: [...estado.resto.paginas, { _key: paginaKey, titulo: '', bloques: [vacio] }] };
  const conBloque = { ...estado, orden, porKey, padre, resto };
  const r = abrirPagina(conBloque, paginaKey);
  return { estado: r.estado, foco: { titulo: true, key: vacio._key, pos: 0 } };
}

export function renombrarPagina(estado, key, titulo) {
  const p = estado.resto.paginas.find((x) => x._key === key);
  if (!p || p.titulo === titulo) return { estado };
  return {
    estado: { ...estado, resto: { ...estado.resto, paginas: estado.resto.paginas.map((x) => (x._key === key ? { ...x, titulo } : x)) } },
  };
}

export const tituloDePagina = (estado, key) => estado.resto.paginas.find((p) => p._key === key)?.titulo ?? '';

// ── Bloques enteros ─────────────────────────────────────────────────────────

/** Un bloque con todo lo que cuelga de él. */
function rama(estado, key) {
  return estado.orden.filter((k) => k === key || ancestros(estado, k).includes(key));
}

/** Las claves elegidas más sus ramas, en el orden del documento, sin repetir. */
function conRamas(estado, keys) {
  const todas = new Set();
  for (const k of keys) for (const x of rama(estado, k)) todas.add(x);
  return estado.orden.filter((k) => todas.has(k));
}

/**
 * Mover bloques (con lo que cuelga de ellos) para que queden justo antes de
 * `antesDe`, o al final si es null. Toman el padre del lugar adonde van: si
 * caen entre los hijos de un toggle, pasan a ser sus hijos.
 */
export function moverBloques(estado, keys, antesDe) {
  const movidos = conRamas(estado, keys);
  if (!movidos.length || movidos.includes(antesDe)) return { estado };
  const setMovidos = new Set(movidos);
  const sinEllos = estado.orden.filter((k) => !setMovidos.has(k));
  const i = antesDe ? sinEllos.indexOf(antesDe) : sinEllos.length;
  if (i < 0) return { estado };
  const orden = [...sinEllos.slice(0, i), ...movidos, ...sinEllos.slice(i)];
  if (orden.every((k, j) => k === estado.orden[j])) return { estado };

  const nuevoPadre = antesDe ? estado.padre[antesDe] ?? null : null;
  const padre = { ...estado.padre };
  // Solo los de arriba de cada rama cambian de padre; los hijos siguen con
  // el suyo.
  for (const k of movidos) if (!setMovidos.has(estado.padre[k])) padre[k] = nuevoPadre;
  return { estado: { ...estado, orden, padre, pendiente: null } };
}

/**
 * Subir o bajar la selección un lugar, saltando de a bloques visibles: un
 * toggle plegado se salta entero.
 */
export function moverUnPaso(estado, keys, delta) {
  const movidos = new Set(conRamas(estado, keys));
  const posiciones = estado.orden.flatMap((k, i) => (movidos.has(k) ? [i] : []));
  if (!posiciones.length) return { estado };
  const sirve = (k) => !movidos.has(k) && visible(estado, k);

  if (delta < 0) {
    // Subir: quedar antes del bloque visible de arriba.
    for (let i = posiciones[0] - 1; i >= 0; i--) if (sirve(estado.orden[i])) return moverBloques(estado, keys, estado.orden[i]);
    return { estado };
  }

  // Bajar: saltar el bloque visible de abajo con todo lo que cuelga de él.
  const ultimo = posiciones[posiciones.length - 1];
  const abajo = estado.orden.slice(ultimo + 1).find(sirve);
  if (!abajo) return { estado };
  const fin = estado.orden.indexOf(abajo) + rama(estado, abajo).length;
  const antesDe = estado.orden.slice(fin).find((k) => !movidos.has(k)) ?? null;
  return moverBloques(estado, keys, antesDe);
}

/** Borrar bloques con lo que cuelga de ellos. La página nunca queda sin renglones. */
export function borrarBloques(estado, keys, { clave = nuevaClave } = {}) {
  const fuera = new Set(conRamas(estado, keys));
  if (!fuera.size) return { estado };
  const orden = estado.orden.filter((k) => !fuera.has(k));
  const porKey = { ...estado.porKey };
  const padre = { ...estado.padre };
  for (const k of fuera) {
    delete porKey[k];
    delete padre[k];
  }
  if (!orden.length) {
    const vacio = { _type: 'block', _key: clave(), style: 'normal', children: normalizar([], clave), markDefs: [] };
    orden.push(vacio._key);
    porKey[vacio._key] = vacio;
    padre[vacio._key] = null;
  }
  const i = Math.min(estado.orden.findIndex((k) => fuera.has(k)), orden.length - 1);
  const k = orden[Math.max(0, i)];
  return { estado: { ...estado, orden, porKey, padre, pendiente: null }, foco: null, alLado: k };
}

/**
 * Los bloques como markdown, para copiarlos. Lo que cuelga de ellos va
 * adentro, y una página copiada lleva su contenido.
 */
export function copiarBloques(estado, keys) {
  const elegidos = conRamas(estado, keys);
  if (!elegidos.length) return '';
  const sub = {
    ...estado,
    orden: elegidos,
    // Los de arriba de cada rama pasan a ser raíz del recorte.
    padre: Object.fromEntries(elegidos.map((k) => [k, elegidos.includes(estado.padre[k]) ? estado.padre[k] : null])),
  };
  const doc = aDocumento(sub);
  const pagina = doc.paginas.find((p) => p._key === estado.pagina) || doc.paginas[0];
  return aMarkdown({ ...doc, paginas: [pagina, ...doc.paginas.filter((p) => p !== pagina)] });
}
