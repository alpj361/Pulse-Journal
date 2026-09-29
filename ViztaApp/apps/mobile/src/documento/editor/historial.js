/**
 * Deshacer y rehacer.
 *
 * Como las operaciones no modifican el estado sino que devuelven uno nuevo,
 * deshacer es volver al estado de antes: se guardan los estados, no las
 * operaciones inversas. Los bloques que no cambiaron son los mismos objetos
 * en los dos, así que guardar un estado cuesta lo que cambió, no el documento
 * entero.
 *
 * Las teclas seguidas se agrupan: mientras se escribe en el mismo bloque sin
 * parar más de medio segundo, todo es un solo paso. Deshacer se lleva una
 * frase, no una letra. Cualquier otra operación —Enter, un formato, un
 * atajo— es un paso propio.
 */

const AGRUPAR_MS = 500;
const TOPE = 200;

export function crearHistorial({ agruparMs = AGRUPAR_MS, tope = TOPE, reloj = () => Date.now() } = {}) {
  let atras = [];
  let adelante = [];

  return {
    /**
     * Anota un paso. `tipo` y `key` deciden si se suma al anterior: solo se
     * agrupan escrituras seguidas en el mismo bloque.
     */
    anotar({ antes, despues, focoAntes = null, focoDespues = null, tipo = 'otro', key = null }) {
      if (antes === despues) return;
      const ahora = reloj();
      const ultimo = atras[atras.length - 1];
      adelante = [];
      if (
        ultimo &&
        tipo === 'escribir' &&
        ultimo.tipo === 'escribir' &&
        ultimo.key === key &&
        ahora - ultimo.t < agruparMs
      ) {
        ultimo.despues = despues;
        ultimo.focoDespues = focoDespues;
        ultimo.t = ahora;
        return;
      }
      atras.push({ antes, despues, focoAntes, focoDespues, tipo, key, t: ahora });
      if (atras.length > tope) atras = atras.slice(-tope);
    },

    /** El estado al que volver, o null si no hay nada que deshacer. */
    deshacer() {
      const paso = atras.pop();
      if (!paso) return null;
      adelante.push(paso);
      return { estado: paso.antes, foco: paso.focoAntes };
    },

    rehacer() {
      const paso = adelante.pop();
      if (!paso) return null;
      atras.push({ ...paso, t: 0 });
      return { estado: paso.despues, foco: paso.focoDespues };
    },

    /** Corta el grupo actual: la próxima tecla empieza un paso nuevo. */
    cortar() {
      const ultimo = atras[atras.length - 1];
      if (ultimo) ultimo.t = 0;
    },

    get puedeDeshacer() {
      return atras.length > 0;
    },
    get puedeRehacer() {
      return adelante.length > 0;
    },

    limpiar() {
      atras = [];
      adelante = [];
    },
  };
}
