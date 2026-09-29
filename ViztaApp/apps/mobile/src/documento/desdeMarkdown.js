/**
 * Markdown → `vizta.doc/1`.
 *
 * Lee lo que ya está escrito en las notas: lo que escribe la barra de hoy
 * (`formato.js`: `#`, `##`, `**`, `_`, `==`, `` ` ``) y lo que escriben los
 * modelos (`markdown.js`: `###`, listas `-`/`*`/`1.`, `---`, `>`, tablas,
 * bloques de código).
 *
 * **Un bloque por renglón, y un renglón en blanco es un bloque vacío.** En
 * markdown estricto, dos renglones seguidos son un solo párrafo; pero en la
 * nota nunca fue así: el `TextInput` muestra cada salto como un salto, y así
 * es como la gente escribió sus notas. Con esta regla, markdown → doc →
 * markdown devuelve el mismo texto, y `description` —la que leen el
 * indexador, el rastreo y la web— no cambia por migrar una nota. Es además
 * cómo se comporta un editor de bloques: cada Enter abre un bloque.
 *
 * Las excepciones son las que ocupan varios renglones por naturaleza: un
 * bloque de código (```) y una tabla, que son un solo bloque cada una.
 */

import { crearDocumento, nuevaClave } from './esquema.js';
import { leerEnLinea } from './enLinea.js';
import { contadorDeListas } from './aMarkdown.js';

const CERCA = /^\s*```(.*)$/;
const CIERRE_CERCA = /^\s*```\s*$/;
const TITULO = /^ {0,3}(#{1,6})[ \t]+(.*)$/;
const SEPARADOR = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const CITA = /^\s*>\s?(.*)$/;
const TODO = /^(\s*)[-*+][ \t]+\[( |x|X)\][ \t]+(.*)$/;
const VINETA = /^(\s*)[-*+][ \t]+(.*)$/;
const NUMERADA = /^(\s*)(\d{1,9})[.)][ \t]+(.*)$/;
const FILA = /^\s*\|.*\|\s*$/;
const FILA_SEPARADORA = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

/**
 * El nivel de un renglón de lista por su sangría. Dos espacios por nivel,
 * que es lo que escriben los modelos; un tab cuenta como un nivel.
 */
const nivelDe = (sangria) => Math.floor(sangria.replace(/\t/g, '  ').length / 2) + 1;

/** Las celdas de una fila. Un `\|` es una barra dentro de la celda, no un corte. */
function celdas(fila) {
  const t = fila.trim().replace(/^\|/, '').replace(/\|$/, '');
  const salida = [''];
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '|' && t[i - 1] !== '\\') salida.push('');
    else salida[salida.length - 1] += t[i];
  }
  return salida.map((c) => c.trim());
}

function alineacionDe(celda) {
  const izq = celda.startsWith(':');
  const der = celda.endsWith(':');
  if (izq && der) return 'centro';
  if (der) return 'derecha';
  if (izq) return 'izquierda';
  return null;
}

function tablaDe(filas, clave) {
  const bloque = { _type: 'tabla', _key: clave(), filas: [], encabezado: false };
  filas.forEach((f, i) => {
    if (i === 1 && FILA_SEPARADORA.test(f)) {
      bloque.encabezado = true;
      const al = celdas(f).map(alineacionDe);
      if (al.some(Boolean)) bloque.alineacion = al;
      return;
    }
    bloque.filas.push(celdas(f));
  });
  return bloque;
}

function deTexto(texto, clave, extra = {}) {
  const { children, markDefs } = leerEnLinea(texto, { clave });
  return { _type: 'block', _key: clave(), style: 'normal', ...extra, children, markDefs };
}

/**
 * @param {string} md
 * @param {{ clave?: () => string }} [opciones] `clave` genera las `_key`; las
 *   pruebas pasan una en serie para poder escribir el resultado esperado.
 */
export function desdeMarkdown(md, { clave = nuevaClave } = {}) {
  const lineas = String(md ?? '').replace(/\r\n?/g, '\n').split('\n');
  const bloques = [];
  const escritos = new Map();

  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];

    const cerca = CERCA.exec(l);
    if (cerca) {
      // Hasta el cierre o hasta el final: un bloque de código sin cerrar se
      // cierra solo, que es lo que hacen los que pintan markdown.
      const adentro = [];
      let j = i + 1;
      while (j < lineas.length && !CIERRE_CERCA.test(lineas[j])) adentro.push(lineas[j++]);
      bloques.push({ _type: 'codigo', _key: clave(), lenguaje: cerca[1].trim(), texto: adentro.join('\n') });
      i = j;
      continue;
    }

    if (FILA.test(l)) {
      const filas = [];
      let j = i;
      while (j < lineas.length && FILA.test(lineas[j])) filas.push(lineas[j++]);
      bloques.push(tablaDe(filas, clave));
      i = j - 1;
      continue;
    }

    const titulo = TITULO.exec(l);
    if (titulo) {
      bloques.push(deTexto(titulo[2], clave, { style: `h${titulo[1].length}` }));
      continue;
    }

    if (SEPARADOR.test(l)) {
      bloques.push({ _type: 'separador', _key: clave(), estilo: 'fina' });
      continue;
    }

    const cita = CITA.exec(l);
    if (cita) {
      bloques.push(deTexto(cita[1], clave, { style: 'cita' }));
      continue;
    }

    const todo = TODO.exec(l);
    if (todo) {
      const { children, markDefs } = leerEnLinea(todo[3], { clave });
      bloques.push({
        _type: 'todo',
        _key: clave(),
        hecho: todo[2] !== ' ',
        level: nivelDe(todo[1]),
        children,
        markDefs,
      });
      continue;
    }

    const vineta = VINETA.exec(l);
    if (vineta) {
      bloques.push(deTexto(vineta[2], clave, { listItem: 'bullet', level: nivelDe(vineta[1]) }));
      continue;
    }

    const numerada = NUMERADA.exec(l);
    if (numerada) {
      const b = deTexto(numerada[3], clave, { listItem: 'number', level: nivelDe(numerada[1]) });
      escritos.set(b, Number(numerada[2]));
      bloques.push(b);
      continue;
    }

    bloques.push(deTexto(l, clave));
  }

  // `numero` solo donde la cuenta no daría lo escrito: casi siempre ningún
  // renglón lo necesita, y así reordenar una lista normal la renumera sola.
  const cuenta = contadorDeListas();
  for (const b of bloques) {
    const escrito = escritos.get(b);
    const esperado = cuenta(b, escrito);
    if (escrito !== undefined && esperado !== escrito) b.numero = escrito;
  }

  return crearDocumento({ clave, bloques });
}
