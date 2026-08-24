/**
 * URLs de los servicios de Pulse Journal.
 *
 * Estaban declaradas por duplicado dentro de `codex.jsx` y `orbit.jsx` — dos
 * archivos de ruta, que es el peor lugar para un dato que necesita cualquiera.
 * Acá quedan una sola vez para lo nuevo; los dos archivos viejos siguen con su
 * copia porque tocarlos no era parte de este trabajo.
 */
export const EXTRACTORW_URL =
  process.env.EXPO_PUBLIC_EXTRACTORW_URL || 'https://server.standatpd.com';

export const EXTRACTORT_URL =
  process.env.EXPO_PUBLIC_EXTRACTORT_URL || 'https://api.standatpd.com';
