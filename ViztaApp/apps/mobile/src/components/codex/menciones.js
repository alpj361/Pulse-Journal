/**
 * Detección de menciones del Codex dentro de un texto libre.
 *
 * Esto es el lado del teléfono de lo que ya hace la base: `codex_terminos`
 * arma, para cada item, la lista de términos por los que se lo puede nombrar
 * —su nombre más sus alias—, normalizados y con piso de 4 caracteres. Acá se
 * repiten esas mismas reglas a propósito. Si el resaltado usara un criterio
 * distinto al del contador, la nota mostraría en color un nombre que después
 * no aparece en «menciones», o al revés, y no habría forma de explicarle a
 * nadie cuál de las dos tiene razón.
 *
 * Las reglas, iguales a las de `codex_terminos` + `codex_norm`:
 *  · minúsculas y sin tildes
 *  · todo lo que no es letra o número cuenta como separador
 *  · se compara por palabras enteras, nunca por pedazo de palabra
 *  · términos de menos de 4 caracteres no cuentan
 *
 * El piso de 4 no es arbitrario: sin él, un alias como «CC» pintaría cada «cc»
 * que aparezca dentro de cualquier oración.
 */

// Se normaliza carácter por carácter, no con `normalize('NFD')`.
//
// NFD separa la tilde en un carácter aparte y por lo tanto **cambia el largo**
// del texto. Como acá hay que devolver los offsets exactos para cortar el
// texto ORIGINAL —el que la persona escribió, con sus tildes y mayúsculas—,
// cualquier normalización que corra los índices deja el resaltado desfasado.
const ACENTOS = {
  á: 'a', à: 'a', ä: 'a', â: 'a', ã: 'a', å: 'a',
  é: 'e', è: 'e', ë: 'e', ê: 'e',
  í: 'i', ì: 'i', ï: 'i', î: 'i',
  ó: 'o', ò: 'o', ö: 'o', ô: 'o', õ: 'o',
  ú: 'u', ù: 'u', ü: 'u', û: 'u',
  ñ: 'n', ç: 'c', ý: 'y', ÿ: 'y',
  Á: 'a', À: 'a', Ä: 'a', Â: 'a', Ã: 'a', Å: 'a',
  É: 'e', È: 'e', Ë: 'e', Ê: 'e',
  Í: 'i', Ì: 'i', Ï: 'i', Î: 'i',
  Ó: 'o', Ò: 'o', Ö: 'o', Ô: 'o', Õ: 'o',
  Ú: 'u', Ù: 'u', Ü: 'u', Û: 'u',
  Ñ: 'n', Ç: 'c', Ý: 'y',
};

/**
 * Minúsculas y sin tildes, **manteniendo el largo intacto**.
 * Ver el comentario de ACENTOS: de esto depende que los offsets sirvan.
 */
export function normalizar(texto) {
  const t = String(texto || '');
  let salida = '';
  for (const c of t) {
    const sinTilde = ACENTOS[c];
    if (sinTilde) {
      salida += sinTilde;
      continue;
    }
    const bajo = c.toLowerCase();
    // Hay caracteres cuyo minúsculo ocupa más lugar que el original (la «İ»
    // turca, por ejemplo). Se dejan como están: correr un offset por un caso
    // así rompería todo el resaltado de ahí en adelante.
    salida += bajo.length === c.length ? bajo : c;
  }
  return salida;
}

const PALABRA = /[a-z0-9]+/g;

function palabrasDe(textoNormalizado) {
  return textoNormalizado.match(PALABRA) || [];
}

/**
 * Índice de términos, agrupados por su primera palabra.
 *
 * Con ~1300 items en el Codex, probar un regex por item en cada tecla no es
 * viable. Agrupando por primera palabra, cada palabra del texto solo se compara
 * contra los pocos términos que empiezan igual, y la mayoría de las palabras no
 * tiene ningún candidato y sale en el primer lookup.
 */
/**
 * El piso de largo, en un solo lugar.
 *
 * Lo usan el índice y el aviso que ve quien escribe un alias. Si cada uno
 * tuviera su propia copia del número, un día la pantalla diría que un alias
 * sirve y el resaltado no lo pintaría — y no habría manera de saber cuál de los
 * dos está equivocado.
 */
export const PISO = 4;

/** El término tal como lo indexa `codex_terminos`, o cadena vacía si no da. */
export function claveDe(crudo) {
  const palabras = palabrasDe(normalizar(crudo || ''));
  return palabras.length ? palabras.join(' ') : '';
}

/** ¿Este nombre alcanza para que el resaltado lo reconozca? */
export function esReconocible(crudo) {
  return claveDe(crudo).length >= PISO;
}

export function construirIndice(items) {
  const porPrimeraPalabra = new Map();

  for (const item of items || []) {
    if (!item?.name) continue;

    const crudos = [item.name, ...(Array.isArray(item.aliases) ? item.aliases : [])];
    const vistos = new Set();

    for (const crudo of crudos) {
      const palabras = palabrasDe(normalizar(crudo));
      if (!palabras.length) continue;

      const clave = palabras.join(' ');
      if (clave.length < PISO) continue; // mismo piso que `codex_terminos`
      if (vistos.has(clave)) continue;
      vistos.add(clave);

      const primera = palabras[0];
      if (!porPrimeraPalabra.has(primera)) porPrimeraPalabra.set(primera, []);
      porPrimeraPalabra.get(primera).push({ palabras, item });
    }
  }

  // Más largo primero: si el Codex tiene «Bernardo» y «Bernardo Arévalo», el
  // texto «Bernardo Arévalo» tiene que pintarse como uno solo, no como el
  // primero seguido de un apellido suelto.
  for (const lista of porPrimeraPalabra.values()) {
    lista.sort((a, b) => b.palabras.length - a.palabras.length);
  }

  return porPrimeraPalabra;
}

/**
 * Parte el texto en tramos: los que son mención traen `item`, el resto no.
 *
 * Devuelve siempre tramos del texto ORIGINAL, así que lo que se pinta es lo que
 * la persona escribió — con sus mayúsculas y sus tildes— aunque el match se
 * haya hecho contra la versión normalizada.
 */
export function segmentar(texto, indice) {
  const original = String(texto || '');
  if (!original || !indice || indice.size === 0) {
    return original ? [{ texto: original, item: null }] : [];
  }

  const norm = normalizar(original);

  // Tokens con posición, para poder volver al texto original.
  const tokens = [];
  PALABRA.lastIndex = 0;
  let m;
  while ((m = PALABRA.exec(norm)) !== null) {
    tokens.push({ palabra: m[0], desde: m.index, hasta: m.index + m[0].length });
  }

  const tramos = [];
  let corte = 0; // hasta dónde ya se emitió
  let i = 0;

  while (i < tokens.length) {
    const candidatos = indice.get(tokens[i].palabra);
    let encontrado = null;

    if (candidatos) {
      for (const cand of candidatos) {
        const n = cand.palabras.length;
        if (i + n > tokens.length) continue;
        let coincide = true;
        for (let k = 0; k < n; k++) {
          if (tokens[i + k].palabra !== cand.palabras[k]) {
            coincide = false;
            break;
          }
        }
        if (coincide) {
          encontrado = cand;
          break; // la lista ya viene de más largo a más corto
        }
      }
    }

    if (!encontrado) {
      i++;
      continue;
    }

    const desde = tokens[i].desde;
    const hasta = tokens[i + encontrado.palabras.length - 1].hasta;

    if (desde > corte) tramos.push({ texto: original.slice(corte, desde), item: null });
    tramos.push({ texto: original.slice(desde, hasta), item: encontrado.item });

    corte = hasta;
    i += encontrado.palabras.length;
  }

  if (corte < original.length) tramos.push({ texto: original.slice(corte), item: null });

  return tramos;
}
