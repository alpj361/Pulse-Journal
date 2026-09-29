/**
 * El documento como lo necesita el editor: plano y por clave.
 *
 * En `vizta.doc/1` los hijos de un toggle viven adentro del toggle
 * (`bloques`). Para editar eso estorba: Enter, borrar al inicio o moverse al
 * bloque de arriba tendrían que bajar y subir por un árbol. Acá todo queda en
 * una sola fila en el orden en que se lee, y cada bloque sabe quién es su
 * padre. Al guardar se vuelve a anidar.
 *
 * `porKey` es lo que permite que al escribir solo se vuelva a pintar el bloque
 * tocado: el bloque cambia de objeto, los demás siguen siendo los mismos, y un
 * selector por clave se da cuenta.
 *
 *   { orden: string[], porKey: { [key]: bloque }, padre: { [key]: key | null }, resto: doc }
 *
 * `resto` es el documento de origen, para devolver intactas las páginas que
 * el editor todavía no toca (F3).
 */

import { crearDocumento, CON_TEXTO } from '../esquema.js';

export function desdeDocumento(doc) {
  const base = doc?.paginas?.length ? doc : crearDocumento();
  const orden = [];
  const porKey = {};
  const padre = {};

  const aplanar = (bloques, de) => {
    for (const b of bloques || []) {
      if (!b?._key || porKey[b._key]) continue;
      if (b._type === 'toggle') {
        const { bloques: hijos, ...titulo } = b;
        porKey[b._key] = titulo;
        orden.push(b._key);
        padre[b._key] = de;
        aplanar(hijos, b._key);
      } else {
        porKey[b._key] = b;
        orden.push(b._key);
        padre[b._key] = de;
      }
    }
  };
  aplanar(base.paginas[0].bloques, null);

  return { orden, porKey, padre, resto: base };
}

export function aDocumento(estado) {
  const { orden, porKey, padre, resto } = estado;
  const hijosDe = new Map();
  for (const k of orden) {
    const p = padre[k] ?? null;
    if (!hijosDe.has(p)) hijosDe.set(p, []);
    hijosDe.get(p).push(k);
  }
  const armar = (p) =>
    (hijosDe.get(p) || []).map((k) => {
      const b = porKey[k];
      return b._type === 'toggle' ? { ...b, bloques: armar(k) } : b;
    });

  const [primera, ...otras] = resto.paginas;
  return { ...resto, paginas: [{ ...primera, bloques: armar(null) }, ...otras] };
}

export const conTexto = (b) => !!b && CON_TEXTO.includes(b._type);

/** Los padres de un bloque, del más cercano al más lejano. */
export function ancestros(estado, key) {
  const salida = [];
  let p = estado.padre[key];
  while (p) {
    salida.push(p);
    p = estado.padre[p];
  }
  return salida;
}

/** ¿Se ve? No, si algún toggle de arriba está plegado. */
export const visible = (estado, key) => ancestros(estado, key).every((p) => estado.porKey[p]?.abierto !== false);

/** Hasta dónde llega un bloque con todo lo que cuelga de él, en `orden`. */
export function finDeRama(estado, key) {
  const i = estado.orden.indexOf(key);
  let j = i + 1;
  while (j < estado.orden.length && ancestros(estado, estado.orden[j]).includes(key)) j++;
  return j; // exclusivo
}

/** El bloque visible anterior, o null. */
export function anteriorVisible(estado, key) {
  for (let i = estado.orden.indexOf(key) - 1; i >= 0; i--) {
    if (visible(estado, estado.orden[i])) return estado.orden[i];
  }
  return null;
}
