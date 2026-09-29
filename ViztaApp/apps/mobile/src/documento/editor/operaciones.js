/**
 * Lo que se le puede hacer al documento mientras se escribe.
 *
 * Funciones puras: reciben el estado (`estado.js`) y devuelven uno nuevo, más
 * dónde tiene que quedar el cursor (`foco`) cuando la operación lo mueve. Si
 * no cambió nada, devuelven el mismo estado —el mismo objeto—, y así quien
 * escucha sabe que no hay nada que repintar ni que guardar.
 *
 * El comportamiento sigue a los editores de bloques que la gente ya conoce
 * (Craft, Notion, Notas): Enter parte el bloque, borrar al principio primero
 * quita el formato del bloque y después lo une al de arriba, Enter en una
 * viñeta vacía sale de la lista, y los atajos de markdown al principio de un
 * renglón («# », «- », «1. », «[] », «> ») cambian el tipo del bloque.
 */

import { nuevaClave, RESALTADO_AMARILLO } from '../esquema.js';
import { desdeMarkdown } from '../desdeMarkdown.js';
import { leerEnLinea } from '../enLinea.js';
import { anteriorVisible, conTexto, finDeRama } from './estado.js';
import {
  alternarMarca,
  cortar,
  defsUsadas,
  diferencia,
  marcasEn,
  normalizar,
  palabraEn,
  reemplazar,
  textoDe,
  unirDefs,
} from './spans.js';

// ── Tipos de bloque ─────────────────────────────────────────────────────────

/**
 * El tipo de un bloque tal como lo piensa quien escribe: «viñeta», «título»,
 * «to-do». En el documento eso se reparte entre `_type`, `style` y
 * `listItem`; acá se junta en un solo nombre.
 */
export function tipoDe(b) {
  if (!b) return null;
  if (b._type === 'toggle' || b._type === 'todo') return b._type;
  if (b._type !== 'block') return b._type;
  return b.listItem || b.style || 'normal';
}

export const TIPOS_DE_TEXTO = ['normal', 'h1', 'h2', 'h3', 'cita', 'bullet', 'number', 'todo', 'toggle'];

/** El mismo bloque, con otro tipo. Conserva la clave, el texto y el formato. */
export function conTipo(b, tipo) {
  const { _key, children, markDefs = [] } = b;
  const nivel = b.level || 1;
  switch (tipo) {
    case 'todo':
      return { _type: 'todo', _key, hecho: b._type === 'todo' ? b.hecho : false, level: nivel, children, markDefs };
    case 'toggle':
      return { _type: 'toggle', _key, abierto: b._type === 'toggle' ? b.abierto : true, children, markDefs };
    case 'bullet':
    case 'number': {
      const nuevo = { _type: 'block', _key, style: 'normal', listItem: tipo, level: nivel, children, markDefs };
      if (tipo === 'number' && Number.isInteger(b.numero)) nuevo.numero = b.numero;
      return nuevo;
    }
    default:
      return { _type: 'block', _key, style: tipo, children, markDefs };
  }
}

/** ¿Es de los que se «deshacen» antes de unirse con el de arriba? */
const conFormatoDeBloque = (b) => tipoDe(b) !== 'normal';

// ── Utilidades de estado ────────────────────────────────────────────────────

const conBloque = (estado, b) => ({ ...estado, porKey: { ...estado.porKey, [b._key]: b } });

/**
 * Poner un bloque con otro tipo. Si era un toggle y deja de serlo, sus hijos
 * no se pierden: quedan donde estaban, colgando del padre del toggle. Solo
 * un toggle puede tener hijos, y al volver a anidar para guardar, los hijos
 * de cualquier otro bloque desaparecerían.
 */
function reemplazarBloque(estado, b) {
  let siguiente = conBloque(estado, b);
  if (estado.porKey[b._key]?._type === 'toggle' && b._type !== 'toggle') {
    const padre = { ...siguiente.padre };
    for (const k of Object.keys(padre)) if (padre[k] === b._key) padre[k] = siguiente.padre[b._key] ?? null;
    siguiente = { ...siguiente, padre };
  }
  return siguiente;
}

function insertarDespues(estado, despuesDe, b, padre) {
  // Después del bloque **y de todo lo que cuelga de él**: un bloque nuevo
  // después de un toggle abierto va después de sus hijos, no entre ellos.
  const i = despuesDe === null ? 0 : finDeRama(estado, despuesDe);
  const orden = [...estado.orden.slice(0, i), b._key, ...estado.orden.slice(i)];
  return {
    ...estado,
    orden,
    porKey: { ...estado.porKey, [b._key]: b },
    padre: { ...estado.padre, [b._key]: padre ?? null },
  };
}

function insertarAntes(estado, antesDe, b) {
  const i = estado.orden.indexOf(antesDe);
  const orden = [...estado.orden.slice(0, i), b._key, ...estado.orden.slice(i)];
  return {
    ...estado,
    orden,
    porKey: { ...estado.porKey, [b._key]: b },
    padre: { ...estado.padre, [b._key]: estado.padre[antesDe] ?? null },
  };
}

function quitar(estado, key) {
  const porKey = { ...estado.porKey };
  const padre = { ...estado.padre };
  const suPadre = padre[key] ?? null;
  delete porKey[key];
  delete padre[key];
  // Lo que colgaba de él no se pierde: pasa a colgar de su padre.
  for (const k of Object.keys(padre)) if (padre[k] === key) padre[k] = suPadre;
  return { ...estado, orden: estado.orden.filter((k) => k !== key), porKey, padre };
}

const texto = (estado, key) => textoDe(estado.porKey[key]?.children);

// ── Escribir ────────────────────────────────────────────────────────────────

/**
 * Los atajos de markdown: escritos al principio de un párrafo y seguidos de
 * un espacio, cambian el tipo del bloque y desaparecen. Es lo que los que
 * escriben markdown hacen de memoria, y así la nota nueva los entiende sin
 * mostrar los signos.
 */
const ATAJOS = [
  [/^###$/, 'h3'],
  [/^##$/, 'h2'],
  [/^#$/, 'h1'],
  [/^[-*+]$/, 'bullet'],
  [/^\d{1,9}[.)]$/, 'number'],
  [/^\[ ?\]$/, 'todo'],
  [/^\[[xX]\]$/, 'todo'],
  [/^>>$/, 'toggle'],
  [/^>$/, 'cita'],
];

function atajo(b, antes) {
  // Solo en párrafos: en una viñeta, «- » al principio es texto.
  if (tipoDe(b) !== 'normal') return null;
  for (const [re, tipo] of ATAJOS) if (re.test(antes)) return tipo;
  return null;
}

/**
 * Lo que tipeó la persona: el texto nuevo entero del bloque, como lo avisa el
 * `TextInput`.
 *
 * @param sel La selección **antes** del cambio: desempata dónde fue la tecla.
 */
export function escribir(estado, key, nuevo, sel, { clave = nuevaClave } = {}) {
  const b = estado.porKey[key];
  if (!conTexto(b)) return { estado };
  const viejo = textoDe(b.children);
  if (viejo === nuevo) return { estado };

  const d = diferencia(viejo, nuevo, sel?.start);

  // Un salto de renglón adentro de lo nuevo es Enter o un pegado de varios
  // renglones. En los dos casos el bloque se parte.
  if (d.insertado.includes('\n')) return pegar(estado, key, d.desde, d.hasta, d.insertado, { clave });

  // Lo pegado en un renglón que trae marcas de markdown se lee como formato:
  // pegar «**hola**» da «hola» en negrita, no los asteriscos.
  let insertado = d.insertado;
  let defs = b.markDefs || [];
  if (insertado.length > 1 && /[*_=`~[]/.test(insertado)) {
    const leido = leerEnLinea(insertado, { clave });
    if (textoDe(leido.children) !== insertado) {
      insertado = leido.children;
      defs = unirDefs(defs, leido.markDefs);
    }
  }

  let marcas;
  const p = estado.pendiente;
  if (p && p.key === key && p.pos === d.desde && typeof insertado === 'string') {
    const base = marcasEn(b.children, d.desde, defs);
    marcas = [...base.filter((m) => !p.quitar.includes(m)), ...p.agregar.filter((m) => !base.includes(m))];
  }

  let children = reemplazar(b.children, d.desde, d.hasta, insertado, { marcas, markDefs: defs, clave });
  let nuevoBloque = { ...b, children, markDefs: defs };
  let foco = null;

  // ¿Se acaba de escribir un atajo? Solo si lo que entró fue el espacio que
  // lo cierra y quedó todo al principio del bloque.
  if (d.insertado === ' ' && d.hasta === d.desde) {
    const escrito = textoDe(children);
    const antes = escrito.slice(0, d.desde);
    const tipo = atajo(b, antes);
    if (tipo) {
      children = reemplazar(children, 0, d.desde + 1, '', { clave });
      nuevoBloque = conTipo({ ...b, children, markDefs: defs }, tipo);
      if (tipo === 'todo' && /x/i.test(antes)) nuevoBloque.hecho = true;
      if (tipo === 'number' && !/^1[.)]$/.test(antes)) nuevoBloque.numero = Number(antes.replace(/\D/g, ''));
      foco = { key, pos: 0 };
    }
  }

  nuevoBloque.markDefs = defsUsadas(nuevoBloque.children, unirDefs(nuevoBloque.markDefs, marcasResaltado(nuevoBloque)));
  const siguiente = conBloque(estado, nuevoBloque);
  return { estado: { ...siguiente, pendiente: null }, foco };
}

/** Si los spans usan el resaltado amarillo, su definición tiene que estar. */
const marcasResaltado = (b) =>
  (b.children || []).some((s) => (s.marks || []).includes(RESALTADO_AMARILLO._key)) ? [{ ...RESALTADO_AMARILLO }] : [];

/** Reemplazar un rango del texto de un bloque. Lo usa el autocompletado. */
export function reemplazarRango(estado, key, desde, hasta, nuevoTexto, { clave = nuevaClave } = {}) {
  const b = estado.porKey[key];
  if (!conTexto(b)) return { estado };
  const children = reemplazar(b.children, desde, hasta, nuevoTexto, { markDefs: b.markDefs, clave });
  return {
    estado: { ...conBloque(estado, { ...b, children }), pendiente: null },
    foco: { key, pos: desde + nuevoTexto.length },
  };
}

// ── Enter ───────────────────────────────────────────────────────────────────

/** El bloque que sigue a uno partido: mismo tipo si es lista, párrafo si es título. */
function tipoQueSigue(b) {
  const t = tipoDe(b);
  if (['bullet', 'number', 'todo', 'cita'].includes(t)) return t;
  return 'normal';
}

function bloqueNuevo(tipo, children, markDefs, base, clave) {
  const b = conTipo({ _key: clave(), children, markDefs, level: base?.level }, tipo);
  if (b._type === 'todo') b.hecho = false;
  delete b.numero;
  return b;
}

/**
 * Enter en `[desde, hasta)`: lo seleccionado se borra y el bloque se parte.
 */
export function partir(estado, key, desde, hasta = desde, { clave = nuevaClave } = {}) {
  let b = estado.porKey[key];
  if (!conTexto(b)) return { estado };
  if (hasta > desde) {
    b = { ...b, children: reemplazar(b.children, desde, hasta, '', { clave }) };
    estado = conBloque(estado, b);
  }
  const t = tipoDe(b);
  const vacio = !textoDe(b.children);

  // Enter en una viñeta, to-do o cita vacía: se sale. Si estaba sangrada,
  // primero sube un nivel.
  if (vacio && ['bullet', 'number', 'todo', 'cita'].includes(t)) {
    const nivel = b.level || 1;
    const salida = nivel > 1 && t !== 'cita' ? { ...b, level: nivel - 1 } : conTipo(b, 'normal');
    return { estado: { ...conBloque(estado, salida), pendiente: null }, foco: { key, pos: 0 } };
  }

  // Enter en un párrafo vacío adentro de un toggle: sale del toggle.
  const padre = estado.padre[key] ?? null;
  if (vacio && t === 'normal' && padre) {
    const sinEl = quitar(estado, key);
    const afuera = insertarDespues(sinEl, padre, b, sinEl.padre[padre] ?? null);
    return { estado: { ...afuera, pendiente: null }, foco: { key, pos: 0 } };
  }

  // Al principio de un bloque con texto: se abre uno vacío arriba y el
  // cursor se queda donde estaba. Es cómo se hace lugar arriba de un título.
  if (desde === 0 && !vacio) {
    const arriba = bloqueNuevo(t === 'toggle' ? 'normal' : tipoQueSigue(b), [], [], b, clave);
    arriba.children = normalizar([], clave);
    return { estado: { ...insertarAntes(estado, key, arriba), pendiente: null }, foco: { key, pos: 0 } };
  }

  const [izq, der] = cortar(b.children, desde, clave);
  const actual = { ...b, children: normalizar(izq, clave), markDefs: defsUsadas(izq, b.markDefs) };
  const defsDer = defsUsadas(der, b.markDefs);

  // Enter en el título de un toggle abierto: el renglón nuevo es su primer hijo.
  if (t === 'toggle' && b.abierto !== false) {
    const hijo = bloqueNuevo('normal', normalizar(der, clave), defsDer, b, clave);
    let siguiente = conBloque(estado, actual);
    const i = siguiente.orden.indexOf(key) + 1;
    siguiente = {
      ...siguiente,
      orden: [...siguiente.orden.slice(0, i), hijo._key, ...siguiente.orden.slice(i)],
      porKey: { ...siguiente.porKey, [hijo._key]: hijo },
      padre: { ...siguiente.padre, [hijo._key]: key },
    };
    return { estado: { ...siguiente, pendiente: null }, foco: { key: hijo._key, pos: 0 } };
  }

  const nuevo = bloqueNuevo(tipoQueSigue(b), normalizar(der, clave), defsDer, b, clave);
  const siguiente = insertarDespues(conBloque(estado, actual), key, nuevo, padre);
  return { estado: { ...siguiente, pendiente: null }, foco: { key: nuevo._key, pos: 0 } };
}

// ── Borrar al principio ─────────────────────────────────────────────────────

/**
 * Borrar con el cursor al principio de un bloque.
 *
 * Primero se le quita el formato de bloque —una viñeta vuelve a párrafo, un
 * título a texto—; recién el segundo borrar lo une al de arriba. Es lo que
 * evita que un borrar de más se lleve el renglón entero pegado al anterior.
 */
export function borrarAlInicio(estado, key, { clave = nuevaClave } = {}) {
  const b = estado.porKey[key];
  if (!b) return { estado };

  if (conTexto(b) && conFormatoDeBloque(b)) {
    const t = tipoDe(b);
    const nivel = b.level || 1;
    const nuevo = (t === 'bullet' || t === 'number' || t === 'todo') && nivel > 1 ? { ...b, level: nivel - 1 } : conTipo(b, 'normal');
    return { estado: { ...reemplazarBloque(estado, nuevo), pendiente: null }, foco: { key, pos: 0 } };
  }

  const prev = anteriorVisible(estado, key);
  if (!prev) return { estado };
  const p = estado.porKey[prev];

  // Arriba hay algo que no es texto. Un separador se borra; lo demás (una
  // tabla, un código, un medio) no se lleva puesto por un borrar de más.
  if (!conTexto(p)) {
    if (p._type === 'separador') return { estado: { ...quitar(estado, prev), pendiente: null }, foco: { key, pos: 0 } };
    if (!texto(estado, key)) return { estado: { ...quitar(estado, key), pendiente: null }, foco: null };
    return { estado };
  }

  const largo = textoDe(p.children);
  const unido = {
    ...p,
    children: normalizar([...p.children, ...(b.children || [])], clave),
    markDefs: unirDefs(p.markDefs, b.markDefs),
  };
  const siguiente = quitar(conBloque(estado, unido), key);
  return { estado: { ...siguiente, pendiente: null }, foco: { key: prev, pos: largo.length } };
}

// ── Pegar ───────────────────────────────────────────────────────────────────

/**
 * Pegar varios renglones: se leen como markdown y se vuelven bloques.
 *
 * El primer renglón se suma al bloque donde está el cursor y el último se
 * junta con lo que había después del cursor, como en cualquier editor. Un
 * Enter solo es el caso más chico: un renglón vacío de cada lado.
 */
export function pegar(estado, key, desde, hasta, pegado, { clave = nuevaClave } = {}) {
  if (pegado === '\n') return partir(estado, key, desde, hasta, { clave });
  const b = estado.porKey[key];
  if (!conTexto(b)) return { estado };

  const leidos = desdeMarkdown(pegado, { clave }).paginas[0].bloques;
  const [izq] = cortar(b.children, desde, clave);
  const [, der] = cortar(b.children, hasta, clave);
  const padre = estado.padre[key] ?? null;

  const primero = leidos[0];
  const ultimo = leidos[leidos.length - 1];
  const medio = leidos.slice(1, -1);

  // El primero se suma al bloque actual. Si el actual estaba vacío, además
  // toma su tipo: pegar «# Título» en un renglón en blanco da un título.
  const actualVacio = !textoDe(izq) && !textoDe(der);
  let actual = { ...b };
  if (conTexto(primero)) {
    actual.children = normalizar([...izq, ...primero.children], clave);
    actual.markDefs = unirDefs(b.markDefs, primero.markDefs);
    if (actualVacio && tipoDe(primero) !== 'normal') actual = conTipo({ ...actual, level: primero.level }, tipoDe(primero));
  } else {
    actual.children = normalizar(izq, clave);
  }

  let siguiente = reemplazarBloque(estado, actual);
  let despuesDe = key;
  const agregar = (x) => {
    siguiente = insertarDespues(siguiente, despuesDe, x, padre);
    despuesDe = x._key;
  };
  if (!conTexto(primero)) agregar(primero);
  for (const x of medio) agregar(x);

  let foco;
  if (leidos.length > 1 && conTexto(ultimo)) {
    const pos = textoDe(ultimo.children).length;
    agregar({ ...ultimo, children: normalizar([...ultimo.children, ...der], clave), markDefs: unirDefs(ultimo.markDefs, b.markDefs) });
    foco = { key: ultimo._key, pos };
  } else {
    if (leidos.length > 1) agregar(ultimo);
    // Lo que había después del cursor sigue en un bloque propio.
    if (textoDe(der) || leidos.length > 1) {
      const resto = bloqueNuevo(tipoQueSigue(b), normalizar(der, clave), b.markDefs, b, clave);
      agregar(resto);
      foco = { key: resto._key, pos: 0 };
    } else {
      foco = { key, pos: textoDe(actual.children).length };
    }
  }

  return { estado: { ...siguiente, pendiente: null }, foco };
}

// ── Formato ─────────────────────────────────────────────────────────────────

/**
 * Cambiar el tipo del bloque. El mismo botón prende y apaga: pedir «título»
 * sobre un título lo devuelve a párrafo.
 */
export function ponerTipo(estado, key, tipo) {
  const b = estado.porKey[key];
  if (!conTexto(b)) return { estado };
  const final = tipoDe(b) === tipo ? 'normal' : tipo;
  return { estado: { ...reemplazarBloque(estado, conTipo(b, final)), pendiente: null } };
}

const MARCA_DE_ACCION = { negrita: 'strong', cursiva: 'em', codigo: 'code', tachado: 'strike', subrayado: 'underline' };

/**
 * Formato en línea sobre la selección. Las acciones son las de la barra de
 * hoy: `negrita`, `cursiva`, `resaltado`, `codigo` (y `tachado`,
 * `subrayado`).
 *
 * Con texto seleccionado se aplica a lo seleccionado. Parado en una palabra,
 * a la palabra entera, igual que la barra de hoy. En blanco queda
 * **pendiente**: lo próximo que se escriba sale con ese formato.
 */
export function marcar(estado, key, desde, hasta, accion, { clave = nuevaClave } = {}) {
  const b = estado.porKey[key];
  if (!conTexto(b)) return { estado };
  const marca = accion === 'resaltado' ? RESALTADO_AMARILLO._key : MARCA_DE_ACCION[accion];
  if (!marca) return { estado };

  let a = desde;
  let z = hasta;
  if (a === z) {
    const palabra = palabraEn(textoDe(b.children), a);
    if (!palabra) {
      const hay = marcasEn(b.children, a, b.markDefs).includes(marca);
      const previo = estado.pendiente?.key === key && estado.pendiente?.pos === a ? estado.pendiente : null;
      const agregar = new Set(previo?.agregar || []);
      const sacar = new Set(previo?.quitar || []);
      // Tocar dos veces el mismo botón en blanco lo apaga.
      if (agregar.has(marca)) agregar.delete(marca);
      else if (sacar.has(marca)) sacar.delete(marca);
      else if (hay) sacar.add(marca);
      else agregar.add(marca);
      return {
        estado: { ...estado, pendiente: { key, pos: a, agregar: [...agregar], quitar: [...sacar] } },
        foco: { key, pos: a },
      };
    }
    a = palabra.desde;
    z = palabra.hasta;
  }

  const children = alternarMarca(b.children, a, z, marca, clave);
  const markDefs = defsUsadas(children, unirDefs(b.markDefs, marca === RESALTADO_AMARILLO._key ? [{ ...RESALTADO_AMARILLO }] : []));
  return {
    estado: { ...conBloque(estado, { ...b, children, markDefs }), pendiente: null },
    foco: desde === hasta ? { key, pos: desde } : { key, pos: hasta, desde },
  };
}

/** Sangrar o desangrar una viñeta, numeración o to-do. */
export function sangrar(estado, key, delta) {
  const b = estado.porKey[key];
  const t = tipoDe(b);
  if (!['bullet', 'number', 'todo'].includes(t)) return { estado };
  const level = Math.max(1, Math.min(6, (b.level || 1) + delta));
  if (level === (b.level || 1)) return { estado };
  return { estado: conBloque(estado, { ...b, level }) };
}

export function alternarHecho(estado, key) {
  const b = estado.porKey[key];
  if (b?._type !== 'todo') return { estado };
  return { estado: conBloque(estado, { ...b, hecho: !b.hecho }) };
}

export function alternarAbierto(estado, key) {
  const b = estado.porKey[key];
  if (b?._type !== 'toggle') return { estado };
  return { estado: conBloque(estado, { ...b, abierto: b.abierto === false }) };
}

/** El texto de un bloque de código. No tiene spans: es texto literal. */
export function escribirCodigo(estado, key, nuevo) {
  const b = estado.porKey[key];
  if (b?._type !== 'codigo' || b.texto === nuevo) return { estado };
  return { estado: conBloque(estado, { ...b, texto: nuevo }) };
}
