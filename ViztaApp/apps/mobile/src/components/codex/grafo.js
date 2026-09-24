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
export function armar({ items = [], relaciones = [], aristas = [], menciones = new Map(), nota = null }) {
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

  // La historia entra como dos clases de nodo. Las ideas —cada oración— son
  // puntos sin nombre: se leen tocándolas. Los conceptos son lo que las agrupa
  // y llevan el nombre que el indexador sacó del texto. Los ids llevan prefijo
  // porque viven en otras tablas y no pueden confundirse con un elemento.
  for (const i of nota?.ideas || []) {
    nodos.push({ id: `idea:${i.id}`, idea: i, texto: '', tipo: 'Idea', veces: 0 });
  }
  for (const c of nota?.conceptos || []) {
    if (!c.ideas?.length) continue;
    nodos.push({
      id: `con:${c.id}`,
      concepto: c,
      texto: recortar(c.nombre, LARGO_CONCEPTO),
      tipo: 'Concepto',
      veces: 0,
    });
  }

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
    for (const id of c.ideas || []) agregar(`idea:${id}`, `con:${c.id}`, 'miembro', 1);
  }
  for (const i of nota?.ideas || []) {
    for (const id of i.menciona || []) agregar(`idea:${i.id}`, id, 'menciona', 1);
  }
  for (const l of nota?.lazos || []) {
    agregar(l.a, l.b, l.tipo === 'mentions' ? 'menciona' : 'parecido', l.peso);
  }

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
export function construir({ items, relaciones, aristas, menciones, marco, nota = null }) {
  const base = armar({ items, relaciones, aristas, menciones, nota });
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
      (b.concepto ? 1 : 0) - (a.concepto ? 1 : 0) ||
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
    const r = n.concepto
      ? 7.5
      : n.idea
        ? 3 + Math.min(3, (n.grado || 0) * 0.45)
        : R_MIN + (R_MAX - R_MIN) * Math.sqrt(peso / techo);
    // `radio` es con cuánto empuja: el punto más aire, para que dos puntos no
    // queden pegados y entre ellos quepa una línea que se vea.
    return { ...n, peso, cuerpo: r, radio: r + 7, ancho: r * 2, alto: r * 2 };
  });

  const nodos = acomodar(puntos, lazos, marco);
  return { nodos, lazos, etiquetas: etiquetar(nodos, marco), ocultos };
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
function etiquetar(nodos, marco) {
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
      (b.concepto ? 1 : 0) - (a.concepto ? 1 : 0) ||
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
export function acomodar(nodos, lazos, { ancho, alto }) {
  const n = nodos.length;
  if (!n) return [];

  const cx = ancho / 2;
  const cy = alto / 2;

  // Arranque determinista: cada nodo sale de un punto del círculo que le toca
  // por su id. No importa dónde arranque —las fuerzas lo llevan— pero sí que
  // arranque siempre en el mismo lado, porque de eso depende que el dibujo sea
  // el mismo cada vez.
  const p = nodos.map((nodo, i) => {
    const h = hash(nodo.id);
    const ang = ((h % 3600) / 3600) * Math.PI * 2;
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

  for (let paso = 0; paso < PASOS; paso++) {
    const temple = 1 - paso / PASOS;

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
        const f = REPULSION / d2;
        const d = Math.sqrt(d2);
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

    for (let i = 0; i < n; i++) {
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
