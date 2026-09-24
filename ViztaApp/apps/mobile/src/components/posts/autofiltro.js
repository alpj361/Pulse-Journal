/**
 * Autofiltro de posts: grupos que salen de los análisis, sin llamar al modelo.
 *
 * Cada post analizado ya trae lo que menciona —con su tipo y, a veces, su
 * vínculo al Codex— y sus temas. De ahí salen los grupos por los que se puede
 * filtrar: país, tema, lugares, entidades y actores. No hay prompt nuevo ni
 * servidor: si mañana entran más posts, aparecen más grupos solos.
 *
 * **Solo se ofrece lo que agrupa.** Un valor que aparece en un único post no
 * asocia nada con nada, y medido sobre 19 posts los temas eran 58 distintos y
 * apenas 8 se repetían: un filtro con 58 opciones de a un post no filtra, lista.
 * Por eso temas, lugares, entidades y actores muestran lo que está en dos posts
 * o más. País es la excepción —son pocos por naturaleza, y saber que hay un
 * post de Haití entre veinte de Guatemala ya es información—.
 *
 * **País no es un campo del análisis.** Los territorios mezclan países,
 * ciudades, municipios y zonas. Se deduce de tres lugares, en orden: que el
 * territorio sea un país («Haití»), que su nombre lo contenga («Ciudad de
 * Guatemala»), o que su pista lo diga («Mixco: municipio en Guatemala»).
 *
 * **País y lugares agrupan por lo que el post trata, no por todo lo que nombra.**
 * Un reel sobre Corea del Sur que compara con Estados Unidos es un post de
 * Corea: Estados Unidos sigue entre sus mencionados, pero filtrar por Estados
 * Unidos y encontrarlo ahí es ruido. El análisis marca cada mención como
 * `central` o `referencia` —comparación, ejemplo, antecedente— y aquí solo
 * cuentan las centrales. Pueden ser varias: un post que trata de dos países
 * aparece bajo los dos.
 *
 * Los análisis de antes del rol no lo traen, y se estima: cuenta si es el único
 * territorio del post, si la narrativa o los temas lo nombran, o si el texto lo
 * repite. Es una aproximación; volver a analizar el post la reemplaza por el rol.
 *
 * **Un lugar puede venir como material.** Antigua recomendada como destino, si
 * no está en tu Codex, llega como Ref con material `place` y el tipo que
 * propuso el modelo aparte: para país y lugares cuenta igual que un territorio.
 * Y los materiales tienen su grupo: películas, libros, música.
 */

const normalizar = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Clave normalizada → nombre para mostrar. Sin «usa» como alias de Estados
// Unidos: en una pista en español es un verbo, y «lugar que usa el transporte»
// terminaba como un post de Estados Unidos.
const PAISES = {
  guatemala: 'Guatemala', mexico: 'México', belice: 'Belice', honduras: 'Honduras',
  'el salvador': 'El Salvador', nicaragua: 'Nicaragua', 'costa rica': 'Costa Rica', panama: 'Panamá',
  cuba: 'Cuba', haiti: 'Haití', 'republica dominicana': 'República Dominicana', 'puerto rico': 'Puerto Rico',
  jamaica: 'Jamaica', colombia: 'Colombia', venezuela: 'Venezuela', ecuador: 'Ecuador', peru: 'Perú',
  bolivia: 'Bolivia', chile: 'Chile', argentina: 'Argentina', uruguay: 'Uruguay', paraguay: 'Paraguay',
  brasil: 'Brasil', guyana: 'Guyana', surinam: 'Surinam', canada: 'Canadá',
  'estados unidos': 'Estados Unidos', eeuu: 'Estados Unidos', 'ee uu': 'Estados Unidos', eua: 'Estados Unidos',
  espana: 'España', francia: 'Francia', alemania: 'Alemania', italia: 'Italia', portugal: 'Portugal',
  'reino unido': 'Reino Unido', irlanda: 'Irlanda', 'paises bajos': 'Países Bajos', holanda: 'Países Bajos',
  belgica: 'Bélgica', suiza: 'Suiza', austria: 'Austria', suecia: 'Suecia', noruega: 'Noruega',
  dinamarca: 'Dinamarca', finlandia: 'Finlandia', polonia: 'Polonia', ucrania: 'Ucrania', rusia: 'Rusia',
  grecia: 'Grecia', turquia: 'Turquía', israel: 'Israel', palestina: 'Palestina', iran: 'Irán', irak: 'Irak',
  siria: 'Siria', libano: 'Líbano', 'arabia saudita': 'Arabia Saudita', 'emiratos arabes unidos': 'Emiratos Árabes Unidos',
  qatar: 'Catar', catar: 'Catar', china: 'China', taiwan: 'Taiwán', japon: 'Japón', 'corea del sur': 'Corea del Sur',
  'corea del norte': 'Corea del Norte', india: 'India', pakistan: 'Pakistán', filipinas: 'Filipinas',
  indonesia: 'Indonesia', vietnam: 'Vietnam', tailandia: 'Tailandia', egipto: 'Egipto', marruecos: 'Marruecos',
  argelia: 'Argelia', nigeria: 'Nigeria', kenia: 'Kenia', etiopia: 'Etiopía', sudafrica: 'Sudáfrica',
  australia: 'Australia', 'nueva zelanda': 'Nueva Zelanda',
};

// De más largo a más corto: «corea del sur» tiene que ganar antes de probar
// nombres más cortos que podrían estar adentro.
const CLAVES_PAIS = Object.keys(PAISES).sort((a, b) => b.length - a.length);

import { MATERIAL } from '../codex/materiales';

const contiene = (texto, termino) => ` ${texto} `.includes(` ${termino} `);

/** El país que nombra un texto, entero o como palabras sueltas adentro. */
function paisEn(texto) {
  const n = normalizar(texto);
  if (!n) return null;
  if (PAISES[n]) return PAISES[n];
  for (const k of CLAVES_PAIS) if (contiene(n, k)) return PAISES[k];
  return null;
}

export const FACETAS = [
  { id: 'pais', titulo: 'país', minimo: 1 },
  { id: 'tema', titulo: 'tema', minimo: 2 },
  { id: 'lugar', titulo: 'lugares', minimo: 2 },
  { id: 'entidad', titulo: 'entidades', minimo: 2 },
  { id: 'actor', titulo: 'actores', minimo: 2 },
  { id: 'material', titulo: 'materiales', minimo: 1 },
];

const veces = (cuerpo, termino) => (termino ? ` ${cuerpo} `.split(` ${termino} `).length - 1 : 0);

/** Si el post trata de esa mención, o solo la nombra de paso. */
function central(m, { territorios, cuerpo, resumen }) {
  if (m?.rol === 'central') return true;
  // «referencia» es como se llamó `de_paso` en los primeros análisis con rol.
  if (m?.rol === 'de_paso' || m?.rol === 'referencia') return false;
  const k = normalizar(m?.texto);
  if (!k) return false;
  return territorios === 1 || contiene(resumen, k) || veces(cuerpo, k) >= 2;
}

/** Territorio, o un lugar que llegó como material. */
function esTerritorio(m) {
  const tipo = m?.codex?.tipo || m?.tipo;
  return tipo === 'Territorio' || m?.tipo_sugerido === 'Territorio' || m?.material === 'place';
}

const vacias = () => Object.fromEntries(FACETAS.map((f) => [f.id, new Map()]));
const SIN_ANALISIS = vacias();

// Por análisis y no por post: el objeto `analysis` cambia de identidad cuando
// cambia su contenido, así que la caché nunca devuelve etiquetas viejas.
const cache = new WeakMap();

/** Qué valores de cada grupo tiene un post: `{ pais: Map(clave → etiqueta), … }`. */
export function etiquetasDe(post) {
  const a = post?.details?.analysis;
  if (!a || typeof a !== 'object') return SIN_ANALISIS;
  if (cache.has(a)) return cache.get(a);

  const e = vacias();
  const menciones = Array.isArray(a.menciones)
    ? a.menciones
    : [
        ...(a.actores || []).map((texto) => ({ texto, tipo: 'Actor' })),
        ...(a.entidades || []).map((texto) => ({ texto, tipo: 'Entidad' })),
      ];

  const contexto = {
    territorios: menciones.filter(esTerritorio).length,
    cuerpo: normalizar(post?.details?.transcription || post?.description || ''),
    resumen: normalizar([a.narrativa, ...(Array.isArray(a.temas) ? a.temas : [])].join(' ')),
  };

  for (const m of menciones) {
    const texto = String(m?.texto || '').trim();
    if (!texto) continue;
    const tipo = String(m?.codex?.tipo || m?.tipo || '');
    // Vinculado al Codex, se agrupa por el elemento: dos formas de nombrarlo
    // en dos posts son la misma cosa.
    const clave = m?.codex?.id ? `codex:${m.codex.id}` : normalizar(texto);
    const etiqueta = m?.codex?.name || texto;

    if (esTerritorio(m)) {
      if (!central(m, contexto)) continue;
      const pais = paisEn(texto) || paisEn(m?.pista);
      if (pais) e.pais.set(normalizar(pais), pais);
      // Un país ya está en su grupo; en lugares van las ciudades, zonas y el resto.
      if (!PAISES[normalizar(texto)]) e.lugar.set(clave, etiqueta);
    } else if (tipo === 'Entidad') {
      e.entidad.set(clave, etiqueta);
    } else if (tipo === 'Actor') {
      e.actor.set(clave, etiqueta);
    }

    // Por clase, no por obra: «posts que citan películas». Cuenta aunque sea de
    // paso, porque citar ya es lo que se busca.
    if (m?.material && MATERIAL[m.material]) e.material.set(m.material, MATERIAL[m.material].plural);
  }

  for (const t of Array.isArray(a.temas) ? a.temas : []) {
    if (typeof t !== 'string') continue;
    const k = normalizar(t);
    if (k && !e.tema.has(k)) e.tema.set(k, t.trim());
  }

  cache.set(a, e);
  return e;
}

/** Los grupos con lo que agrupa en estos posts, de lo más repetido a lo menos. */
export function facetasDe(posts) {
  const cuenta = Object.fromEntries(FACETAS.map((f) => [f.id, new Map()]));

  for (const p of posts || []) {
    const e = etiquetasDe(p);
    for (const f of FACETAS) {
      for (const [clave, etiqueta] of e[f.id]) {
        const v = cuenta[f.id].get(clave) || { clave, etiqueta, posts: 0 };
        v.posts += 1;
        cuenta[f.id].set(clave, v);
      }
    }
  }

  return FACETAS.map((f) => ({
    id: f.id,
    titulo: f.titulo,
    valores: [...cuenta[f.id].values()]
      .filter((v) => v.posts >= f.minimo)
      .sort((x, y) => y.posts - x.posts || x.etiqueta.localeCompare(y.etiqueta, 'es')),
  })).filter((f) => f.valores.length);
}

/** Si un post tiene todo lo elegido: un valor por grupo, y los grupos suman. */
export function cumple(post, seleccion) {
  const e = etiquetasDe(post);
  return Object.entries(seleccion || {}).every(([faceta, clave]) => !clave || !!e[faceta]?.has(clave));
}
