/**
 * El índice de una historia: dónde empieza cada sección.
 *
 * Son las mismas reglas con que la base la parte para el indexador
 * (`historia_partir`): cada título (`#`, `##`) o separador (`---`) abre una
 * sección; sin ninguno, cada párrafo, y los muy cortos —una pregunta, un
 * rótulo— se pegan al siguiente. Se repiten acá para que el índice siga al
 * texto mientras se escribe, sin esperar a guardar.
 */

const ENCABEZADO = /^[ \t]*#{1,6}[ \t]+(.*)$/;
const SEPARADOR = /^[ \t]*(-{3,}|\*{3,}|_{3,})[ \t]*$/;
const CORTO = 80;

/** El título de una sección sin encabezado: su primera frase, sin formato. */
function tituloDe(texto) {
  let t = String(texto || '')
    .replace(/^[ \t]*(#{1,6}|[-*•>]|\d+[.)])[ \t]+/, '')
    .replace(/(\*\*|__|==|~~|`)/g, '')
    .trim();
  const frase = /^(.{3,70}?[?!.:])(\s|$)/.exec(t);
  if (frase) t = frase[1];
  t = t.replace(/[.:]+$/, '');
  if (t.length > 60) t = `${t.slice(0, 60).replace(/\s+\S*$/, '')}…`;
  return t;
}

/**
 * @returns `[{ titulo, inicio }]` — `inicio` es la posición en el texto donde
 *   arranca la sección, para llevar la hoja hasta ahí.
 */
export function indiceDeHistoria(texto) {
  const t = String(texto || '');
  if (!t.trim()) return [];

  const lineas = [];
  let pos = 0;
  for (const linea of t.split('\n')) {
    lineas.push({ linea, inicio: pos });
    pos += linea.length + 1;
  }

  const conMarcas = lineas.some(({ linea }) => ENCABEZADO.test(linea) || SEPARADOR.test(linea));
  const secciones = [];

  if (conMarcas) {
    let actual = null;
    const cerrar = () => {
      if (actual && (actual.titulo || actual.cuerpo.trim())) secciones.push(actual);
    };
    for (const { linea, inicio } of lineas) {
      const enc = ENCABEZADO.exec(linea);
      if (enc || SEPARADOR.test(linea)) {
        cerrar();
        actual = { titulo: enc ? enc[1].trim() : '', cuerpo: '', inicio };
      } else {
        if (!actual) actual = { titulo: '', cuerpo: '', inicio };
        actual.cuerpo += `${linea}\n`;
      }
    }
    cerrar();
  } else {
    // Párrafos: bloques separados por un renglón en blanco.
    let bloque = null;
    const bloques = [];
    for (const { linea, inicio } of lineas) {
      if (!linea.trim()) {
        if (bloque) bloques.push(bloque);
        bloque = null;
      } else if (!bloque) {
        bloque = { cuerpo: linea, inicio };
      } else {
        bloque.cuerpo += `\n${linea}`;
      }
    }
    if (bloque) bloques.push(bloque);

    let pendiente = null;
    for (const b of bloques) {
      const junto = pendiente ? { cuerpo: `${pendiente.cuerpo}\n${b.cuerpo}`, inicio: pendiente.inicio } : b;
      pendiente = null;
      if (junto.cuerpo.length < CORTO) pendiente = junto;
      else secciones.push({ titulo: '', cuerpo: junto.cuerpo, inicio: junto.inicio });
    }
    if (pendiente) {
      const ultima = secciones[secciones.length - 1];
      if (ultima) ultima.cuerpo += `\n${pendiente.cuerpo}`;
      else secciones.push({ titulo: '', cuerpo: pendiente.cuerpo, inicio: pendiente.inicio });
    }
  }

  return secciones.slice(0, 24).map((s, i) => ({
    titulo:
      tituloDe(s.titulo || s.cuerpo.split('\n').find((l) => l.trim()) || '') || `Parte ${i + 1}`,
    inicio: s.inicio,
  }));
}

/**
 * Cuántos renglones ocupa en pantalla el texto hasta `hasta`.
 *
 * La nota se escribe en monoespaciada: todos los glifos miden lo mismo, así
 * que cuánto entra en un renglón es aritmética y no medición. Es la misma
 * cuenta que usa el grafo para ubicar los nombres.
 */
export function renglonesHasta(texto, hasta, porRenglon) {
  const antes = String(texto || '').slice(0, hasta);
  let total = 0;
  const lineas = antes.split('\n');
  // La última es el renglón donde empieza la sección: no se cuenta entero.
  for (let i = 0; i < lineas.length - 1; i++) {
    total += Math.max(1, Math.ceil(lineas[i].length / Math.max(porRenglon, 1)));
  }
  return total;
}
