/**
 * La capa de medios de una card: quién cuenta la historia y si coinciden.
 *
 * `news_cards.cards` trae, desde la corrida del 2026-09-08, un análisis de
 * encuadre por tweet y de narrativas por historia. Este módulo es lo único que
 * lee esos campos, y existe separado de las vistas por dos razones:
 *
 *  · **Los campos pueden faltar.** Toda fila anterior a esa corrida no los
 *    tiene, y las cards con una sola fuente editorial no los tienen nunca. Si
 *    cada componente hiciera su propio `card?.fuentes?.casas ?? []`, bastaría
 *    con que uno se olvide para que la card reviente en el feed.
 *  · **Interpretarlos mal es fácil.** Hay tres trampas —el valor neutro, el
 *    análisis fallido, y qué describe el espectro— y cada una está documentada
 *    donde se resuelve.
 */

/**
 * El valor que significa «este medio no tomó postura».
 *
 * Es el ~80% de los tweets, y **no se pinta**. No es una etiqueta más de las
 * ocho: es la ausencia de etiqueta. Ocho colores de chip harían una pared de
 * «Informativo sin encuadre» que no dice nada, y de paso enterrarían los pocos
 * tweets que sí tienen postura — que son justamente la señal.
 */
export const SIN_ENCUADRE = 'Informativo sin encuadre';

/**
 * Los espectros con postura, agrupados por lo que **de verdad** miden.
 *
 * La lista cerrada trae ocho valores, y la tentación es ponerlos los siete no
 * neutros en una línea. No se puede: no son un continuo. Son dos ejes con polos
 * opuestos y tres miradas sectoriales que no se ordenan entre sí.
 *
 * Decir que «Empresarial» está entre «Institucional» y «Comunitario» en algún
 * eje no afirma nada verificable. Separarlos sí sirve, y de hecho responde algo
 * mejor: **en qué** está polarizada una historia. Puede estar partida al medio
 * entre Oficialista y Crítico del poder y a la vez ser uniformemente
 * Institucional.
 */
export const EJES = [
  {
    id: 'poder',
    nombre: 'frente al poder',
    polos: ['Oficialista', 'Crítico del poder'],
  },
  {
    id: 'ideologico',
    nombre: 'ideológico',
    polos: ['Conservador', 'Progresista'],
  },
];

/** Desde qué sector se mira. No se ordenan entre sí, así que van como grupo. */
export const SECTORES = ['Institucional', 'Empresarial', 'Comunitario'];

/** Los ocho valores exactos, para validar lo que llega. */
export const ESPECTROS = [
  ...EJES.flatMap((e) => e.polos),
  ...SECTORES,
  SIN_ENCUADRE,
];

/** Cómo de comprometido está el lenguaje del tweet. */
export const LENGUAJES = ['atribuido', 'asertivo', 'valorativo'];

// ─── Lectura tolerante ───────────────────────────────────────────────────────

const lista = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);

/**
 * Las fuentes de la historia.
 *
 * `contrastada` es la compuerta de todo lo demás: significa dos o más casas
 * editoriales distintas. Sin eso no hay narrativas ni divergencia ni encuadres,
 * y **no es un error** — con una sola fuente no hay nada que contrastar.
 */
export function fuentesDe(card) {
  const f = card?.fuentes;
  return {
    casas: lista(f?.casas),
    handles: lista(f?.handles),
    independientes: Number.isFinite(f?.independientes) ? f.independientes : 0,
    contrastada: f?.contrastada === true,
  };
}

/** ¿Hay más de una casa editorial? Es la compuerta de la capa de medios. */
export function contrastada(card) {
  return fuentesDe(card).contrastada;
}

/** Las narrativas en competencia. Vacío si no está contrastada. */
export function narrativasDe(card) {
  if (!contrastada(card)) return [];

  return lista(card?.narrativas)
    .filter((n) => n?.narrativa)
    .map((n) => ({
      narrativa: String(n.narrativa),
      casas: lista(n.casas),
      evidencia: n.evidencia ? String(n.evidencia) : null,
    }));
}

/**
 * Si las fuentes coinciden o no.
 *
 * Devuelve `'coinciden' | 'divergen' | 'desconocido'`, y esa tercera opción es
 * el punto entero de esta función.
 *
 * El campo llega como `{ hay, en_que }` **o como `null` si el análisis falló**,
 * y tratar los dos casos igual sería afirmar que las fuentes coinciden cuando
 * en realidad nadie llegó a compararlas. Es la clase de error que no se ve
 * —queda una card que se lee bien— y que dice algo falso sobre la noticia.
 */
export function divergenciaDe(card) {
  if (!contrastada(card)) return { estado: 'desconocido', enQue: null };

  const d = card?.divergencia;
  if (!d || typeof d.hay !== 'boolean') return { estado: 'desconocido', enQue: null };

  return {
    estado: d.hay ? 'divergen' : 'coinciden',
    enQue: d.hay && d.en_que ? String(d.en_que) : null,
  };
}

/**
 * El encuadre de un tweet, o `null` si no tiene postura.
 *
 * Devuelve `null` tanto para el tweet sin análisis como para el neutro, y eso
 * es a propósito: los dos se pintan igual —no se pintan— así que quien llama no
 * tiene que distinguirlos para renderizar.
 */
export function encuadreDe(tweet) {
  const e = tweet?.encuadre;
  if (!e?.espectro || e.espectro === SIN_ENCUADRE) return null;
  if (!ESPECTROS.includes(e.espectro)) return null; // valor fuera de la lista

  return {
    espectro: e.espectro,
    enfoque: e.enfoque ? String(e.enfoque) : null,
    lenguaje: LENGUAJES.includes(e.lenguaje) ? e.lenguaje : null,
    evidencia: e.evidencia ? String(e.evidencia) : null,
  };
}

/**
 * El lenguaje que **no** es el esperado.
 *
 * `atribuido` es la práctica periodística por defecto —«según X»— así que
 * marcarlo no informa nada: es lo que se supone. Se muestran solo los otros
 * dos, por la misma razón por la que no se pinta `Informativo sin encuadre`.
 *
 * Y se muestran con la palabra del contrato, sin traducir. La tentación era
 * escribir «afirma sin atribuir» para `asertivo`, pero eso ya es un juicio:
 * un medio que reporta «el Congreso aprobó la ley» es asertivo y está
 * perfecto — no se atribuye un hecho público. `asertivo` describe; «sin
 * atribuir» insinúa una falta que el dato no respalda.
 */
function lenguajeVisible(lenguaje) {
  return lenguaje === 'asertivo' || lenguaje === 'valorativo' ? lenguaje : null;
}

/**
 * Lo que hay que marcar sobre un tweet, o `null` si no hay nada.
 *
 * Existe aparte de `encuadreDe` porque las dos mitades son independientes: un
 * tweet **neutro** puede ser `asertivo`. Si reusara `encuadreDe` —que descarta
 * el neutro— se perdería el lenguaje justamente en el 82% de los casos, que es
 * donde vive casi toda la dispersión de ese campo.
 */
export function marcaDe(tweet) {
  const e = tweet?.encuadre;
  if (!e) return null;

  const espectro =
    e.espectro && e.espectro !== SIN_ENCUADRE && ESPECTROS.includes(e.espectro)
      ? e.espectro
      : null;

  const lenguaje = lenguajeVisible(e.lenguaje);
  if (!espectro && !lenguaje) return null;

  return { espectro, lenguaje, enfoque: e.enfoque ? String(e.enfoque) : null };
}

/**
 * Cuántos encuadres caen en cada espectro con postura.
 *
 * **Se cuenta sobre `encuadres`, no sobre `tweets_muestra`.** Los dos traen lo
 * mismo por tweet, y parecen intercambiables, pero no lo son: `encuadres`
 * analiza *todos* los tweets de la historia mientras `tweets_muestra` enseña
 * apenas una muestra. En los datos reales del 2026-09-09 hay cards con 8
 * encuadres y 3 tweets de muestra — contar sobre la muestra describiría 3 de 8
 * y llamaría a eso «cómo se está contando la historia».
 *
 * La muestra sirve para lo otro: **marcar un tweet concreto**, que es
 * `encuadreDe`, y ahí el dato inline evita el cruce por `tweet_id`. Cada cosa
 * desde donde corresponde.
 *
 * Si `encuadres` no viniera —fila vieja, o card sin contrastar— se cae a la
 * muestra: es menos, pero es lo que hay, y quedarse en cero sería peor.
 */
export function distribucionDe(card) {
  const cuenta = new Map();
  let conPostura = 0;
  let total = 0;

  const desdeArray = lista(card?.encuadres);
  const fuente = desdeArray.length
    ? desdeArray.map((e) => ({ encuadre: e }))
    : lista(card?.tweets_muestra);

  for (const t of fuente) {
    total++;
    const e = encuadreDe(t);
    if (!e) continue;
    conPostura++;
    cuenta.set(e.espectro, (cuenta.get(e.espectro) || 0) + 1);
  }

  return { cuenta, conPostura, total, deMuestra: !desdeArray.length };
}

/**
 * Los ejes con datos, listos para dibujar.
 *
 * Un eje solo aparece si **algún** tweet cae en alguno de sus dos polos: un eje
 * vacío no dice «equilibrado», dice «nadie se posicionó acá», y dibujarlo
 * centrado afirmaría lo primero.
 *
 * `sesgo` va de -1 (todo en el primer polo) a 1 (todo en el segundo), y 0 es
 * partido al medio. Es lo que permite ver de un golpe si una historia se está
 * contando toda desde un lado.
 */
export function ejesDe(card) {
  const { cuenta } = distribucionDe(card);

  const ejes = EJES.map((eje) => {
    const [a, b] = eje.polos.map((p) => cuenta.get(p) || 0);
    const n = a + b;
    return { ...eje, conteos: [a, b], n, sesgo: n ? (b - a) / n : 0 };
  }).filter((e) => e.n > 0);

  const sectores = SECTORES.map((s) => ({ sector: s, n: cuenta.get(s) || 0 })).filter(
    (s) => s.n > 0
  );

  return { ejes, sectores };
}

// ─── La línea de la card ─────────────────────────────────────────────────────

/**
 * La única línea que la capa de medios se gana en el feed.
 *
 * Devuelve `{ texto, alerta }` o `null`. `null` significa que la card se dibuja
 * exactamente como antes — sin sección vacía y sin placeholder: una card que
 * muestra el hueco donde iría el análisis se lee como que algo falló, cuando lo
 * que pasa es que con una sola fuente no había nada que contrastar.
 *
 * El feed sirve para barrer «qué pasó hoy». De todo este análisis, lo único que
 * cambia si te detenés a leer una card es que las fuentes no coincidan; el
 * resto es material de lectura y vive en el detalle.
 */
export function lineaDeCard(card) {
  const f = fuentesDe(card);
  if (!f.contrastada) return null;

  const d = divergenciaDe(card);
  const casas = f.casas.length;

  if (d.estado === 'divergen') {
    return {
      texto: d.enQue ? `las fuentes no coinciden en ${d.enQue}` : 'las fuentes no coinciden',
      alerta: true,
    };
  }

  if (d.estado === 'coinciden') {
    return { texto: `${casas} casas · coinciden`, alerta: false };
  }

  // Análisis fallido o ausente: se dice cuántas casas cubrieron la historia,
  // que es un hecho, y no se afirma nada sobre si coinciden.
  return { texto: casas === 1 ? '1 casa' : `${casas} casas`, alerta: false };
}
