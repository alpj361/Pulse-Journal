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
  evidencia_insuficiente: 'Todavía no hay lecturas',
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
  if (e.requiere_atribucion) out.push('saber quién lo dice');
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
  publicacion_de_cuenta: 'publicado por la cuenta',
  autor_segun_analisis: 'lo dice el autor',
  tercero: 'lo dice otra persona',
  sin_atribucion: 'sin saber quién lo dice',
  atribucion_probable: 'probablemente el autor',
  cita_ambigua: 'la dicen varias voces',
  cita_sin_turno: 'sin turno identificado',
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
  if (!['aceptar', 'descartar'].includes(decision)) return 'Elegí aceptar o descartar.';
  if (decision === 'descartar' && !c) return 'Contá por qué la descartás.';
  if (c.length > MAX_COMENTARIO) return `Hasta ${MAX_COMENTARIO} caracteres.`;
  return null;
}

/** Qué decir ante un error, según el estado HTTP del contrato. */
export function motivoDeError(e) {
  switch (e?.status) {
    case 0:
      return 'Sin conexión. Probá de nuevo.';
    case 401:
      return 'Tu sesión venció. Volvé a entrar.';
    case 403:
      return 'Esta cuenta no tiene huella de autor.';
    case 404:
      return 'Este autor ya no está disponible.';
    case 409:
      return 'La lectura cambió. Ya la estamos recargando.';
    case 422:
      return 'Este tipo de ficha no tiene huella de autor.';
    case 503:
      return 'La huella no está disponible ahora. Probá más tarde.';
    case 400:
      return e?.message || 'No se pudo hacer.';
    default:
      return 'No se pudo cargar. Probá de nuevo.';
  }
}
