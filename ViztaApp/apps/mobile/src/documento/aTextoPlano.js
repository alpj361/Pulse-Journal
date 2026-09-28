/**
 * `vizta.doc/1` → texto plano con un mapa, para el rastreo.
 *
 * El rastreo (`menciones.js`, `useVeredictos`) busca nombres en texto corrido
 * y devuelve posiciones. Con el markdown de hoy esas posiciones incluyen los
 * `**` y los `#`; con bloques, lo que importa es en qué bloque y en qué letra
 * de ese bloque cae cada nombre, para pintarlo ahí. Este texto es lo que se
 * lee —sin marcadores— y el mapa traduce en las dos direcciones:
 *
 *   posición global  ⇄  { key del bloque, offset dentro de su texto }
 *
 * Un bloque por renglón, separados por `\n`, en el orden en que se leen:
 * toggles abiertos, páginas en el lugar de su bloque. Las celdas de una tabla
 * también son renglones —las notas de diputados tienen los nombres en
 * tablas— y su tramo del mapa dice qué celda es.
 *
 * El código y las fórmulas no entran: un nombre dentro de un fragmento de
 * código no es una mención.
 */

import { leerEnLinea, textoDe } from './enLinea.js';

/**
 * @returns {{ texto: string, mapa: Array<{ key: string, desde: number, hasta: number, celda?: [number, number] }> }}
 *   `desde`/`hasta` son posiciones en `texto`; `hasta` es exclusivo.
 */
export function aTextoPlano(doc) {
  const partes = [];
  const mapa = [];
  let pos = 0;

  const agregar = (texto, tramo) => {
    if (partes.length) pos += 1; // el `\n` que separa del anterior
    mapa.push({ ...tramo, desde: pos, hasta: pos + texto.length });
    partes.push(texto);
    pos += texto.length;
  };

  const visitadas = new Set();
  const recorrer = (bloques) => {
    for (const b of bloques || []) {
      switch (b._type) {
        case 'block':
        case 'todo':
          agregar(textoDe(b.children), { key: b._key });
          break;
        case 'toggle':
          agregar(textoDe(b.children), { key: b._key });
          recorrer(b.bloques);
          break;
        case 'tabla':
          (b.filas || []).forEach((fila, f) =>
            fila.forEach((c, k) => agregar(textoDe(leerEnLinea(c).children), { key: b._key, celda: [f, k] })),
          );
          break;
        case 'pagina': {
          const p = doc.paginas.find((x) => x._key === b.pagina);
          if (!p || visitadas.has(p._key)) break;
          visitadas.add(p._key);
          recorrer(p.bloques);
          break;
        }
        default:
          break;
      }
    }
  };

  const raiz = doc?.paginas?.[0];
  if (raiz) {
    visitadas.add(raiz._key);
    recorrer(raiz.bloques);
  }
  return { texto: partes.join('\n'), mapa };
}

const mismaCelda = (a, b) => (!a && !b) || (a && b && a[0] === b[0] && a[1] === b[1]);

/**
 * Posición global → `{ key, offset, celda? }`, o null si está fuera del texto.
 * Las posiciones son de cursor: la del `\n` entre dos bloques es el final del
 * primero.
 */
export function aLocal(mapa, pos) {
  // Búsqueda binaria: los tramos están en orden y una nota larga tiene miles.
  let a = 0;
  let z = mapa.length - 1;
  while (a <= z) {
    const m = (a + z) >> 1;
    const t = mapa[m];
    if (pos < t.desde) z = m - 1;
    else if (pos > t.hasta) a = m + 1;
    else return { key: t.key, offset: pos - t.desde, ...(t.celda ? { celda: t.celda } : {}) };
  }
  return null;
}

/** `{ key, offset, celda? }` → posición global, o -1 si el bloque no está. */
export function aGlobal(mapa, key, offset, celda) {
  const t = mapa.find((x) => x.key === key && mismaCelda(x.celda, celda));
  if (!t) return -1;
  return t.desde + Math.max(0, Math.min(offset, t.hasta - t.desde));
}
