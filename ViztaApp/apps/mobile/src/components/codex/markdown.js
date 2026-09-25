/**
 * El markdown que escriben los modelos, para pintarlo.
 *
 * No es un renderizador de markdown: es exactamente lo que los modelos usan al
 * contestar —negritas, títulos, listas, tablas, código— y nada más. Una
 * librería completa traería notas al pie, HTML embebido y referencias, que
 * ningún modelo escribe, a cambio de una dependencia y de perder el control de
 * la tipografía de la hoja.
 *
 * Devuelve **líneas con piezas**, no un árbol. La razón es la máquina de
 * escribir: hay que poder mostrar los primeros N caracteres *visibles* del
 * texto, y con un árbol habría que recorrerlo entero en cada cuadro para saber
 * dónde cortar. Con una lista plana de piezas, cortar es sumar largos.
 *
 * Y esa es la razón de fondo de que el markdown se parsee **antes** de animar y
 * no después: si se animara el texto crudo, durante dos segundos se leerían los
 * asteriscos antes de que se conviertan en negrita.
 */

/**
 * Los marcadores en línea, en orden de precedencia.
 *
 * `**` va antes que `*` a propósito: al revés, `**fuerte**` se leería como una
 * cursiva vacía seguida de basura. Es el clásico error de tokenizar markdown
 * con un regex, y el orden dentro de la alternancia es lo único que lo evita.
 */
const EN_LINEA = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_)/g;

/** Parte una línea en piezas con estilo. */
function piezasDe(linea) {
  const piezas = [];

  for (const tramo of linea.split(EN_LINEA)) {
    if (!tramo) continue;

    // Lo de adentro se vuelve a partir: cursiva dentro de negrita, o al revés.
    if (/^\*\*[\s\S]+\*\*$/.test(tramo) || /^__[\s\S]+__$/.test(tramo)) {
      for (const p of piezasDe(tramo.slice(2, -2))) piezas.push({ ...p, negrita: true });
    } else if (/^`[\s\S]+`$/.test(tramo)) {
      piezas.push({ t: tramo.slice(1, -1), codigo: true });
    } else if (/^\*[\s\S]+\*$/.test(tramo) || /^_[\s\S]+_$/.test(tramo)) {
      for (const p of piezasDe(tramo.slice(1, -1))) piezas.push({ ...p, cursiva: true });
    } else {
      piezas.push({ t: tramo });
    }
  }

  return piezas;
}

/** ¿Es la línea de guiones que separa el encabezado de una tabla? */
function esSeparadorDeTabla(linea) {
  return /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(linea) && linea.includes('-');
}

/**
 * Convierte una fila de tabla en algo legible en una columna angosta.
 *
 * Una tabla markdown en cuarenta caracteres de monoespaciada no es una tabla:
 * es una pared de pipes que se parte en cada celda. Las celdas separadas por un
 * punto medio se leen; la cuadrícula, no. Se pierde la alineación en columnas,
 * que en un teléfono no existía de todos modos.
 */
function filaDeTabla(linea) {
  return linea
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean)
    .join('  ·  ');
}

/**
 * Parsea el texto a líneas.
 *
 * Cada línea es `{ tipo, nivel, piezas }`. Los tipos son los que aparecen en
 * las respuestas: `titulo`, `lista`, `cita`, `regla` y `normal`.
 */
export function parsear(texto) {
  const salida = [];
  let enCodigo = false;

  for (const cruda of String(texto || '').split('\n')) {
    // Los bloques ``` se marcan como código y no se les tocan los marcadores
    // de adentro: un `*` en un fragmento de código es un asterisco.
    if (/^\s*```/.test(cruda)) {
      enCodigo = !enCodigo;
      continue;
    }

    if (enCodigo) {
      salida.push({ tipo: 'codigo', piezas: [{ t: cruda, codigo: true }] });
      continue;
    }

    if (esSeparadorDeTabla(cruda)) continue;

    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(cruda)) {
      salida.push({ tipo: 'regla', piezas: [] });
      continue;
    }

    const titulo = /^\s*(#{1,6})\s+(.*)$/.exec(cruda);
    if (titulo) {
      salida.push({ tipo: 'titulo', nivel: titulo[1].length, piezas: piezasDe(titulo[2]) });
      continue;
    }

    const cita = /^\s*>\s?(.*)$/.exec(cruda);
    if (cita) {
      salida.push({ tipo: 'cita', piezas: piezasDe(cita[1]) });
      continue;
    }

    const lista = /^\s*[-*+]\s+(.*)$/.exec(cruda);
    if (lista) {
      salida.push({ tipo: 'lista', piezas: piezasDe(lista[1]) });
      continue;
    }

    const numerada = /^\s*(\d+)[.)]\s+(.*)$/.exec(cruda);
    if (numerada) {
      salida.push({ tipo: 'lista', marca: `${numerada[1]}.`, piezas: piezasDe(numerada[2]) });
      continue;
    }

    if (/^\s*\|.*\|/.test(cruda)) {
      const fila = filaDeTabla(cruda);
      if (fila) salida.push({ tipo: 'normal', piezas: piezasDe(fila) });
      continue;
    }

    salida.push({ tipo: 'normal', piezas: piezasDe(cruda) });
  }

  return salida;
}

/** Cuántos caracteres se ven en total. Es el largo que anima la máquina. */
export function largoVisible(lineas) {
  let total = 0;
  for (const l of lineas) for (const p of l.piezas) total += p.t.length;
  return total;
}

/**
 * Las primeras `n` letras visibles.
 *
 * Corta por dentro de las piezas, así que una negrita a medio revelar se ve
 * en negrita desde la primera letra — nunca como asteriscos que después
 * desaparecen.
 *
 * Las líneas que todavía no empezaron se descartan en vez de quedar vacías: una
 * lista de veinte renglones en blanco esperando su turno empujaría el campo de
 * escritura fuera de la pantalla desde el primer cuadro.
 */
export function recortarA(lineas, n) {
  if (n <= 0) return [];

  const salida = [];
  let quedan = n;

  for (const l of lineas) {
    if (quedan <= 0) break;

    // Una regla no tiene texto: o se muestra o no, según si ya se llegó.
    if (!l.piezas.length) {
      salida.push(l);
      continue;
    }

    const piezas = [];
    for (const p of l.piezas) {
      if (quedan <= 0) break;
      piezas.push(p.t.length <= quedan ? p : { ...p, t: p.t.slice(0, quedan) });
      quedan -= p.t.length;
    }

    salida.push({ ...l, piezas });
  }

  return salida;
}
