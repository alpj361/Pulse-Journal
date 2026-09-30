/**
 * El grafo de un espacio: cómo se arma y dónde cae cada cosa.
 *
 * **Nada de esto está escrito a mano.** No hay posiciones, ni un orden, ni una
 * lista de qué mostrar: entra lo que el espacio tenga —tres elementos o
 * cincuenta y cinco, con aristas o sin ninguna— y sale un dibujo. Si mañana el
 * espacio tiene otra cosa adentro, el dibujo es otro sin que nadie lo toque.
 *
 * Se acomoda con fuerzas y no colocando uno por uno. La diferencia importa: un
 * acomodo por turnos necesita que alguien decida el turno, y esa decisión
 * termina siendo una opinión disfrazada de algoritmo. Con fuerzas no hay turno
 * —todos los nodos se empujan a la vez— y lo que se ve es lo que los datos
 * tienen: lo que está conectado queda junto porque tira, y lo suelto se va al
 * borde porque nada lo retiene.
 *
 * **Cada nodo es un punto, y el nombre va donde entra.** La primera versión
 * dibujaba solo palabras, y una palabra ocupa tanto que en la franja de un
 * teléfono entraban nueve: medido sobre «Crisis de gasolina 2026» —33
 * elementos, 63 lazos— se veían 9 nodos y 9 líneas, y de las 30 relaciones
 * hechas a mano sobrevivía una. Un grafo que no puede mostrar sus conexiones no
 * es un grafo. Con puntos entran los 33 y las 63 líneas, lo conectado queda
 * 2.3 veces más junto que lo suelto, y 23 de los 33 nombres encuentran lugar.
 *
 * Las capas:
 *
 *  · **tamaño** — cuánto pesa cada nodo: sus lazos, contando doble los que
 *    afirmaste, más cuántas veces lo nombraste en tus notas. Antes mandaban
 *    solo las menciones, y así el nodo más conectado del espacio —29 lazos, un
 *    nombre largo que nadie escribe entero— era el primero en quedar afuera.
 *  · **lazos de relación** — `codex_relations`, lo que conectaste a mano.
 *    Pocos y ciertos: tiran fuerte y se dibujan sólidos.
 *  · **lazos del índice** — `workspace_graph_edges`, lo que deduce el
 *    indexador. Muchos y probables: tiran flojo y se dibujan tenues. Un lazo
 *    que una máquina supuso no puede pesar lo mismo que uno que afirmaste.
 *
 * La simulación es determinista —semilla del id, pasos fijos— así que el mismo
 * espacio siempre cae igual. Un grafo que se reacomoda cada vez que entrás no
 * se puede aprender de memoria, y aprenderse el mapa es justamente para lo que
 * sirve mirarlo dos veces.
 */

// ─── Medidas ──────────────────────────────────────────────────────────────────

// El radio del punto. El piso es lo más chico que todavía se toca y se ve sobre
// una línea; el techo, lo más grande antes de que un nodo tape a sus vecinos.
const R_MIN = 3.5;
const R_MAX = 11;

// Los nombres no se escalan con el dibujo: si el encuadre achica todo para que
// entre, el texto igual tiene que leerse.
const CUERPO_ETIQUETA = 10.5;

// Aire mínimo entre dos nombres. Sin él el control de choques aceptaba cajas
// que se tocaban en el borde, y dos nombres seguidos se leían como uno solo:
// «Partido Polít…CABAL».
const SEPARACION_NOMBRES = 5;

// La monoespaciada hace que el ancho de un texto sea aritmética y no medición:
// todos los glifos miden lo mismo. Es la razón por la que ubicar un nombre no
// necesita pasar por el motor de texto para saber cuánto ocupa.
const ANCHO_GLIFO = 0.6;

// Caracteres antes de recortar. Catorce y no más: con dieciséis, en el mismo
// espacio entraban la mitad de los nombres, y el nombre entero ya se lee al
// tocar el punto.
const LARGO_MAX = 14;

// Los conceptos de la historia se leen por su nombre, que puede ser una frase
// corta: con catorce caracteres «Democracia deliberativa» no se entendería.
const LARGO_CONCEPTO = 24;

// Tope de nodos. Con puntos entran muchos, pero el acomodo compara todos contra
// todos en cada paso: pasado este número el costo crece más rápido de lo que
// el dibujo gana, y los puntos se vuelven granos.
const TOPE_NODOS = 120;

const PASOS = 320;

// Cuánto tira cada clase de lazo en el acomodo.
const RESORTE = { miembro: 0.22, relacion: 0.15, menciona: 0.12, parecido: 0.07, indice: 0.045 };

// ─── Armado ───────────────────────────────────────────────────────────────────

/** Hash estable: la semilla de cada nodo sale de su id, no del azar. */
function hash(s) {
  let h = 2166136261;
  const t = String(s ?? '');
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const recortar = (t, max = LARGO_MAX) => {
  const s = String(t || '').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

/**
 * De los datos crudos a nodos y lazos.
 *
 * `menciones` puede venir vacío —si todavía no se contaron, o si no nombraste a
 * nadie— y entonces el peso sale solo de los lazos. Es un grado menos de
 * información, no un error: el grafo sigue mostrando qué hay y qué se conecta.
 */
// Cuántas líneas de parecido muestra cada nodo: las más fuertes. Con todas,
// una historia de ochenta ideas era una maraña de trescientas líneas.
const LINEAS_POR_NODO = 4;

const plano = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function armar({
  items = [],
  relaciones = [],
  aristas = [],
  menciones = new Map(),
  nota = null,
  expandido = null,
}) {
  const nodos = items
    .filter((it) => it?.id && it?.name)
    .map((it) => ({
      id: it.id,
      item: it,
      texto: recortar(it.name),
      tipo: it.tipo,
      veces: menciones.get(it.id) || 0,
      // Nombrado por la nota principal pero fuera del espacio: se dibuja
      // tenue. La nota lo trae al tema, pero todavía no es parte del espacio.
      ...(nota?.externos?.has(it.id) ? { externo: true } : {}),
    }));

  /**
   * La historia, en dos niveles.
   *
   * **Al entrar** se ven los conceptos —cada uno más grande cuantas más ideas
   * junta—, los documentos y los elementos del espacio. Las ideas no se
   * dibujan: sus líneas y menciones se suman a su concepto. Es lo que deja leer
   * un espacio con cien ideas: en vez de cien puntos, quince conceptos.
   *
   * **Al tocar un concepto** (`expandido`) aparecen sus ideas alrededor. Las de
   * los demás siguen plegadas.
   *
   * Un concepto que se llama igual que un elemento del grafo —el concepto
   * «Walter Mazariegos» y el actor Walter Mazariegos— no se dibuja aparte: es
   * ese mismo nodo. Dos etiquetas iguales en lugares distintos no se entienden.
   */
  const porItem = new Map(nodos.map((n) => [n.id, n]));
  const porNombre = new Map(nodos.map((n) => [plano(n.item?.name), n]));
  const nodoDeConcepto = new Map();
  const conceptoDeIdea = new Map();
  for (const c of nota?.conceptos || []) {
    if (!c.ideas?.length) continue;
    const mismo = (c.item?.id && porItem.get(c.item.id)) || porNombre.get(plano(c.nombre));
    if (mismo && !mismo.concepto) {
      mismo.concepto = c;
      nodoDeConcepto.set(c.id, mismo.id);
    } else {
      nodoDeConcepto.set(c.id, `con:${c.id}`);
      nodos.push({
        id: `con:${c.id}`,
        concepto: c,
        texto: recortar(c.nombre, LARGO_CONCEPTO),
        tipo: 'Concepto',
        veces: 0,
      });
    }
    for (const id of c.ideas) conceptoDeIdea.set(id, c);
  }
  for (const d of nota?.documentos || []) {
    nodos.push({
      id: `doc:${d.id}`,
      documento: d,
      texto: recortar(d.nombre.replace(/\.[^.]+$/, ''), LARGO_CONCEPTO),
      tipo: 'Documento',
      veces: 0,
    });
  }

  // Las ideas que se ven: solo las del concepto abierto. Una historia que
  // todavía se está procesando entra entera cuando esté.
  const visibles = new Set();
  for (const i of nota?.ideas || []) {
    if (nota.enCamino?.has(i.historia)) continue;
    const c = conceptoDeIdea.get(i.id);
    if (!c || c.id !== expandido) continue;
    visibles.add(i.id);
    nodos.push({
      id: `idea:${i.id}`,
      idea: i,
      texto: '',
      tipo: 'Idea',
      veces: 0,
      // Arranca donde está su concepto: abrirlo no desordena el resto.
      cerca: nodoDeConcepto.get(c.id),
    });
  }

  // Dónde cae una idea en el dibujo: ella misma si está abierta; si no, su
  // concepto; si no tiene, su documento. Si no queda en ninguno, no se dibuja
  // y sus líneas tampoco.
  const nodoDe = (idNodo) => {
    if (!idNodo?.startsWith('idea:')) return idNodo;
    const id = idNodo.slice(5);
    if (visibles.has(id)) return idNodo;
    const c = conceptoDeIdea.get(id);
    if (c) return nodoDeConcepto.get(c.id);
    const i = (nota?.ideas || []).find((x) => x.id === id);
    return i?.documento ? `doc:${i.documento}` : null;
  };

  const porId = new Map(nodos.map((n) => [n.id, n]));

  // Un lazo solo existe si sus dos puntas están en el dibujo. Una relación
  // hacia algo que no está en este espacio no se puede dibujar sin inventar el
  // otro extremo, y un extremo inventado es una línea que miente.
  const lazos = [];
  const vistos = new Set();

  const agregar = (a, b, clase, peso) => {
    if (!a || !b || a === b) return;
    if (!porId.has(a) || !porId.has(b)) return;
    // Una misma pareja puede venir por los dos caminos. Se queda con el más
    // firme: si vos lo afirmaste, que el indexador lo haya supuesto no agrega.
    const clave = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (vistos.has(clave)) {
      if (clase === 'relacion') {
        const ya = lazos.find((l) => l.clave === clave);
        if (ya) {
          ya.clase = 'relacion';
          ya.peso = Math.max(ya.peso, peso);
        }
      }
      return;
    }
    vistos.add(clave);
    lazos.push({ clave, a, b, clase, peso });
  };

  for (const r of relaciones) agregar(r.subject_id, r.object_id, 'relacion', 1);
  // El indexador conecta muchas clases de cosa; `agregar` se queda solo con las
  // que son elementos del Codex, que son las únicas que tienen nodo dibujado.
  // Lo que ya afirmaste no pasa por el corte de mediana: es cierto, no parecido.
  for (const e of aristas) {
    if (e.origin === 'codex_relation' || e.origin === 'user') {
      agregar(e.source_id, e.target_id, 'relacion', 1);
    }
  }
  for (const e of fuertes(aristas.filter((e) => e.origin !== 'codex_relation' && e.origin !== 'user'))) {
    agregar(e.source_id, e.target_id, 'indice', Number(e.weight) || 0.5);
  }

  // La tercera capa: la historia. Tres clases de lazo, de más firme a menos:
  //  · miembro — la idea es parte de ese concepto. Es lo que forma los
  //    racimos: tira fuerte y se dibuja casi invisible, porque lo que se tiene
  //    que ver es el grupo, no las líneas.
  //  · menciona — la idea nombra ese elemento del Codex. Está escrito.
  //  · parecido — el indexador encontró la idea cerca de otra, o de un
  //    elemento del espacio. Es probable, y pesa lo que se parecen.
  // Van en ese orden porque `agregar` se queda con el primero de cada pareja.
  for (const c of nota?.conceptos || []) {
    const nodoC = nodoDeConcepto.get(c.id);
    if (!nodoC) continue;
    // Los conceptos de un documento cuelgan del documento; las ideas abiertas,
    // de su concepto.
    if (c.documento) agregar(nodoC, `doc:${c.documento}`, 'miembro', 1);
    for (const id of c.ideas || []) if (visibles.has(id)) agregar(`idea:${id}`, nodoC, 'miembro', 1);
  }
  for (const i of nota?.ideas || []) {
    for (const id of i.menciona || []) agregar(nodoDe(`idea:${i.id}`), id, 'menciona', 1);
  }

  // Parecidos: muchos llegan a la misma pareja una vez plegados —dos conceptos
  // con varias ideas parecidas entre sí—; queda el más fuerte. Después cada
  // nodo se queda con sus `LINEAS_POR_NODO` más fuertes: una línea sobrevive si
  // es de las mejores de cualquiera de sus dos puntas.
  const parecidos = new Map();
  for (const l of nota?.lazos || []) {
    const x = nodoDe(l.a);
    const y = nodoDe(l.b);
    if (!x || !y || x === y) continue;
    if (l.tipo === 'mentions') {
      agregar(x, y, 'menciona', 1);
      continue;
    }
    const clave = x < y ? `${x}|${y}` : `${y}|${x}`;
    const previo = parecidos.get(clave);
    if (!previo || previo.peso < l.peso) parecidos.set(clave, { a: x, b: y, peso: Number(l.peso) || 0 });
  }
  const mejores = new Map();
  for (const par of parecidos.values()) {
    for (const punta of [par.a, par.b]) {
      if (!mejores.has(punta)) mejores.set(punta, []);
      mejores.get(punta).push(par);
    }
  }
  const quedan = new Set();
  for (const lista of mejores.values()) {
    lista.sort((u, v) => v.peso - u.peso);
    for (const par of lista.slice(0, LINEAS_POR_NODO)) quedan.add(par);
  }
  for (const par of quedan) agregar(par.a, par.b, 'parecido', par.peso);

  // Grado: cuántos lazos toca cada nodo.
  for (const l of lazos) {
    porId.get(l.a).grado = (porId.get(l.a).grado || 0) + 1;
    porId.get(l.b).grado = (porId.get(l.b).grado || 0) + 1;
  }
  for (const n of nodos) n.grado = n.grado || 0;

  return { nodos, lazos };
}

/**
 * El grafo listo para dibujar: armado, acomodado y con los nombres ubicados.
 *
 * El peso de un nodo es lo que lo hace grande y lo que decide qué nombre elige
 * lugar primero: sus lazos —los afirmados cuentan doble, porque son ciertos— y
 * cuántas veces lo nombraste. Así lo más conectado nunca se queda sin dibujar
 * por tener un nombre que nadie escribe entero.
 */
export function construir({ items, relaciones, aristas, menciones, marco, nota = null, expandido = null, iniciales = null }) {
  const base = armar({ items, relaciones, aristas, menciones, nota, expandido });
  if (!base.nodos.length || !marco?.ancho || !marco?.alto) {
    return { ...base, etiquetas: [], ocultos: 0 };
  }

  const conexiones = new Map(base.nodos.map((n) => [n.id, 0]));
  for (const l of base.lazos) {
    const w = l.clase === 'relacion' ? 2 : 1;
    conexiones.set(l.a, conexiones.get(l.a) + w);
    conexiones.set(l.b, conexiones.get(l.b) + w);
  }
  const pesoDe = (n) => conexiones.get(n.id) + n.veces;

  // El desempate es el nombre y no el azar: si fuera el azar, con más de
  // `TOPE_NODOS` el grafo cambiaría de contenido entre visitas.
  // Los conceptos van primero: sin ellos la historia no se ve, y son pocos.
  let activos = [...base.nodos].sort(
    (a, b) =>
      (b.concepto || b.documento ? 1 : 0) - (a.concepto || a.documento ? 1 : 0) ||
      pesoDe(b) - pesoDe(a) ||
      a.texto.localeCompare(b.texto, 'es')
  );
  const ocultos = Math.max(0, activos.length - TOPE_NODOS);
  if (ocultos) activos = activos.slice(0, TOPE_NODOS);

  const quedan = new Set(activos.map((n) => n.id));
  const lazos = base.lazos.filter((l) => quedan.has(l.a) && quedan.has(l.b));

  // Radio por la raíz del peso y no por el número crudo: algo con veinte lazos
  // se ve claramente más grande que algo con cinco, pero no cuatro veces más.
  // Sin raíz, el nodo central aplasta a todos y el resto se vuelve polvo.
  const techo = activos.reduce((m, n) => Math.max(m, pesoDe(n)), 0) || 1;
  const puntos = activos.map((n) => {
    const peso = pesoDe(n);
    // Un concepto tiene tamaño fijo: es el centro de su racimo. Una idea crece
    // poco, lo justo para que la que se une con más cosas se note.
    // Un concepto crece con las ideas que junta: es lo que dice, sin abrirlo,
    // cuánto habla la historia de eso.
    const r = n.documento
      ? 9
      : n.concepto && !n.item
      ? 5.5 + Math.min(6, Math.sqrt(n.concepto.ideas?.length || 1) * 1.3)
      : n.idea
        ? 3 + Math.min(3, (n.grado || 0) * 0.45)
        : R_MIN + (R_MAX - R_MIN) * Math.sqrt(peso / techo);
    // `radio` es con cuánto empuja: el punto más aire, para que dos puntos no
    // queden pegados y entre ellos quepa una línea que se vea.
    return { ...n, peso, cuerpo: r, radio: r + 7, ancho: r * 2, alto: r * 2 };
  });

  /**
   * El seguro. Acomodar es una simulación y, aunque tiene frenos, un caso que
   * nadie previó puede terminar con un nodo lejísimos y el resto aplastado en
   * una esquina. Se mide el resultado y, si tiene ese síntoma, se vuelve a
   * acomodar arrancando distinto; si tampoco, se encuadra ignorando al que se
   * escapó. `rescate` dice si hizo falta, para enterarnos si pasa de verdad.
   */
  let nodos = acomodar(puntos, lazos, marco, { iniciales });
  let rescate = null;
  for (let sal = 1; sal <= 2 && !bienRepartido(nodos, marco); sal++) {
    nodos = acomodar(puntos, lazos, marco, { sal });
    rescate = 'reintento';
  }
  if (!bienRepartido(nodos, marco)) {
    nodos = recortarEscapados(nodos, marco);
    rescate = 'recorte';
  }
  nodos = conProfundidad(nodos, lazos, marco);
  return { nodos, lazos, etiquetas: etiquetar(nodos, marco), ocultos, rescate };
}

/**
 * La profundidad de cada nodo, para verlo en 3D al orbitar.
 *
 * Es el mismo acomodo por fuerzas, en una sola dimensión y sin tocar el plano:
 * lo conectado se atrae —queda a profundidad parecida, y al girar el racimo se
 * mueve junto— y lo que cae cerca en el plano se separa hacia adelante o hacia
 * atrás, para que al girar no queden nodos encimados. Determinista, como el
 * resto: el mismo espacio tiene siempre el mismo volumen.
 */
function conProfundidad(nodos, lazos, marco) {
  const n = nodos.length;
  if (n < 2) return nodos.map((nd) => ({ ...nd, z: 0 }));
  const R = Math.min(marco.ancho, marco.alto) * 0.3;
  const indice = new Map(nodos.map((nd, i) => [nd.id, i]));
  const z = nodos.map((nd) => (((hash(`${nd.id}#z`) % 2000) / 1000) - 1) * R * 0.5);
  const v = new Array(n).fill(0);
  const pares = lazos
    .map((l) => [indice.get(l.a), indice.get(l.b)])
    .filter(([a, b]) => a !== undefined && b !== undefined);

  for (let paso = 0; paso < 120; paso++) {
    const temple = 1 - paso / 120;
    for (let i = 0; i < n; i++) {
      let f = -z[i] * 0.01; // hacia el plano medio, flojo
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dxy = Math.hypot(nodos[i].x - nodos[j].x, nodos[i].y - nodos[j].y);
        if (dxy > 70) continue; // solo se separan los que en el plano están cerca
        const dz = z[i] - z[j] || (i < j ? 0.5 : -0.5);
        f += (Math.sign(dz) * 60) / (Math.abs(dz) + 6) * (1 - dxy / 70);
      }
      v[i] = (v[i] + f) * 0.8;
    }
    for (const [a, b] of pares) {
      const tira = (z[b] - z[a]) * 0.04;
      v[a] += tira;
      v[b] -= tira;
    }
    for (let i = 0; i < n; i++) z[i] += Math.max(-8, Math.min(8, v[i])) * temple;
  }

  const tope = Math.max(...z.map(Math.abs)) || 1;
  return nodos.map((nd, i) => ({ ...nd, z: (z[i] / tope) * R }));
}

/**
 * Si el dibujo quedó repartido: nada fuera del marco, nada inválido, y ningún
 * nodo mucho más lejos que el resto. El síntoma de un acomodo que explotó es
 * justamente ese: la mitad de los nodos a dos píxeles del centro y uno a
 * trescientos.
 */
function bienRepartido(nodos, marco) {
  if (nodos.length < 4) return true;
  if (nodos.some((n) => !Number.isFinite(n.x) || !Number.isFinite(n.y))) return false;
  const cx = nodos.reduce((a, n) => a + n.x, 0) / nodos.length;
  const cy = nodos.reduce((a, n) => a + n.y, 0) / nodos.length;
  const d = nodos.map((n) => Math.hypot(n.x - cx, n.y - cy)).sort((a, b) => a - b);
  const mediana = d[Math.floor(d.length / 2)];
  const minimo = Math.min(marco.ancho, marco.alto) * 0.06;
  return mediana >= minimo && d[d.length - 1] <= Math.max(mediana * 8, minimo * 4);
}

/**
 * Último recurso: se encuadra lo que está en el grueso del dibujo y lo que se
 * escapó se trae al borde. Se pierde la distancia exacta de esos pocos, pero
 * el resto vuelve a verse.
 */
function recortarEscapados(nodos, marco) {
  const validos = nodos.filter((n) => Number.isFinite(n.x) && Number.isFinite(n.y));
  if (!validos.length) return nodos;
  const xs = validos.map((n) => n.x).sort((a, b) => a - b);
  const ys = validos.map((n) => n.y).sort((a, b) => a - b);
  const q = (arr, t) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(t * (arr.length - 1))))];
  const x0 = q(xs, 0.05);
  const x1 = q(xs, 0.95);
  const y0 = q(ys, 0.05);
  const y1 = q(ys, 0.95);
  const margen = 16;
  const ex = (marco.ancho - margen * 2) / Math.max(x1 - x0, 1);
  const ey = (marco.alto - margen * 2) / Math.max(y1 - y0, 1);
  return nodos.map((n) => {
    const x = Number.isFinite(n.x) ? n.x : (x0 + x1) / 2;
    const y = Number.isFinite(n.y) ? n.y : (y0 + y1) / 2;
    return {
      ...n,
      x: Math.min(marco.ancho - margen, Math.max(margen, margen + (x - x0) * ex)),
      y: Math.min(marco.alto - margen, Math.max(margen, margen + (y - y0) * ey)),
    };
  });
}

/**
 * Dónde va cada nombre, si va.
 *
 * De mayor a menor peso, cada nombre prueba cuatro lugares alrededor de su
 * punto —abajo, arriba, a la derecha, a la izquierda— y se queda con el primero
 * que no pisa otro punto ni otro nombre. Si ninguno sirve, ese nodo queda sin
 * nombre: un nombre encimado sobre otro no se lee, y además tapa al que sí
 * entró. Se lee tocándolo.
 *
 * Probar cuatro lugares en vez de uno es casi todo el resultado: con uno solo
 * entraban 2 de 33 nombres; con cuatro, 23.
 */
export function etiquetar(nodos, marco) {
  const ocupado = nodos.map((p) => ({
    id: p.id,
    x0: p.x - p.cuerpo,
    x1: p.x + p.cuerpo,
    y0: p.y - p.cuerpo,
    y1: p.y + p.cuerpo,
  }));
  const alto = CUERPO_ETIQUETA * 1.3;
  const aire = 3;
  const etiquetas = [];

  // Los conceptos eligen lugar primero: son lo que da sentido al dibujo. Las
  // ideas no llevan nombre —una oración entera no entra— y se leen tocándolas.
  const orden = [...nodos].filter((p) => p.texto).sort(
    (a, b) =>
      (b.concepto || b.documento ? 1 : 0) - (a.concepto || a.documento ? 1 : 0) ||
      b.peso - a.peso ||
      a.texto.localeCompare(b.texto, 'es')
  );
  for (const p of orden) {
    const ancho = p.texto.length * CUERPO_ETIQUETA * ANCHO_GLIFO;
    const r = p.cuerpo;
    const lugares = [
      { x: p.x - ancho / 2, y: p.y + r + aire },
      { x: p.x - ancho / 2, y: p.y - r - aire - alto },
      { x: p.x + r + aire, y: p.y - alto / 2 },
      { x: p.x - r - aire - ancho, y: p.y - alto / 2 },
    ];

    for (const l of lugares) {
      const caja = { x0: l.x, x1: l.x + ancho, y0: l.y, y1: l.y + alto };
      if (caja.x0 < 0 || caja.y0 < 0 || caja.x1 > marco.ancho || caja.y1 > marco.alto) continue;
      const pisa = ocupado.some(
        (o) => o.id !== p.id && caja.x0 < o.x1 && caja.x1 > o.x0 && caja.y0 < o.y1 && caja.y1 > o.y0
      );
      if (pisa) continue;
      // Se guarda inflado: el próximo nombre tiene que quedar a esa distancia,
      // no pegado. Los puntos no se inflan, porque un nombre al lado de su
      // propio punto o de uno vecino sí se lee.
      ocupado.push({
        id: `nombre-${p.id}`,
        x0: caja.x0 - SEPARACION_NOMBRES,
        x1: caja.x1 + SEPARACION_NOMBRES,
        y0: caja.y0 - 1,
        y1: caja.y1 + 1,
      });
      etiquetas.push({ id: p.id, texto: p.texto, x: l.x, y: l.y, ancho, alto });
      break;
    }
  }

  return etiquetas;
}

/**
 * Quedarse con la mitad más fuerte de lo que sugirió el indexador.
 *
 * **Lo que el indexador guarda no son relaciones: es parecido.** Embebe cada
 * elemento y conecta a los que quedaron cerca en ese espacio vectorial. Y
 * adentro de un espacio temático todo se parece a todo, porque todo habla del
 * mismo tema: medido sobre «Crisis de gasolina 2026», los pesos iban de 0.78 a
 * 1.00 —una franja angosta y alta—, el 25% de todas las parejas posibles tenía
 * arista, un solo nodo tocaba a 32 de los otros 33, y no quedaba ni uno suelto.
 * Un grafo casi completo no tiene grupos que mostrar: es una mancha.
 *
 * El corte va en la mediana **de ese espacio** y no en un número fijo, porque la
 * escala del parecido cambia según qué tan parecido sea el contenido entre sí.
 * Con ese corte, el mismo espacio pasa a 36 lazos, 6.8% de densidad y grado
 * máximo 9 — que ya es una forma con partes distinguibles.
 *
 * Lo que hiciste a mano no pasa por acá. Son pocas y son ciertas: una relación
 * que afirmaste no se descarta por estadística.
 */
function fuertes(aristas) {
  if (aristas.length < 6) return aristas;

  const pesos = aristas
    .map((a) => Number(a.weight))
    .filter(Number.isFinite)
    .sort((x, y) => x - y);

  // Sin peso no hay con qué comparar: entran todas antes que ninguna.
  if (!pesos.length) return aristas;

  const mediana = pesos[Math.floor((pesos.length - 1) / 2)];
  return aristas.filter((a) => (Number(a.weight) || 0) >= mediana);
}

/**
 * Ids de las aristas del índice que realmente quedaron dibujadas.
 *
 * No es lo mismo que «todas las sugeridas»: el corte de mediana y el tope de
 * nodos dejan varias afuera. Aceptar es un acto editorial sobre lo que se ve,
 * no sobre el dump entero del indexador.
 */
export function idsIndiceMostrados(aristas = [], lazos = []) {
  const claves = new Set();
  for (const l of lazos) {
    if (l.clase === 'indice' && l.clave) claves.add(l.clave);
  }
  if (!claves.size) return [];

  const ids = [];
  const vistos = new Set();
  for (const e of aristas) {
    if (!e?.id || !e.source_id || !e.target_id) continue;
    if (e.origin === 'codex_relation' || e.origin === 'user') continue;
    const clave = e.source_id < e.target_id ? `${e.source_id}|${e.target_id}` : `${e.target_id}|${e.source_id}`;
    if (!claves.has(clave) || vistos.has(e.id)) continue;
    vistos.add(e.id);
    ids.push(e.id);
  }
  return ids;
}

// ─── Acomodo ──────────────────────────────────────────────────────────────────

/**
 * Dejar que el grafo se asiente.
 *
 * Tres fuerzas, todas sobre todos a la vez:
 *
 *  · **repulsión** — cada nodo empuja a cada otro. Es lo que hace que una nube
 *    sin ninguna arista igual se despliegue en vez de amontonarse en el centro.
 *  · **resortes** — cada lazo tira de sus dos puntas. Los de relación tiran más
 *    que los del índice, y por eso lo que afirmaste queda más junto que lo que
 *    una máquina supuso.
 *  · **gravedad al centro** — floja, solo para que lo suelto no se escape.
 *
 * Más una corrección de choque al final de cada paso: si dos nodos se montan,
 * se separan a la fuerza. La repulsión sola no alcanza porque es suave y dos
 * nodos muy pesados pueden quedar solapados en el punto de equilibrio.
 *
 * El enfriado (`temple`) es lo que hace que esto termine: los primeros pasos
 * mueven mucho y los últimos casi nada, así que el dibujo se congela en vez de
 * quedar vibrando.
 */
export function acomodar(nodos, lazos, { ancho, alto }, { sal = 0, iniciales = null } = {}) {
  const n = nodos.length;
  if (!n) return [];

  const cx = ancho / 2;
  const cy = alto / 2;

  // Arranque determinista: cada nodo sale de un punto del círculo que le toca
  // por su id. No importa dónde arranque —las fuerzas lo llevan— pero sí que
  // arranque siempre en el mismo lado, porque de eso depende que el dibujo sea
  // el mismo cada vez.
  //
  // `sal` cambia ese punto de arranque, siempre de forma determinista: es lo que
  // usa el seguro para reintentar un acomodo que salió mal.
  //
  // `iniciales` son las posiciones del dibujo anterior. Lo que ya estaba
  // arranca donde estaba, y lo nuevo —las ideas de un concepto que se abre—
  // junto a su concepto: abrir o cerrar no desordena lo que ya se miraba.
  const p = nodos.map((nodo, i) => {
    const h = hash(sal ? `${nodo.id}#${sal}` : nodo.id);
    const ang = ((h % 3600) / 3600) * Math.PI * 2;
    const previo = iniciales?.get(nodo.id);
    if (previo) return { x: previo.x, y: previo.y, vx: 0, vy: 0, i };
    const ancla = nodo.cerca ? iniciales?.get(nodo.cerca) : null;
    if (ancla) {
      const r = 8 + ((h >> 7) % 12);
      return { x: ancla.x + Math.cos(ang) * r, y: ancla.y + Math.sin(ang) * r, vx: 0, vy: 0, i };
    }
    const r = 20 + ((h >> 7) % 100) * (Math.min(ancho, alto) / 420);
    return { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r, vx: 0, vy: 0, i };
  });

  const indice = new Map(nodos.map((nd, i) => [nd.id, i]));
  const resortes = lazos
    // Ser parte de un concepto es lo que más tira: arma los racimos. Lo que la
    // historia nombra tira casi como una relación afirmada, porque está
    // escrito. Lo que solo se parece tira menos.
    .map((l) => ({
      a: indice.get(l.a),
      b: indice.get(l.b),
      k: RESORTE[l.clase] ?? 0.045,
    }))
    .filter((r) => r.a !== undefined && r.b !== undefined);

  // La repulsión se escala con el lugar disponible: el mismo grafo en una franja
  // angosta tiene que apretarse, no desbordarse.
  const area = ancho * alto;
  // Estos dos números —cuánto tira un lazo y cuánto empuja un nodo— son los que
  // deciden si los grupos se ven o no. Se midieron: con tres grupos que no se
  // tocan entre sí, la distancia media entre grupos contra la de adentro de
  // cada uno pasa de 1.54x a 1.89x al subir el resorte y aflojar la repulsión.
  // Más resorte que esto vuelve a empeorar —los grupos se contraen tanto que el
  // encuadre los agranda a todos por igual— y además empieza a apretar nodos.
  const REPULSION = (area / n) * 0.6;
  const CERCA = 5;
  const pasoMax = Math.max(ancho, alto) * 0.06;

  // Partiendo de un dibujo anterior, la simulación arranca tibia: lo que ya
  // estaba en su lugar apenas se mueve, y lo nuevo se acomoda alrededor.
  const calor = iniciales ? 0.3 : 1;

  for (let paso = 0; paso < PASOS; paso++) {
    const temple = calor * (1 - paso / PASOS);

    for (let i = 0; i < n; i++) {
      let fx = 0;
      let fy = 0;

      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        let dx = p[i].x - p[j].x;
        let dy = p[i].y - p[j].y;
        let d2 = dx * dx + dy * dy;
        // Dos nodos exactamente encima tendrían fuerza infinita y dirección
        // indefinida. Se los separa con el hash, que mantiene el determinismo.
        if (d2 < 0.01) {
          dx = ((hash(nodos[i].id + nodos[j].id) % 100) - 50) / 100;
          dy = ((hash(nodos[j].id + nodos[i].id) % 100) - 50) / 100;
          d2 = 0.01;
        }
        const d = Math.sqrt(d2);
        // La repulsión es inversa al cuadrado de la distancia, y dos nodos que
        // arrancan casi encima —con cien nodos, pasa— se empujaban con una
        // fuerza miles de veces mayor que la normal: uno salía disparado, el
        // encuadre achicaba todo para que entrara y el grafo quedaba aplastado
        // en una esquina. Por debajo de `CERCA` la fuerza deja de crecer.
        const f = REPULSION / Math.max(d2, CERCA * CERCA);
        fx += (dx / d) * f;
        fy += (dy / d) * f;
      }

      // Gravedad: proporcional a la distancia, como una goma al centro.
      fx += (cx - p[i].x) * 0.006;
      fy += (cy - p[i].y) * 0.006;

      p[i].vx = (p[i].vx + fx) * 0.82;
      p[i].vy = (p[i].vy + fy) * 0.82;
    }

    for (const r of resortes) {
      const dx = p[r.b].x - p[r.a].x;
      const dy = p[r.b].y - p[r.a].y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      // Largo de reposo: la suma de los dos radios más aire. Así dos nodos
      // grandes conectados no se incrustan uno en el otro.
      const reposo = nodos[r.a].radio + nodos[r.b].radio + 14;
      const f = (d - reposo) * r.k;
      const ux = (dx / d) * f;
      const uy = (dy / d) * f;
      p[r.a].vx += ux;
      p[r.a].vy += uy;
      p[r.b].vx -= ux;
      p[r.b].vy -= uy;
    }

    // Ningún nodo se mueve más que `pasoMax` por paso. Es el segundo freno: un
    // nodo con muchas líneas —un actor mencionado veinte veces— suma la
    // fuerza de todas, y sin tope se pasa de largo, rebota y se escapa.
    for (let i = 0; i < n; i++) {
      const v = Math.sqrt(p[i].vx * p[i].vx + p[i].vy * p[i].vy);
      if (v > pasoMax) {
        p[i].vx = (p[i].vx / v) * pasoMax;
        p[i].vy = (p[i].vy / v) * pasoMax;
      }
      p[i].x += p[i].vx * temple;
      p[i].y += p[i].vy * temple;
    }

    // Choques: lo que quedó montado se separa, mitad para cada lado.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = p[j].x - p[i].x;
        const dy = p[j].y - p[i].y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const minimo = (nodos[i].radio + nodos[j].radio) * 0.82;
        if (d < minimo) {
          const empuje = (minimo - d) / 2;
          const ux = (dx / d) * empuje;
          const uy = (dy / d) * empuje;
          p[i].x -= ux;
          p[i].y -= uy;
          p[j].x += ux;
          p[j].y += uy;
        }
      }
    }
  }

  return encuadrar(nodos, p, ancho, alto);
}

/**
 * Meter lo que se asentó adentro del marco.
 *
 * La simulación no sabe nada del lienzo: trabaja en un plano sin bordes y puede
 * terminar corrida o más grande que la pantalla. Acá se mide lo que quedó y se
 * escala de una vez, en lugar de recortar contra los bordes durante la
 * simulación —que deformaría el resultado, apretando contra las paredes lo que
 * en realidad quería estar afuera.
 *
 * Solo se achica, nunca se agranda: un espacio con dos elementos se vería
 * ridículo con los dos puntos estirados a los extremos del marco.
 */
function encuadrar(nodos, p, ancho, alto) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;

  for (let i = 0; i < nodos.length; i++) {
    x0 = Math.min(x0, p[i].x - nodos[i].ancho / 2);
    x1 = Math.max(x1, p[i].x + nodos[i].ancho / 2);
    y0 = Math.min(y0, p[i].y - nodos[i].alto / 2);
    y1 = Math.max(y1, p[i].y + nodos[i].alto / 2);
  }

  const w = Math.max(x1 - x0, 1);
  const h = Math.max(y1 - y0, 1);
  const margen = 10;
  const escala = Math.min(1, (ancho - margen * 2) / w, (alto - margen * 2) / h);

  // Se centra lo que sobra, para que un grafo chico no quede pegado arriba.
  const dx = (ancho - w * escala) / 2 - x0 * escala;
  const dy = (alto - h * escala) / 2 - y0 * escala;

  return nodos.map((nodo, i) => ({
    ...nodo,
    x: p[i].x * escala + dx,
    y: p[i].y * escala + dy,
    // El punto acompaña la escala: si el dibujo se achicó para entrar, los
    // puntos tienen que achicarse con él o volverían a chocar.
    cuerpo: nodo.cuerpo * escala,
  }));
}
