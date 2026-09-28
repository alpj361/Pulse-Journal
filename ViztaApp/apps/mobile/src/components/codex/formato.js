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

// La cursiva se escribe con `_` y no con `*`: con asterisco, cursiva y
// negrita juntas daban `***hola***`, que el tokenizador ya no reconoce como
// ninguna de las dos y queda como una hilera de asteriscos. Con `_` no se
// pisan y se pueden anidar. Las cursivas viejas con `*` se siguen leyendo.
const PARES = {
  negrita: '**',
  cursiva: '_',
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
    // Lo de adentro puede tener otro estilo —cursiva dentro de negrita—: se
    // vuelve a partir y cada pieza suma el estilo de afuera. El código no se
    // parte: adentro de un `código` los asteriscos son texto.
    const interior = tramo.slice(largo, -largo);
    if (estilo === 'codigo') piezas.push({ texto: interior, codigo: true });
    else for (const p of piezasDe(interior)) piezas.push({ ...p, [estilo]: true });
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
      empujar(t.texto, { item: t.item, estado: t.estado, alfa: t.alfa, ...(titulo ? { titulo } : {}) });
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

  // Varios renglones: el formato en línea no cruza un salto, así que se aplica
  // a cada renglón por separado. Si todos ya lo tenían, se quita de todos.
  if (texto.slice(start, end).includes('\n')) return formatoPorRenglon(texto, start, end, accion, par);

  const desde = inicioDeRenglon(texto, start);
  const finLinea = texto.indexOf('\n', desde);
  const linea = texto.slice(desde, finLinea === -1 ? texto.length : finLinea);

  // Ya dentro de algo con este estilo —el cursor, o todo lo seleccionado—: se
  // quita ese tramo entero. El mismo botón prende y apaga, y no se anida un
  // `**` adentro de otro.
  // El más de adentro gana: es el que el cursor está tocando.
  const tramo = tramosDeLinea(linea)
    .filter((t) => t.estilo === accion && desde + t.desde <= start && end <= desde + t.hasta)
    .sort((x, y) => x.hasta - x.desde - (y.hasta - y.desde))[0];
  if (tramo) {
    const a = desde + tramo.desde;
    const z = desde + tramo.hasta;
    const sinMarcas = texto.slice(0, a) + texto.slice(a + n, z - n) + texto.slice(z);
    const mover = (p) => (p >= z ? p - 2 * n : p > a + n ? p - n : a);
    return { texto: sinMarcas, cursor: mover(end) };
  }

  if (start === end) {
    // Un par vacío con el cursor en medio: el segundo toque lo retira, en vez
    // de sumar otro (`****`, `====`).
    if (texto.slice(start - n, start) === par && texto.slice(start, start + n) === par) {
      return { texto: texto.slice(0, start - n) + texto.slice(start + n), cursor: start - n };
    }
    // Parado en una palabra: se le aplica a la palabra entera.
    const palabra = palabraEn(texto, start);
    if (palabra) {
      return {
        texto: texto.slice(0, palabra.a) + par + texto.slice(palabra.a, palabra.z) + par + texto.slice(palabra.z),
        cursor: palabra.z + 2 * n,
      };
    }
    // En blanco: el par queda puesto y se escribe adentro.
    return { texto: texto.slice(0, start) + par + par + texto.slice(start), cursor: start + n };
  }

  // Lo seleccionado, sin los espacios de las puntas: `** hola **` no es
  // negrita en markdown, y los marcadores quedarían a la vista para siempre.
  let a = start;
  let z = end;
  while (a < z && /\s/.test(texto[a])) a++;
  while (z > a && /\s/.test(texto[z - 1])) z--;
  if (a === z) return { texto, cursor: end };

  // Lo que ya tenía este estilo adentro se desenvuelve antes de envolver todo:
  // si no, quedan pares anidados que el render no entiende.
  const dentro = quitarEstilo(texto.slice(a, z), accion, par);
  return {
    texto: texto.slice(0, a) + par + dentro + par + texto.slice(z),
    cursor: a + dentro.length + 2 * n,
  };
}

/**
 * Los tramos con formato de un renglón: `{ estilo, desde, hasta }` con los
 * marcadores incluidos. Es el mismo corte que usa `piezasDe` para pintar, así
 * que lo que se ve negrita es lo que se trata como negrita.
 */
function tramosDeLinea(linea, base = 0) {
  const tramos = [];
  const re = new RegExp(EN_LINEA.source, 'g');
  let m;
  while ((m = re.exec(linea))) {
    const t = m[0];
    const estilo = t.startsWith('**')
      ? 'negrita'
      : t.startsWith('==')
        ? 'resaltado'
        : t.startsWith('`')
          ? 'codigo'
          : /^[*_]/.test(t) && t.length > 2
            ? 'cursiva'
            : null;
    if (!estilo) continue;
    tramos.push({ estilo, desde: base + m.index, hasta: base + m.index + t.length });
    // Los anidados también cuentan: el cursor en una cursiva dentro de una
    // negrita tiene que poder quitar la cursiva.
    if (estilo !== 'codigo') {
      const n = estilo === 'negrita' || estilo === 'resaltado' ? 2 : 1;
      tramos.push(...tramosDeLinea(t.slice(n, -n), base + m.index + n));
    }
  }
  return tramos;
}

/** Quita un estilo de todos los tramos de un texto sin saltos. */
function quitarEstilo(texto, accion, par) {
  // Uno a la vez y volviendo a leer: quitar uno corre las posiciones de los
  // demás, y los anidados se superponen.
  let salida = texto;
  for (let i = 0; i < 50; i++) {
    const t = tramosDeLinea(salida).find((x) => x.estilo === accion);
    if (!t) break;
    const n = accion === 'cursiva' ? 1 : par.length;
    salida = salida.slice(0, t.desde) + salida.slice(t.desde + n, t.hasta - n) + salida.slice(t.hasta);
  }
  return salida;
}

/** La palabra bajo el cursor, si el cursor está pegado a una. */
function palabraEn(texto, pos) {
  const letra = /[\p{L}\p{N}]/u;
  let a = pos;
  let z = pos;
  while (a > 0 && letra.test(texto[a - 1])) a--;
  while (z < texto.length && letra.test(texto[z])) z++;
  return z > a ? { a, z } : null;
}

function formatoPorRenglon(texto, start, end, accion, par) {
  const desde = inicioDeRenglon(texto, start);
  const hasta = texto.indexOf('\n', end) === -1 ? texto.length : texto.indexOf('\n', end);
  const renglones = texto.slice(desde, hasta).split('\n');
  const conTexto = renglones.filter((r) => r.trim());
  const todos =
    conTexto.length > 0 &&
    conTexto.every((r) => {
      const t = tramosDeLinea(r.trim());
      return t.length === 1 && t[0].estilo === accion && t[0].desde === 0 && t[0].hasta === r.trim().length;
    });

  const nuevos = renglones.map((r) => {
    if (!r.trim()) return r;
    const lead = r.match(/^\s*/)[0];
    const trail = r.match(/\s*$/)[0];
    const cuerpo = r.trim();
    const limpio = quitarEstilo(cuerpo, accion, par);
    return lead + (todos ? limpio : par + limpio + par) + trail;
  });
  const bloque = nuevos.join('\n');
  return { texto: texto.slice(0, desde) + bloque + texto.slice(hasta), cursor: desde + bloque.length };
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
