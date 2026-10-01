/**
 * De qué tipo es un espacio, y cómo se llaman las cosas adentro.
 *
 * Un espacio puede ser de ficción, legal, de investigación o periodismo, de
 * política, o híbrido (varios a la vez). Se guarda en `spaces.metadata`
 * (`aspectos` + `hibrido`, ver `espacio_ajustar`).
 *
 * El mapa vive acá para que haya un solo lugar que diga cómo se llama cada
 * cosa según el espacio: los tipos del Codex y los niveles de la historia.
 */

export const ASPECTOS = [
  { id: 'ficcion', nombre: 'ficción' },
  { id: 'legal', nombre: 'legal' },
  { id: 'investigacion', nombre: 'investigación y periodismo' },
  { id: 'politica', nombre: 'política' },
];

/**
 * Los nombres de los tipos del Codex en cada aspecto, en plural.
 * Lo que no aparece se llama como siempre.
 */
export const ONTOLOGIA = {
  ficcion: {
    Actor: 'personajes',
    Entidad: 'entidades',
    Territorio: 'lugares',
    Artefacto: 'lore',
    Evidencia: 'objetos',
    Concepto: 'líneas narrativas',
  },
  legal: {},
  investigacion: {},
  politica: {},
};

/**
 * Cómo se llama un tipo en un espacio con estos aspectos, o `null` si se llama
 * como siempre. En un híbrido gana el primero que lo renombre, en el orden de
 * `ASPECTOS`.
 */
export function nombreEnEspacio(tipo, aspectos = []) {
  for (const { id } of ASPECTOS) {
    if (aspectos.includes(id) && ONTOLOGIA[id]?.[tipo]) return ONTOLOGIA[id][tipo];
  }
  return null;
}

/**
 * Cómo se llaman los niveles de la historia de un espacio (Task 8.1):
 * cada snippet que es historia, sus partes (páginas o títulos) y sus
 * párrafos. La estructura es la misma en todos; cambia el nombre.
 */
export const NIVELES = {
  ficcion: [
    ['capítulo', 'capítulos'],
    ['escena', 'escenas'],
    ['párrafo', 'párrafos'],
  ],
  legal: [
    ['expediente', 'expedientes'],
    ['capítulo', 'capítulos'],
    ['artículo', 'artículos'],
  ],
  investigacion: [
    ['parte', 'partes'],
    ['sección', 'secciones'],
    ['hallazgo', 'hallazgos'],
  ],
  politica: [
    ['eje', 'ejes'],
    ['tema', 'temas'],
    ['punto', 'puntos'],
  ],
};

const NIVELES_DE_SIEMPRE = [
  ['parte', 'partes'],
  ['sección', 'secciones'],
  ['párrafo', 'párrafos'],
];

/**
 * Los nombres de los tres niveles para un espacio. Con un solo aspecto, los
 * suyos; sin aspecto o híbrido, los de siempre: mezclar «capítulos» con
 * «artículos» confundiría más de lo que ayuda.
 *
 * @returns `[[singular, plural], [singular, plural], [singular, plural]]`
 */
export function nivelesDe(aspectos = [], hibrido = false) {
  const lista = Array.isArray(aspectos) ? aspectos : [];
  if (hibrido || lista.length !== 1) return NIVELES_DE_SIEMPRE;
  return NIVELES[lista[0]] || NIVELES_DE_SIEMPRE;
}

/** «1 capítulo», «16 escenas». */
export const contar = (n, [uno, varios]) => `${n} ${n === 1 ? uno : varios}`;
