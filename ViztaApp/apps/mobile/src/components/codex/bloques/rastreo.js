/**
 * El rastreo del Codex, bloque por bloque.
 *
 * Con el editor viejo la nota entera viajaba a la base 700 ms después de cada
 * tecla. Con bloques se manda solo lo que cambió: la respuesta de cada bloque
 * se guarda con una clave hecha de su renglón **y del contexto que lo
 * rodea**. Mientras esa clave no cambie, no se vuelve a preguntar.
 *
 * El contexto importa por la firma. La base decide cada mención mirando tres
 * palabras antes y tres después (`codex_resolver_texto`), aunque estén en el
 * renglón de al lado, y con esa firma se cruzan las decisiones guardadas. Por
 * eso cada pedido lleva los renglones vecinos hasta juntar palabras de sobra,
 * y `codex_resolver_bloques` los usa y los descarta. Se probó contra la nota
 * entera: mismas menciones, mismo veredicto, misma firma.
 *
 * Y por eso lo que se manda es el renglón en markdown —con sus `**` y su
 * «- »— y no el texto limpio: para la base un `**` es un corte de frase, y con
 * el texto limpio decidiría distinto que el indexador, que lee `description`.
 *
 * Este archivo es puro: sin React ni red. El hook que lo usa es
 * `useRastreoBloques`.
 */

import { normalizar, segmentar } from '../menciones';
import { textoDe } from '../../../documento/editor';

// ── Nombres reconocidos, por bloque ─────────────────────────────────────────

const porIndice = new WeakMap();

/**
 * `segmentar` del texto de un bloque, recordado por bloque.
 *
 * Los bloques son inmutables: uno que no se tocó es el mismo objeto de antes,
 * y su resultado sirve igual. Con eso, recorrer la nota entera después de una
 * pausa cuesta lo que cambió y no lo que mide la nota. Se recuerda por índice
 * también: si el Codex cambia, se vuelve a buscar.
 */
export function tramosDeBloque(b, indice) {
  if (!b) return [];
  if (!indice) return segmentar(textoDe(b.children), indice);
  let memo = porIndice.get(indice);
  if (!memo) {
    memo = new WeakMap();
    porIndice.set(indice, memo);
  }
  let t = memo.get(b);
  if (!t) {
    t = segmentar(textoDe(b.children), indice);
    memo.set(b, t);
  }
  return t;
}

// ── Qué preguntar ───────────────────────────────────────────────────────────

/**
 * Cuántas palabras juntar de cada lado. La firma usa tres; se juntan de más
 * porque la cuenta de acá es aproximada: la base además descarta enlaces,
 * usuarios y palabras con `_`, `/` o `=` (`codex_limpiar`).
 */
const PALABRAS_DE_CONTEXTO = 8;

/** Las palabras de un renglón, contadas más o menos como las cuenta la base. */
export function palabrasAprox(linea) {
  const limpio = String(linea || '')
    .replace(/(https?:\/\/|www\.)\S+|\S+@\S+|[@#][A-Za-z0-9_]+/gi, ' ')
    .replace(/\S*[_/\\=]\S*/g, ' ');
  return (limpio.match(/[\p{L}\p{N}]+/gu) || []).length;
}

/**
 * Para cada renglón, el contexto de arriba y de abajo: renglones vecinos
 * enteros hasta juntar `PALABRAS_DE_CONTEXTO` palabras o llegar al borde.
 */
export function contextos(renglones) {
  const n = renglones.length;
  const palabras = renglones.map((r) => palabrasAprox(r.texto));
  const antes = new Array(n);
  const despues = new Array(n);
  for (let i = 0; i < n; i++) {
    let juntadas = 0;
    let j = i - 1;
    while (j >= 0 && juntadas < PALABRAS_DE_CONTEXTO) juntadas += palabras[j--];
    antes[i] = renglones
      .slice(j + 1, i)
      .map((r) => r.texto)
      .join('\n');

    juntadas = 0;
    j = i + 1;
    while (j < n && juntadas < PALABRAS_DE_CONTEXTO) juntadas += palabras[j++];
    despues[i] = renglones
      .slice(i + 1, j)
      .map((r) => r.texto)
      .join('\n');
  }
  return { antes, despues };
}

/**
 * Qué hay que preguntar.
 *
 * @param renglones  `[{ key, texto }]` de `renglonesPorBloque`, en orden.
 * @param conTexto   Qué claves son bloques de texto (los únicos que se pintan).
 * @param yaSabidos  `Set`/`Map` de hashes que ya tienen respuesta.
 * @returns `{ hashes: { [key]: hash }, pedido: [...] }` — `pedido` es lo que
 *   recibe `codex_resolver_bloques`: los bloques sin respuesta, con `sigue`
 *   marcando los que van pegados al anterior, para que la base los resuelva
 *   de una vez.
 */
export function armarPedido(renglones, conTexto, yaSabidos) {
  const { antes, despues } = contextos(renglones);
  const hashes = {};
  const pedido = [];
  let anterior = -2;
  renglones.forEach((r, i) => {
    if (!conTexto.has(r.key)) return;
    // La clave de la respuesta es el renglón con su contexto, tal cual. Se
    // probó un hash propio y costaba más que dejarle el trabajo al `Map`,
    // que ya hashea sus claves en código nativo.
    const hash = `${antes[i]}\u0001${r.texto}\u0001${despues[i]}`;
    hashes[r.key] = hash;
    if (yaSabidos.has(hash)) return;
    const sigue = anterior === i - 1;
    pedido.push({ k: r.key, texto: r.texto, antes: sigue ? '' : antes[i], despues: despues[i], sigue, hash });
    // El contexto de abajo lo lee la base del último del tramo: los de antes
    // no lo necesitan.
    if (sigue) pedido[pedido.length - 2].despues = '';
    anterior = i;
  });
  return { hashes, pedido };
}

// ── Qué contestó la base ────────────────────────────────────────────────────

/** Lo escrito, reducido a palabras: así se comparan el tramo de la app y el de la base. */
export const claveEscrita = (t) => normalizar(t).replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Los lugares del bloque según la base, en orden, con quién ganó en cada uno.
 * Igual que en `useVeredictos`: `guardadas` son las decisiones ya tomadas
 * sobre esta nota (por la huella o por la persona), que valen más que las
 * reglas.
 */
export function lugaresDe(filas, guardadas) {
  const porLugar = new Map();
  for (const f0 of filas || []) {
    const pesa = f0.origen === 'regla' ? guardadas?.get(`${f0.item_id}|${f0.firma}`) : undefined;
    const f = pesa ? { ...f0, veredicto: pesa } : f0;
    if (!porLugar.has(f.palabra)) porLugar.set(f.palabra, []);
    porLugar.get(f.palabra).push(f);
  }
  return [...porLugar.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, grupo]) => {
      const si = grupo.find((g) => g.veredicto === 'si');
      const dudosas = grupo.filter((g) => g.veredicto === 'dudosa');
      const base = si || dudosas[0] || grupo[0];
      return {
        clave: claveEscrita(base.escrito),
        estado: si ? 'si' : dudosas.length ? 'dudosa' : 'no',
        itemId: base.item_id,
        candidatos: (si ? [si] : dudosas.length ? dudosas : grupo).map((g) => g.item_id),
        firma: base.firma,
        firmaCorta: base.firma_corta,
      };
    });
}

const FUNDIDO_MS = 280;

/**
 * Los tramos de `segmentar`, anotados con lo que dijo la base.
 *
 * Es la misma lógica que `useVeredictos` para la nota entera, por bloque:
 * mientras llega la respuesta cada nombre conserva lo que se sabía de él
 * (`memoria.recordado`), un nombre recién escrito no se pinta hasta saber qué
 * es, y el color entra despacio la primera vez (`memoria.aparecio`).
 *
 * @param lugares  `lugaresDe(...)` si la respuesta es del texto actual; si no, null.
 * @returns `{ tramos, entrando }` — `entrando` dice si hay un color a mitad
 *   de fundido y hace falta otro cuadro.
 */
export function anotar(tramos, lugares, memoria, { fallo = false, porId = null, ahora = Date.now() } = {}) {
  const vistos = new Map();
  let j = 0;
  let entrando = false;

  const salida = (tramos || []).map((t) => {
    if (!t.item) return t;
    const k = claveEscrita(t.texto);
    const orden = (vistos.get(k) || 0) + 1;
    vistos.set(k, orden);
    const memo = `${k}#${orden}`;

    let lugar = null;
    if (lugares) {
      // Se avanza en paralelo: el tramo de la app y el lugar de la base con
      // lo mismo escrito. Se tolera que la base tenga alguno de más.
      for (let salto = 0; salto < 4 && j + salto < lugares.length; salto++) {
        if (lugares[j + salto].clave === k) {
          lugar = lugares[j + salto];
          j += salto + 1;
          break;
        }
      }
      if (lugar) memoria.recordado.set(memo, lugar);
    } else {
      lugar = memoria.recordado.get(memo) || null;
    }

    if (!lugar) {
      // Si la base no contesta, se pinta como siempre: todo lo reconocido cuenta.
      if (fallo) return { ...t, estado: 'si', alfa: 1 };
      memoria.aparecio.delete(memo);
      return { texto: t.texto, pendiente: true };
    }
    if (lugar.estado === 'no') {
      memoria.aparecio.delete(memo);
      return { texto: t.texto, descartado: true };
    }

    if (!memoria.aparecio.has(memo)) memoria.aparecio.set(memo, ahora);
    const pasado = ahora - memoria.aparecio.get(memo);
    const alfa = pasado >= FUNDIDO_MS ? 1 : 0.2 + 0.8 * (pasado / FUNDIDO_MS);
    if (alfa < 1) entrando = true;

    const item = (lugar.itemId !== t.item.id && porId?.get(lugar.itemId)) || t.item;
    return {
      ...t,
      item,
      estado: lugar.estado,
      alfa,
      candidatos: lugar.candidatos.map((id) => porId?.get(id)).filter(Boolean),
      firma: lugar.firma,
      firmaCorta: lugar.firmaCorta,
    };
  });

  return { tramos: salida, entrando };
}

export const memoriaNueva = () => ({ recordado: new Map(), aparecio: new Map() });

// ── Pintar ──────────────────────────────────────────────────────────────────

/**
 * Las piezas que se pintan dentro del `TextInput` de un bloque: el cruce de
 * los spans (formato) con los tramos del rastreo (menciones). Cada pieza
 * lleva sus marcas y, si cae en un nombre, la mención.
 *
 * La concatenación de las piezas es exactamente el texto del bloque: el
 * `TextInput` no tiene `value`, su contenido son sus hijos.
 */
export function piezas(children, tramos) {
  const cortes = new Set([0]);
  let pos = 0;
  for (const s of children || []) {
    pos += (s.text || '').length;
    cortes.add(pos);
  }
  const total = pos;
  pos = 0;
  for (const t of tramos || []) {
    pos += (t.texto || '').length;
    cortes.add(Math.min(pos, total));
  }
  const orden = [...cortes].sort((a, b) => a - b);

  const marcasEn = (x) => {
    let p = 0;
    for (const s of children || []) {
      const l = (s.text || '').length;
      if (x >= p && x < p + l) return s.marks || [];
      p += l;
    }
    return [];
  };
  const tramoEn = (x) => {
    let p = 0;
    for (const t of tramos || []) {
      const l = (t.texto || '').length;
      if (x >= p && x < p + l) return t;
      p += l;
    }
    return null;
  };

  const texto = (children || []).map((s) => s.text || '').join('');
  const salida = [];
  for (let i = 0; i < orden.length - 1; i++) {
    const a = orden[i];
    const z = orden[i + 1];
    if (z <= a) continue;
    const t = tramoEn(a);
    salida.push({
      texto: texto.slice(a, z),
      marcas: marcasEn(a),
      mencion: t?.item ? t : null,
    });
  }
  return salida;
}

/**
 * La mención que cae en `pos`, si cae alguna. Incluye el arranque y excluye el
 * final, por lo mismo que `mencionEn` en `buscarCodex.js`.
 */
export function mencionEnTramos(tramos, pos) {
  let desde = 0;
  for (const t of tramos || []) {
    const largo = (t.texto || '').length;
    if (t.item && pos >= desde && pos < desde + largo) return { tramo: t, desde };
    desde += largo;
  }
  return null;
}
