import { claveDe, normalizar, palabrasDe } from './menciones';

/** Cuántos resultados se pintan. Ver `buscar`. */
const TECHO = 60;

/**
 * La palabra que se está escribiendo, según dónde está el cursor.
 *
 * Es la consulta del autocompletado: no hay un campo de búsqueda aparte, la
 * nota misma es lo que se busca. Se toma la última palabra antes del cursor,
 * que es lo que uno acaba de teclear.
 *
 * Devuelve cadena vacía si el cursor no está pegado a una palabra —después de
 * un espacio, de un punto, o al principio—. Sin ese corte, terminar de escribir
 * «Bernardo.» seguiría sugiriendo Bernardo mientras se escribe la oración
 * siguiente, y las sugerencias no se irían nunca.
 *
 * Trabaja sobre el texto normalizado, así que «Aré» y «Are» preguntan lo mismo.
 */
export function palabraEnCursor(texto, posicion) {
  const t = String(texto || '');
  const corte = Math.max(0, Math.min(posicion ?? t.length, t.length));
  const antes = normalizar(t.slice(0, corte));

  // El cursor tiene que estar justo después de una letra o un número.
  if (!/[a-z0-9]$/.test(antes)) return '';

  const palabras = palabrasDe(antes);
  return palabras.length ? palabras[palabras.length - 1] : '';
}

/**
 * Qué mención cae en esta posición del texto, si cae alguna.
 *
 * Es cómo se sabe qué nombre se tocó en la nota. El camino obvio —un `onPress`
 * en el `<Text>` de cada mención— no funciona: el `TextInput` se queda el toque
 * para poner el cursor y el `onPress` del hijo nunca corre. Pero eso mismo es
 * la solución, porque el cursor **es** la respuesta: donde quedó es donde se
 * tocó, y solo hay que ver qué tramo lo contiene.
 *
 * Incluye el arranque del tramo y excluye el final: tocando la primera letra,
 * iOS deja el cursor antes de ella, así que sin incluirlo la mitad izquierda
 * del nombre no respondería. Y excluir el final es lo que evita que el cursor
 * apenas pasado el nombre —donde queda justo después de autocompletar— cuente
 * como estar dentro.
 */
export function mencionEn(tramos, posicion) {
  let desde = 0;

  for (const t of tramos || []) {
    const largo = (t.texto || '').length;
    if (t.item && posicion >= desde && posicion < desde + largo) return t.item;
    desde += largo;
  }

  return null;
}

/** ¿Este carácter forma parte de una palabra? */
function esDePalabra(c) {
  // Se pregunta a `normalizar` en vez de a un regex propio: así «é» cuenta como
  // letra por la misma razón por la que el índice la trata como «e», y no hay
  // dos definiciones de «palabra» que se puedan desincronizar.
  return /^[a-z0-9]$/.test(normalizar(c || ''));
}

/**
 * Dónde empieza y termina, en el texto **crudo**, la palabra bajo el cursor.
 *
 * `palabraEnCursor` trabaja sobre el texto normalizado, que sirve para
 * preguntar pero no para reemplazar: «Aré» y «are» tienen el mismo largo acá,
 * pero cortar por índices normalizados en un texto con tildes desalinearía todo
 * lo que viene después. Esto devuelve índices del texto original.
 */
export function tramoDePalabra(texto, posicion) {
  const t = String(texto || '');
  const fin = Math.max(0, Math.min(posicion ?? t.length, t.length));

  let ini = fin;
  while (ini > 0 && esDePalabra(t[ini - 1])) ini--;

  return { ini, fin };
}

/**
 * Reemplaza la palabra a medio escribir por el nombre completo.
 *
 * Es lo que hace el toque en una sugerencia: se venía escribiendo «bern» y
 * queda «Bernardo Arévalo», con el cursor listo para seguir la oración.
 *
 * Agrega un espacio detrás, salvo que ya hubiera uno. Sin eso, completar en
 * medio de una frase pegaría el nombre con la palabra siguiente; y poniéndolo
 * siempre, completar antes de un espacio existente dejaría dos.
 *
 * Devuelve el texto nuevo y dónde va el cursor. El cursor importa tanto como el
 * texto: si queda al final del documento, completar una palabra en el medio te
 * manda el cursor lejos de donde estabas escribiendo.
 *
 * **Y queda siempre pasando el separador, nunca pegado al nombre.** Si quedara
 * pegado, `palabraEnCursor` leería la última palabra del nombre que se acaba de
 * insertar y el panel volvería a abrirse sugiriendo lo mismo que ya se eligió
 * — completar dejaría la sugerencia en pantalla en vez de resolverla.
 */
export function completar(texto, posicion, nombre) {
  const t = String(texto || '');
  const limpio = String(nombre || '').trim();
  if (!limpio) return { texto: t, cursor: posicion ?? t.length };

  const { ini, fin } = tramoDePalabra(t, posicion);
  const antes = t.slice(0, ini);
  const despues = t.slice(fin);

  // O se pone el separador, o se salta el que ya estaba: de las dos maneras el
  // cursor termina del otro lado.
  const propio = /^\s/.test(despues) ? '' : ' ';
  const ajeno = propio ? 0 : 1;

  return {
    texto: antes + limpio + propio + despues,
    cursor: (antes + limpio + propio).length + ajeno,
  };
}

/**
 * Aplana el índice de menciones en una lista de términos buscables.
 *
 * El índice viene agrupado por primera palabra —le sirve al resaltado, que
 * pregunta «¿algún término empieza con esta palabra?»— y para buscar hace falta
 * lo contrario: recorrer todo. Se aplana una vez por índice, no por tecla.
 *
 * Cada término trae su item, así que un mismo item aparece varias veces: una
 * por su nombre y una por cada alias. Eso es a propósito — buscar «MP» tiene
 * que encontrar al Ministerio Público— y `buscar` se encarga de que el
 * resultado salga una sola vez.
 */
export function aplanar(indice) {
  const terminos = [];
  for (const lista of indice?.values() || []) {
    for (const { palabras, item } of lista) {
      terminos.push({ clave: palabras.join(' '), palabras, item });
    }
  }
  return terminos;
}

/**
 * Busca en los términos del Codex.
 *
 * Tres calidades de coincidencia, y en ese orden:
 *
 *  0. el término **empieza** con lo escrito — «ber» → «Bernardo Arévalo»
 *  1. **alguna palabra** del término empieza con lo escrito — «are» → el mismo
 *  2. el término lo **contiene** en cualquier parte — la red de seguridad
 *
 * El orden importa más que la cantidad: escribir una letra devuelve cientos de
 * cosas, y lo que la persona busca casi siempre empieza con esa letra. Sin el
 * ranking, «B» mostraría primero cualquier nombre que tenga una b en el medio.
 *
 * Con varias palabras se pide que **todas** coincidan, cada una contra alguna
 * palabra del término, sin importar el orden: «arevalo ber» encuentra a
 * Bernardo Arévalo igual que «ber arevalo». Escribir más siempre achica la
 * lista, que es lo que uno espera de seguir tecleando.
 *
 * Se corta en `TECHO` resultados. No es paginación: es que nadie recorre
 * seiscientas filas para encontrar algo, y si lo que se busca no está en las
 * primeras sesenta, la respuesta correcta es escribir otra letra.
 */
export function buscar(terminos, consulta) {
  const q = normalizar(consulta || '').trim();
  if (!q) return [];

  const partes = palabrasDe(q);
  if (!partes.length) return [];

  // Por item y no por término: al Ministerio Público lo encuentran «ministerio»
  // y «MP», y sería el mismo item dos veces en la lista.
  const mejores = new Map();

  for (const t of terminos) {
    const rango = rangoDe(t, partes, q);
    if (rango === null) continue;

    const previo = mejores.get(t.item.id);
    if (previo && previo.rango <= rango) continue;

    // Se guarda con qué coincidió: si fue un alias, hay que poder decirlo.
    // Un resultado que no se parece a lo escrito se lee como un error.
    mejores.set(t.item.id, { item: t.item, rango, clave: t.clave });
  }

  return [...mejores.values()]
    .sort(
      (a, b) =>
        a.rango - b.rango ||
        // Entre iguales, el nombre más corto primero: es el más específico de
        // lo escrito. Buscando «guate», «Guatemala» va antes que «Guatemala,
        // Ministerio de Finanzas Públicas».
        a.clave.length - b.clave.length ||
        a.clave.localeCompare(b.clave)
    )
    .slice(0, TECHO);
}

/**
 * Desde qué largo vale buscar por dentro de las palabras.
 *
 * Con una sola letra, «contiene» no discrimina nada: la mitad del Codex tiene
 * una a o una e en alguna parte, y la lista quedaría llena de nombres donde lo
 * escrito está enterrado en la mitad de la tercera palabra. Escribir «b» quiere
 * decir «lo que empieza con b».
 *
 * Desde dos letras la cosa se invierte y la red empieza a pagar: «blico»
 * encuentra «Público», que es justo lo que ninguna búsqueda por prefijo
 * encontraría.
 */
const PISO_INTERIOR = 2;

/** La calidad de la coincidencia, o `null` si no coincide. */
function rangoDe(termino, partes, q) {
  const { clave, palabras } = termino;

  const todas = partes.every((p) => palabras.some((w) => w.startsWith(p)));
  if (todas) return clave.startsWith(q) ? 0 : 1;

  // La red de seguridad solo aplica a una palabra suelta: con varias, exigir
  // que la frase entera aparezca literal contradice el «sin importar el orden»
  // de arriba, y no encontraría nada que las palabras no hubieran encontrado.
  if (partes.length === 1 && q.length >= PISO_INTERIOR && clave.includes(q)) return 2;

  return null;
}

