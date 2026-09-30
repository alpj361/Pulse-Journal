/**
 * El documento de una nota: `vizta.doc/1`.
 *
 * Es Portable Text —bloques con `children` de spans, `marks` y `markDefs`—
 * más tipos propios para lo que Portable Text no trae (to-do, toggle,
 * separador, código, fórmula, dibujo, tabla, datasheet, medio, página). Se
 * eligió Portable Text porque es una spec abierta con `_key` estable por
 * bloque y por span, que es lo que permite fusionar por bloque y rastrear por
 * bloque; la web lo puede pintar con los serializadores que ya existen.
 *
 * Vive en `details.documento`. `description` sigue siendo markdown, generado
 * desde acá (`aMarkdown`): el indexador, el rastreo, Vizta, la búsqueda y la
 * web lo siguen leyendo sin enterarse del cambio.
 *
 * Este archivo es JS puro, sin React ni React Native: lo usan la app, las
 * pruebas y el script de ida y vuelta que corre en Node.
 */

export const TIPO = 'vizta.doc';
export const VERSION = 1;

/** Estilos de un bloque de texto. `cita` es el «Foco» de la barra; `tarjeta`, el «Block». */
export const ESTILOS = ['normal', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'cita', 'tarjeta'];

/** Listas planas, como en Portable Text: cada renglón dice su tipo y su nivel. */
export const LISTAS = ['bullet', 'number'];

/**
 * Marcas sin datos. Las que llevan datos (resaltado con color, enlace) van en
 * `markDefs` y la marca del span es la `_key` de esa definición.
 */
export const DECORADORES = ['strong', 'em', 'code', 'underline', 'strike'];

export const TIPOS_DE_MARCA = ['resaltado', 'link'];

/**
 * El resaltado de siempre, el `==así==` de la nota vieja. Tiene `_key` fija
 * para que dos resaltados amarillos del mismo bloque compartan definición y
 * el markdown → doc → markdown no invente claves nuevas en cada vuelta.
 */
export const RESALTADO_AMARILLO = { _key: 'h-amarillo', _type: 'resaltado', color: '#F5C842' };

/**
 * Los colores del resaltado (F2). Cinco, suaves, que se leen sobre el papel
 * y no compiten con el color de los nombres del Codex. Claves fijas, como el
 * amarillo: dos resaltados del mismo color comparten definición. En
 * markdown todos se escriben `==así==` (el color vive en el documento).
 */
export const RESALTADOS = [
  RESALTADO_AMARILLO,
  { _key: 'h-verde', _type: 'resaltado', color: '#8FD19E' },
  { _key: 'h-azul', _type: 'resaltado', color: '#8DB8F2' },
  { _key: 'h-rosa', _type: 'resaltado', color: '#F2A7C3' },
  { _key: 'h-naranja', _type: 'resaltado', color: '#F7B267' },
];

export const ESTILOS_DE_SEPARADOR = ['puntos', 'punteado', 'corte', 'fina', 'gruesa'];

export const TIPOS_DE_MEDIO = ['foto', 'audio', 'documento'];

/** Los tipos de bloque que se conocen. Uno desconocido no se valida pero tampoco se borra. */
export const TIPOS_DE_BLOQUE = [
  'block',
  'todo',
  'toggle',
  'separador',
  'codigo',
  'formula',
  'dibujo',
  'tabla',
  'datasheet',
  'medio',
  'pagina',
];

/** Los bloques cuyo texto está en `children` de spans y se edita en línea. */
export const CON_TEXTO = ['block', 'todo', 'toggle'];

// ── Claves ──────────────────────────────────────────────────────────────────

const LETRAS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Una `_key` nueva. Doce caracteres al azar, como las de Portable Text: sin
 * contador global, porque dos dispositivos crean bloques sin hablarse y la
 * fusión por bloque depende de que no choquen.
 */
export function nuevaClave() {
  let k = '';
  for (let i = 0; i < 12; i++) k += LETRAS[Math.floor(Math.random() * LETRAS.length)];
  return k;
}

/**
 * Claves predecibles para las pruebas: `k1`, `k2`, … Con claves al azar, un
 * documento esperado no se podría escribir a mano.
 */
export function clavesEnSerie(prefijo = 'k') {
  let n = 0;
  return () => `${prefijo}${++n}`;
}

// ── Construcción ────────────────────────────────────────────────────────────

export function crearDocumento({ clave = nuevaClave, bloques = [] } = {}) {
  return {
    _type: TIPO,
    version: VERSION,
    paginas: [{ _key: clave(), titulo: '', bloques }],
  };
}

// ── Validación ──────────────────────────────────────────────────────────────

/**
 * Revisa que un documento tenga la forma de `vizta.doc/1`.
 *
 * Devuelve todos los errores y no solo el primero: cuando un documento llega
 * roto de otro dispositivo, saber qué más está roto es lo que dice si se
 * repara o se descarta. No lanza: guardar una nota nunca debería romperse por
 * validar.
 *
 * @returns {{ ok: boolean, errores: string[] }}
 */
export function validar(doc) {
  const errores = [];
  const err = (donde, que) => errores.push(`${donde}: ${que}`);

  if (!doc || typeof doc !== 'object') return { ok: false, errores: ['documento: no es un objeto'] };
  if (doc._type !== TIPO) err('documento', `_type debería ser «${TIPO}»`);
  if (doc.version !== VERSION) err('documento', `versión ${doc.version} desconocida`);
  if (!Array.isArray(doc.paginas) || !doc.paginas.length) {
    err('documento', 'sin páginas');
    return { ok: false, errores };
  }

  // Una sola bolsa de claves para todo el documento: la fusión y el mapa del
  // rastreo buscan un bloque por su `_key` sin saber en qué página está.
  const vistas = new Set();
  const clave = (donde, k) => {
    if (typeof k !== 'string' || !k) return err(donde, 'sin _key');
    if (vistas.has(k)) err(donde, `_key repetida «${k}»`);
    vistas.add(k);
  };

  // La historia como datasheet (F5): cuál dataset y qué columna titula.
  if (doc.datasheet != null && (typeof doc.datasheet !== 'object' || typeof doc.datasheet.dataset_id !== 'string')) {
    err('documento', 'datasheet sin dataset_id');
  }

  const paginas = new Set(doc.paginas.map((p) => p?._key));

  const validarBloques = (bloques, donde) => {
    if (!Array.isArray(bloques)) return err(donde, 'bloques no es una lista');
    bloques.forEach((b, i) => validarBloque(b, `${donde}[${i}]`));
  };

  const validarSpans = (b, donde) => {
    if (!Array.isArray(b.children)) return err(donde, 'children no es una lista');
    // Las claves de `markDefs` son del bloque, no del documento: dos bloques
    // pueden tener cada uno su `h-amarillo`.
    const defs = new Set();
    for (const d of b.markDefs || []) {
      if (typeof d?._key !== 'string' || !d._key) err(`${donde}.markDefs`, 'sin _key');
      else if (defs.has(d._key)) err(`${donde}.markDefs`, `_key repetida «${d._key}»`);
      if (!TIPOS_DE_MARCA.includes(d?._type)) err(`${donde}.markDefs`, `tipo de marca «${d?._type}» desconocido`);
      defs.add(d?._key);
    }
    b.children.forEach((s, j) => {
      const aca = `${donde}.children[${j}]`;
      if (s?._type !== 'span') return err(aca, 'no es un span');
      clave(aca, s._key);
      if (typeof s.text !== 'string') err(aca, 'text no es texto');
      for (const m of s.marks || []) {
        if (!DECORADORES.includes(m) && !defs.has(m)) err(aca, `marca «${m}» sin definición`);
      }
    });
  };

  const validarBloque = (b, donde) => {
    if (!b || typeof b !== 'object') return err(donde, 'no es un bloque');
    clave(donde, b._key);

    switch (b._type) {
      case 'block':
        if (!ESTILOS.includes(b.style)) err(donde, `estilo «${b.style}» desconocido`);
        if (b.listItem !== undefined) {
          if (!LISTAS.includes(b.listItem)) err(donde, `lista «${b.listItem}» desconocida`);
          if (!Number.isInteger(b.level) || b.level < 1) err(donde, 'nivel de lista inválido');
        }
        // `numero`: el número escrito de un renglón numerado cuando no es el
        // que daría la cuenta (ver `contadorDeListas`).
        if (b.numero !== undefined && !(Number.isInteger(b.numero) && b.numero >= 0)) {
          err(donde, 'numero inválido');
        }
        validarSpans(b, donde);
        break;
      case 'todo':
        if (typeof b.hecho !== 'boolean') err(donde, 'hecho no es sí/no');
        validarSpans(b, donde);
        break;
      case 'toggle':
        validarSpans(b, donde);
        validarBloques(b.bloques || [], `${donde}.bloques`);
        break;
      case 'separador':
        if (!ESTILOS_DE_SEPARADOR.includes(b.estilo)) err(donde, `separador «${b.estilo}» desconocido`);
        break;
      case 'codigo':
        if (typeof b.texto !== 'string') err(donde, 'código sin texto');
        break;
      case 'formula':
        if (typeof b.latex !== 'string') err(donde, 'fórmula sin latex');
        break;
      case 'tabla':
        if (!Array.isArray(b.filas) || !b.filas.every((f) => Array.isArray(f) && f.every((c) => typeof c === 'string'))) {
          err(donde, 'filas no es una lista de listas de texto');
        }
        break;
      case 'medio':
        if (!TIPOS_DE_MEDIO.includes(b.tipo)) err(donde, `medio «${b.tipo}» desconocido`);
        break;
      case 'pagina':
        if (!paginas.has(b.pagina)) err(donde, `página «${b.pagina}» no existe`);
        break;
      case 'dibujo':
      case 'datasheet':
        break;
      default:
        err(donde, `tipo de bloque «${b._type}» desconocido`);
    }
  };

  doc.paginas.forEach((p, i) => {
    const donde = `paginas[${i}]`;
    if (!p || typeof p !== 'object') return err(donde, 'no es una página');
    clave(donde, p._key);
    validarBloques(p.bloques, `${donde}.bloques`);
  });

  return { ok: errores.length === 0, errores };
}

/** Si parece un documento, sin validarlo entero. Para decidir qué editor abre. */
export const esDocumento = (x) => !!x && x._type === TIPO && Array.isArray(x.paginas);
