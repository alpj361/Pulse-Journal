/**
 * Formato en línea: de markdown a spans con marcas, y de vuelta.
 *
 * Lee la misma sintaxis que `formato.js` y `markdown.js` —`**`, `__`, `*`,
 * `_`, `` ` ``— más `==resaltado==`, `~~tachado~~` y `[texto](enlace)`. Pero
 * no con una sola expresión regular como ellos, sino recorriendo el texto,
 * por dos casos que las notas reales sí tienen:
 *
 * - **Guiones bajos que no son cursiva.** `@elenamotta._ / @elenamotta_` es
 *   un usuario de Instagram, no una cursiva de « / @elenamotta». Como en
 *   CommonMark, `_` solo abre si no tiene una letra pegada antes, solo cierra
 *   si no tiene una letra pegada después, y ninguna marca abre o cierra
 *   contra un espacio.
 * - **Enlaces.** `https://…/a_b_c` o `…?x=*` son texto: dentro de una URL no
 *   se busca formato.
 *
 * Lo que no llega a cerrar se queda como texto, tal cual. Así, markdown →
 * spans → markdown devuelve lo mismo aunque el original tenga un `**` suelto.
 */

import { DECORADORES, RESALTADO_AMARILLO, nuevaClave } from './esquema.js';

const LETRA = /[\p{L}\p{N}]/u;
const ESPACIO = /\s/;
const URL = /^(?:https?:\/\/|www\.)[^\s<>]+/;

// Los delimitadores, en el orden en que se prueban. Los dobles antes que los
// simples por la misma razón que en `formato.js`: al revés, `**fuerte**` se
// leería como una cursiva vacía seguida de basura.
const DELIMITADORES = ['**', '__', '==', '~~', '*', '_'];

const MARCA_DE = {
  '**': 'strong',
  __: 'strong',
  '==': RESALTADO_AMARILLO._key,
  '~~': 'strike',
  '*': 'em',
  _: 'em',
};

const esLetra = (c) => !!c && LETRA.test(c);
const esEspacio = (c) => !c || ESPACIO.test(c);

/** ¿Empieza una URL en `i`? Solo si no viene pegada a una palabra. */
function urlEn(t, i) {
  if (esLetra(t[i - 1])) return 0;
  const m = URL.exec(t.slice(i, i + 2048));
  return m ? m[0].length : 0;
}

function abre(t, i, d) {
  const antes = t[i - 1];
  const despues = t[i + d.length];
  if (esEspacio(despues)) return false;
  // Un `*` pegado a otro `*` es parte de un `**` que no cerró, no una cursiva.
  if (d.length === 1 && (despues === d || antes === d)) return false;
  if (d[0] === '_' && esLetra(antes)) return false;
  if (d === '==' && despues === '=') return false;
  return true;
}

/** Dónde cierra `d` a partir de `desde`, o -1. Salta código y URLs. */
function cierre(t, desde, d) {
  let k = desde;
  while (k < t.length) {
    if (t[k] === '`') {
      const fin = t.indexOf('`', k + 1);
      if (fin > k + 1) {
        k = fin + 1;
        continue;
      }
    }
    const url = urlEn(t, k);
    if (url) {
      k += url;
      continue;
    }
    if (d.length === 1 && t[k] === d && t[k + 1] === d) {
      // Un par doble dentro de una cursiva simple es otra marca: se salta.
      k += 2;
      continue;
    }
    if (t.startsWith(d, k) && k > desde && !esEspacio(t[k - 1])) {
      // `**a *b***`: el cierre de la negrita son los dos últimos, no los dos
      // primeros; si no, la cursiva de adentro queda sin cerrar.
      let z = k;
      if (d.length === 2) while (t[z + 2] === d[0]) z++;
      const despues = t[z + d.length];
      if (d[0] === '_' && esLetra(despues)) {
        k++;
        continue;
      }
      if (d.length === 1 && despues === d) {
        k++;
        continue;
      }
      return z;
    }
    k++;
  }
  return -1;
}

/** `[texto](enlace)` en `i`, o null. */
function enlaceEn(t, i) {
  if (t[i] !== '[') return null;
  const m = /^\[([^\]\n]+)\]\(([^)\s]+)\)/.exec(t.slice(i, i + 2048));
  return m ? { largo: m[0].length, texto: m[1], href: m[2] } : null;
}

/**
 * Parte un texto en tramos `{ text, marks }`. Recursivo: lo de adentro de una
 * negrita puede tener una cursiva.
 */
function tramos(t, marcas, salida, defs, clave) {
  let buf = '';
  const soltar = () => {
    if (buf) salida.push({ text: buf, marks: marcas });
    buf = '';
  };
  const con = (m) => (marcas.includes(m) ? marcas : [...marcas, m]);

  let i = 0;
  while (i < t.length) {
    const url = urlEn(t, i);
    if (url) {
      buf += t.slice(i, i + url);
      i += url;
      continue;
    }

    if (t[i] === '`') {
      const fin = t.indexOf('`', i + 1);
      if (fin > i + 1) {
        soltar();
        salida.push({ text: t.slice(i + 1, fin), marks: con('code') });
        i = fin + 1;
        continue;
      }
    }

    const enlace = enlaceEn(t, i);
    if (enlace) {
      soltar();
      const def = { _key: clave(), _type: 'link', href: enlace.href };
      defs.push(def);
      tramos(enlace.texto, con(def._key), salida, defs, clave);
      i += enlace.largo;
      continue;
    }

    let hecho = false;
    for (const d of DELIMITADORES) {
      if (!t.startsWith(d, i) || !abre(t, i, d)) continue;
      const z = cierre(t, i + d.length, d);
      if (z < 0) continue;
      soltar();
      tramos(t.slice(i + d.length, z), con(MARCA_DE[d]), salida, defs, clave);
      i = z + d.length;
      hecho = true;
      break;
    }
    if (hecho) continue;

    buf += t[i];
    i++;
  }
  soltar();
}

const mismas = (a, b) => a.length === b.length && a.every((m) => b.includes(m));

/**
 * Markdown de un renglón → `{ children, markDefs }` de Portable Text.
 *
 * Siempre hay al menos un span, aunque sea vacío: Portable Text no admite un
 * bloque sin hijos, y un renglón en blanco es un bloque.
 */
export function leerEnLinea(texto, { clave = nuevaClave } = {}) {
  const crudos = [];
  const defs = [];
  tramos(String(texto ?? ''), [], crudos, defs, clave);

  const juntos = [];
  for (const c of crudos) {
    const ultimo = juntos[juntos.length - 1];
    if (ultimo && mismas(ultimo.marks, c.marks)) ultimo.text += c.text;
    else juntos.push({ ...c });
  }
  if (!juntos.length) juntos.push({ text: '', marks: [] });

  const usaResaltado = juntos.some((s) => s.marks.includes(RESALTADO_AMARILLO._key));
  return {
    children: juntos.map((s) => ({ _type: 'span', _key: clave(), text: s.text, marks: s.marks })),
    markDefs: usaResaltado ? [{ ...RESALTADO_AMARILLO }, ...defs] : defs,
  };
}

// ── De vuelta a markdown ────────────────────────────────────────────────────

// Afuera hacia adentro. El código va siempre último: adentro de un `código`
// los asteriscos son texto, así que ninguna otra marca puede abrir ahí.
const ORDEN = ['link', 'resaltado', 'strong', 'em', 'strike', 'underline', 'code'];

/**
 * Los espacios de las puntas se sacan de la marca: `** hola**` no es negrita
 * en markdown y los asteriscos quedarían a la vista para siempre. El espacio
 * conserva solo las marcas que sigue teniendo el vecino de ese lado.
 */
function sinEspaciosEnLasPuntas(spans) {
  const salida = [];
  spans.forEach((s, i) => {
    const marcas = s.marks.filter((m) => m !== 'code');
    if (!marcas.length || s.marks.includes('code')) return salida.push(s);
    const antes = spans[i - 1]?.marks || [];
    const despues = spans[i + 1]?.marks || [];
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s.text);
    if (m[1]) salida.push({ text: m[1], marks: s.marks.filter((x) => antes.includes(x)) });
    if (m[2]) salida.push({ text: m[2], marks: s.marks });
    if (m[3]) salida.push({ text: m[3], marks: s.marks.filter((x) => despues.includes(x)) });
  });
  return salida;
}

/**
 * Spans → markdown de un renglón.
 *
 * La cursiva sale con `_`, como la escribe la barra de la nota (ver
 * `formato.js`: con `*`, cursiva y negrita juntas daban `***`). Pero `_` no
 * funciona pegado a una letra ni si el texto ya tiene guiones bajos; ahí sale
 * con `*`.
 *
 * El subrayado no tiene markdown: vive en el documento y en `description` se
 * pierde.
 */
export function escribirEnLinea(children, markDefs = []) {
  const defs = new Map((markDefs || []).map((d) => [d._key, d]));
  const tipo = (m) => (DECORADORES.includes(m) ? m : defs.get(m)?._type);
  const rango = (m) => ORDEN.indexOf(tipo(m));

  let spans = [];
  for (const s of children || []) {
    const marcas = (s.marks || []).filter((m) => rango(m) >= 0).sort((a, b) => rango(a) - rango(b));
    const ultimo = spans[spans.length - 1];
    if (ultimo && mismas(ultimo.marks, marcas) && !marcas.includes('code')) ultimo.text += s.text || '';
    else if (s.text) spans.push({ text: s.text, marks: marcas });
  }
  spans = sinEspaciosEnLasPuntas(spans);

  // Primero fichas de abrir/cerrar/texto; recién después se elige el
  // delimitador de cada cursiva, porque depende de lo que venga después.
  const fichas = [];
  let abiertas = [];
  const cerrarHasta = (n) => {
    while (abiertas.length > n) fichas.push({ cierra: abiertas.pop() });
  };
  for (const s of spans) {
    const i = abiertas.findIndex((m) => !s.marks.includes(m) || m === 'code');
    if (i >= 0) cerrarHasta(i);
    for (const m of s.marks) {
      if (abiertas.includes(m)) continue;
      fichas.push({ abre: m });
      abiertas.push(m);
    }
    fichas.push({ texto: s.text });
  }
  cerrarHasta(0);

  const letraAntes = (i) => {
    for (let k = i - 1; k >= 0; k--) if (fichas[k].texto) return fichas[k].texto.slice(-1);
    return '';
  };
  const letraDespues = (i) => {
    for (let k = i + 1; k < fichas.length; k++) if (fichas[k].texto) return fichas[k].texto[0];
    return '';
  };

  const delim = new Map();
  fichas.forEach((f, i) => {
    if (f.abre === undefined || tipo(f.abre) !== 'em') return;
    let z = i + 1;
    let adentro = '';
    while (z < fichas.length && fichas[z].cierra !== f.abre) adentro += fichas[z++].texto || '';
    const guion = esLetra(letraAntes(i)) || esLetra(letraDespues(z)) || adentro.includes('_') ? '*' : '_';
    delim.set(i, guion);
    delim.set(z, guion);
  });

  let out = '';
  fichas.forEach((f, i) => {
    if (f.texto !== undefined) {
      out += f.texto;
      return;
    }
    const m = f.abre ?? f.cierra;
    const abriendo = f.abre !== undefined;
    switch (tipo(m)) {
      case 'strong':
        out += '**';
        break;
      case 'em':
        out += delim.get(i);
        break;
      case 'strike':
        out += '~~';
        break;
      case 'resaltado':
        out += '==';
        break;
      case 'code': {
        // Un código con backticks adentro necesita un par doble.
        const texto = abriendo ? fichas[i + 1]?.texto || '' : fichas[i - 1]?.texto || '';
        out += texto.includes('`') ? (abriendo ? '`` ' : ' ``') : '`';
        break;
      }
      case 'link':
        out += abriendo ? '[' : `](${defs.get(m)?.href || ''})`;
        break;
      default:
        break;
    }
  });
  return out;
}

/** El texto visible de unos spans, sin marcas. */
export const textoDe = (children) => (children || []).map((s) => s.text || '').join('');
