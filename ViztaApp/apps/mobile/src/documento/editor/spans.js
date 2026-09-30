/**
 * Operaciones sobre los spans de un bloque: el texto con formato por rangos.
 *
 * El editor de bloques no guarda marcadores en el texto. Lo que se ve es el
 * texto tal cual, y el formato vive al costado, en los spans: «Algo
 * **importante**» son dos spans, `Algo ` sin marcas e `importante` con
 * `strong`. Por eso cada tecla tiene que traducirse a «qué rango del texto
 * cambió» y aplicarse a los spans sin perder el formato de alrededor.
 *
 * Todo es inmutable: una operación devuelve spans nuevos y deja los de
 * entrada como estaban. Es lo que hace que deshacer sea volver a un estado
 * anterior, sin tener que calcular la operación inversa.
 */

import { nuevaClave } from '../esquema.js';

const vacio = (clave) => ({ _type: 'span', _key: clave(), text: '', marks: [] });

const mismas = (a = [], b = []) => a.length === b.length && a.every((m) => b.includes(m));

/** El texto de los spans, sin formato. */
export const textoDe = (children) => {
  let t = '';
  for (const s of children || []) t += s.text || '';
  return t;
};

/**
 * Junta los spans vecinos con las mismas marcas y quita los vacíos. Siempre
 * queda al menos uno: Portable Text no admite un bloque sin hijos.
 *
 * Conserva la `_key` del primero de cada grupo, para que un span que no
 * cambió de fondo no parezca nuevo.
 */
export function normalizar(children, clave = nuevaClave) {
  const salida = [];
  for (const s of children || []) {
    if (!s.text) continue;
    const ultimo = salida[salida.length - 1];
    if (ultimo && mismas(ultimo.marks, s.marks)) {
      salida[salida.length - 1] = { ...ultimo, text: ultimo.text + s.text };
    } else {
      salida.push(s);
    }
  }
  return salida.length ? salida : [vacio(clave)];
}

/**
 * Corta los spans en `pos`: lo de antes y lo de después. Un span que cae
 * justo en el corte se parte en dos con las mismas marcas.
 */
export function cortar(children, pos, clave = nuevaClave) {
  const antes = [];
  const despues = [];
  let recorrido = 0;
  for (const s of children || []) {
    const largo = (s.text || '').length;
    if (recorrido + largo <= pos) antes.push(s);
    else if (recorrido >= pos) despues.push(s);
    else {
      const k = pos - recorrido;
      antes.push({ ...s, text: s.text.slice(0, k) });
      despues.push({ ...s, _key: clave(), text: s.text.slice(k) });
    }
    recorrido += largo;
  }
  return [antes, despues];
}

/**
 * Las marcas que hereda lo que se escribe en `pos`: las de la letra de antes,
 * como en cualquier editor —se sigue escribiendo en negrita después de una
 * palabra en negrita—. Al principio del bloque, las de la primera letra.
 *
 * Los enlaces no se heredan en el borde final: seguir escribiendo después de
 * un enlace no tiene por qué agrandarlo.
 */
export function marcasEn(children, pos, markDefs = []) {
  const links = new Set((markDefs || []).filter((d) => d._type === 'link').map((d) => d._key));
  let recorrido = 0;
  const lista = children || [];
  for (let i = 0; i < lista.length; i++) {
    const s = lista[i];
    const largo = (s.text || '').length;
    if (pos > recorrido && pos <= recorrido + largo) {
      const alFinal = pos === recorrido + largo;
      const siguiente = lista[i + 1];
      return (s.marks || []).filter(
        (m) => !(alFinal && links.has(m) && !(siguiente?.marks || []).includes(m)),
      );
    }
    recorrido += largo;
  }
  return pos === 0 && lista[0] ? [...(lista[0].marks || [])].filter((m) => !links.has(m)) : [];
}

/**
 * Reemplaza el rango `[desde, hasta)` por `texto`.
 *
 * Lo nuevo lleva `marcas` si se pasan; si no, las que hereda en `desde`.
 * También acepta `texto` como spans ya armados —lo que viene de pegar
 * markdown—, que conservan sus propias marcas.
 */
export function reemplazar(children, desde, hasta, texto, { marcas, markDefs, clave = nuevaClave } = {}) {
  const heredadas = marcas ?? marcasEn(children, desde, markDefs);
  const [antes] = cortar(children, desde, clave);
  const [, despues] = cortar(children, hasta, clave);
  const medio = Array.isArray(texto)
    ? texto.map((s) => ({ ...s, _key: s._key || clave(), marks: [...new Set([...heredadas, ...(s.marks || [])])] }))
    : texto
      ? [{ _type: 'span', _key: clave(), text: texto, marks: heredadas }]
      : [];
  return normalizar([...antes, ...medio, ...despues], clave);
}

/**
 * ¿Todo el rango tiene esta marca? Un rango vacío pregunta por la letra de
 * antes, que es la que se va a heredar.
 */
export function tieneMarca(children, desde, hasta, marca) {
  if (desde === hasta) return marcasEn(children, desde).includes(marca);
  let recorrido = 0;
  for (const s of children || []) {
    const largo = (s.text || '').length;
    const a = Math.max(desde, recorrido);
    const z = Math.min(hasta, recorrido + largo);
    if (a < z && !(s.marks || []).includes(marca)) return false;
    recorrido += largo;
  }
  return true;
}

/**
 * Prende o apaga una marca en un rango. Si todo el rango ya la tenía, se la
 * quita; si no, se la pone a todo. El mismo botón prende y apaga, como en la
 * barra de hoy.
 */
export function alternarMarca(children, desde, hasta, marca, clave = nuevaClave) {
  if (desde >= hasta) return children;
  const quitar = tieneMarca(children, desde, hasta, marca);
  const [antes, resto] = cortar(children, desde, clave);
  const [medio, despues] = cortar(resto, hasta - desde, clave);
  const cambiado = medio.map((s) => ({
    ...s,
    marks: quitar ? (s.marks || []).filter((m) => m !== marca) : [...new Set([...(s.marks || []), marca])],
  }));
  return normalizar([...antes, ...cambiado, ...despues], clave);
}

/** Sacar unas marcas de `[desde, hasta)`, estén o no en todo el tramo. */
export function quitarMarcas(children, desde, hasta, marcas, clave = nuevaClave) {
  if (desde >= hasta || !marcas.length) return children;
  const [antes, resto] = cortar(children, desde, clave);
  const [medio, despues] = cortar(resto, hasta - desde, clave);
  const limpio = medio.map((s) => ({ ...s, marks: (s.marks || []).filter((m) => !marcas.includes(m)) }));
  return normalizar([...antes, ...limpio, ...despues], clave);
}

/**
 * Qué cambió entre dos textos: un solo reemplazo `[desde, hasta)` del viejo
 * por `insertado`.
 *
 * Un `TextInput` avisa el texto nuevo entero, no la tecla. Con prefijo y
 * sufijo comunes se recupera el cambio; `cursor` —dónde estaba el cursor
 * antes— desempata cuando hay letras repetidas: escribir una «a» en «aa»
 * podría ser en cualquiera de las tres posiciones, y la que importa para el
 * formato es la del cursor.
 */
export function diferencia(viejo, nuevo, cursor) {
  const a = String(viejo ?? '');
  const b = String(nuevo ?? '');
  let p = 0;
  const tope = Math.min(a.length, b.length);
  while (p < tope && a[p] === b[p]) p++;
  if (Number.isInteger(cursor) && cursor >= 0) p = Math.min(p, cursor);
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  return { desde: p, hasta: a.length - s, insertado: b.slice(p, b.length - s) };
}

/** Las definiciones que usan de verdad estos spans. */
export function defsUsadas(children, markDefs = []) {
  const usadas = new Set();
  for (const s of children || []) for (const m of s.marks || []) usadas.add(m);
  return (markDefs || []).filter((d) => usadas.has(d._key));
}

/** Junta dos listas de definiciones sin repetir claves. */
export function unirDefs(a = [], b = []) {
  const vistas = new Set();
  const salida = [];
  for (const d of [...(a || []), ...(b || [])]) {
    if (vistas.has(d._key)) continue;
    vistas.add(d._key);
    salida.push(d);
  }
  return salida;
}

/** La palabra bajo el cursor, si está pegado a una. Igual que en `formato.js`. */
export function palabraEn(texto, pos) {
  const letra = /[\p{L}\p{N}]/u;
  let a = pos;
  let z = pos;
  while (a > 0 && letra.test(texto[a - 1])) a--;
  while (z < texto.length && letra.test(texto[z])) z++;
  return z > a ? { desde: a, hasta: z } : null;
}
