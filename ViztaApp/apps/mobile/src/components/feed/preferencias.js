import { categoriaDe, normalizarTema, temaDe } from './temas';

/**
 * El feed de cada quien: qué temas van primero, cuáles no aparecen al abrir y
 * qué tipos de violencia no se quieren ver.
 *
 * Antes los chips arrancaban en «todo» en cada apertura, y quien no quería ver
 * violencia (una de cada cinco tarjetas a fines de octubre) tenía que quitarla
 * a mano cada vez. Esto lo deja dicho una sola vez; los chips siguen filtrando
 * adentro.
 *
 * La forma guardada es `{ temas: { [tema]: 'primero' | 'ocultar' }, violencia:
 * [clase] }`. «normal» no se guarda: es la ausencia.
 *
 * Dos alcances distintos, a propósito:
 *  · Un tema oculto sale del feed al abrir, pero su chip sigue (tenue) y
 *    tocarlo lo muestra esa vez. Nada queda escondido para siempre.
 *  · Un tipo de violencia oculto no aparece en ningún lado, tampoco desde el
 *    chip de Violencia: quien lo apagó es porque no lo quiere ver ni por
 *    accidente. Se vuelve a ver prendiéndolo en el ajuste.
 */

export const VACIAS = { temas: {}, violencia: [] };

export const ESTADOS = [
  { clave: 'primero', nombre: 'primero' },
  { clave: 'normal', nombre: 'normal' },
  { clave: 'ocultar', nombre: 'ocultar' },
];

/** Los temas del enum de `news_cards`, en el orden en que suelen pesar. */
export const TEMAS_DEL_FEED = ['Política', 'Justicia', 'Violencia', 'Economía', 'Movilidad', 'Clima', 'Deportes', 'Otros'];

/**
 * Los tipos de violencia que se pueden apagar, del catálogo v2 de ExtractorW.
 * El sticker es el mismo que lleva la tarjeta, para que se reconozca.
 */
export const CLASES_VIOLENCIA = [
  { clave: 'homicidios', nombre: 'Homicidios y ataques armados', sticker: 'violencia-homicidio' },
  { clave: 'linchamientos', nombre: 'Linchamientos', sticker: 'violencia-linchamiento' },
  { clave: 'mujeres_ninez', nombre: 'Violencia contra mujeres y niñez', sticker: 'violencia-mujer' },
  { clave: 'desapariciones', nombre: 'Secuestros y desapariciones', sticker: 'violencia-desaparicion' },
  { clave: 'extorsion', nombre: 'Extorsión y amenazas', sticker: 'violencia-extorsion' },
  { clave: 'robos', nombre: 'Robos y asaltos', sticker: 'violencia-alerta' },
  { clave: 'crimen_organizado', nombre: 'Crimen organizado', sticker: 'violencia-crimen-organizado' },
  { clave: 'estado', nombre: 'Uso de la fuerza por agentes del Estado', sticker: 'violencia-estado' },
  { clave: 'capturas', nombre: 'Capturas y operativos', sticker: 'violencia' },
  { clave: 'otros', nombre: 'Otros hechos violentos', sticker: 'violencia-urgente' },
];

const CLASE_POR_SUBCATEGORIA = {
  homicidios: 'homicidios',
  'violencia contra mujeres y ninez': 'mujeres_ninez',
  'secuestros y desapariciones': 'desapariciones',
  'secuestro y desapariciones': 'desapariciones',
  'extorsion y amenazas': 'extorsion',
  'robos y asaltos': 'robos',
  'crimen organizado': 'crimen_organizado',
  'uso de la fuerza por agentes del estado': 'estado',
  'capturas y operativos': 'capturas',
};

/** El tipo de violencia de una tarjeta; el linchamiento manda sobre su subcategoría. */
export function claseViolencia(card) {
  if (normalizarTema(card?.subtipo) === 'linchamiento') return 'linchamientos';
  return CLASE_POR_SUBCATEGORIA[normalizarTema(card?.subcategoria)] || 'otros';
}

/** Lo que llegue (de la cuenta o del teléfono) a la forma conocida, sin claves sueltas. */
export function limpiar(prefs) {
  const temas = {};
  for (const [tema, estado] of Object.entries(prefs?.temas || {})) {
    if (estado === 'primero' || estado === 'ocultar') temas[tema] = estado;
  }
  const validas = new Set(CLASES_VIOLENCIA.map((c) => c.clave));
  const violencia = [...new Set((prefs?.violencia || []).filter((c) => validas.has(c)))].sort();
  return { temas, violencia };
}

export function estadoDe(prefs, tema) {
  return prefs?.temas?.[tema] || 'normal';
}

export function personalizado(prefs) {
  return Object.keys(prefs?.temas || {}).length > 0 || (prefs?.violencia || []).length > 0;
}

export function conEstado(prefs, tema, estado) {
  const temas = { ...(prefs?.temas || {}) };
  if (estado === 'normal') delete temas[tema];
  else temas[tema] = estado;
  return limpiar({ ...prefs, temas });
}

export function conClase(prefs, clase, visible) {
  const resto = (prefs?.violencia || []).filter((c) => c !== clase);
  return limpiar({ ...prefs, violencia: visible ? resto : [...resto, clase] });
}

/** ¿La tarjeta es de un tipo de violencia apagado? Esas no salen nunca. */
function vetada(card, prefs) {
  if (!(prefs?.violencia || []).length) return false;
  if (temaDe(categoriaDe(card)) !== 'Violencia') return false;
  return prefs.violencia.includes(claseViolencia(card));
}

/**
 * Las tarjetas que se ven con el chip elegido.
 *
 * Con «todo» es el feed de la persona: sin sus temas ocultos y con los suyos
 * primero dentro de cada día (el orden de días y de peso que trae la consulta
 * no se toca). Con un tema, solo ese, aunque esté oculto.
 */
export function noticiasDelFeed(cards = [], prefs = VACIAS, elegido = 'todo', diaDe = () => 0) {
  const permitidas = cards.filter((c) => !vetada(c, prefs));
  if (elegido !== 'todo') return permitidas.filter((c) => temaDe(categoriaDe(c)) === elegido);
  const base = permitidas.filter((c) => estadoDe(prefs, temaDe(categoriaDe(c))) !== 'ocultar');
  const primero = (c) => (estadoDe(prefs, temaDe(categoriaDe(c))) === 'primero' ? 0 : 1);
  // Orden estable a mano: solo se adelantan las de «primero» dentro de su día.
  const orden = new Map(base.map((c, i) => [c, i]));
  const posDia = new Map();
  for (const c of base) if (!posDia.has(diaDe(c))) posDia.set(diaDe(c), posDia.size);
  return [...base].sort((a, b) => posDia.get(diaDe(a)) - posDia.get(diaDe(b)) || primero(a) - primero(b) || orden.get(a) - orden.get(b));
}

/**
 * Los chips: «tu feed» (o «todo» si no hay nada ajustado), después los temas
 * de la persona —los de «primero» adelante— y al final los ocultos, tenues.
 * Las cuentas ya descuentan los tipos de violencia apagados.
 */
export function chipsDelFeed(cards = [], prefs = VACIAS) {
  const permitidas = cards.filter((c) => !vetada(c, prefs));
  const cuentas = new Map();
  for (const c of permitidas) {
    const tema = temaDe(categoriaDe(c));
    cuentas.set(tema, (cuentas.get(tema) || 0) + 1);
  }
  const rango = (tema) => ({ primero: 0, normal: 1, ocultar: 2 })[estadoDe(prefs, tema)];
  const temas = [...cuentas]
    .sort((a, b) => rango(a[0]) - rango(b[0]) || b[1] - a[1])
    .map(([clave, cuenta]) => ({ clave, nombre: clave, cuenta, tenue: estadoDe(prefs, clave) === 'ocultar' }));
  const enTuFeed = temas.filter((t) => !t.tenue).reduce((n, t) => n + t.cuenta, 0);
  return [{ clave: 'todo', nombre: personalizado(prefs) ? 'tu feed' : 'todo', cuenta: enTuFeed }, ...temas];
}

/** Los temas que se ofrecen en el ajuste: los del enum y cualquier otro que haya llegado. */
export function temasAjustables(cards = [], prefs = VACIAS) {
  const extra = new Set([...cards.map((c) => temaDe(categoriaDe(c))), ...Object.keys(prefs?.temas || {})]);
  return [...TEMAS_DEL_FEED, ...[...extra].filter((t) => !TEMAS_DEL_FEED.includes(t)).sort()];
}
