/**
 * El editor de bloques, la parte que no depende de React: estado plano,
 * operaciones y deshacer. Los componentes viven en `components/codex/bloques`.
 */

export * from './estado.js';
export * from './operaciones.js';
export { crearHistorial } from './historial.js';
export {
  textoDe,
  normalizar,
  cortar,
  reemplazar,
  alternarMarca,
  tieneMarca,
  marcasEn,
  diferencia,
  palabraEn,
} from './spans.js';
