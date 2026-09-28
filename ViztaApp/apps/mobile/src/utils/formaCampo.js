/**
 * ¿El valor guardado calza con el tipo que declara el campo?
 *
 * **Por qué existe.** Un campo puede decir que es un eje —una posición entre
 * dos polos, `{value: -40}`— y tener adentro la frase «Derecha / conservador».
 * La ficha lo muestra igual, porque mostrar es fácil; el editor, en cambio,
 * abre el control del tipo declarado y ese control no sabe qué hacer con una
 * frase. De ahí la sensación de que lectura y edición no se alinean: no es que
 * discrepen, es que el dato no es del tipo que dice ser. Hoy pasa en 287
 * valores, casi todos de importaciones y de campos que llenó la IA.
 *
 * Esto no corrige nada ni esconde nada: marca. La ficha pone un ícono en el
 * campo y la base guarda la bandera, para poder encontrarlos después y
 * arreglarlos con criterio en vez de descubrirlos de uno en uno.
 *
 * **Es un espejo del contrato del servidor** (`validateFieldValue`, contrato
 * 4.1). Si allá cambian las reglas, acá también: una copia que se atrasa marca
 * como malo lo que el servidor acepta, que es peor que no marcar nada.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SOLO_TEXTO = new Set(['texto', 'parrafo', 'hora', 'telefono', 'id']);
const REFERENCIAS = new Set(['ref', 'archivo', 'imagen']);

const objeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const soloClaves = (v, permitidas) => objeto(v) && Object.keys(v).every((k) => permitidas.includes(k));

/** Nombre legible de lo que el campo esperaba, para decirlo sin jerga. */
export const FORMA_ESPERADA = {
  fecha: 'una fecha',
  link: 'un enlace',
  email: 'un correo',
  numero: 'un número',
  porcentaje: 'un porcentaje',
  escala: 'un valor del 1 al 5',
  booleano: 'sí o no',
  dropdown: 'una de las opciones',
  tags: 'una lista de etiquetas',
  moneda: 'un monto con moneda',
  rango: 'un rango de fechas',
  eje: 'una posición entre dos polos',
  geo: 'unas coordenadas',
  repetible: 'una tabla',
  color: 'un color',
  ref: 'un vínculo a otra ficha',
  refs: 'vínculos a otras fichas',
  archivo: 'un archivo del Codex',
  imagen: 'una imagen del Codex',
};

/**
 * `true` si el valor calza con el tipo. Vacío siempre calza: un campo sin
 * llenar no es un campo mal llenado.
 */
export function formaValida(tipo, valor, config = {}) {
  if (valor === null || valor === undefined || valor === '') return true;
  if (!tipo || tipo === 'formula') return true;

  if (SOLO_TEXTO.has(tipo)) return typeof valor === 'string';
  if (tipo === 'fecha') return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor);
  if (tipo === 'link') return typeof valor === 'string' && /^https?:\/\//i.test(valor);
  if (tipo === 'email') return typeof valor === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
  if (tipo === 'color') return typeof valor === 'string' && /^#[0-9a-f]{6}$/i.test(valor);
  if (tipo === 'numero') return typeof valor === 'number' && Number.isFinite(valor);
  // Decimal 0..1, que es lo que guarda el editor (escribís 25 y guarda 0.25) y
  // lo que el MCP le indica al modelo. **El validador del servidor dice otra
  // cosa** —acepta 0..100— y por eso hay valores como 72 guardados donde debía
  // ir 0.72: la app los muestra como 7200%. Acá se sigue el convenio de la app,
  // que es el que decide cómo se ve el dato, para que esos casos se marquen.
  if (tipo === 'porcentaje') return typeof valor === 'number' && valor >= 0 && valor <= 1;
  if (tipo === 'escala') return Number.isInteger(valor) && valor >= 1 && valor <= 5;
  if (tipo === 'booleano') return typeof valor === 'boolean';
  // Un valor fuera de las opciones no se marca: el editor lo muestra igual,
  // como pastilla activa, y se puede cambiar por una opción. Marcarlo llenaba
  // de triángulos fichas correctas —«Guatemalteca» en Nacionalidad, «Activo»
  // en Estado— sin que hubiera nada roto.
  if (tipo === 'dropdown') return typeof valor === 'string';
  if (tipo === 'tags') return Array.isArray(valor) && valor.every((t) => typeof t === 'string' && t.trim());
  if (tipo === 'moneda') return soloClaves(valor, ['amount', 'cur']) && 'amount' in valor;
  if (tipo === 'rango') {
    return soloClaves(valor, ['from', 'to', 'gran']) && (typeof valor.from === 'string' || typeof valor.to === 'string');
  }
  if (tipo === 'eje') {
    // `poles` viaja en algunos datos viejos junto al valor; el contrato solo
    // acepta `value`, pero marcar por eso sería marcar un dato que sí sirve.
    return objeto(valor) && Number.isInteger(valor.value) && valor.value >= -100 && valor.value <= 100;
  }
  if (tipo === 'geo') {
    return (
      objeto(valor) &&
      Number.isFinite(valor.lat) &&
      Number.isFinite(valor.lng) &&
      Math.abs(valor.lat) <= 90 &&
      Math.abs(valor.lng) <= 180
    );
  }
  if (tipo === 'repetible') return objeto(valor) && Array.isArray(valor.rows);
  // Una imagen o un archivo guardados como enlace se ven y se abren igual.
  if ((tipo === 'imagen' || tipo === 'archivo') && typeof valor === 'string') return /^https?:\/\//i.test(valor);
  // Una referencia guardada como texto —«UNE» en Partido, típico de lo
  // importado— el editor la muestra como una pastilla sin vincular, que se
  // puede reemplazar por el item real. No está rota: le falta el enlace.
  const refValida = (r) => (objeto(r) && UUID.test(String(r.id || ''))) || (typeof r === 'string' && r.trim() !== '');
  if (REFERENCIAS.has(tipo)) return refValida(valor);
  if (tipo === 'refs') return (Array.isArray(valor) ? valor : [valor]).every(refValida);

  // Un tipo que este espejo no conoce no se marca: el servidor manda, y
  // marcar por ignorancia propia sería ruido.
  return true;
}

/** Qué decirle a quien mira el campo marcado. Una frase, sin jerga de tipos. */
export function avisoDeForma(tipo) {
  const esperado = FORMA_ESPERADA[tipo];
  return esperado
    ? `Este campo espera ${esperado}, y lo guardado no tiene esa forma.`
    : 'Lo guardado no tiene la forma que este campo espera.';
}

/**
 * El tipo de un campo que no tiene definición, deducido de lo que guarda.
 *
 * Un campo suelto —que no está en el catálogo, como `partido_potencial`— no
 * tiene dónde anotar su tipo. Si alguien lo edita como referencia y guarda un
 * vínculo, al volver a abrirlo la ficha no sabía qué era y lo trataba como
 * texto: un vínculo leído como texto se ve `[object Object]`. Mirando la forma
 * del valor se sabe qué es sin que nadie lo haya anotado.
 */
export function tipoPorForma(valor) {
  if (valor === null || valor === undefined) return 'texto';
  if (typeof valor === 'boolean') return 'booleano';
  if (typeof valor === 'number') return 'numero';
  if (typeof valor === 'string') return valor.length > 120 ? 'parrafo' : 'texto';
  if (Array.isArray(valor)) {
    if (valor.length && valor.every((r) => objeto(r) && UUID.test(String(r.id || '')))) return 'refs';
    if (valor.every((t) => typeof t === 'string')) return 'tags';
    return 'parrafo';
  }
  if (objeto(valor)) {
    if (UUID.test(String(valor.id || ''))) return 'ref';
    if (Number.isFinite(valor.lat) && Number.isFinite(valor.lng)) return 'geo';
    if ('from' in valor || 'to' in valor) return 'rango';
    if ('amount' in valor) return 'moneda';
    if (Number.isInteger(valor.value)) return 'eje';
    if (Array.isArray(valor.rows)) return 'repetible';
  }
  return 'parrafo';
}
