/**
 * Lógica pura de la huella de autor (`autor_huella/1`). Sin red ni React: lo
 * que se prueba en __tests__/logica.test.js.
 *
 * Dos estados distintos que no se mezclan:
 *  · el del trabajo: sin_calcular | pendiente | procesando | error | listo
 *  · el del perfil (solo con huella vigente): evidencia_insuficiente |
 *    lectura_inicial | patron_respaldado
 */

export const TRABAJO_EN_CURSO = ['pendiente', 'procesando'];
export const ENFRIAMIENTO_MS = 30 * 1000;
/** Cada cuánto se vuelve a mirar mientras se calcula, y hasta cuándo. */
export const SONDEO_MS = 4000;
export const SONDEO_MAX_MS = 3 * 60 * 1000;
export const MAX_COMENTARIO = 2000;

/** ¿Se está calculando? (sin huella vigente y con trabajo en cola o en curso). */
export const enCurso = (r) => !!r && !r.huella && TRABAJO_EN_CURSO.includes(r.estado);

/** Lo que hay que mostrar, a partir de la respuesta de GET /:autorId. */
export function situacion(r) {
  if (!r) return 'cargando';
  if (r.huella) return 'vigente';
  if (enCurso(r)) return r.desactualizada ? 'recalculando' : 'calculando';
  if (r.estado === 'error') return 'fallo';
  if (r.estado === 'sin_calcular') return 'sin_calcular';
  // `listo` sin huella: se invalidó entre lecturas; se vuelve a pedir.
  return 'calculando';
}

export const PERFIL = {
  evidencia_insuficiente: 'Sin datos suficientes',
  lectura_inicial: 'Lectura inicial',
  patron_respaldado: 'Patrón respaldado',
};

/**
 * Las tres clases de lectura. Cada una dice algo distinto y no se confunden:
 * un tema es de qué publica; una narrativa aparece en lo publicado pero no es
 * suya; una postura es lo que se le atribuye con cita y voz identificada.
 */
export const CLASES = {
  tema_editorial: { titulo: 'Temas que publica', singular: 'tema' },
  narrativa_publicada: { titulo: 'Narrativas en lo que publica', singular: 'narrativa' },
  postura_atribuida: { titulo: 'Posturas atribuidas', singular: 'postura' },
};
export const ORDEN_CLASES = ['postura_atribuida', 'tema_editorial', 'narrativa_publicada'];

/** Las lecturas por clase, en orden; las más respaldadas primero dentro de cada una. */
export function porClase(lecturas) {
  const grupos = new Map(ORDEN_CLASES.map((c) => [c, []]));
  for (const l of lecturas || []) {
    if (!grupos.has(l.clase)) grupos.set(l.clase, []);
    grupos.get(l.clase).push(l);
  }
  for (const lista of grupos.values()) {
    lista.sort(
      (a, b) =>
        (b.estado === 'patron_respaldado') - (a.estado === 'patron_respaldado') ||
        (b.respaldo?.posts || 0) - (a.respaldo?.posts || 0) ||
        String(a.tema || '').localeCompare(String(b.tema || ''), 'es')
    );
  }
  return [...grupos].filter(([, l]) => l.length).map(([clase, lecturas]) => ({ clase, lecturas }));
}

const SENTIDO = { a_favor: 'a favor', en_contra: 'en contra', informa: 'informa', mixto: 'mixto' };

/** El nombre corto de una lectura: el tema, y hacia qué/quién y en qué sentido si los tiene. */
export function nombreLectura(l) {
  const tema = l?.tema || 'Sin tema';
  if (l?.clase === 'tema_editorial') return tema;
  // «libertad religiosa · a favor libertad religiosa»: el «hacia» igual al tema no se repite.
  const igual = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const partes = [SENTIDO[l?.sentido], igual(l?.hacia, tema) ? null : l?.hacia].filter(Boolean);
  return partes.length ? `${tema} · ${partes.join(' ')}` : tema;
}

/** «4 publicaciones · 12 días», o «1 publicación». */
export function respaldoCorto(r) {
  const n = r?.posts || 0;
  const pubs = `${n} ${n === 1 ? 'publicación' : 'publicaciones'}`;
  return r?.dias > 0 ? `${pubs} · ${r.dias} ${r.dias === 1 ? 'día' : 'días'}` : pubs;
}

/** Qué le falta a una lectura para ser un patrón, en palabras. Vacío si nada. */
export function falta(l) {
  const e = l?.evidencia_necesaria || {};
  if (l?.estado === 'patron_respaldado') return [];
  const out = [];
  if (e.requiere_atribucion) out.push('confirmar quién lo dijo');
  if (e.posts_adicionales_minimos > 0) {
    out.push(`${e.posts_adicionales_minimos} ${e.posts_adicionales_minimos === 1 ? 'publicación más' : 'publicaciones más'}`);
  }
  if (e.requiere_fechas) out.push('fechas de publicación');
  if (e.requiere_cobertura_temporal) out.push('más tiempo entre publicaciones');
  if (e.requiere_identidad) out.push('confirmar la cuenta');
  return out;
}

/** Quién dice la cita de una evidencia. */
export const ATRIBUCION = {
  publicacion_de_cuenta: 'Publicado por la cuenta',
  autor_segun_analisis: 'Lo dijo el autor',
  tercero: 'Lo dijo otra persona',
  sin_atribucion: 'No se sabe quién lo dijo',
  atribucion_probable: 'Probablemente el autor, sin confirmar',
  cita_ambigua: 'Hablan varias personas',
  cita_sin_turno: 'No se distingue quién habla',
};

/** Fecha de publicación; sin fecha no se inventa (la de análisis no la reemplaza). */
export function fechaPublicacion(iso) {
  if (!iso) return 'fecha desconocida';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'fecha desconocida';
  return d.toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Segundos que faltan para poder volver a pedir la actualización. */
export const enfriamientoRestante = (ultimoPedido, ahora = Date.now()) =>
  ultimoPedido ? Math.max(0, Math.ceil((ENFRIAMIENTO_MS - (ahora - ultimoPedido)) / 1000)) : 0;

/** Una corrección válida antes de mandarla (el servidor valida igual). */
export function validarCorreccion({ decision, comentario }) {
  const c = String(comentario || '').trim();
  if (!['aceptar', 'descartar'].includes(decision)) return 'Falta elegir si es correcta o no.';
  if (decision === 'descartar' && !c) return 'Falta escribir por qué no es correcta.';
  if (c.length > MAX_COMENTARIO) return `Hasta ${MAX_COMENTARIO} caracteres.`;
  return null;
}

/** Qué decir ante un error, según el estado HTTP del contrato. */
export function motivoDeError(e) {
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

/**
 * Los pasos para que un tema llegue a patrón, con cómo va este autor. Salen
 * de `reglas.tema_editorial` y la cobertura del perfil (criterio provisional).
 */
export function pasosPatron(perfil) {
  const regla = perfil?.reglas?.tema_editorial || { posts_patron: 4, dias_patron: 7 };
  const c = perfil?.cobertura || {};
  const temas = (perfil?.lecturas || []).filter((l) => l.clase === 'tema_editorial');
  const mejor = Math.max(0, ...temas.map((t) => t.respaldo?.posts || 0));
  const posts = c.posts || 0;
  const conFecha = c.con_fecha || 0;
  return [
    {
      clave: 'publicaciones',
      titulo: `${regla.posts_patron} publicaciones sobre un mismo tema`,
      ok: mejor >= regla.posts_patron,
      detalle: mejor >= regla.posts_patron ? 'Listo' : `El tema con más publicaciones tiene ${mejor}`,
      avance: Math.min(1, mejor / regla.posts_patron),
    },
    {
      clave: 'tiempo',
      titulo: `${regla.dias_patron} días entre la primera y la última`,
      ok: (c.dias || 0) >= regla.dias_patron,
      detalle:
        (c.dias || 0) >= regla.dias_patron
          ? 'Listo'
          : posts < 2
            ? 'Con una sola publicación no hay tiempo que medir'
            : conFecha < 2
              ? 'Sin fechas de publicación no se puede medir'
              : `Sus publicaciones abarcan ${c.dias} ${c.dias === 1 ? 'día' : 'días'}`,
      avance: Math.min(1, (c.dias || 0) / regla.dias_patron),
    },
    {
      clave: 'fechas',
      titulo: 'Fecha de publicación en cada una',
      ok: posts > 0 && conFecha === posts,
      detalle: posts > 0 && conFecha === posts ? 'Todas tienen fecha' : `${posts - conFecha} de ${posts} no tienen fecha`,
      avance: posts ? conFecha / posts : 0,
    },
    {
      clave: 'cuenta',
      titulo: 'Cuenta confirmada',
      ok: perfil?.autor?.usuario_confirmado === true,
      detalle: perfil?.autor?.usuario_confirmado === true ? 'Listo' : 'Falta confirmar que la cuenta es de quien dice ser',
      avance: perfil?.autor?.usuario_confirmado === true ? 1 : 0,
    },
  ];
}

/** Cuánto le falta a un tema para el umbral de publicaciones: {tiene, meta, avance}. */
export function avanceTema(l, perfil) {
  const meta = perfil?.reglas?.tema_editorial?.posts_patron || 4;
  const tiene = l?.respaldo?.posts || 0;
  return { tiene, meta, avance: Math.min(1, tiene / meta) };
}

export const SENTIDOS = {
  a_favor: { texto: 'A favor', tono: 'verde' },
  en_contra: { texto: 'En contra', tono: 'rojo' },
  informa: { texto: 'Informa', tono: 'azul' },
  mixto: { texto: 'Mixto', tono: 'neutro' },
};

export const EJES = { politico: 'político', economico: 'económico', social: 'social', cultural: 'cultural', especifico: 'específico' };

/**
 * Cuánto se llenó la huella, de 0 a 1: lo que dibuja el ícono grande. Pesa más
 * lo que más cuesta juntar (publicaciones sobre un tema y tiempo cubierto) que
 * lo que se resuelve de una vez (fechas, cuenta confirmada).
 */
export function llenadoHuella(perfil) {
  if (!perfil) return 0;
  if (perfil.estado === 'patron_respaldado') return 1;
  const PESO = { publicaciones: 0.45, tiempo: 0.35, fechas: 0.1, cuenta: 0.1 };
  const total = pasosPatron(perfil).reduce((n, p) => n + (PESO[p.clave] || 0) * p.avance, 0);
  return Math.round(Math.min(1, total) * 100) / 100;
}
