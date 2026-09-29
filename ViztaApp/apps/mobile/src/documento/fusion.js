/**
 * Juntar dos versiones de la misma nota sin que una pise a la otra.
 *
 * Pasa cuando la nota se edita en dos lugares —el teléfono y la web, o dos
 * teléfonos— y los dos guardan. «Gana el último» borraría en silencio lo que
 * escribió el otro. Con bloques hay algo mejor: cada bloque tiene su `_key`,
 * así que se puede decidir bloque por bloque, a tres puntas:
 *
 *   base     lo que había cuando se empezó a editar acá
 *   nuestro  lo que hay acá ahora
 *   suyo     lo que hay en la base de datos ahora
 *
 * - Lo que cambió de un solo lado, se toma de ese lado.
 * - Lo que cambió de los dos lados, gana lo nuestro (el bloque entero: no se
 *   mezclan letras de dos versiones de una misma oración).
 * - Lo que el otro borró y acá no se tocó, se borra; si acá se tocó, queda.
 * - Lo que el otro agregó entra después del bloque que tenía arriba.
 *
 * Un toggle cuenta como un bloque, con sus hijos adentro. CRDT (Yjs) recién
 * haría falta para escribir los dos en el mismo renglón a la vez.
 */

import { desdeMarkdown } from './desdeMarkdown.js';

/** El contenido de un bloque, sin claves: para saber si cambió. */
export function contenidoDe(b) {
  return JSON.stringify(b, (k, v) => (k === '_key' ? undefined : v));
}

const igual = (a, b) => a === b || (!!a && !!b && contenidoDe(a) === contenidoDe(b));

function fusionarBloques(base = [], nuestro = [], suyo = []) {
  const mapa = (lista) => new Map(lista.map((b) => [b._key, b]));
  const B = mapa(base);
  const N = mapa(nuestro);
  const S = mapa(suyo);

  const salida = [];
  for (const b of nuestro) {
    const k = b._key;
    if (!B.has(k)) {
      salida.push(b); // nuevo de acá
      continue;
    }
    if (!S.has(k)) {
      // El otro lo borró: se va, salvo que acá se haya tocado.
      if (!igual(b, B.get(k))) salida.push(b);
      continue;
    }
    const cambioAca = !igual(b, B.get(k));
    const cambioAlla = !igual(S.get(k), B.get(k));
    salida.push(!cambioAca && cambioAlla ? S.get(k) : b);
  }

  // Lo nuevo del otro lado, después de lo que tenía arriba.
  suyo.forEach((b, i) => {
    if (B.has(b._key) || N.has(b._key)) return;
    let j = i - 1;
    while (j >= 0 && !salida.some((x) => x._key === suyo[j]._key)) j--;
    const donde = j < 0 ? 0 : salida.findIndex((x) => x._key === suyo[j]._key) + 1;
    salida.splice(donde, 0, b);
  });
  return salida;
}

export function fusionar(base, nuestro, suyo) {
  if (!suyo) return nuestro;
  if (!base) return nuestro;
  const pagina = (doc, k) => doc?.paginas?.find((p) => p._key === k);
  const claves = [];
  for (const doc of [nuestro, suyo]) for (const p of doc.paginas) if (!claves.includes(p._key)) claves.push(p._key);

  const paginas = [];
  for (const k of claves) {
    const b = pagina(base, k);
    const n = pagina(nuestro, k);
    const s = pagina(suyo, k);
    if (!n && b) continue; // la borramos acá
    if (!s && b && n && igual(n, b)) continue; // la borraron allá y acá no se tocó
    const titulo = n && b && n.titulo === b.titulo && s ? s.titulo : (n || s).titulo;
    paginas.push({
      ...(n || s),
      titulo,
      bloques: n && s ? fusionarBloques(b?.bloques, n.bloques, s.bloques) : (n || s).bloques,
    });
  }
  // La nota empieza siempre por la primera página nuestra.
  paginas.sort((x, y) => (x._key === nuestro.paginas[0]._key ? -1 : y._key === nuestro.paginas[0]._key ? 1 : 0));
  // Lo del documento entero (la historia como datasheet): el nuestro si lo
  // cambiamos, si no el de la otra versión.
  const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const datasheet = igual(nuestro.datasheet, base.datasheet) ? suyo.datasheet : nuestro.datasheet;
  const junto = { ...nuestro, paginas };
  if (datasheet) junto.datasheet = datasheet;
  else delete junto.datasheet;
  return junto;
}

/**
 * Cuando el otro lado solo tiene markdown —la web o el editor viejo
 * cambiaron `description` sin documento—, sus bloques no traen nuestras
 * claves y la fusión los vería todos como nuevos. Esto les pone la clave del
 * bloque de la base que tiene el mismo contenido, en orden, para que lo que
 * no cambió se reconozca como tal.
 */
export function alinearClaves(base, suyo) {
  const libres = new Map();
  for (const p of base.paginas) {
    for (const b of p.bloques) {
      const c = contenidoDe(b);
      if (!libres.has(c)) libres.set(c, []);
      libres.get(c).push(b._key);
    }
  }
  const usadas = new Set();
  return {
    ...suyo,
    paginas: suyo.paginas.map((p, i) => ({
      ...p,
      // La primera página es la nota en las dos versiones.
      _key: i === 0 ? base.paginas[0]._key : p._key,
      bloques: p.bloques.map((b) => {
        const k = (libres.get(contenidoDe(b)) || []).find((x) => !usadas.has(x));
        if (!k) return b;
        usadas.add(k);
        return { ...b, _key: k };
      }),
    })),
  };
}

/**
 * La versión de la base de datos como documento: el suyo si es coherente con
 * su `description`, o su `description` leída y alineada con la base.
 */
export function versionDeLaBase({ description, documento }, base, { coherente }) {
  if (documento && coherente(documento, description)) return documento;
  return alinearClaves(base, desdeMarkdown(description || ''));
}
