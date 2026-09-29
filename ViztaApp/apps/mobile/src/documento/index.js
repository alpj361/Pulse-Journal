/**
 * El documento de la nota (`vizta.doc/1`): forma, validación y conversores.
 * Plan y porqué: `docs/EDITOR_BLOQUES_PLAN.md`.
 */

export * from './esquema.js';
export { leerEnLinea, escribirEnLinea, textoDe } from './enLinea.js';
export { desdeMarkdown } from './desdeMarkdown.js';
export { aMarkdown, renglonesPorBloque } from './aMarkdown.js';
export { aTextoPlano, aLocal, aGlobal } from './aTextoPlano.js';
export { fusionar, alinearClaves, versionDeLaBase, contenidoDe } from './fusion.js';
