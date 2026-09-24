/**
 * Formato en la nota: pintarlo mientras se escribe, y aplicarlo desde la barra.
 *
 * **Los marcadores no se esconden, se atenúan.** Un editor que borra los `**`
 * al pintar la negrita tiene que mantener dos textos —el que se ve y el que se
 * guarda— y sincronizar el cursor entre los dos; acá hay un solo `TextInput`
 * cuyo contenido son sus propios hijos, así que quitarlos correría todos los
 * offsets y rompería el resaltado de menciones, el autocompletado y el toque
 * en un nombre. Se pintan en gris muy claro: se leen como andamio, no como
 * texto, y siguen ahí para borrarlos a mano.
 *
 * Por eso la regla de oro de este archivo: **la concatenación de todas las
 * piezas es idéntica al cuerpo original**. Cualquier cambio que agregue o quite
 * un carácter acá rompe `mencionEn`, que camina los tramos sumando largos.
 *
 * La sintaxis es la misma que ya entiende `markdown.js` —la que escriben los
 * modelos— más `==resaltado==`, que ningún modelo escribe pero una persona
 * subrayando algo sí.
 */

// Los marcadores en línea, en orden de precedencia. `**` va antes que `*` por
// la misma razón que en `markdown.js`: al revés, `**fuerte**` se leería como
// una cursiva vacía seguida de basura.
const EN_LINEA = /(\*\*[^*\n]+\*\*|==[^=\n]+==|`[^`\n]+`|\*[^*\n]+\*|_[^_\n]+_)/g;

const PARES = {
  negrita: '**',
  cursiva: '*',
  resaltado: '==',
  codigo: '`',
};

const PREFIJOS = { h1: '# ', h2: '## ', cuerpo: '' };

/** Un tramo sin mención, partido en piezas con estilo. */
function piezasDe(texto) {
  const piezas = [];

  for (const tramo of texto.split(EN_LINEA)) {
    if (!tramo) continue;

    const par = tramo.startsWith('**')
      ? ['negrita', 2]
      : tramo.startsWith('==')
        ? ['resaltado', 2]
        : tramo.startsWith('`')
          ? ['codigo', 1]
          : /^[*_]/.test(tramo) && tramo.length > 2
            ? ['cursiva', 1]
            : null;

    if (!par) {
      piezas.push({ texto: tramo });
      continue;
    }

    const [estilo, largo] = par;
    piezas.push({ texto: tramo.slice(0, largo), marca: true });
    piezas.push({ texto: tramo.slice(largo, -largo), [estilo]: true });
    piezas.push({ texto: tramo.slice(-largo), marca: true });
  }

  return piezas;
}

/**
 * Los tramos de menciones, subdivididos en piezas con formato.
 *
 * Los títulos son de renglón, no de palabra, así que se lleva cuenta de dónde
 * empieza cada línea: `#` a mitad de frase es un numeral, no un título.
 */
export function conFormato(tramos) {
  const salida = [];
  let inicioDeLinea = true;
  let titulo = 0;

  const empujar = (texto, extra) => {
    if (texto) salida.push({ texto, ...extra });
  };

  for (const t of tramos || []) {
    // Una mención dentro de un título se pinta como mención, pero conserva el
    // tamaño del renglón: si no, el título tendría una palabra más chica.
    if (t.item) {
      empujar(t.texto, { item: t.item, ...(titulo ? { titulo } : {}) });
      inicioDeLinea = /\n$/.test(t.texto);
      continue;
    }

    for (const parte of String(t.texto || '').split(/(\n)/)) {
      if (parte === '\n') {
        empujar('\n', {});
        inicioDeLinea = true;
        titulo = 0;
        continue;
      }
      if (!parte) continue;

      let resto = parte;
      if (inicioDeLinea) {
        const enc = /^(#{1,6})(\s+)/.exec(parte);
        if (enc) {
          titulo = Math.min(enc[1].length, 2);
          empujar(enc[1] + enc[2], { marca: true, titulo });
          resto = parte.slice(enc[0].length);
        }
      }
      inicioDeLinea = false;

      for (const { texto: suyo, ...estilo } of piezasDe(resto)) {
        empujar(suyo, { ...estilo, ...(titulo ? { titulo } : {}) });
      }
    }
  }

  return salida;
}

/** Dónde empieza el renglón que contiene `pos`. */
const inicioDeRenglon = (texto, pos) => texto.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;

/**
 * Aplicar formato a lo seleccionado.
 *
 * Devuelve `{ texto, cursor }` listo para `setCuerpo` + `setCursorImpuesto`,
 * que es el mismo camino que usa el autocompletado para mover el cursor.
 *
 * Con texto seleccionado envuelve; sin selección, deja el par puesto y el
 * cursor en medio, que es lo que hace cualquier editor cuando tocás negrita
 * antes de escribir. Y si lo seleccionado **ya** estaba envuelto, lo
 * desenvuelve: el mismo botón prende y apaga.
 */
export function aplicarFormato(cuerpo, seleccion, accion) {
  const texto = String(cuerpo || '');
  const start = Math.max(0, Math.min(seleccion?.start ?? 0, texto.length));
  const end = Math.max(start, Math.min(seleccion?.end ?? start, texto.length));

  // ── Títulos: son de renglón ──────────────────────────────────────────────
  if (accion in PREFIJOS) {
    const desde = inicioDeRenglon(texto, start);
    const finLinea = texto.indexOf('\n', desde);
    const linea = texto.slice(desde, finLinea === -1 ? texto.length : finLinea);
    const previo = /^(#{1,6}\s+)/.exec(linea)?.[1] || '';
    const nuevo = PREFIJOS[accion];
    // Tocar H1 sobre un renglón que ya es H1 lo devuelve a cuerpo: el botón es
    // un interruptor, no una orden de ida.
    const puesto = previo === nuevo ? '' : nuevo;

    return {
      texto: texto.slice(0, desde) + puesto + linea.slice(previo.length) + texto.slice(desde + linea.length),
      cursor: Math.max(desde, start - previo.length + puesto.length),
    };
  }

  const par = PARES[accion];
  if (!par) return { texto, cursor: end };
  const n = par.length;

  // Ya envuelto: se quita.
  const yaEnvuelto =
    texto.slice(Math.max(0, start - n), start) === par && texto.slice(end, end + n) === par;
  if (yaEnvuelto) {
    return {
      texto: texto.slice(0, start - n) + texto.slice(start, end) + texto.slice(end + n),
      cursor: end - n,
    };
  }

  const dentro = texto.slice(start, end);
  return {
    texto: texto.slice(0, start) + par + dentro + par + texto.slice(end),
    cursor: dentro ? end + n * 2 : start + n,
  };
}

/**
 * El estilo de una pieza, para el `<Text>` que la pinta.
 *
 * `base` es el tamaño del cuerpo de la nota: los títulos se calculan desde ahí
 * para que cambiar la tipografía de la hoja no deje los títulos sueltos.
 */
export function estiloDePieza(pieza, base = 15) {
  if (pieza.marca) return { color: 'rgba(28,43,34,0.22)' };

  const estilo = {};
  if (pieza.titulo === 1) {
    estilo.fontSize = base + 6;
    estilo.fontWeight = '700';
  } else if (pieza.titulo === 2) {
    estilo.fontSize = base + 2.5;
    estilo.fontWeight = '700';
  }
  if (pieza.negrita) estilo.fontWeight = '700';
  if (pieza.cursiva) estilo.fontStyle = 'italic';
  if (pieza.resaltado) estilo.backgroundColor = 'rgba(245,200,66,0.38)';
  if (pieza.codigo) estilo.backgroundColor = 'rgba(28,43,34,0.06)';
  return estilo;
}
