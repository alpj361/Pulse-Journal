/**
 * Cómo avanzó una historia: la línea de tiempo que vive dentro de la card.
 *
 * Desde la corrida de las 6:00 AM GT del 18-oct-2026, ExtractorW junta cada
 * historia en una sola card y lo nuevo entra en `cards[].desarrollos` (más
 * reciente primero). Las cards anteriores a esa corrida no traen el campo, o
 * lo traen vacío: este módulo es lo único que lo lee, para que un acceso
 * directo en la vista no tire la card del feed.
 *
 * Lo que **no** se lee acá —a propósito—:
 *  · `historia_id`, `source_ids`, `ids_fundidos`, códigos de `tipo`:
 *    son detalles de sistema. Quien lee la ficha no los necesita.
 *  · `historia_relacionada`: otra historia, otro momento. Se ignora.
 */

/** Cuántas entradas se ven antes de «ver más». */
export const VISIBLE_INICIAL = 4;

const lista = (v) => (Array.isArray(v) ? v : []);

/**
 * Solo http y https. `javascript:`, `ftp:`, `data:` y lo que no es URL
 * se descartan: el medio se sigue mostrando, pero no como enlace.
 */
export function urlHttp(url) {
  if (typeof url !== 'string') return null;
  const t = url.trim();
  if (!/^https?:\/\/[^\s<>]+$/i.test(t)) return null;
  return t;
}

/**
 * La hora de Guatemala, leída del string ISO.
 *
 * El contrato manda `ts` con offset fijo `-06:00` —p. ej.
 * `2026-10-17T20:33:50-06:00`— así que la hora ya viene en Guatemala. Se
 * toma `HH:MM` del string; no se convierte con `Date` ni con `Intl`, que
 * devolverían la hora del teléfono.
 *
 * Formato: `8:33 p. m.`. Vacío o ilegible → `null`, y la fila se dibuja
 * sin hora en vez de inventar un `Invalid Date`.
 */
export function horaGT(ts) {
  if (typeof ts !== 'string' || !ts) return null;
  const m = ts.match(/T(\d{2}):(\d{2})/);
  if (!m) return null;
  const hora24 = Number(m[1]);
  if (!Number.isInteger(hora24) || hora24 < 0 || hora24 > 23) return null;
  const minutos = m[2];
  const periodo = hora24 < 12 ? 'a. m.' : 'p. m.';
  const hora12 = hora24 % 12 === 0 ? 12 : hora24 % 12;
  return `${hora12}:${minutos} ${periodo}`;
}

function milis(ts) {
  if (typeof ts !== 'string' || !ts) return 0;
  const n = Date.parse(ts);
  return Number.isFinite(n) ? n : 0;
}

function limpiaTexto(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function limpiaLista(v) {
  return lista(v)
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean);
}

function normalizar(entrada) {
  if (!entrada || typeof entrada !== 'object') return null;
  const texto = limpiaTexto(entrada.texto);
  if (!texto) return null;

  const fuentes = limpiaLista(entrada.fuentes);
  const fuente = limpiaTexto(entrada.fuente) || fuentes[0] || null;
  const detalle = limpiaTexto(entrada.detalle) || null;
  const correccion = limpiaTexto(entrada.correccion) || null;
  const tipo =
    entrada.tipo === 'reacciones' || entrada.tipo === 'hecho_base' || entrada.tipo === 'desarrollo'
      ? entrada.tipo
      : null;

  return {
    id: entrada.id != null ? String(entrada.id) : null,
    ts: typeof entrada.ts === 'string' ? entrada.ts : null,
    tipo,
    texto,
    detalle,
    fuente,
    url: urlHttp(entrada.url),
    corregido: entrada.corregido === true,
    correccion,
    actores: limpiaLista(entrada.actores),
  };
}

/**
 * Los desarrollos de una card, listos para pintar.
 *
 * Devuelve `[]` si el campo falta, no es array, o ninguna entrada tiene
 * texto. Ordena del más nuevo al más viejo aunque el origen ya venga así:
 * una card mal armada no puede invertir la línea de tiempo.
 *
 * No muta el array original.
 */
export function desarrollosDe(card) {
  const crudos = card?.desarrollos;
  if (!Array.isArray(crudos)) return [];
  const limpios = crudos.map(normalizar).filter(Boolean);
  return limpios.sort((a, b) => milis(b.ts) - milis(a.ts));
}

/**
 * El cuerpo de una fila: en `reacciones`, los actores; si no, el texto.
 *
 * Las reacciones llegan como una sola entrada. Listar quiénes hablaron es
 * lo que esa fila aporta; el `tipo` no se escribe — es un código interno.
 */
export function cuerpoDe(entrada) {
  if (!entrada) return null;
  if (entrada.tipo === 'reacciones' && entrada.actores.length) {
    return entrada.actores.join(', ');
  }
  return entrada.texto || null;
}

/**
 * La entrada más nueva es el titular. Repetirlo debajo no informa nada.
 *
 * Solo se oculta el texto de la primera fila, y solo si coincide con el
 * titular. El `detalle`, la corrección y el medio sí se quedan.
 */
export function ocultaTextoPorTitular(entrada, titulo, index) {
  if (index !== 0 || !entrada) return false;
  if (entrada.tipo === 'reacciones') return false;
  const t = limpiaTexto(titulo);
  return !!t && entrada.texto === t;
}

/**
 * Una fila de la línea de tiempo: qué se ve, sin códigos internos.
 */
export function filaDe(entrada, card, index) {
  if (!entrada) return null;
  const ocultar = ocultaTextoPorTitular(entrada, card?.titulo, index);
  return {
    hora: horaGT(entrada.ts),
    texto: ocultar ? null : cuerpoDe(entrada),
    medio: entrada.fuente,
    url: entrada.url,
    detalle: entrada.detalle,
    corregido: entrada.corregido,
    correccion: entrada.correccion,
  };
}

/**
 * `{n} medios`, una sola vez arriba de la línea de tiempo.
 *
 * `fuentes.independientes` ya es el conteo de casas distintas. Si no viene
 * o no es un número, no se escribe: un `0 medios` o un `NaN` no le sirve
 * a nadie.
 */
export function etiquetaMedios(card) {
  const n = card?.fuentes?.independientes;
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n} medios`;
}

/**
 * La línea discreta del feed: `actualizada 8:33 p. m.`.
 *
 * Solo si la card trae desarrollos. Sin ellos, la card se ve exactamente
 * como hoy: no hay hueco ni «actualizada» huérfano. Si falta
 * `ultima_actualizacion`, se usa la hora del desarrollo más nuevo.
 */
export function lineaActualizada(card) {
  const listaDev = desarrollosDe(card);
  if (!listaDev.length) return null;
  const ts =
    typeof card?.ultima_actualizacion === 'string' && card.ultima_actualizacion
      ? card.ultima_actualizacion
      : listaDev[0].ts;
  const hora = horaGT(ts);
  if (!hora) return null;
  return `actualizada ${hora}`;
}
