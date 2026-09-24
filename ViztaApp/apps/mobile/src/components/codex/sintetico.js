/**
 * Si un item del Codex es un perfil sintético.
 *
 * **Es un campo del contrato, no una convención.** `usr_sintetico` es un
 * `booleano` declarado para Actor, Entidad, Territorio y Evento, así que se
 * marca y se desmarca con el mismo control que cualquier otro campo, y se puede
 * poner al crear un item nuevo. No hace falta nada especial para editarlo: el
 * editor de `booleano` ya existe.
 *
 * Antes esto leía el tag `perfil sintético`. Era una convención —un tag mal
 * escrito devolvía un perfil hipotético a la interfaz vestido de persona real— y
 * además no se podía desmarcar sin editar tags a mano. El campo resuelve las
 * dos cosas.
 *
 * Este archivo existe solo para que la clave viva en un lugar: si el contrato
 * algún día promueve esto a campo de sistema, cambia acá y nada más.
 */

/** La clave con la que se guarda en `details`. */
export const CLAVE_SINTETICO = 'usr_sintetico';

/**
 * ¿El item es un perfil sintético?
 *
 * Acepta el booleano crudo y también `{ value: true }`, que es la forma en que
 * algunos tipos del contrato envuelven su valor. Cualquier otra cosa —ausente,
 * `false`, una cadena— es «no», porque marcar a alguien como hipotético por un
 * dato ambiguo es peor que no marcarlo.
 */
export function esSintetico(item) {
  const v = item?.details?.[CLAVE_SINTETICO];
  return v === true || v?.value === true;
}

/**
 * ¿Este campo de la ficha es el de «Sintético»?
 *
 * Se compara contra las dos claves que el contrato publica —la canónica y la de
 * almacenamiento— porque un campo puede llegar identificado por cualquiera de
 * las dos según si el backfill ya corrió.
 */
export function esCampoSintetico(campo) {
  return campo?.field_key === CLAVE_SINTETICO || campo?.storage_key === CLAVE_SINTETICO;
}
