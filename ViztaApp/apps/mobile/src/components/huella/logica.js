/**
 * Lógica pura de la huella de autor. Sin red ni React: lo que se prueba en
 * __tests__/logica.test.js.
 *
 * Contrato (ExtractorW, PRs #77 y #83–#87): el GET devuelve `huella_profunda/2`
 * con `impresiones` (resumen), `lectura_breve` y `caracterizacion`; las tarjetas
 * con sus citas vienen de `/impresiones`.
 *
 * Tres cosas distintas que no se mezclan:
 *  · el trabajo (`estado_trabajo`): sin_calcular | pendiente | procesando | error | listo
 *  · la suficiencia (`elegibilidad`): evidencia_insuficiente | parcial
 *  · la madurez de lo observado (`impresiones.madurez`)
 * Terminar el trabajo no completa la huella: `terminal: true` con `huella: null`
 * es un resultado y se muestra lo observado.
 */

export const TRABAJO_EN_CURSO = ['pendiente', 'procesando', 'en_cola'];
export const ENFRIAMIENTO_MS = 30 * 1000;
/** Cada cuánto se vuelve a mirar mientras se calcula, y hasta cuándo. */
export const SONDEO_MS = 4000;
export const SONDEO_MAX_MS = 3 * 60 * 1000;
export const MOTIVO_MIN = 8;
export const MOTIVO_MAX = 2000;

/** El estado del trabajo, venga en `estado_trabajo` o (antes de calcular) en `estado`. */
export const trabajoDe = (r) => r?.estado_trabajo || r?.estado || null;

/** ¿Se está calculando? */
export const enCurso = (r) => !!r && !r.terminal && TRABAJO_EN_CURSO.includes(trabajoDe(r));

/** Lo que hay que mostrar, a partir de la respuesta de GET /:autorId. */
export function situacion(r) {
  if (!r) return 'cargando';
  if (r.terminal || (trabajoDe(r) === 'listo' && r.base_id)) return 'lista';
  if (enCurso(r)) return r.desactualizada ? 'recalculando' : 'calculando';
  if (trabajoDe(r) === 'error') return 'fallo';
  if (trabajoDe(r) === 'sin_calcular') return 'sin_calcular';
  // `listo` sin base: se invalidó entre lecturas; se vuelve a pedir.
  return 'calculando';
}

/** ¿Hay que volver a pedir el GET? Mientras calcula, o si quedó listo sin base. */
export const hayQueSondear = (r) => enCurso(r) || (!!r && !r.terminal && trabajoDe(r) === 'listo');

/** Los niveles de una tarjeta o dimensión, con su peso en el llenado del ícono. */
export const NIVELES = {
  sin_observaciones: { texto: 'Sin observaciones', tono: 'neutro', peso: 0 },
  impresion_inicial: { texto: 'Impresión inicial', tono: 'ambar', peso: 0.25 },
  en_formacion: { texto: 'En formación', tono: 'azul', peso: 0.6 },
  en_revision: { texto: 'En revisión', tono: 'rojo', peso: 0.4 },
  huella_respaldada: { texto: 'Respaldada', tono: 'verde', peso: 1 },
};
const ORDEN_NIVEL = { huella_respaldada: 0, en_formacion: 1, en_revision: 2, impresion_inicial: 3, sin_observaciones: 4 };

/** La madurez de toda la huella. */
export const MADUREZ = {
  sin_observaciones: { texto: 'Sin observaciones', tono: 'neutro' },
  impresiones_iniciales: { texto: 'Impresiones iniciales', tono: 'ambar' },
  en_formacion: { texto: 'En formación', tono: 'azul' },
  dimensiones_respaldadas: { texto: 'Huella respaldada', tono: 'verde' },
};

/**
 * Cuánto se llenó la huella, de 0 a 1: el promedio del nivel de sus partes
 * (temas, voces, posiciones, argumentos, evolución). Una parte respaldada pesa
 * entero; una impresión inicial, un cuarto.
 */
export function llenadoHuella(lecturaBreve) {
  const dims = lecturaBreve?.dimensiones || [];
  if (!dims.length) return 0;
  const suma = dims.reduce((n, d) => n + (NIVELES[d.nivel]?.peso || 0), 0);
  return Math.round(Math.min(1, suma / dims.length) * 100) / 100;
}

/** El nivel de una dimensión de la lectura breve, por su clave. */
export const nivelDimension = (lecturaBreve, clave) =>
  (lecturaBreve?.dimensiones || []).find((d) => d.clave === clave)?.nivel || 'sin_observaciones';

/**
 * Las pestañas: cada una corresponde a una dimensión del contrato. Voces no
 * tiene pestaña propia: quién habla se ve en cada declaración y se filtra ahí.
 */
export const PESTANAS = [
  { id: 'temas', titulo: 'Temas', dimension: 'seleccion_editorial' },
  { id: 'declaraciones', titulo: 'Declaraciones', dimension: 'posiciones' },
  { id: 'argumentos', titulo: 'Argumentos', dimension: 'argumentos' },
  { id: 'tiempo', titulo: 'En el tiempo', dimension: 'evolucion' },
];

/** Las tarjetas repartidas por pestaña, ordenadas. */
export function repartir(tarjetas) {
  const temas = [];
  const declaraciones = [];
  for (const t of tarjetas || []) {
    if (t.clase === 'referencia_tematica') temas.push(t);
    else if (t.clase === 'declaracion_observada' || t.clase === 'lectura_por_dimension') declaraciones.push(t);
  }
  temas.sort((a, b) => publicacionesDe(b) - publicacionesDe(a) || String(a.titulo).localeCompare(String(b.titulo), 'es'));
  declaraciones.sort(
    (a, b) =>
      (a.clase === 'lectura_por_dimension' ? 0 : 1) - (b.clase === 'lectura_por_dimension' ? 0 : 1) ||
      (ORDEN_NIVEL[a.nivel] ?? 9) - (ORDEN_NIVEL[b.nivel] ?? 9) ||
      String(fechaDe(b) || '').localeCompare(String(fechaDe(a) || ''))
  );
  return { temas, declaraciones };
}

/**
 * El árbol temático (`arbol_tematico`, ExtractorW #89–#91): temas principales
 * con sus subtemas, y los que no tienen un grupo validado. Null si todavía no
 * hay árbol; entonces la pestaña usa la lista simple de las tarjetas.
 */
export function arbolDeTemas(arbol) {
  if (!arbol || typeof arbol !== 'object') return null;
  const hoja = (h) => ({
    id: h.id,
    etiqueta: h.etiqueta,
    publicaciones: h.evidencia?.publicaciones ?? (h.evidencia?.posts || []).length,
    posts: h.evidencia?.posts || [],
    citas: (h.evidencia?.citas || []).filter((c) => c?.cita),
    desde: h.evidencia?.desde || null,
  });
  const orden = (a, b) => b.publicaciones - a.publicaciones || String(a.etiqueta).localeCompare(String(b.etiqueta), 'es');
  const grupos = (arbol.grupos || [])
    .filter((g) => g?.etiqueta)
    .map((g) => ({ ...hoja(g), subtemas: (g.subtemas || []).filter((h) => h?.etiqueta).map(hoja).sort(orden) }))
    .sort(orden);
  const sueltos = (arbol.sin_agrupar || []).filter((h) => h?.etiqueta).map(hoja).sort(orden);
  if (!grupos.length && !sueltos.length) return null;
  return { grupos, sueltos, total: grupos.length + sueltos.length };
}

/** Las publicaciones que cita el árbol, para traer sus títulos. */
export const postsDelArbol = (arbol) =>
  [...new Set([...(arbol?.grupos || []).flatMap((g) => [g, ...(g.subtemas || [])]), ...(arbol?.sin_agrupar || [])].flatMap((h) => h?.evidencia?.posts || []))].sort();

/** Publicaciones distintas de las que sale una tarjeta. */
export const publicacionesDe = (t) => new Set((t?.evidencia || []).map((e) => e.post_id).filter(Boolean)).size;
const fechaDe = (t) => (t?.evidencia || []).map((e) => e.fecha).filter(Boolean).sort().at(-1) || null;

/** ¿La dijo la cuenta? Solo cuando todas sus citas están atribuidas a ella. */
export const delAutor = (t) => (t?.evidencia || []).length > 0 && t.evidencia.every((e) => e.atribuida_al_autor);

/**
 * Quién habla en una evidencia, solo si se sabe: la revisión de una persona o
 * la atribución del análisis. Una voz sin identificar no se rotula (null): «H1»
 * es una marca interna de cada publicación y no le dice nada a quien lee.
 */
export function quienHabla(e, revision, nombres = {}) {
  if (revision?.relacion === 'voz_de_cuenta') return { texto: 'Lo dijo la cuenta', tono: 'verde', confirmado: true };
  if (revision?.relacion === 'tercero') {
    const nombre = revision.persona_item_id ? nombres[revision.persona_item_id] : null;
    return { texto: nombre ? `Lo dijo ${nombre}` : ROL[revision.rol] || 'Lo dijo otra persona', tono: 'neutro', confirmado: true };
  }
  if (e?.atribuida_al_autor) return { texto: 'Lo dijo la cuenta', tono: 'verde', confirmado: false };
  return null;
}
const ROL = { invitado: 'Lo dijo un invitado', personaje: 'Lo dijo un personaje', anfitrion: 'Lo dijo otra persona', narrador: 'Lo dijo otra persona' };

/**
 * Las voces que falta identificar, una por publicación y voz: las de las
 * declaraciones que no están atribuidas a la cuenta ni revisadas. Las que más
 * frases tienen van primero (son las que más aportan a la huella).
 */
export function vocesPendientes(tarjetas, identidad) {
  const grupos = new Map();
  for (const t of tarjetas || []) {
    if (t.clase !== 'declaracion_observada') continue;
    for (const e of t.evidencia || []) {
      if (!e.voz_local || !e.post_id || e.atribuida_al_autor || revisionDeVoz(identidad, e.post_id, e.voz_local)) continue;
      const clave = `${e.post_id}|${e.voz_local}`;
      if (!grupos.has(clave)) grupos.set(clave, { clave, post_id: e.post_id, voz: e.voz_local, fecha: e.fecha || null, citas: [] });
      if (e.cita && !grupos.get(clave).citas.includes(e.cita)) grupos.get(clave).citas.push(e.cita);
    }
  }
  return [...grupos.values()].sort((a, b) => b.citas.length - a.citas.length || a.clave.localeCompare(b.clave));
}

/** Los ids de fichas vinculadas a voces, para traer sus nombres. */
export const personasDe = (identidad) =>
  [...new Set(Object.values(identidad?.config?.voces || {}).flatMap((p) => Object.values(p || {}).map((v) => v?.persona_item_id)).filter(Boolean))].sort();

/** Si el contexto sostiene la cita; solo se rotula cuando ya se comprobó. */
export const RESPALDO = {
  respaldada: { texto: 'El contexto la sostiene', tono: 'verde' },
  no_respaldada: { texto: 'El contexto no la sostiene', tono: 'rojo' },
};

/** Lo que le falta a una tarjeta, en palabras (`faltantes` del contrato). */
export const FALTANTE = {
  atribucion_insuficiente: 'saber quién lo dice',
  respaldo_pendiente: 'comprobarla en su contexto',
  independencia_no_resuelta: 'saber si las fuentes son ocasiones distintas',
  fechas_incompletas: 'las fechas de las fuentes',
  politica_no_calibrada: 'un criterio de suficiencia calibrado',
  ocasiones_insuficientes: 'más ocasiones independientes',
  periodo_insuficiente: 'más tiempo cubierto',
  contraevidencia_pendiente: 'revisar la evidencia en contra',
  revision_de_etiqueta: 'revisar la etiqueta del análisis',
};
export const faltaDe = (t) => (t?.faltantes || []).map((f) => FALTANTE[f]).filter(Boolean);

/**
 * Las respuestas a «¿quién habla?» (`identidad/voz`). `ficha` pide elegir la
 * persona en el Codex: así lo que dice suma a su propia huella.
 */
export const OPCIONES_VOZ = [
  { id: 'cuenta', texto: 'La cuenta', relacion: 'voz_de_cuenta', rol: 'anfitrion' },
  { id: 'ficha', texto: 'Una persona de tu Codex', relacion: 'tercero', rol: 'invitado', ficha: true },
  { id: 'otra', texto: 'Otra persona, sin ficha', relacion: 'tercero', rol: 'invitado' },
  { id: 'personaje', texto: 'Un personaje o una actuación', relacion: 'tercero', rol: 'personaje' },
];

/** Cómo lo sabe quien identifica: queda como motivo de la revisión. */
export const MOTIVOS_VOZ = ['Se presenta por su nombre', 'Aparece a cámara', 'Reconozco su voz', 'Lo dice la publicación'];

/** La revisión guardada de una voz, si hay (`identidad.config.voces[post][voz]`). */
export const revisionDeVoz = (identidad, postId, voz) => (postId && voz ? identidad?.config?.voces?.[postId]?.[voz] || null : null);

/** Una revisión de identidad válida antes de mandarla (el servidor valida igual). */
export function validarMotivo(motivo) {
  const m = String(motivo || '').trim();
  if (m.length < MOTIVO_MIN) return `Escribe cómo lo sabes (al menos ${MOTIVO_MIN} caracteres).`;
  if (m.length > MOTIVO_MAX) return `Hasta ${MOTIVO_MAX} caracteres.`;
  return null;
}

/** Los argumentos explícitos (`caracterizacion.argumentos[].faceta`). */
export const FACETAS = {
  problema: 'Plantea un problema',
  causa: 'Señala una causa',
  responsabilidad: 'Atribuye responsabilidad',
  solucion: 'Propone una solución',
  derechos: 'Invoca derechos',
  legalidad: 'Invoca la ley',
  costos: 'Habla de costos',
  dato: 'Usa datos',
  testimonio: 'Usa testimonios',
  autoridad: 'Apela a una autoridad',
};

/** Cómo se relacionan dos intervenciones en el tiempo (`evolucion.eventos[].tipo`). */
export const TRAYECTORIA = {
  recurrencia_en_fuentes: { texto: 'Se repite en varias fuentes', tono: 'neutro' },
  recurrencia_observada: { texto: 'La cuenta lo repite', tono: 'verde' },
  independencia_pendiente: { texto: 'Falta saber si son ocasiones distintas', tono: 'ambar' },
  diferencia_sin_atribucion_personal: { texto: 'Difieren, sin atribuirlo a la cuenta', tono: 'neutro' },
  tension_contextual_por_revisar: { texto: 'Tensión por revisar', tono: 'ambar' },
  posible_cambio_de_posicion: { texto: 'Posible cambio de posición', tono: 'rojo' },
  pendiente_de_fechas: { texto: 'Faltan fechas para ordenarlas', tono: 'ambar' },
};

/** Publicaciones con fecha, de las que aparecen en las tarjetas: { con, total }. */
export function fechasCubiertas(tarjetas) {
  const posts = new Map();
  for (const t of tarjetas || [])
    for (const e of t.evidencia || []) if (e.post_id) posts.set(e.post_id, posts.get(e.post_id) || !!e.fecha);
  return { con: [...posts.values()].filter(Boolean).length, total: posts.size };
}

/** Los ids de publicación que citan las tarjetas, para traer sus títulos. */
export const postsDe = (tarjetas) => [...new Set((tarjetas || []).flatMap((t) => (t.evidencia || []).map((e) => e.post_id)).filter(Boolean))].sort();

/** Fecha de publicación; sin fecha no se inventa (la de análisis no la reemplaza). */
export function fechaPublicacion(iso) {
  if (!iso) return 'sin fecha';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'sin fecha';
  return d.toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Segundos que faltan para poder volver a pedir la actualización. */
export const enfriamientoRestante = (ultimoPedido, ahora = Date.now()) =>
  ultimoPedido ? Math.max(0, Math.ceil((ENFRIAMIENTO_MS - (ahora - ultimoPedido)) / 1000)) : 0;

/** Qué decir ante un error, según el estado HTTP y el código del contrato. */
export function motivoDeError(e) {
  if (e?.code === 'voz_sin_insumo') return 'Esa voz no está identificada de forma única en la publicación.';
  if (e?.code === 'huella_desactivada') return 'Los cambios en la huella están desactivados por ahora.';
  switch (e?.status) {
    case 0:
      return 'Sin conexión a internet.';
    case 401:
      return 'La sesión venció. Hay que volver a entrar.';
    case 403:
      return 'Esta cuenta no tiene huella de autor.';
    case 404:
      return 'Este autor ya no está disponible.';
    case 409:
      return 'La huella cambió mientras se veía. Se está recargando.';
    case 422:
      return 'Este tipo de ficha no tiene huella de autor.';
    case 503:
      return 'La huella no está disponible en este momento.';
    case 400:
      return e?.message || 'No se pudo hacer.';
    default:
      return 'No se pudo cargar la huella.';
  }
}
