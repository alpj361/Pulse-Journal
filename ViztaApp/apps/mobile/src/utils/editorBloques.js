import { useCapacidadesStore } from '../state/capacidadesStore';

/**
 * El interruptor del editor de bloques (STA-190).
 *
 * Mientras el editor nuevo se construye por fases, la nota sigue abriendo el
 * editor de siempre para todos. Esta cuenta lo tiene prendido solo si la base
 * lo dice: `get_my_capabilities` junta las funciones del plan con los ajustes
 * por persona de `profile_limits.overrides`, y ahí se prende para quien lo
 * prueba. Se puede apagar desde la base sin publicar una versión.
 *
 * Si las capacidades no llegaron o la consulta falló, está apagado: un editor
 * a medio hacer nunca se abre por un error de red.
 *
 * En F6 se quitan el editor viejo y este interruptor.
 */

export const FLAG = 'editor_bloques';

/** Si esta cuenta abre las notas con el editor de bloques. Se lee de las capacidades, en vivo. */
export function useEditorBloques() {
  return useCapacidadesStore((s) => s.capacidades?.features?.[FLAG]?.availability === 'enabled');
}
