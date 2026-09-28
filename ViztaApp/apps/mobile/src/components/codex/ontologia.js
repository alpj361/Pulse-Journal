/**
 * De qué tipo es un espacio, y cómo se llaman las cosas adentro.
 *
 * Un espacio puede ser de ficción, legal, de investigación o periodismo, de
 * política, o híbrido (varios a la vez). Se guarda en `spaces.metadata`
 * (`aspectos` + `hibrido`, ver `espacio_ajustar`).
 *
 * Por ahora es solo el dato: nada de la app cambia de nombre todavía. El mapa
 * vive acá para que, cuando se use, haya un solo lugar que diga cómo se llama
 * cada tipo según el espacio.
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
