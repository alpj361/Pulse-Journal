/**
 * Taxonomía de temas del feed, con su paleta.
 *
 * Por qué existe: el tema venía escrito de tres formas distintas y ninguna
 * cubría a las otras.
 *
 *  · `news_cards` usa once temas (Política, Movilidad, Social, Violencia,
 *    Deportes, Justicia, Otros, Economía, Internacional, Entretenimiento,
 *    Cultura).
 *  · `news` usa tres, y con otros nombres: Política, **Sociales**, **Económica**.
 *  · El mapa de gradientes viejo tenía nueve claves y le faltaban Movilidad,
 *    Violencia y Cultura — o sea que 34 de 136 tarjetas (una de cada cuatro) se
 *    pintaban con el gris de fallback.
 *
 * Acá se unifica en un solo vocabulario canónico. Importa para dos cosas: que
 * ninguna tarjeta caiga al gris genérico, y que cuando el orden del feed
 * responda a los clicks del usuario no cuente «Social» y «Sociales» como dos
 * temas distintos.
 *
 * Sobre la paleta: son lavados pálidos, no losas. Los gradientes que había
 * (#2d1b69 índigo, #6b21a8 violeta) son el degradado morado saturado que
 * delata una interfaz generada — y además peleaban con el fondo claro de la
 * app. Estos se apoyan sobre el papel en vez de taparlo, y el color solo tiene
 * que alcanzar para reconocer el tema de un vistazo, no para gritar.
 */

/** Minúsculas y sin tildes, para poder comparar sin importar cómo vino escrito. */
export function normalizarTema(t) {
  return String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // tildes, ya separadas por NFD
    .trim();
}

// Todo lo que puede llegar → el tema canónico. Las variantes de `news`
// ('sociales', 'economica') entran acá; sin esto el algoritmo por temas las
// contaría aparte.
const ALIAS = {
  politica: 'Política',
  economia: 'Economía',
  economica: 'Economía',
  economico: 'Economía',
  social: 'Social',
  sociales: 'Social',
  violencia: 'Violencia',
  seguridad: 'Violencia',
  justicia: 'Justicia',
  movilidad: 'Movilidad',
  transporte: 'Movilidad',
  internacional: 'Internacional',
  deportes: 'Deportes',
  deporte: 'Deportes',
  cultura: 'Cultura',
  entretenimiento: 'Entretenimiento',
  tecnologia: 'Tecnología',
  otros: 'Otros',
};

/**
 * Paleta por tema. `lavado` son las dos paradas del degradado, `tinta` el color
 * del texto sobre él, y `marca` el punto que identifica al tema en listas.
 *
 * Todas las tintas están por encima de 4.5:1 contra su propio lavado — el texto
 * del tema se lee, no se adivina.
 */
export const TEMAS = {
  Política:        { lavado: ['#E9ECF3', '#DCE3EF'], tinta: '#39476B', marca: '#4B5C87' },
  Economía:        { lavado: ['#F3EEE4', '#EAE1D0'], tinta: '#6A5433', marca: '#8A6F44' },
  Social:          { lavado: ['#E8EFE9', '#DAE7DC'], tinta: '#3D5F46', marca: '#537A5D' },
  Violencia:       { lavado: ['#F3E9E7', '#EBDBD7'], tinta: '#783D34', marca: '#9A5347' },
  Justicia:        { lavado: ['#ECEEEF', '#E0E3E5'], tinta: '#43494E', marca: '#5C6469' },
  Movilidad:       { lavado: ['#E4EEF1', '#D4E5EA'], tinta: '#2D5862', marca: '#3F737F' },
  Internacional:   { lavado: ['#ECEAF3', '#DFDDEE'], tinta: '#484468', marca: '#615C86' },
  Deportes:        { lavado: ['#EEF0E4', '#E2E7D2'], tinta: '#535E38', marca: '#6E7B4A' },
  Cultura:         { lavado: ['#F3EAEF', '#E9DBE3'], tinta: '#693E56', marca: '#89546F' },
  Entretenimiento: { lavado: ['#F6EBE4', '#EEDCD1'], tinta: '#784832', marca: '#9A6044' },
  Tecnología:      { lavado: ['#E7EDEF', '#D8E4E8'], tinta: '#37535C', marca: '#4C6E79' },
  Otros:           { lavado: ['#EDEDEB', '#E3E3E0'], tinta: '#545956', marca: '#6E7370' },
};

/**
 * El tema canónico de cualquier cosa que venga de la base.
 *
 * El tercer paso existe porque el generador de la narrativa escribe categorías
 * compuestas: hoy mismo hay una fila con `"Economía y Política"`. Sin partirla,
 * cae al gris genérico — que es justo lo que este módulo vino a eliminar. Se
 * toma el primer fragmento reconocible, no el último: en «Economía y Política»
 * el tema que manda es el primero que el generador nombró.
 */
/**
 * La categoría de una tarjeta de noticia.
 *
 * `news_cards` trae dos campos que parecen lo mismo y no lo son:
 *
 *  · `categoria_principal` es un enum cerrado del prompt — Política, Movilidad,
 *    Deportes, Violencia, Otros — y es el que hay que usar.
 *  · `categoria` es texto libre que el modelo llena a gusto. Hoy escribió
 *    «Justicia», «Gestión pública» y «Deporte y sociedad» en la misma corrida.
 *
 * Leer el libre es cómo un cuerpo calcinado terminó etiquetado «Justicia» y una
 * reparación de puente cayó al gris de «Otros»: no es que el generador se haya
 * equivocado, es que el front estaba leyendo el campo equivocado. El enum decía
 * Violencia y Movilidad al mismo tiempo.
 *
 * El libre queda como respaldo para las corridas viejas, anteriores a que el
 * enum existiera.
 */
export function categoriaDe(card) {
  return card?.categoria_principal || card?.categoria || null;
}

export function temaDe(valor) {
  const n = normalizarTema(valor);
  if (!n) return 'Otros';
  if (ALIAS[n]) return ALIAS[n];

  // Por si llega ya canónico con otra capitalización.
  const directo = Object.keys(TEMAS).find((k) => normalizarTema(k) === n);
  if (directo) return directo;

  // Compuestas: «Economía y Política», «Justicia / Política», «Social, Economía».
  for (const parte of n.split(/\s+y\s+|\s+e\s+|[/,|]|\s+-\s+/)) {
    const t = parte.trim();
    if (!t) continue;
    if (ALIAS[t]) return ALIAS[t];
    const d = Object.keys(TEMAS).find((k) => normalizarTema(k) === t);
    if (d) return d;
  }

  return 'Otros';
}

/** Paleta del tema. Nunca devuelve undefined: eso era el gris de antes. */
export function paletaDe(valor) {
  return TEMAS[temaDe(valor)] || TEMAS.Otros;
}

// El impulso viene de `narrativa_diaria.temas_subiendo` como palabra. Se ordena
// por peso, y el peso también decide cuánto se marca visualmente.
export const IMPULSO = {
  alto: { peso: 3, label: 'subiendo fuerte' },
  medio: { peso: 2, label: 'subiendo' },
  bajo: { peso: 1, label: 'estable' },
};

export function impulsoDe(valor) {
  return IMPULSO[normalizarTema(valor)] || IMPULSO.bajo;
}
