/**
 * Las piezas de un análisis, cada una con una sola sección dueña.
 *
 * El análisis llega por secciones que se pisan: la misma cifra está en
 * `cantidades` y otra vez contada como hecho; la misma cita sostiene un hecho y
 * una fuente; la misma persona está en las menciones, en las voces y en las
 * relaciones. Acá se cruza todo una vez y se decide dónde vive cada cosa:
 *
 *  · un número vive en **cifras** — el hecho que lo cuenta se va con él;
 *  · una afirmación sin número vive en **hechos**;
 *  · una persona u organización vive en **quién aparece**, con su voz y sus
 *    relaciones;
 *  · a quién se cita vive en **en qué se apoya**.
 *
 * En las demás secciones la pieza se nombra con una referencia, sin repetir el
 * texto ni la cita.
 *
 * Los cruces son solo los que se pueden leer en el texto: la misma cita, el
 * mismo número, el mismo nombre. Nada se une por parecido de sentido: una
 * referencia mal puesta diría que el post apoya una cosa en otra que no dijo.
 */

const PARADA = new Set(['para', 'como', 'entre', 'sobre', 'desde', 'hasta', 'este', 'esta', 'esto', 'pero', 'cada', 'todo', 'toda', 'todos', 'tiene', 'tienen', 'está', 'están', 'será', 'según', 'donde', 'cuando', 'porque', 'también', 'millones', 'ciento']);

export const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9%\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const palabras = (s) => norm(s).split(' ').filter((p) => p.length >= 4 && !PARADA.has(p));

const numeros = (s) => (String(s || '').match(/\d[\d.,]*\d|\d/g) || []).map((n) => n.replace(/[.,]/g, ''));

/** La misma cita, o una dentro de la otra. */
function mismaCita(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (x.length < 12 || y.length < 12) return false;
  return x.includes(y) || y.includes(x);
}

/** Cuánto de las palabras de `a` está en `b`, de 0 a 1. */
function cubre(a, b) {
  const pa = palabras(a);
  if (!pa.length) return 0;
  const pb = new Set(palabras(b));
  return pa.filter((p) => pb.has(p)).length / pa.length;
}

/** El hecho cuenta esta cifra: comparten la cita, o el número y de qué es. */
function cuentaLaCifra(hecho, cifra) {
  if (cifra.cita && hecho.cita && mismaCita(cifra.cita, hecho.cita)) return true;
  const enHecho = new Set(numeros(`${hecho.texto} ${hecho.cita || ''}`));
  const delValor = numeros(cifra.valor);
  if (!delValor.length || !delValor.some((n) => enHecho.has(n))) return false;
  const deQue = `${cifra.variable || cifra.que_representa || ''} ${cifra.hacia || ''}`;
  return cubre(deQue, `${hecho.texto} ${hecho.cita || ''}`) >= 0.5;
}

const nombra = (texto, nombre) => {
  const n = norm(nombre);
  return n.length >= 3 && ` ${norm(texto)} `.includes(` ${n} `);
};

const mismoNombre = (a, b) => {
  const x = norm(a);
  const y = norm(b);
  if (x.length < 4 || y.length < 4) return false;
  return x === y || ` ${x} `.includes(` ${y} `) || ` ${y} `.includes(` ${x} `);
};

/** Las primeras palabras de una frase, para nombrarla en una referencia. */
export function corta(texto, n = 4) {
  const p = String(texto || '').trim().split(/\s+/);
  return p.length <= n ? p.join(' ') : `${p.slice(0, n).join(' ').replace(/[,;:.]$/, '')}…`;
}

const ESCALA = [
  [/\bbillon(es)?\b/, 1e12],
  [/\bmil millones\b/, 1e9],
  [/\bmillon(es)?\b/, 1e6],
  [/\bmil\b/, 1e3],
];

/** El número de una cifra y en qué se mide: «Q240 millones» → 240e6, «q». */
function medida(c) {
  const v = norm(c.valor);
  const m = String(c.valor || '').match(/\d[\d.,]*\d|\d/);
  if (!m) return null;
  let n = typeof c.numero === 'number' ? c.numero : parseFloat(m[0].replace(/,(?=\d{3}\b)/g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  if (typeof c.numero !== 'number') {
    const escala = ESCALA.find(([re]) => re.test(v));
    if (escala) n *= escala[1];
  }
  // La unidad es lo que queda al quitar el número y la escala: «q», «%», «us$».
  const unidad = v.replace(/[\d.,]/g, ' ').replace(/\b(mil|millon(es)?|billon(es)?)\b/g, ' ').replace(/\s+/g, ' ').trim();
  return { n, unidad };
}

/**
 * Una visualización para entender, si las cifras del post la permiten.
 *
 * Por ahora una sola: comparar entre sí las cifras que se miden en lo mismo
 * (dos montos en quetzales, dos porcentajes). Sale solo de números que el post
 * dijo; no se calcula ni se completa nada.
 */
function compararCifras(cifras) {
  const grupos = new Map();
  for (const c of cifras) {
    const m = medida(c);
    if (!m || m.n <= 0 || !m.unidad) continue;
    if (!grupos.has(m.unidad)) grupos.set(m.unidad, []);
    grupos.get(m.unidad).push({ id: c.id, valor: c.valor, n: m.n, de: [c.variable || c.que_representa, c.hacia].filter(Boolean).join(' · ') });
  }
  const mejor = [...grupos.values()].filter((g) => g.length >= 2).sort((a, b) => b.length - a.length)[0];
  if (!mejor) return null;
  const tope = Math.max(...mejor.map((x) => x.n));
  // Si una barra no llegaría ni a verse, comparar así confunde más que aclara.
  if (mejor.some((x) => x.n / tope < 0.02)) return null;
  return { tipo: 'comparacion', filas: mejor.map((x) => ({ ...x, parte: x.n / tope })) };
}

const QUIEN = new Set(['Actor', 'Entidad']);

/**
 * @param analisis  el análisis tal como llega
 * @param menciones las menciones ya resueltas (`mencionesDe`)
 * @param tipoDe    cómo se lee el tipo de una mención
 */
export function armarPiezas(analisis, menciones = [], tipoDe = (m) => m?.tipo) {
  const a = analisis || {};
  const hablantes = a.hablantes || [];

  const cifras = (a.cantidades || []).map((c, i) => ({ ...c, id: `cifra:${i}`, hecho: null, fuentes: [] }));
  const hechos = (a.hechos || [])
    .filter((h) => h && typeof h === 'object')
    .map((h, i) => ({ ...h, id: `hecho:${i}`, enCifra: null, fuentes: [] }));
  const fuentes = (a.fuentes || []).map((f, i) => ({ ...f, id: `fuente:${i}`, piezas: [], citaPropia: !!(f.cita && f.cita_en_texto) }));

  // Un hecho que cuenta una cifra se va con ella. Cada cifra se queda con un
  // solo hecho, el primero que la cuenta: dos frases sobre el mismo número son
  // dos hechos, y el segundo se queda en su sección.
  for (const h of hechos) {
    const c = cifras.find((x) => !x.hecho && cuentaLaCifra(h, x));
    if (c) {
      c.hecho = h;
      h.enCifra = c.id;
    }
  }

  // A quién se cita: la fuente señala las piezas que sostiene, y cada pieza
  // lleva el nombre de su fuente. Si la cita de la fuente es la de la pieza, se
  // lee en la pieza y no dos veces.
  for (const f of fuentes) {
    for (const h of hechos) {
      const porCita = f.cita && h.cita && mismaCita(f.cita, h.cita);
      if (!porCita && !nombra(`${h.texto} ${h.cita || ''}`, f.nombre)) continue;
      const destino = h.enCifra || h.id;
      if (!f.piezas.includes(destino)) f.piezas.push(destino);
      h.fuentes.push(f.id);
      if (porCita) f.citaPropia = false;
    }
    for (const c of cifras) {
      if (c.hecho || !(c.cita && f.cita && mismaCita(f.cita, c.cita))) continue;
      if (!f.piezas.includes(c.id)) f.piezas.push(c.id);
      c.fuentes.push(f.id);
      f.citaPropia = false;
    }
  }
  for (const c of cifras) if (c.hecho) c.fuentes = c.hecho.fuentes;

  // Quién aparece: las personas y organizaciones nombradas, cada una con su voz
  // si habla y con las relaciones que salen de ella.
  const usadas = new Set();
  const quienes = menciones
    .filter((m) => QUIEN.has(tipoDe(m)))
    .map((m) => {
      const voz = hablantes.find((v) => v.nombre && !usadas.has(v.id) && mismoNombre(v.nombre, m.texto)) || null;
      if (voz) usadas.add(voz.id);
      return { id: `quien:${m.texto}`, nombre: m.texto, mencion: m, voz, relaciones: [], piezas: [] };
    });
  // Las voces sin nombre propio —«narra», «voz en off»— también aparecen.
  for (const v of hablantes) {
    if (usadas.has(v.id)) continue;
    quienes.push({ id: `quien:voz:${v.id}`, nombre: null, mencion: null, voz: v, relaciones: [], piezas: [] });
  }

  const deNombre = (t) => quienes.find((q) => q.mencion?.texto === t) || null;
  const sueltas = [];
  for (const r of a.relaciones || []) {
    // Una relación se muestra una vez, en quien la protagoniza; si ese no es
    // una persona u organización, en el otro extremo.
    const duena = deNombre(r.a) || deNombre(r.b);
    if (duena) duena.relaciones.push(r);
    else sueltas.push(r);
  }

  for (const q of quienes) {
    if (!q.mencion) continue;
    for (const h of hechos) {
      if ((h.menciones || []).includes(q.mencion.texto)) {
        const destino = h.enCifra || h.id;
        if (!q.piezas.includes(destino)) q.piezas.push(destino);
      }
    }
    for (const c of cifras) {
      if (c.hacia && mismoNombre(c.hacia, q.nombre) && !q.piezas.includes(c.id)) q.piezas.push(c.id);
    }
  }

  const porId = new Map();
  for (const c of cifras) porId.set(c.id, { clase: 'cifras', etiqueta: c.valor });
  for (const h of hechos) if (!h.enCifra) porId.set(h.id, { clase: 'hechos', etiqueta: corta(h.texto) });
  for (const f of fuentes) porId.set(f.id, { clase: 'apoyo', etiqueta: f.nombre });
  for (const q of quienes) if (q.nombre) porId.set(q.id, { clase: 'quien', etiqueta: q.nombre });

  /** Las piezas del post que hablan de esto: mismo número, o casi la misma frase. */
  const dondeAparece = (texto) => {
    const ids = [];
    const ns = new Set(numeros(texto));
    for (const c of cifras) {
      const suyos = numeros(c.valor);
      const deQue = `${c.variable || c.que_representa || ''} ${c.hacia || ''}`;
      if (suyos.some((n) => ns.has(n)) && cubre(deQue, texto) >= 0.5) ids.push(c.id);
    }
    for (const h of hechos) {
      if (h.enCifra) continue;
      if (cubre(texto, h.texto) >= 0.7 || cubre(h.texto, texto) >= 0.7) ids.push(h.id);
    }
    return ids;
  };

  /** Las piezas que nombran un término, para «en esta nota» de un concepto. */
  const dondeSeNombra = (termino) => {
    const ids = [];
    for (const c of cifras) {
      const todo = `${c.variable || ''} ${c.hacia || ''} ${c.hecho?.texto || ''} ${c.hecho?.cita || ''} ${c.cita || ''}`;
      if (nombra(todo, termino)) ids.push(c.id);
    }
    for (const h of hechos) {
      if (!h.enCifra && nombra(`${h.texto} ${h.cita || ''}`, termino)) ids.push(h.id);
    }
    return ids;
  };

  return {
    cifras,
    hechos: hechos.filter((h) => !h.enCifra),
    fuentes,
    quienes,
    relacionesSueltas: sueltas,
    visual: compararCifras(cifras),
    porId,
    quienDe: (nombre) => quienes.find((q) => q.nombre && mismoNombre(q.nombre, nombre)) || null,
    // La fila de quien habla, si tiene nombre: para señalarla en vez de repetirlo.
    quienDeVoz: (vozId) => quienes.find((q) => q.nombre && q.voz?.id === vozId) || null,
    dondeAparece,
    dondeSeNombra,
  };
}
