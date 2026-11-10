/**
 * La vista de un análisis profundo, armada con reglas fijas (Smart UI de posts).
 *
 * Del análisis de un post sale un programa de OpenUI Lang con las piezas del
 * catálogo de Vizta (`components/visual/catalogo.jsx`). Cada pieza entra solo
 * si el análisis trae con qué llenarla, y en un orden fijo: lo que dice, sus
 * cifras, quién aparece, cuándo, cómo se relacionan y en qué se apoya. Sin
 * modelos: el mismo análisis se ve siempre igual (decisión de PJ, 8-nov-2026).
 *
 * Lo que falta no se anuncia: una sección sin datos no aparece.
 */

const MAX_CIFRAS = 4;
const MAX_CITAS = 2;
const MAX_HECHOS = 5;
const MAX_ACTORES = 12; // personas y entidades
const MAX_HITOS = 8;
const MAX_RELACIONES = 6;
const MAX_FUENTES = 4;

const s = (t) => JSON.stringify(String(t ?? '').replace(/\s+/g, ' ').trim());
// Tal cual: lo que la pieza busca después en el análisis vivo (relaciones, ids).
const exacto = (t) => JSON.stringify(String(t ?? ''));
const limpio = (t) => (typeof t === 'string' ? t.replace(/\s+/g, ' ').trim() : '');

const palabras = (t) => new Set(String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]{3,}/g) || []);

/** ¿Dicen lo mismo? Si comparten casi todas sus palabras, una repite a la otra. */
export function repite(a, b) {
  const x = palabras(a);
  const y = palabras(b);
  if (!x.size || !y.size) return false;
  let comunes = 0;
  for (const w of x) if (y.has(w)) comunes += 1;
  return comunes / Math.min(x.size, y.size) >= 0.7;
}

/** Una cita de fuente que solo dice «según X» no es una cita. */
const citaQueAporta = (cita, nombre) => {
  const c = limpio(cita);
  if (c.length < 25) return false;
  return !/^seg[uú]n\b/i.test(c) && !repite(c, nombre);
};

/** La primera oración de un texto, para la bajada. */
export function primeraOracion(texto, max = 180) {
  const t = limpio(texto);
  if (!t) return '';
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  const o = m ? m[1] : t;
  return o.length > max ? `${o.slice(0, max - 1).trimEnd()}…` : o;
}

/** Una cifra legible: «7 segundos», «Q1,533 millones». */
function cifraDe(c) {
  if (!c || (c.numero == null && !c.valor)) return null;
  const valor = c.valor != null && String(c.valor).trim() ? String(c.valor) : String(c.numero);
  const etiqueta = limpio(c.variable) || limpio(c.hacia);
  if (!etiqueta) return null;
  const detalle = c.variable && c.hacia ? limpio(c.hacia) : '';
  return { valor: c.moneda ? `${c.moneda}${valor}` : valor, etiqueta, detalle };
}

/**
 * El programa OpenUI de un análisis, o `null` si no hay con qué armar una vista
 * (menos de dos secciones: ahí se queda la vista de siempre).
 */
export function programaDelAnalisis(analisis) {
  if (!analisis || typeof analisis !== 'object') return null;
  const lineas = [];
  const secciones = [];
  let n = 0;
  const nombre = (prefijo) => `${prefijo}${(n += 1)}`;
  const seccion = (titulo, contenido, icono) => {
    if (!contenido.length) return;
    const id = nombre('s');
    lineas.push(`${id} = Seccion(${s(titulo)}, [${contenido.join(', ')}], ${s(icono)})`);
    secciones.push(id);
  };

  const titulo = limpio(analisis.resumen) || primeraOracion(analisis.narrativa || analisis.contexto) || 'El análisis';

  // Lo que dice: citas literales con quién las dijo; si no hay, los hechos. Lo
  // que repite el título no se vuelve a decir.
  const hechos = (analisis.hechos || []).filter((h) => h && typeof h === 'object' && limpio(h.texto) && !repite(h.texto, titulo) && !repite(h.cita, titulo));
  const conCita = hechos.filter((h) => limpio(h.cita) && h.cita_en_texto !== false);
  const dice = [];
  // Cada hecho va como `Hecho` con su id: en la ficha del post se guarda en el
  // Codex desde ahí. Sin id, solo se lee.
  const pieza = (h, conLaCita) => {
    // `hablante` puede ser el id de una voz («v1»): eso no es un nombre.
    const quien = limpio(h.hablante?.nombre || (typeof h.hablante === 'string' && !/^v\d+$/i.test(h.hablante) ? h.hablante : ''));
    if (!h.id) return conLaCita ? (quien ? `Cita(${s(h.cita)}, ${s(quien)})` : `Cita(${s(h.cita)})`) : `Texto(${s(h.texto)})`;
    const args = [exacto(h.id), s(h.texto)];
    if (conLaCita) args.push(s(h.cita));
    if (conLaCita && quien) args.push(s(quien));
    return `Hecho(${args.join(', ')})`;
  };
  for (const h of conCita.slice(0, MAX_CITAS)) dice.push(pieza(h, true));
  const yaCitados = new Set(conCita.slice(0, MAX_CITAS).map((h) => h.id));
  for (const h of hechos.filter((x) => !yaCitados.has(x.id)).slice(0, MAX_HECHOS)) dice.push(pieza(h, false));
  seccion('Lo que dice', dice, 'cita');

  // Las cifras: de 2 a 4 en una fila; una sola va igual, como cifra.
  const cifras = (analisis.cantidades || []).map(cifraDe).filter(Boolean).slice(0, MAX_CIFRAS);
  if (cifras.length) {
    const fila = cifras.map((c) => (c.detalle ? `Cifra(${s(c.valor)}, ${s(c.etiqueta)}, ${s(c.detalle)})` : `Cifra(${s(c.valor)}, ${s(c.etiqueta)})`));
    seccion('Las cifras', [`Cifras([${fila.join(', ')}])`], 'cifras');
  }

  // Quién aparece: personas y entidades, estén o no en el Codex. Las que están
  // van con su id (cara y ficha); las que no, en la ficha del post se agregan.
  // Primero las centrales.
  const vistos = new Set();
  const personas = [];
  const menciones = [...(analisis.menciones || [])].sort((a, b) => (a?.rol === 'central' ? 0 : 1) - (b?.rol === 'central' ? 0 : 1));
  for (const m of menciones) {
    const tipo = m?.codex?.tipo || m?.tipo;
    const texto = typeof m?.texto === 'string' ? m.texto : '';
    if (!texto.trim() || !['Actor', 'Entidad'].includes(tipo)) continue;
    const clave = m.codex?.id || texto.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    personas.push(m.codex?.id ? `Persona(${exacto(texto)}, ${exacto(m.codex.id)}, ${s(tipo)})` : `Persona(${exacto(texto)})`);
  }
  if (personas.length) seccion('Quién aparece', [`Personas([${personas.slice(0, MAX_ACTORES).join(', ')}])`], 'actores');

  // Cuándo: solo hitos con fecha. Los tramos del video (segundos) no son una
  // cronología y no entran.
  const hitos = (analisis.linea_tiempo || [])
    .map((h) => (h && typeof h === 'object' ? { fecha: limpio(h.fecha || h.cuando), titulo: limpio(h.titulo || h.texto || h.evento) } : null))
    .filter((h) => h && h.fecha && h.titulo)
    .slice(0, MAX_HITOS);
  if (hitos.length) seccion('Cuándo', [`LineaDeTiempo([${hitos.map((h) => `Hito(${s(h.fecha)}, ${s(h.titulo)})`).join(', ')}])`], 'tiempo');

  // Cómo se relacionan: lo que el análisis vincula, en una línea cada cosa.
  const rels = (analisis.relaciones || []).filter((r) => r && limpio(r.a) && limpio(r.b) && limpio(r.verbo)).slice(0, MAX_RELACIONES);
  if (rels.length) seccion('Cómo se relacionan', rels.map((r) => `Relacion(${exacto(r.a)}, ${exacto(r.verbo)}, ${exacto(r.b)})`), 'relaciones');

  // En qué se apoya: las fuentes que cita el post.
  const fuentes = (analisis.fuentes || []).filter((f) => f && limpio(f.nombre)).slice(0, MAX_FUENTES);
  if (fuentes.length) {
    seccion('En qué se apoya', fuentes.map((f) => (citaQueAporta(f.cita, f.nombre) ? `Cita(${s(f.cita)}, ${s(f.nombre)})` : `Texto(${s(f.nombre)})`)), 'noticias');
  }

  if (secciones.length < 2) return null;
  const bajada = primeraOracion(analisis.narrativa || analisis.contexto);
  const raiz = bajada && bajada !== titulo
    ? `root = Vista(${s(titulo)}, [${secciones.join(', ')}], ${s(bajada)})`
    : `root = Vista(${s(titulo)}, [${secciones.join(', ')}])`;
  return [raiz, ...lineas].join('\n');
}
