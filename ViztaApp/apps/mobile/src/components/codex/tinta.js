import { TYPE_ACCENT, normalizeTipo } from './tipos';

/** El color de una mención: el de su tipo en toda la app. */
export function colorDe(item) {
  return TYPE_ACCENT[normalizeTipo(item?.tipo)] || '#4B4FA6';
}

/**
 * El color de una mención con cierta presencia, mezclado con la tinta del
 * texto y no con transparencia: mientras entra, el nombre pasa del negro del
 * resto de la nota a su color, sin verse nunca más claro que las palabras de
 * al lado.
 */
export function tinta(hex, presencia) {
  const p = Math.max(0, Math.min(1, presencia));
  const a = [0x1c, 0x2b, 0x22]; // INK.title
  const b = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
  const c = a.map((x, k) => Math.round(x + (b[k] - x) * p));
  return `#${c.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}
